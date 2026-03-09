/**
 * Fix script for 12 rows where the CSV had malformed state data.
 * The address was split incorrectly — state contains city name, city contains unit/apt.
 * We manually fix each one and insert them.
 */

import mysql from "mysql2/promise";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_USER_ID = 1;

// Manual corrections for the 12 problematic rows
const FIXES = {
  "682e39ea12f9ee028fbe2606": { addr: "109 Briarwood Cir # 2-2", city: "Hollywood", state: "FL", zip: "33024" },
  "68420876bb1d47baa99b5b43": { addr: "23 Burgundy A # A", city: "Delray Beach", state: "FL", zip: "33484" },
  "67e5a4f3b1503eb32bb99ff4": { addr: "10605 S Jog Rd Unit 210", city: "Boynton Beach", state: "FL", zip: "33437" },
  "67d9b021cd5137a5e0cad962": { addr: "6313 Bay Club Dr Apt 2", city: "Fort Lauderdale", state: "FL", zip: "33308" },
  "67eaf2076f61b6a4bd0ead35": { addr: "1717 Homewood Blvd Unit 146", city: "Delray Beach", state: "FL", zip: "33445" },
  "689f4b056bdd25e55ae8e74b": { addr: "15100 Front Beach Rd Unit 731", city: "Panama City Beach", state: "FL", zip: "32413" },
  "687ed67ab039bdd9a417d979": { addr: "1337 W 49th Pl Apt 321", city: "Miami", state: "FL", zip: "33012" },
  "688fe716ecdea7880af15ddd": { addr: "501 Blue Heron Dr # 202-A", city: "Hallandale Beach", state: "FL", zip: "33009" },
  "67f5b85553fd866cde620faa": { addr: "3304 Aruba Way Apt A2", city: "Coconut Creek", state: "FL", zip: "33066" },
  "687d508d403701c6a1d5eb7d": { addr: "150 E 1st Ave # 711", city: "Hialeah", state: "FL", zip: "33010" },
  "68a0b4fbdb948601b0d78210": { addr: "100 Nw 204 St Apartment G5", city: "North Miami Beach", state: "FL", zip: "33169" },
  "68a4d72e419b003d7563430e": { addr: "10382 Sw 212th St Apt 102", city: "Miami", state: "FL", zip: "33189" },
};

function mapLeadTemperature(status) {
  if (!status) return "TBD";
  const s = status.toLowerCase();
  if (s.includes("super hot")) return "SUPER HOT";
  if (s.includes("hot")) return "HOT";
  if (s.includes("warm")) return "WARM";
  if (s.includes("cold") || s.includes("dead") || s.includes("dnc")) return "COLD";
  if (s.includes("follow up") || s.includes("follow-up")) return "WARM";
  return "TBD";
}

function mapDealStage(status, row) {
  if (!status) return "NEW_LEAD";
  const s = status.toLowerCase();
  if (s.includes("dead") || s.includes("dnc")) return "DEAD_LOST";
  if (row["Under Contract Date"]) return "UNDER_CONTRACT_A";
  if (row["Offer Date"] || row["Offer Price"]) return "OFFER_PENDING";
  if (s.includes("follow up") || s.includes("follow-up")) return "FIRST_CONTACT_MADE";
  return "LEAD_IMPORTED";
}

