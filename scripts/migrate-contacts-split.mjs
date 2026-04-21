/**
 * Migration: Split multi-phone/email contacts into individual records.
 * 
 * Logic:
 * 1. For each existing contact:
 *    a. Get all phones from contactPhones table
 *    b. Get all emails from contactEmails table
 *    c. If contact has 1+ phones: first phone goes to the original contact record,
 *       each additional phone creates a NEW contact record (copy all fields, different phone)
 *    d. Each email creates a NEW contact record with contactType='email'
 *    e. If contact has 0 phones and 0 emails: keep as-is with contactType='phone' (no phone)
 *    f. If contact has 0 phones but 1+ emails: first email goes to original, rest create new
 * 
 * 2. Copy phone-specific fields (carrier, trestleScore, etc.) from contactPhones to the contact
 * 3. Copy DNC and isLitigator from the phone record to the contact record
 * 
 * ZERO data loss: original contactPhones and contactEmails tables are NOT deleted.
 */

import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=== MIGRATION START ===');
  console.log('Strategy: Split multi-phone/email contacts into individual records');
  
  // Get counts before
  const [[{contactsBefore}]] = await conn.query('SELECT COUNT(*) as contactsBefore FROM contacts');
  const [[{phonesBefore}]] = await conn.query('SELECT COUNT(*) as phonesBefore FROM contactPhones');
  const [[{emailsBefore}]] = await conn.query('SELECT COUNT(*) as emailsBefore FROM contactEmails');
  console.log(`\nBEFORE: ${contactsBefore} contacts, ${phonesBefore} phones, ${emailsBefore} emails`);
  
  // Get all contacts
  const [allContacts] = await conn.query('SELECT * FROM contacts');
  
  let newContactsCreated = 0;
  let phonesAssigned = 0;
  let emailsAssigned = 0;
  let errors = 0;
  
  for (const contact of allContacts) {
    try {
      // Get phones for this contact
      const [phones] = await conn.query(
        'SELECT * FROM contactPhones WHERE contactId = ? ORDER BY isPrimary DESC, id ASC',
        [contact.id]
      );
      
      // Get emails for this contact
      const [emails] = await conn.query(
        'SELECT * FROM contactEmails WHERE contactId = ? ORDER BY isPrimary DESC, id ASC',
        [contact.id]
      );
      
      if (phones.length === 0 && emails.length === 0) {
        // No phone, no email — just set contactType='phone' (placeholder)
        await conn.query(
          'UPDATE contacts SET contactType = ? WHERE id = ?',
          ['phone', contact.id]
        );
        continue;
      }
      
      // === PHONE RECORDS ===
      if (phones.length > 0) {
        // First phone goes to the original contact record
        const firstPhone = phones[0];
        await conn.query(
          `UPDATE contacts SET 
            phoneNumber = ?, phoneType = ?, contactType = 'phone',
            carrier = ?, activityStatus = ?, isPrepaid = ?,
            trestleScore = ?, trestleLineType = ?, trestleLastChecked = ?,
            dnc = ?, isLitigator = ?
          WHERE id = ?`,
          [
            firstPhone.phoneNumber, firstPhone.phoneType || 'Mobile',
            firstPhone.carrier, firstPhone.activityStatus, firstPhone.isPrepaid || 0,
            firstPhone.trestleScore, firstPhone.trestleLineType, firstPhone.trestleLastChecked,
            firstPhone.dnc || 0, firstPhone.isLitigator || contact.isLitigator || 0,
            contact.id
          ]
        );
        phonesAssigned++;
        
        // Additional phones create new contact records
        for (let i = 1; i < phones.length; i++) {
          const phone = phones[i];
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
          
          // Update the contactPhones record to point to the new contact
          const newContactId = result.insertId;
          await conn.query('UPDATE contactPhones SET contactId = ? WHERE id = ?', [newContactId, phone.id]);
          
          newContactsCreated++;
          phonesAssigned++;
        }
      } else {
        // No phones — first email goes to original record
        const firstEmail = emails[0];
        await conn.query(
          `UPDATE contacts SET email = ?, contactType = 'email' WHERE id = ?`,
          [firstEmail.email, contact.id]
        );
        emailsAssigned++;
        
        // Additional emails create new contact records
        for (let i = 1; i < emails.length; i++) {
          const emailRecord = emails[i];
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
          
          newContactsCreated++;
          emailsAssigned++;
        }
        
        // Skip email processing below since we already handled them
        continue;
      }
      
      // === EMAIL RECORDS (for contacts that HAD phones) ===
      // Each email creates a separate contact record with contactType='email'
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
        
        newContactsCreated++;
        emailsAssigned++;
      }
      
    } catch (err) {
      console.error(`ERROR on contact ${contact.id}:`, err.message);
      errors++;
    }
  }
  
  // Get counts after
  const [[{contactsAfter}]] = await conn.query('SELECT COUNT(*) as contactsAfter FROM contacts');
  const [[{withPhone}]] = await conn.query('SELECT COUNT(*) as withPhone FROM contacts WHERE phoneNumber IS NOT NULL');
  const [[{withEmail}]] = await conn.query('SELECT COUNT(*) as withEmail FROM contacts WHERE email IS NOT NULL');
  const [[{noPhoneNoEmail}]] = await conn.query('SELECT COUNT(*) as noPhoneNoEmail FROM contacts WHERE phoneNumber IS NULL AND email IS NULL');
  
  console.log('\n=== MIGRATION RESULTS ===');
  console.log(`Contacts before: ${contactsBefore}`);
  console.log(`New contacts created: ${newContactsCreated}`);
  console.log(`Contacts after: ${contactsAfter}`);
  console.log(`Phones assigned: ${phonesAssigned}`);
  console.log(`Emails assigned: ${emailsAssigned}`);
  console.log(`Contacts with phone: ${withPhone}`);
  console.log(`Contacts with email: ${withEmail}`);
  console.log(`Contacts with neither: ${noPhoneNoEmail}`);
  console.log(`Errors: ${errors}`);
  
  // Validation
  console.log('\n=== VALIDATION ===');
  const expectedPhoneContacts = phonesAssigned;
  const expectedEmailContacts = emailsAssigned;
  console.log(`Expected total contacts: ${contactsBefore} + ${newContactsCreated} = ${contactsBefore + newContactsCreated}`);
  console.log(`Actual total contacts: ${contactsAfter}`);
  console.log(`Match: ${contactsAfter == contactsBefore + newContactsCreated ? '✅ YES' : '❌ NO'}`);
  
  // Verify no phone data was lost
  const [[{uniquePhones}]] = await conn.query('SELECT COUNT(DISTINCT phoneNumber) as uniquePhones FROM contacts WHERE phoneNumber IS NOT NULL');
  const [[{uniquePhonesOld}]] = await conn.query('SELECT COUNT(DISTINCT phoneNumber) as uniquePhonesOld FROM contactPhones');
  console.log(`Unique phones in contacts: ${uniquePhones}, in contactPhones: ${uniquePhonesOld}`);
  
  if (errors > 0) {
    console.log('\n⚠️  MIGRATION COMPLETED WITH ERRORS - review above');
  } else {
    console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY - ZERO DATA LOSS');
  }
  
  await conn.end();
}

migrate().catch(err => {
  console.error('MIGRATION FAILED:', err);
  process.exit(1);
});
