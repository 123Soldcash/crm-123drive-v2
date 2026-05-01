/**
 * Export leads from campaign speedtolead_Palmer_April_30_2026 in autocalls CSV format.
 * Format: phone_number, first_name, last_name, email, property_address, city, state, zip
 * Phone in E.164 format (+1XXXXXXXXXX) — one phone per row.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { createWriteStream } from "fs";

dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.execute(`
    SELECT 
      p.id as propertyId,
      p.addressLine1, p.city, p.state, p.zipcode,
      c.firstName, c.lastName, c.name as contactName,
      c.phoneNumber, c.email
    FROM properties p
    JOIN contacts c ON c.propertyId = p.id
    WHERE p.campaignName = 'speedtolead_Palmer_April_30_2026'
      AND c.contactType = 'phone'
      AND c.phoneNumber IS NOT NULL
      AND c.phoneNumber != ''
    ORDER BY p.id
  `);

  // Build CSV
  const header = "property_id,phone_number,first_name,last_name,name,email,property_address,city,state,zip";
  const lines = [header];

  for (const r of rows) {
    // Format phone to E.164
    const raw = (r.phoneNumber || "").replace(/\D/g, "");
    let phone;
    if (raw.length === 10) phone = `+1${raw}`;
    else if (raw.length === 11 && raw.startsWith("1")) phone = `+${raw}`;
    else phone = `+1${raw}`;

    const firstName = (r.firstName || "").replace(/,/g, " ").trim();
    const lastName = (r.lastName || "").replace(/,/g, " ").trim();
    const name = (r.contactName || "").replace(/,/g, " ").trim();
    const email = (r.email || "").replace(/,/g, " ").trim();
    const addr = (r.addressLine1 || "").replace(/,/g, " ").trim();
    const city = (r.city || "").replace(/,/g, " ").trim();
    const state = (r.state || "").replace(/,/g, " ").trim();
    const zip = (r.zipcode || "").replace(/,/g, " ").trim();

    const propertyId = r.propertyId;
    lines.push(`${propertyId},${phone},${firstName},${lastName},${name},${email},${addr},${city},${state},${zip}`);
  }

  const outPath = "/home/ubuntu/speedtolead_Palmer_April_30_2026_autocalls.csv";
  const ws = createWriteStream(outPath);
  ws.write(lines.join("\n") + "\n");
  ws.end();

  console.log(`✅ Exported ${rows.length} leads to ${outPath}`);
  await conn.end();
}

main().catch(console.error);