function parseDollar(val) {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

function parseInt2(val) {
  if (!val) return null;
  const cleaned = val.replace(/[,\s]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database");

  const [maxResult] = await conn.query(
    "SELECT MAX(CAST(leadId AS UNSIGNED)) as maxLeadId FROM properties"
  );
  let nextLeadId = (maxResult[0]?.maxLeadId || 0) + 1;

  // Read CSV
  const rows = [];
  const parser = createReadStream("/home/ubuntu/upload/Exported_Leads_164104.csv").pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true })
  );
  for await (const row of parser) {
    rows.push(row);
  }

  const fixRows = rows.filter((r) => FIXES[r["Property ID"]]);
  console.log(`Found ${fixRows.length} rows to fix`);

  let imported = 0;
  for (const row of fixRows) {
    const fix = FIXES[row["Property ID"]];
    try {
      // Check for duplicate
      const [existing] = await conn.query(
        "SELECT id FROM properties WHERE addressLine1 = ? AND city = ? AND state = ? AND zipcode = ? LIMIT 1",
        [fix.addr, fix.city, fix.state, fix.zip]
      );
      if (existing.length > 0) {
        console.log(`Skipping duplicate: ${fix.addr}, ${fix.city}`);
        continue;
      }

      const leadId = nextLeadId++;
      const firstName = (row["First Name"] || "").trim();
      const lastName = (row["Last Name"] || "").trim();
      const ownerName = [firstName, lastName].filter(Boolean).join(" ") || null;
      const phone = (row["Phone Number"] || "").trim();
      const email = (row["Email Address"] || "").trim();
      const leadStatus = (row["Lead Status"] || "").trim();
      const leadSource = (row["Lead Source"] || "").trim() || null;
      const campaignName = (row["Campaign Name"] || "").trim() || null;
      const leadTemp = mapLeadTemperature(leadStatus);
      const dealStage = mapDealStage(leadStatus, row);
      const createdDate = parseDate(row["Lead Created Date"]);
      const bedrooms = parseInt2(row["Bedroom"]);
      const bathrooms = parseInt2(row["Bathroom"]);
      const sqft = parseInt2(row["Apporx Sqft"]);
      const yearBuilt = parseInt2(row["Year Buit"]);
      const houseType = (row["House Type"] || "").trim() || null;
      const mortgageAmount = parseDollar(row["Mortgage Amount"]);
      const taxAmount = parseDollar(row["Tax Billed Amount"]);
      const lastSoldPrice = parseDollar(row["Last Sold Price"]);

      const [propResult] = await conn.query(
        `INSERT INTO properties (
          leadId, addressLine1, city, state, zipcode,
          owner1Name, leadTemperature, trackingStatus, dealStage,
          totalBedrooms, totalBaths, buildingSquareFeet, yearBuilt, propertyType,
          mortgageAmount, taxAmount, salePrice,
          leadSource, campaignName, source, propertyId,
          stageChangedAt, entryDate, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Not Visited', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CSV', ?, NOW(), ?, NOW(), NOW())`,
        [
          leadId, fix.addr, fix.city, fix.state, fix.zip,
          ownerName, leadTemp, dealStage,
          bedrooms, bathrooms, sqft, yearBuilt, houseType,
          mortgageAmount, taxAmount, lastSoldPrice,
          leadSource, campaignName, row["Property ID"],
          createdDate || new Date(),
        ]
      );

      const propertyId = propResult.insertId;

      // Insert contact
      if (ownerName || phone || email) {
        const [contactResult] = await conn.query(
          `INSERT INTO contacts (propertyId, name, relationship, firstName, lastName, isDecisionMaker, createdAt, updatedAt)
           VALUES (?, ?, 'Owner', ?, ?, 1, NOW(), NOW())`,
          [propertyId, ownerName, firstName || null, lastName || null]
        );
        const contactId = contactResult.insertId;
        if (phone) {
          await conn.query(
            `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, createdAt) VALUES (?, ?, 'Mobile', 1, NOW())`,
            [contactId, phone]
          );
        }
        if (email) {
          await conn.query(
            `INSERT INTO contactEmails (contactId, email, isPrimary, createdAt) VALUES (?, ?, 1, NOW())`,
            [contactId, email]
          );
        }
      }

      // Add Recimple tag
      await conn.query(
        `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt) VALUES (?, 'Recimple', ?, NOW())`,
        [propertyId, OWNER_USER_ID]
      );

      // Add CSV tags
      const csvTags = (row["Tags"] || "").trim();
      if (csvTags) {
        const tagList = csvTags.split(",").map((t) => t.trim()).filter(Boolean);
        for (const tag of tagList) {
          if (tag.toLowerCase() === "recimple") continue;
          try {
            await conn.query(
              `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt) VALUES (?, ?, ?, NOW())`,
              [propertyId, tag.substring(0, 100), OWNER_USER_ID]
            );
          } catch (e) {}
        }
      }

      console.log(`Imported: ${fix.addr}, ${fix.city}, ${fix.state} ${fix.zip}`);
      imported++;
    } catch (err) {
      console.error(`Error: ${row["Property ID"]}: ${err.message}`);
    }
  }

  console.log(`\nFixed and imported: ${imported}/12`);
  await conn.end();
}

main().catch(console.error);
