import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const indexes = [
  // contactPhones — no propertyId, only contactId
  'ALTER TABLE contactPhones ADD INDEX idx_cphone_contactid (contactId)',
  'ALTER TABLE contactPhones ADD INDEX idx_cphone_number (phoneNumber(20))',

  // contactEmails — no propertyId, only contactId
  'ALTER TABLE contactEmails ADD INDEX idx_cemail_contactid (contactId)',
  'ALTER TABLE contactEmails ADD INDEX idx_cemail_email (email(100))',

  // propertyAgents — agentId not userId
  'ALTER TABLE propertyAgents ADD INDEX idx_propagents_agentid (agentId)',

  // tasks — assignedToId not assignedTo
  'ALTER TABLE tasks ADD INDEX idx_tasks_assignedtoid (assignedToId)',
  'ALTER TABLE tasks ADD INDEX idx_tasks_createdbid (createdById)',

  // communicationLog
  'ALTER TABLE communicationLog ADD INDEX idx_commlog_propid (propertyId)',
  'ALTER TABLE communicationLog ADD INDEX idx_commlog_contactid (contactId)',
  'ALTER TABLE communicationLog ADD INDEX idx_commlog_createdat (createdAt)',

  // smsMessages
  'ALTER TABLE smsMessages ADD INDEX idx_sms_propid (propertyId)',
  'ALTER TABLE smsMessages ADD INDEX idx_sms_contactid (contactId)',
  'ALTER TABLE smsMessages ADD INDEX idx_sms_createdat (createdAt)',

  // skiptracingLogs
  'ALTER TABLE skiptracingLogs ADD INDEX idx_skip_propid (propertyId)',
];

let ok = 0, skip = 0, fail = 0;
for (const stmt of indexes) {
  try {
    await conn.execute(stmt);
    ok++;
    console.log('✅ ' + stmt.substring(0, 80));
  } catch(e) {
    if (e.message.includes('Duplicate key name') || e.message.includes('already exists')) {
      skip++;
      console.log('⏭  SKIP (exists): ' + stmt.substring(0, 60));
    } else {
      fail++;
      console.log('❌ FAIL: ' + stmt.substring(0, 80) + ' => ' + e.message);
    }
  }
}

console.log(`\n✅ Results: ${ok} created | ${skip} already existed | ${fail} failed`);
await conn.end();
