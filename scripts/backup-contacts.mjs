import mysql from 'mysql2/promise';
import fs from 'fs';

async function backup() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=== BACKUP START ===');
  
  // Backup contacts
  const [contacts] = await conn.query('SELECT * FROM contacts');
  fs.writeFileSync('/home/ubuntu/backup_contacts.json', JSON.stringify(contacts, null, 2));
  console.log(`Backed up ${contacts.length} contacts`);
  
  // Backup contactPhones
  const [phones] = await conn.query('SELECT * FROM contactPhones');
  fs.writeFileSync('/home/ubuntu/backup_contactPhones.json', JSON.stringify(phones, null, 2));
  console.log(`Backed up ${phones.length} contactPhones`);
  
  // Backup contactEmails
  const [emails] = await conn.query('SELECT * FROM contactEmails');
  fs.writeFileSync('/home/ubuntu/backup_contactEmails.json', JSON.stringify(emails, null, 2));
  console.log(`Backed up ${emails.length} contactEmails`);
  
  // Backup contactAddresses
  const [addresses] = await conn.query('SELECT * FROM contactAddresses');
  fs.writeFileSync('/home/ubuntu/backup_contactAddresses.json', JSON.stringify(addresses, null, 2));
  console.log(`Backed up ${addresses.length} contactAddresses`);
  
  // Backup communicationLog (related to contacts)
  const [commLogs] = await conn.query('SELECT * FROM communicationLog');
  fs.writeFileSync('/home/ubuntu/backup_communicationLog.json', JSON.stringify(commLogs, null, 2));
  console.log(`Backed up ${commLogs.length} communicationLog entries`);
  
  // Backup callNotes
  const [callNotes] = await conn.query('SELECT * FROM callNotes');
  fs.writeFileSync('/home/ubuntu/backup_callNotes.json', JSON.stringify(callNotes, null, 2));
  console.log(`Backed up ${callNotes.length} callNotes`);
  
  console.log('\n=== BACKUP COMPLETE ===');
  console.log('Files saved to /home/ubuntu/backup_*.json');
  
  await conn.end();
}

backup().catch(err => {
  console.error('BACKUP FAILED:', err);
  process.exit(1);
});
