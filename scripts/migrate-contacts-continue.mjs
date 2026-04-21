/**
 * CONTINUATION migration: processes contacts that still have phoneNumber=NULL
 * but have records in contactPhones. Also handles unmigrated emails.
 * Uses batch processing with reconnection for reliability.
 */
import mysql from 'mysql2/promise';

const BATCH_SIZE = 100;

async function getConnection() {
  return mysql.createConnection(process.env.DATABASE_URL);
}

async function migratePhones() {
  let conn = await getConnection();
  console.log('=== PHASE 1: Migrate unmigrated phones ===');
  
  // Get all contacts that have phones in contactPhones but phoneNumber is still NULL
  const [unmigrated] = await conn.query(`
    SELECT DISTINCT c.id FROM contacts c
    INNER JOIN contactPhones cp ON c.id = cp.contactId
    WHERE c.phoneNumber IS NULL
    ORDER BY c.id
  `);
  console.log(`Found ${unmigrated.length} contacts with unmigrated phones`);
  
  let processed = 0;
  let newCreated = 0;
  let errors = 0;
  
  for (let i = 0; i < unmigrated.length; i++) {
    const contactId = unmigrated[i].id;
    
    try {
      // Reconnect every BATCH_SIZE to avoid timeout
      if (i > 0 && i % BATCH_SIZE === 0) {
        await conn.end();
        conn = await getConnection();
        console.log(`  Progress: ${i}/${unmigrated.length} (${newCreated} new contacts created)`);
      }
      
      // Get the contact
      const [[contact]] = await conn.query('SELECT * FROM contacts WHERE id = ?', [contactId]);
      if (!contact) continue;
      
      // Get phones ordered by isPrimary DESC
      const [phones] = await conn.query(
        'SELECT * FROM contactPhones WHERE contactId = ? ORDER BY isPrimary DESC, id ASC',
        [contactId]
      );
      if (phones.length === 0) continue;
      
      // First phone goes to the original contact
      const firstPhone = phones[0];
      await conn.query(
        `UPDATE contacts SET 
          phoneNumber = ?, phoneType = ?, contactType = 'phone',
          carrier = ?, activityStatus = ?, isPrepaid = ?,
          trestleScore = ?, trestleLineType = ?, trestleLastChecked = ?,
          dnc = ?
        WHERE id = ?`,
        [
          firstPhone.phoneNumber, firstPhone.phoneType || 'Mobile',
          firstPhone.carrier, firstPhone.activityStatus, firstPhone.isPrepaid || 0,
          firstPhone.trestleScore, firstPhone.trestleLineType, firstPhone.trestleLastChecked,
          firstPhone.dnc || 0,
          contact.id
        ]
      );
      
      // Additional phones create new contact records
      for (let j = 1; j < phones.length; j++) {
        const phone = phones[j];
        const [result] = await conn.query(
          `INSERT INTO contacts (
            propertyId, name, relationship, age, deceased, currentAddress, flags,
            firstName, lastName, middleInitial, generationalSuffix, gender,
            maritalStatus, netAssetValue, homeBusiness, educationModel,
            occupationGroup, occupationCode, businessOwner, notes, dealMachineContactId,
            phoneNumber, phoneType, contactType,
            carrier, activityStatus, isPrepaid, trestleScore, trestleLineType, trestleLastChecked,
            isDecisionMaker, dnc, isLitigator, hidden,
            currentResident, contacted, contactedDate, onBoard, notOnBoard, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'phone', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            contact.propertyId, contact.name, contact.relationship, contact.age,
            contact.deceased, contact.currentAddress, contact.flags,
            contact.firstName, contact.lastName, contact.middleInitial,
            contact.generationalSuffix, contact.gender, contact.maritalStatus,
            contact.netAssetValue, contact.homeBusiness, contact.educationModel,
            contact.occupationGroup, contact.occupationCode, contact.businessOwner,
            contact.notes, contact.dealMachineContactId,
            phone.phoneNumber, phone.phoneType || 'Mobile',
            phone.carrier, phone.activityStatus, phone.isPrepaid || 0,
            phone.trestleScore, phone.trestleLineType, phone.trestleLastChecked,
            contact.isDecisionMaker, phone.dnc || 0, phone.isLitigator || contact.isLitigator || 0,
            contact.hidden, contact.currentResident, contact.contacted,
            contact.contactedDate, contact.onBoard, contact.notOnBoard, contact.sortOrder
          ]
        );
        
        const newContactId = result.insertId;
        await conn.query('UPDATE contactPhones SET contactId = ? WHERE id = ?', [newContactId, phone.id]);
        newCreated++;
      }
      
      processed++;
    } catch (err) {
      console.error(`  ERROR on contact ${contactId}:`, err.message);
      errors++;
      // Reconnect on error
      try { await conn.end(); } catch(e) {}
      conn = await getConnection();
    }
  }
  
  console.log(`Phase 1 done: ${processed} contacts processed, ${newCreated} new created, ${errors} errors`);
  await conn.end();
  return { processed, newCreated, errors };
}

async function migrateEmails() {
  let conn = await getConnection();
  console.log('\n=== PHASE 2: Migrate unmigrated emails ===');
  
  // Get contacts that have emails in contactEmails but email is still NULL on the contact
  const [unmigrated] = await conn.query(`
    SELECT DISTINCT c.id FROM contacts c
    INNER JOIN contactEmails ce ON c.id = ce.contactId
    WHERE c.email IS NULL
    ORDER BY c.id
  `);
  console.log(`Found ${unmigrated.length} contacts with unmigrated emails`);
  
  let processed = 0;
  let newCreated = 0;
  let errors = 0;
  
  for (let i = 0; i < unmigrated.length; i++) {
    const contactId = unmigrated[i].id;
    
    try {
      if (i > 0 && i % BATCH_SIZE === 0) {
        await conn.end();
        conn = await getConnection();
        console.log(`  Progress: ${i}/${unmigrated.length} (${newCreated} new email contacts created)`);
      }
      
      const [[contact]] = await conn.query('SELECT * FROM contacts WHERE id = ?', [contactId]);
      if (!contact) continue;
      
      const [emails] = await conn.query(
        'SELECT * FROM contactEmails WHERE contactId = ? ORDER BY isPrimary DESC, id ASC',
        [contactId]
      );
      if (emails.length === 0) continue;
      
      // For contacts that already have a phone (contactType='phone'), ALL emails create new records
      // For contacts without phone (contactType='phone' but phoneNumber IS NULL), first email goes to original
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
        // No phone — first email goes to original, rest create new
        const firstEmail = emails[0];
        await conn.query(
          `UPDATE contacts SET email = ?, contactType = 'email' WHERE id = ?`,
          [firstEmail.email, contact.id]
        );
        
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
  
  console.log(`Phase 2 done: ${processed} contacts processed, ${newCreated} new created, ${errors} errors`);
  await conn.end();
  return { processed, newCreated, errors };
}

async function validate() {
  const conn = await getConnection();
  console.log('\n=== VALIDATION ===');
  
  const [[{total}]] = await conn.query('SELECT COUNT(*) as total FROM contacts');
  const [[{withPhone}]] = await conn.query('SELECT COUNT(*) as withPhone FROM contacts WHERE phoneNumber IS NOT NULL');
  const [[{withEmail}]] = await conn.query('SELECT COUNT(*) as withEmail FROM contacts WHERE email IS NOT NULL');
  const [[{noPhoneNoEmail}]] = await conn.query('SELECT COUNT(*) as noPhoneNoEmail FROM contacts WHERE phoneNumber IS NULL AND email IS NULL');
  const [[{stillUnmigPhone}]] = await conn.query('SELECT COUNT(DISTINCT c.id) as stillUnmigPhone FROM contacts c INNER JOIN contactPhones cp ON c.id = cp.contactId WHERE c.phoneNumber IS NULL');
  const [[{stillUnmigEmail}]] = await conn.query('SELECT COUNT(DISTINCT c.id) as stillUnmigEmail FROM contacts c INNER JOIN contactEmails ce ON c.id = ce.contactId WHERE c.email IS NULL');
  
  console.log('Total contacts:', total);
  console.log('With phone:', withPhone);
  console.log('With email:', withEmail);
  console.log('No phone/no email:', noPhoneNoEmail);
  console.log('Still unmigrated phones:', stillUnmigPhone);
  console.log('Still unmigrated emails:', stillUnmigEmail);
  
  if (stillUnmigPhone === 0 && stillUnmigEmail === 0) {
    console.log('\n✅ ALL CONTACTS MIGRATED SUCCESSFULLY');
  } else {
    console.log('\n⚠️  Some contacts still need migration - run again');
  }
  
  await conn.end();
}

async function main() {
  const phoneResult = await migratePhones();
  const emailResult = await migrateEmails();
  await validate();
  
  console.log('\n=== SUMMARY ===');
  console.log('Phones:', phoneResult);
  console.log('Emails:', emailResult);
}

main().catch(err => {
  console.error('MIGRATION FAILED:', err);
  process.exit(1);
});
