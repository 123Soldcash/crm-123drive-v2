/**
 * REsimple Lead Migration Script
 * Imports ~759 leads from CSV into the CRM database.
 * - Creates property records with all mapped fields
 * - Creates owner contacts with phone/email
 * - Adds "Recimple" tag + all existing tags from CSV
 * - Maps Lead Source and Campaign Name
 * - Maps Lead Status to leadTemperature / trackingStatus
 */

import mysql from "mysql2/promise";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Owner user ID for tag creation (Rosangela Russo)
const OWNER_USER_ID = 1;

// Zach Jones user ID for agent assignment
const ZACH_JONES_USER_ID = 12030025;

// Lead Status → leadTemperature mapping
function mapLeadTemperature(status) {
  if (!status) return "TBD";
  const s = status.toLowerCase();
  if (s.includes("super hot")) return "SUPER HOT";
  if (s.includes("hot")) return "HOT";
  if (s.includes("warm")) return "WARM";
  if (s.includes("cold") || s.includes("dead") || s.includes("dnc")) return "COLD";
  if (s.includes("follow up") || s.includes("follow-up")) return "WARM";
  if (s.includes("new") || s.includes("not contacted")) return "TBD";
  return "TBD";
}

// Lead Status → trackingStatus mapping
function mapTrackingStatus(status) {
  if (!status) return "Not Visited";
  const s = status.toLowerCase();
  if (s.includes("interested")) return "Interested";
  if (s.includes("not interested")) return "Not Interested";
  if (s.includes("follow up") || s.includes("follow-up")) return "Follow Up";
  return "Not Visited";
}

// Lead Status → dealStage mapping
function mapDealStage(status, row) {
  if (!status) return "NEW_LEAD";
  const s = status.toLowerCase();
  if (s.includes("dead") || s.includes("dnc")) return "DEAD_LOST";
  if (row["Under Contract Date"]) return "UNDER_CONTRACT_A";
  if (row["Offer Date"] || row["Offer Price"]) return "OFFER_PENDING";
  if (s.includes("follow up") || s.includes("follow-up")) return "FIRST_CONTACT_MADE";
  if (s.includes("new") || s.includes("not contacted")) return "LEAD_IMPORTED";
  return "LEAD_IMPORTED";
}

// Parse dollar amounts like "$8802.84" → cents integer
function parseDollar(val) {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num);
}

