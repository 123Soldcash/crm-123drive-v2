import { execSync } from "child_process";
import { createClient } from "@libsql/client";

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

const db = createClient({ url: dbUrl });

const results = await db.execute({
  sql: `SELECT cp.id as phoneId, cp.phoneNumber, cp.dnc as phoneDnc, 
         c.name as contactName, c.dnc as contactDnc, 
         p.id as propertyDbId, p.leadId, p.propertyAddress 
  FROM contact_phones cp 
  JOIN contacts c ON cp.contactId = c.id 
  JOIN properties p ON c.propertyId = p.id 
  WHERE cp.dnc = 1 
  LIMIT 10`,
  args: []
});

console.log("=== Phone numbers marked as DNC ===\n");
if (results.rows.length === 0) {
  console.log("No phones currently marked as DNC in the database.");
  console.log("\nThe DNC flags get set when the Supabase DNC check runs.");
  console.log("You need to configure Supabase credentials in Integrations first,");
  console.log("then open a property to trigger the auto-check.\n");
  
  // Show contacts that have DNC=1 at the contact level (manually set)
  const manualDnc = await db.execute({
    sql: `SELECT c.name, c.dnc, p.leadId, p.propertyAddress,
           GROUP_CONCAT(cp.phoneNumber) as phones
    FROM contacts c 
    JOIN properties p ON c.propertyId = p.id 
    LEFT JOIN contact_phones cp ON cp.contactId = c.id
    WHERE c.dnc = 1
    GROUP BY c.id
    LIMIT 10`,
    args: []
  });
  
  if (manualDnc.rows.length > 0) {
    console.log("=== Contacts manually marked as DNC ===\n");
    for (const row of manualDnc.rows) {
      console.log(`  Contact: ${row.name} | Lead #${row.leadId} | ${row.propertyAddress} | Phones: ${row.phones || 'none'}`);
    }
  }
  
  // Also show sample properties with contacts
  const sample = await db.execute({
    sql: `SELECT p.leadId, p.propertyAddress, COUNT(cp.id) as phoneCount
    FROM properties p 
    JOIN contacts c ON c.propertyId = p.id 
    JOIN contact_phones cp ON cp.contactId = c.id
    GROUP BY p.id
    HAVING phoneCount > 0
    ORDER BY phoneCount DESC
    LIMIT 5`,
    args: []
  });
  console.log("\n=== Properties with most phones (good for testing) ===\n");
  for (const row of sample.rows) {
    console.log(`  Lead #${row.leadId} | ${row.propertyAddress} | ${row.phoneCount} phones`);
  }
} else {
  for (const row of results.rows) {
    console.log(`  Phone: ${row.phoneNumber} | Contact: ${row.contactName} | Lead #${row.leadId} | ${row.propertyAddress}`);
  }
}
