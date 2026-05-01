/**
 * Fix contacts that have DealMachine URLs as their name.
 * Replace with the real owner name from the associated property (owner1Name).
 * Also parse firstName/lastName from the owner name.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

function parseFirstLastName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };
  
  // Remove common suffixes like "EST OF", "THE EST OF"
  let cleaned = fullName.trim();
  
  // Split by space
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  
  // First part is firstName, last part is lastName
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("✅ Connected to database");

  // Update contacts with DealMachine URLs using a single UPDATE JOIN
  // This is much faster than row-by-row
  const [result] = await conn.execute(`
    UPDATE contacts c
    JOIN properties p ON c.propertyId = p.id
    SET 
      c.name = p.owner1Name,
      c.firstName = SUBSTRING_INDEX(p.owner1Name, ' ', 1),
      c.lastName = TRIM(SUBSTRING(p.owner1Name, LENGTH(SUBSTRING_INDEX(p.owner1Name, ' ', 1)) + 2))
    WHERE (c.name LIKE '%dealmachine%' OR c.name LIKE '%http%')
      AND p.owner1Name IS NOT NULL
      AND p.owner1Name != ''
  `);

  console.log(`\n✅ Updated ${result.affectedRows} contacts with real names from property owner1Name`);

  // Check if any remain without a valid owner1Name
  const [[remaining]] = await conn.execute(`
    SELECT COUNT(*) as cnt FROM contacts c
    LEFT JOIN properties p ON c.propertyId = p.id
    WHERE (c.name LIKE '%dealmachine%' OR c.name LIKE '%http%')
  `);
  console.log(`⚠️  Remaining contacts with URL names (no owner1Name available): ${remaining.cnt}`);

  if (remaining.cnt > 0) {
    const [samples] = await conn.execute(`
      SELECT c.id, c.name, c.propertyId, p.owner1Name, p.addressLine1 
      FROM contacts c
      LEFT JOIN properties p ON c.propertyId = p.id
      WHERE (c.name LIKE '%dealmachine%' OR c.name LIKE '%http%')
      LIMIT 5
    `);
    console.log("Samples of remaining:");
    samples.forEach(r => console.log(`  id:${r.id} | owner1Name: "${r.owner1Name}" | addr: ${r.addressLine1}`));
  }

  await conn.end();
  console.log("\n🎉 Done!");
}

main().catch(console.error);
