import { execSync } from "child_process";
import mysql from "mysql2/promise";

// Get DATABASE_URL from the running node process
const pid = execSync("pgrep -f 'tsx.*server' | head -1").toString().trim();
let dbUrl = "";
if (pid) {
  try {
    const envStr = execSync(`cat /proc/${pid}/environ`).toString();
    const envVars = envStr.split("\0");
    for (const v of envVars) {
      if (v.startsWith("DATABASE_URL=")) {
        dbUrl = v.substring("DATABASE_URL=".length);
        break;
      }
    }
  } catch (e) {}
}

if (!dbUrl) {
  console.log("Could not find DATABASE_URL from running process");
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

// Check for phones marked DNC
const [dncPhones] = await conn.execute(
  `SELECT cp.id as phoneId, cp.phoneNumber, cp.dnc as phoneDnc, 
    c.name as contactName, c.dnc as contactDnc, 
    p.id as propertyDbId, p.leadId, p.propertyAddress 
  FROM contact_phones cp 
  JOIN contacts c ON cp.contactId = c.id 
  JOIN properties p ON c.propertyId = p.id 
  WHERE cp.dnc = 1 
  LIMIT 10`
);

console.log("=== Phone numbers with DNC flag = 1 ===\n");
if (dncPhones.length === 0) {
  console.log("No phones currently have DNC=1 in the contact_phones table.\n");
  
  // Check contacts with DNC=1 (manually set via DNC Geral or individual toggle)
  const [manualDnc] = await conn.execute(
    `SELECT c.name, c.dnc, p.leadId, p.propertyAddress,
      GROUP_CONCAT(cp.phoneNumber SEPARATOR ', ') as phones
    FROM contacts c 
    JOIN properties p ON c.propertyId = p.id 
    LEFT JOIN contact_phones cp ON cp.contactId = c.id
    WHERE c.dnc = 1
    GROUP BY c.id
    LIMIT 10`
  );
  
  if (manualDnc.length > 0) {
    console.log("=== Contacts manually marked as DNC (via DNC Geral / toggle) ===\n");
    for (const row of manualDnc) {
      console.log(`  Contact: ${row.name} | Lead #${row.leadId} | ${row.propertyAddress} | Phones: ${row.phones || 'none'}`);
    }
  } else {
    console.log("No contacts marked as DNC either.\n");
  }
  
  // Show properties with most phones for testing
  const [sample] = await conn.execute(
    `SELECT p.leadId, p.propertyAddress, COUNT(cp.id) as phoneCount
    FROM properties p 
    JOIN contacts c ON c.propertyId = p.id 
    JOIN contact_phones cp ON cp.contactId = c.id
    GROUP BY p.id
    HAVING phoneCount > 0
    ORDER BY phoneCount DESC
    LIMIT 5`
  );
  console.log("\n=== Properties with most phones (good for testing DNC check) ===\n");
  for (const row of sample) {
    console.log(`  Lead #${row.leadId} | ${row.propertyAddress} | ${row.phoneCount} phones`);
  }
} else {
  for (const row of dncPhones) {
    console.log(`  Phone: ${row.phoneNumber} | Contact: ${row.contactName} | Lead #${row.leadId} | ${row.propertyAddress}`);
  }
}

await conn.end();
