import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.DATABASE_URL });

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
  console.log("\nNote: The DNC flags are set when the Supabase DNC check runs.");
  console.log("You need to configure Supabase credentials in Integrations first,");
  console.log("then open a property to trigger the auto-check.\n");
  
  // Show some sample phones instead
  const sample = await db.execute({
    sql: `SELECT cp.phoneNumber, c.name as contactName, p.leadId, p.propertyAddress 
    FROM contact_phones cp 
    JOIN contacts c ON cp.contactId = c.id 
    JOIN properties p ON c.propertyId = p.id 
    LIMIT 5`,
    args: []
  });
  console.log("=== Sample phones (not yet checked) ===\n");
  for (const row of sample.rows) {
    console.log(`  Phone: ${row.phoneNumber} | Contact: ${row.contactName} | Lead #${row.leadId} | ${row.propertyAddress}`);
  }
} else {
  for (const row of results.rows) {
    console.log(`  Phone: ${row.phoneNumber} | Contact: ${row.contactName} | Lead #${row.leadId} | ${row.propertyAddress}`);
  }
}
