/**
 * Run ONLY Phase 2: Migrate unmigrated emails from contactEmails table
 * into individual contact records (1 contact = 1 email).
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const BATCH_SIZE = 100;

async function getConnection() {
  return mysql.createConnection(process.env.DATABASE_URL);
}

async function migrateEmails() {
  let conn = await getConnection();
  console.log('=== PHASE 2: Migrate unmigrated emails ===');
  
  const [unmigrated] = await conn.query(`
    SELECT DISTINCT c.id FROM contacts c
    INNER JOIN contactEmails ce ON c.id = ce.contactId
    WHERE c.email IS NULL
    ORDER BY c.id
  `);
  console.log(`Found ${unmigrated.length} contacts with unmigrated emails`);
  
  if (unmigrated.length === 0) {
    console.log('No unmigrated emails found. Done!');
    await conn.end();
    return;
  }
  
  let processed = 0;
  let newCreated = 0;
  let updatedOriginal = 0;
  let errors = 0;
  
  for (let i = 0; i < unmigrated.length; i++) {
    const contactId = unmigrated[i].id;
    
    try {
      if (i > 0 && i % BATCH_SIZE === 0) {
        await conn.end();
        conn = await getConnection();
        console.log(`  Progress: ${i}/${unmigrated.length} (${newCreated} new email contacts created, ${updatedOriginal} originals updated)`);
      }
      
      const [[contact]] = await conn.query('SELECT * FROM contacts WHERE id = ?', [contactId]);
      if (!contact) continue;
      
      const [emails] = await conn.query(
        'SELECT * FROM contactEmails WHERE contactId = ? ORDER BY isPrimary DESC, id ASC',
        [contactId]
      );
      if (emails.length === 0) continue;
      
      if (contact.phoneNumber) {
        // Has phone — all emails create new contact records
        for (const emailRecord of emails) {
          const [result] = await conn.query(
            `INSERT INTO contacts (
              propertyId, name, relationship, age, deceased, currentAddress, flags,
              firstName, lastName, middleInitial, generationalSuffix, gender,
              maritalStatus, netAssetValue, homeBusiness, educationModel,
              occupationGroup, occupationCode, businessOwner, notes, dealMachineContactId,
              email, contactType,
              isDecisionMaker, dnc, isLitigator, hidden,
              currentResident, contacted, contactedDate, onBoard, notOnBoard, sortOrder
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              contact.propertyId, contact.name, contact.relationship, contact.age,
              contact.deceased, contact.currentAddress, contact.flags,
              contact.firstName, contact.lastName, contact.middleInitial,
              contact.generationalSuffix, contact.gender, contact.maritalStatus,
              contact.netAssetValue, contact.homeBusiness, contact.educationModel,
              contact.occupationGroup, contact.occupationCode, contact.businessOwner,
              contact.notes, contact.dealMachineContactId,
              emailRecord.email,
              contact.isDecisionMaker, contact.dnc, contact.isLitigator,
              contact.hidden, contact.currentResident, contact.contacted,
              contact.contactedDate, contact.onBoard, contact.notOnBoard, contact.sortOrder
            ]
          );
          const newContactId = result.insertId;
          await conn.query('UPDATE contactEmails SET contactId = ? WHERE id = ?', [newContactId, emailRecord.id]);
          newCreated++;
        }
      } else {
        // No phone — first email goes to original contact, rest create new
        const firstEmail = emails[0];
        await conn.query(
          `UPDATE contacts SET email = ?, contactType = 'email' WHERE id = ?`,
          [firstEmail.email, contact.id]
        );
        updatedOriginal++;
        
        for (let j = 1; j < emails.length; j++) {
          const emailRecord = emails[j];
          const [result] = await conn.query(
            `INSERT INTO contacts (
              propertyId, name, relationship, age, deceased, currentAddress, flags,
              firstName, lastName, middleInitial, generationalSuffix, gender,
              maritalStatus, netAssetValue, homeBusiness, educationModel,
              occupationGroup, occupationCode, businessOwner, notes, dealMachineContactId,
              email, contactType,
              isDecisionMaker, dnc, isLitigator, hidden,
              currentResident, contacted, contactedDate, onBoard, notOnBoard, sortOrder
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              contact.propertyId, contact.name, contact.relationship, contact.age,
              contact.deceased, contact.currentAddress, contact.flags,
              contact.firstName, contact.lastName, contact.middleInitial,
              contact.generationalSuffix, contact.gender, contact.maritalStatus,
              contact.netAssetValue, contact.homeBusiness, contact.educationModel,
              contact.occupationGroup, contact.occupationCode, contact.businessOwner,
              contact.notes, contact.dealMachineContactId,
              emailRecord.email,
              contact.isDecisionMaker, contact.dnc, contact.isLitigator,
              contact.hidden, contact.currentResident, contact.contacted,
              contact.contactedDate, contact.onBoard, contact.notOnBoard, contact.sortOrder
            ]
          );
          const newContactId = result.insertId;
          await conn.query('UPDATE contactEmails SET contactId = ? WHERE id = ?', [newContactId, emailRecord.id]);
          newCreated++;
        }
      }
      
      processed++;
    } catch (err) {
      console.error(`  ERROR on contact ${contactId}:`, err.message);
      errors++;
      try { await conn.end(); } catch(e) {}
      conn = await getConnection();
    }
  }
  
  console.log(`\nPhase 2 COMPLETE: ${processed} contacts processed, ${newCreated} new email contacts created, ${updatedOriginal} originals updated, ${errors} errors`);
  await conn.end();
  
  // Validate
  const conn2 = await getConnection();
  const [[{total}]] = await conn2.query('SELECT COUNT(*) as total FROM contacts');
  const [[{withPhone}]] = await conn2.query('SELECT COUNT(*) as withPhone FROM contacts WHERE phoneNumber IS NOT NULL AND phoneNumber != ""');
  const [[{withEmail}]] = await conn2.query('SELECT COUNT(*) as withEmail FROM contacts WHERE email IS NOT NULL AND email != ""');
  const [types] = await conn2.query('SELECT contactType, COUNT(*) as cnt FROM contacts GROUP BY contactType');
  const [[{stillUnmigrated}]] = await conn2.query(`
    SELECT COUNT(DISTINCT c.id) as stillUnmigrated 
    FROM contacts c 
    INNER JOIN contactEmails ce ON c.id = ce.contactId 
    WHERE c.email IS NULL
  `);
  
  console.log('\n=== FINAL STATE ===');
  console.log('Total contacts:', total);
  console.log('With phone:', withPhone);
  console.log('With email:', withEmail);
  console.log('Contact types:', JSON.stringify(types));
  console.log('Still unmigrated emails:', stillUnmigrated);
  
  await conn2.end();
}

migrateEmails().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
