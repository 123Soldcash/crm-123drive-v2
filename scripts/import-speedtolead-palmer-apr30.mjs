/**
 * Import script: speedtolead_Palmer_April_30_2026.xlsx
 * Lead source: referrals
 * Campaign: speedtolead_Palmer_April_30_2026
 * Tag: speedtolead_Palmer_April_30_2026
 * Notes: added to general notes
 */
import mysql from "mysql2/promise";
import xlsx from "xlsx";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = join(__dirname, "../../upload/speedtolead_Palmer_April_30_2026.xlsx");

const LEAD_SOURCE = "referrals";
const CAMPAIGN = "speedtolead_Palmer_April_30_2026";
const TAG = "speedtolead_Palmer_April_30_2026";
const OWNER_USER_ID = 1; // Rosangela Russo (admin)

function normalizePhone(phone) {
  if (!phone) return null;
  const str = String(phone).replace(/\D/g, "");
  // Remove leading country code 1 if 11 digits
  if (str.length === 11 && str.startsWith("1")) return str.slice(1);
  if (str.length === 10) return str;
  return str || null;
}

function normalizeState(state) {
  if (!state) return "FL";
  const s = state.trim();
  if (s.length === 2) return s.toUpperCase();
  // Convert full name to abbreviation
  const map = { florida: "FL" };
  return map[s.toLowerCase()] || s.substring(0, 2).toUpperCase();
}

function normalizeZip(zip) {
  if (!zip) return "00000";
  return String(zip).trim().substring(0, 10);
}

async function main() {
  console.log("📂 Reading Excel file...");
  const wb = xlsx.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: null });
  console.log(`📊 Found ${rows.length} leads to import`);

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("✅ Connected to database");

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const firstName = (row["First Name"] || "").trim();
    const lastName = (row["Last Name"] || "").trim();
    const phone = normalizePhone(row["Phone"]);
    const email = row["Email"] ? row["Email"].trim() : null;
    const addressLine1 = (row["Property Address"] || "").trim();
    const city = (row["City"] || "").trim();
    const state = normalizeState(row["State"]);
    const zipcode = normalizeZip(row["ZIP"]);
    const notesContent = row["notes"] ? row["notes"].trim() : null;
    const ownerName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

    if (!addressLine1) {
      console.log(`⚠️  Skipping row with no address: ${ownerName}`);
      skipped++;
      continue;
    }

    try {
      // Check for duplicate by address
      const [existing] = await conn.execute(
        "SELECT id FROM properties WHERE addressLine1 = ? AND city = ? AND state = ? LIMIT 1",
        [addressLine1, city, state]
      );

      if (existing.length > 0) {
        console.log(`⚠️  Duplicate address, skipping: ${addressLine1}, ${city}, ${state}`);
        skipped++;
        continue;
      }

      // Insert property
      const [propResult] = await conn.execute(
        `INSERT INTO properties 
          (addressLine1, city, state, zipcode, owner1Name, leadSource, campaignName, leadTemperature, deskStatus, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'COLD', 'ACTIVE', NOW(), NOW())`,
        [addressLine1, city, state, zipcode, ownerName, LEAD_SOURCE, CAMPAIGN]
      );
      const propertyId = propResult.insertId;

      // Insert contact with phone (if available)
      if (phone) {
        await conn.execute(
          `INSERT INTO contacts 
            (propertyId, name, firstName, lastName, phoneNumber, phoneType, contactType, relationship, dnc, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 'Mobile', 'phone', 'Owner', 0, NOW(), NOW())`,
          [propertyId, ownerName, firstName, lastName, phone]
        );
      }

      // Insert contact with email (if available and different from phone contact)
      if (email) {
        if (phone) {
          // Add email to the same contact or as a separate email contact
          await conn.execute(
            `INSERT INTO contacts 
              (propertyId, name, firstName, lastName, email, contactType, relationship, dnc, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, 'email', 'Owner', 0, NOW(), NOW())`,
            [propertyId, ownerName, firstName, lastName, email]
          );
        } else {
          // No phone, create email-only contact
          await conn.execute(
            `INSERT INTO contacts 
              (propertyId, name, firstName, lastName, email, contactType, relationship, dnc, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, 'email', 'Owner', 0, NOW(), NOW())`,
            [propertyId, ownerName, firstName, lastName, email]
          );
        }
      }

      // Insert general note with the notes content
      if (notesContent) {
        await conn.execute(
          `INSERT INTO notes (propertyId, userId, content, noteType, isPinned, createdAt, updatedAt)
           VALUES (?, ?, ?, 'general', 0, NOW(), NOW())`,
          [propertyId, OWNER_USER_ID, notesContent]
        );
      }

      // Insert tag
      await conn.execute(
        `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt)
         VALUES (?, ?, ?, NOW())`,
        [propertyId, TAG, OWNER_USER_ID]
      );

      console.log(`✅ Imported: ${ownerName} — ${addressLine1}, ${city}, ${state}`);
      imported++;
    } catch (err) {
      console.error(`❌ Error importing ${ownerName} (${addressLine1}): ${err.message}`);
      errors++;
    }
  }

  await conn.end();

  console.log("\n========================================");
  console.log(`✅ Import complete!`);
  console.log(`   Imported:  ${imported}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   Total:     ${rows.length}`);
  console.log("========================================");
}

main().catch(console.error);