// Parse integer safely
function parseInt2(val) {
  if (!val) return null;
  const cleaned = val.replace(/[,\s]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// Parse date string like "2025-07-08" → Date
function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database");

  // Get current max leadId
  const [maxResult] = await conn.query(
    "SELECT MAX(CAST(leadId AS UNSIGNED)) as maxLeadId FROM properties"
  );
  let nextLeadId = (maxResult[0]?.maxLeadId || 0) + 1;
  // Ensure we start from a clean range
  if (nextLeadId < 2000000000) nextLeadId = 2000000000;
  console.log(`Starting leadId from: ${nextLeadId}`);

  // Read CSV
  const rows = [];
  const parser = createReadStream("/home/ubuntu/upload/Exported_Leads_164104.csv").pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true })
  );

  for await (const row of parser) {
    rows.push(row);
  }
  console.log(`Read ${rows.length} rows from CSV`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const address1 = (row["Property Street Address"] || "").trim();
      const city = (row["Property City"] || "").trim();
      const state = (row["Property State"] || "").trim();
      const zip = (row["Property Zip"] || "").trim();

      if (!address1 || !city || !state || !zip) {
        console.warn(`Skipping row - missing address: ${row["Property ID"]}`);
        skipped++;
        continue;
      }

      // Check for duplicate address
      const [existing] = await conn.query(
        "SELECT id FROM properties WHERE addressLine1 = ? AND city = ? AND state = ? AND zipcode = ? LIMIT 1",
        [address1, city, state, zip]
      );
      if (existing.length > 0) {
        console.warn(`Skipping duplicate: ${address1}, ${city}, ${state} ${zip}`);
        skipped++;
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
      const address2 = (row["Property Street Address 2"] || "").trim() || null;
      const mailingAddress = (row["Mailing Address"] || "").trim() || null;
      const bedrooms = parseInt2(row["Bedroom"]);
      const bathrooms = parseInt2(row["Bathroom"]);
      const sqft = parseInt2(row["Apporx Sqft"]);
      const lotSqft = parseInt2(row["Lot Size Sqft"]);
      const yearBuilt = parseInt2(row["Year Buit"]);
      const houseType = (row["House Type"] || "").trim() || null;
      const mortgageAmount = parseDollar(row["Mortgage Amount"]);
      const taxAmount = parseDollar(row["Tax Billed Amount"]);
      const lastSoldPrice = parseDollar(row["Last Sold Price"]);
      const priorSalePrice = parseDollar(row["Prior Sale Price"]);
      const taxAssessedValue = parseDollar(row["Tax Assessed Value"]);
      const createdDate = parseDate(row["Lead Created Date"]);
      const offerPrice = parseDollar(row["Offer Price"]);
      const offerDate = parseDate(row["Offer Date"]);
      const underContractDate = parseDate(row["Under Contract Date"]);
      const underContractPrice = parseDollar(row["Under Contract Price"]);
      const deadLeadReason = (row["Dead Lead Reason"] || "").trim() || null;

      const leadTemp = mapLeadTemperature(leadStatus);
      const trackStatus = mapTrackingStatus(leadStatus);
      const dealStage = mapDealStage(leadStatus, row);

      // Determine owner location from mailing address
      let ownerLocation = null;
      if (mailingAddress) {
        const mailNorm = mailingAddress.toLowerCase();
        const propNorm = `${address1}`.toLowerCase();
        if (!mailNorm.includes(propNorm.substring(0, 10))) {
          ownerLocation = "Out of State";
        }
      }

      // Insert property
      const [propResult] = await conn.query(
        `INSERT INTO properties (
          leadId, addressLine1, addressLine2, city, state, zipcode,
          owner1Name, leadTemperature, trackingStatus, dealStage,
          totalBedrooms, totalBaths, buildingSquareFeet, yearBuilt, propertyType,
          mortgageAmount, taxAmount, salePrice,
          leadSource, campaignName, source, ownerLocation,
          stageChangedAt, entryDate, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CSV', ?, NOW(), ?, NOW(), NOW())`,
        [
          leadId, address1, address2, city, state, zip,
          ownerName, leadTemp, trackStatus, dealStage,
          bedrooms, bathrooms, sqft, yearBuilt, houseType,
          mortgageAmount, taxAmount, lastSoldPrice,
          leadSource, campaignName, ownerLocation,
          createdDate || new Date(),
        ]
      );

      const propertyId = propResult.insertId;

      // Insert owner contact
      if (ownerName || phone || email) {
        const [contactResult] = await conn.query(
          `INSERT INTO contacts (propertyId, name, relationship, firstName, lastName, isDecisionMaker, currentAddress, createdAt, updatedAt)
           VALUES (?, ?, 'Owner', ?, ?, 1, ?, NOW(), NOW())`,
          [propertyId, ownerName, firstName || null, lastName || null, mailingAddress || null]
        );
        const contactId = contactResult.insertId;

        // Insert phone
        if (phone) {
          await conn.query(
            `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, createdAt)
             VALUES (?, ?, 'Mobile', 1, NOW())`,
            [contactId, phone]
          );
        }

        // Insert email
        if (email) {
          await conn.query(
            `INSERT INTO contactEmails (contactId, email, isPrimary, createdAt)
             VALUES (?, ?, 1, NOW())`,
            [contactId, email]
          );
        }
      }

      // Add "Recimple" tag
      await conn.query(
        `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt) VALUES (?, 'Recimple', ?, NOW())`,
        [propertyId, OWNER_USER_ID]
      );

      // Add existing tags from CSV
      const csvTags = (row["Tags"] || "").trim();
      if (csvTags) {
        const tagList = csvTags.split(",").map((t) => t.trim()).filter(Boolean);
        for (const tag of tagList) {
          if (tag.toLowerCase() === "recimple") continue; // Already added
          try {
            await conn.query(
              `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt) VALUES (?, ?, ?, NOW())`,
              [propertyId, tag.substring(0, 100), OWNER_USER_ID]
            );
          } catch (e) {
            // Duplicate tag - skip
          }
        }
      }

      // Store extra data as JSON in dealMachineRawData for reference
      const extraData = {};
      if (offerPrice) extraData.offerPrice = offerPrice;
      if (offerDate) extraData.offerDate = offerDate;
      if (underContractDate) extraData.underContractDate = underContractDate;
      if (underContractPrice) extraData.underContractPrice = underContractPrice;
      if (priorSalePrice) extraData.priorSalePrice = priorSalePrice;
      if (taxAssessedValue) extraData.taxAssessedValue = taxAssessedValue;
      if (deadLeadReason) extraData.deadLeadReason = deadLeadReason;
      if (row["Appointment Date"]) extraData.appointmentDate = row["Appointment Date"];
      if (row["Schedule Closing Date"]) extraData.scheduleClosingDate = row["Schedule Closing Date"];
      if (row["Expected Profit"]) extraData.expectedProfit = row["Expected Profit"];
      if (row["Buyer Name"]) extraData.buyerName = row["Buyer Name"];
      if (row["Buyer Phone Number"]) extraData.buyerPhone = row["Buyer Phone Number"];
      if (row["Buyer Email"]) extraData.buyerEmail = row["Buyer Email"];
      if (row["Is There a Garage?"]) extraData.garage = row["Is There a Garage?"];
      if (row["Garage Size"]) extraData.garageSize = row["Garage Size"];
      if (row["Garage attached or detached"]) extraData.garageType = row["Garage attached or detached"];
      if (lotSqft) extraData.lotSizeSqft = lotSqft;
      if (row["Mortgage Date"]) extraData.mortgageDate = row["Mortgage Date"];
      if (row["Tax Assessed Year"]) extraData.taxAssessedYear = row["Tax Assessed Year"];
      // Agent roles
      const agentRoles = {};
      for (const role of ["Acquisition Manager", "Lead Manager", "Owner", "Disposition Manager", "Closing Coordinator"]) {
        if (row[role]?.trim()) agentRoles[role] = row[role].trim();
      }
      if (Object.keys(agentRoles).length > 0) extraData.agentRoles = agentRoles;

      if (Object.keys(extraData).length > 0) {
        await conn.query(
          `UPDATE properties SET dealMachineRawData = ? WHERE id = ?`,
          [JSON.stringify(extraData), propertyId]
        );
      }

      // Store REsimple Property ID as propertyId field
      const resimpleId = (row["Property ID"] || "").trim();
      if (resimpleId) {
        await conn.query(
          `UPDATE properties SET propertyId = ? WHERE id = ?`,
          [resimpleId, propertyId]
        );
      }

      imported++;
      if (imported % 50 === 0) {
        console.log(`  Imported ${imported}/${rows.length}...`);
      }
    } catch (err) {
      console.error(`Error importing row ${row["Property ID"]}: ${err.message}`);
      errors++;
    }
  }

  console.log("\n=== Migration Complete ===");
  console.log(`Total rows: ${rows.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (duplicates/missing): ${skipped}`);
  console.log(`Errors: ${errors}`);

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
