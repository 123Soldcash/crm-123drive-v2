import { execSync } from "child_process";
import mysql from "mysql2/promise";

const pid = execSync("pgrep -f 'tsx.*server' | head -1").toString().trim();
let dbUrl = "";
if (pid) {
  const envStr = execSync(`cat /proc/${pid}/environ`).toString();
  for (const v of envStr.split("\0")) {
    if (v.startsWith("DATABASE_URL=")) { dbUrl = v.substring(13); break; }
  }
}
if (!dbUrl) { console.log("No DATABASE_URL found"); process.exit(1); }

const conn = await mysql.createConnection(dbUrl);

// List tables
const [tables] = await conn.execute("SHOW TABLES");
const tableNames = tables.map(t => Object.values(t)[0]);
console.log("Tables:", tableNames.join(", "));

// Find the phone table
const phoneTable = "contactPhones";
const contactTable = "contacts";
const propTable = "properties";

console.log(`\nPhone table: ${phoneTable}, Contact table: ${contactTable}, Property table: ${propTable}\n`);

if (phoneTable) {
  // Check columns
  const [cols] = await conn.execute(`DESCRIBE ${phoneTable}`);
  console.log(`Columns in ${phoneTable}: ${cols.map(c => c.Field).join(", ")}`);
  
  // Find DNC phones
  const [dncPhones] = await conn.execute(
    `SELECT p.*, c.name as cname, c.dnc as cdnc, pr.leadId, pr.addressLine1 
     FROM ${phoneTable} p 
     JOIN ${contactTable} c ON p.contactId = c.id 
     JOIN ${propTable} pr ON c.propertyId = pr.id 
     WHERE p.dnc = 1 LIMIT 10`
  );
  
  console.log(`\n=== Phones with DNC=1: ${dncPhones.length} found ===\n`);
  for (const row of dncPhones) {
    console.log(`  Phone: ${row.phoneNumber} | Contact: ${row.cname} | Lead #${row.leadId} | ${row.addressLine1}`);
  }
  
  if (dncPhones.length === 0) {
    // Check contacts with DNC
    const [dncContacts] = await conn.execute(
      `SELECT c.name, c.dnc, pr.leadId, pr.addressLine1 
       FROM ${contactTable} c 
       JOIN ${propTable} pr ON c.propertyId = pr.id 
       WHERE c.dnc = 1 LIMIT 10`
    );
    console.log(`\n=== Contacts with DNC=1: ${dncContacts.length} found ===\n`);
    for (const row of dncContacts) {
      console.log(`  Contact: ${row.name} | Lead #${row.leadId} | ${row.addressLine1}`);
    }
    
    // Show sample properties
    const [sample] = await conn.execute(
      `SELECT pr.leadId, pr.addressLine1, COUNT(p.id) as phoneCount
       FROM ${propTable} pr 
       JOIN ${contactTable} c ON c.propertyId = pr.id 
       JOIN ${phoneTable} p ON p.contactId = c.id
       GROUP BY pr.id
       HAVING phoneCount > 0
       ORDER BY phoneCount DESC
       LIMIT 5`
    );
    console.log(`\n=== Properties with most phones (for testing) ===\n`);
    for (const row of sample) {
      console.log(`  Lead #${row.leadId} | ${row.addressLine1} | ${row.phoneCount} phones`);
    }
  }
}

await conn.end();
