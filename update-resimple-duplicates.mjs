/**
 * REsimple Duplicate Update Script
 * Updates the 192 properties that were skipped during initial import
 * because they already existed in the CRM.
 * - Updates fields from CSV data (lead source, campaign, owner info, etc.)
 * - Adds "Recimple" tag to each
 * - Adds any CSV tags that don't already exist
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

const OWNER_USER_ID = 1;

// Parse dollar amounts like "$8802.84" → integer
function parseDollar(val) {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num);
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

function mapLeadTemperature(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("super hot")) return "SUPER HOT";
  if (s.includes("hot")) return "HOT";
  if (s.includes("warm")) return "WARM";
  if (s.includes("cold") || s.includes("dead") || s.includes("dnc")) return "COLD";
  if (s.includes("follow up") || s.includes("follow-up")) return "WARM";
  if (s.includes("new") || s.includes("not contacted")) return "TBD";
  return null;
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database");

  // Read CSV
  const rows = [];
  const parser = createReadStream("/home/ubuntu/upload/Exported_Leads_164104.csv").pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true })
  );

  for await (const row of parser) {
    rows.push(row);
  }
  console.log(`Read ${rows.length} rows from CSV`);

  let updated = 0;
  let notFound = 0;
  let alreadyNew = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const address1 = (row["Property Street Address"] || "").trim();
      const city = (row["Property City"] || "").trim();
      const state = (row["Property State"] || "").trim().substring(0, 2).toUpperCase();
      const zip = (row["Property Zip"] || "").trim();

      if (!address1 || !city || !state || !zip) {
        continue;
      }

      // Find existing property by address
      const [existing] = await conn.query(
        "SELECT id, leadSource, campaignName, owner1Name, leadTemperature FROM properties WHERE addressLine1 = ? AND city = ? AND (state = ? OR state = ?) AND zipcode = ? LIMIT 1",
        [address1, city, state, row["Property State"]?.trim() || state, zip]
      );

      if (existing.length === 0) {
        // Try a looser match (just address + zip)
        const [looseMatch] = await conn.query(
          "SELECT id, leadSource, campaignName, owner1Name, leadTemperature FROM properties WHERE addressLine1 = ? AND zipcode = ? LIMIT 1",
          [address1, zip]
        );
        if (looseMatch.length === 0) {
          notFound++;
          continue;
        }
        existing[0] = looseMatch[0];
      }

      const propertyId = existing[0].id;

      // Check if this property was already imported by us (has leadId >= 2000000000)
      const [checkNew] = await conn.query(
        "SELECT leadId FROM properties WHERE id = ?",
        [propertyId]
      );
      if (checkNew[0]?.leadId && parseInt(checkNew[0].leadId) >= 2000000000) {
        alreadyNew++;
        continue; // This was already imported by us, skip
      }

      // Build update fields from CSV data
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
      const offerPrice = parseDollar(row["Offer Price"]);
      const offerDate = parseDate(row["Offer Date"]);
      const underContractDate = parseDate(row["Under Contract Date"]);
      const underContractPrice = parseDollar(row["Under Contract Price"]);
      const deadLeadReason = (row["Dead Lead Reason"] || "").trim() || null;
      const leadTemp = mapLeadTemperature(leadStatus);

      // Build SET clause - only update fields that have values from CSV
      const updates = [];
      const params = [];

      if (leadSource) {
        updates.push("leadSource = ?");
        params.push(leadSource);
      }
      if (campaignName) {
        updates.push("campaignName = ?");
        params.push(campaignName);
      }
      if (ownerName && !existing[0].owner1Name) {
        updates.push("owner1Name = ?");
        params.push(ownerName);
      }
      if (leadTemp && (!existing[0].leadTemperature || existing[0].leadTemperature === "TBD")) {
        updates.push("leadTemperature = ?");
        params.push(leadTemp);
      }
      if (bedrooms) {
        updates.push("totalBedrooms = ?");
        params.push(bedrooms);
      }
      if (bathrooms) {
        updates.push("totalBaths = ?");
        params.push(bathrooms);
      }
      if (sqft) {
        updates.push("buildingSquareFeet = ?");
        params.push(sqft);
      }
      if (yearBuilt) {
        updates.push("yearBuilt = ?");
        params.push(yearBuilt);
      }
      if (houseType) {
        updates.push("propertyType = ?");
        params.push(houseType);
      }
      if (mortgageAmount) {
        updates.push("mortgageAmount = ?");
        params.push(mortgageAmount);
      }
      if (taxAmount) {
        updates.push("taxAmount = ?");
        params.push(taxAmount);
      }
      if (lastSoldPrice) {
        updates.push("salePrice = ?");
        params.push(lastSoldPrice);
      }
      if (address2) {
        updates.push("addressLine2 = ?");
        params.push(address2);
      }

      // Always update updatedAt
      updates.push("updatedAt = NOW()");

      if (updates.length > 1) { // More than just updatedAt
        params.push(propertyId);
        await conn.query(
          `UPDATE properties SET ${updates.join(", ")} WHERE id = ?`,
          params
        );
      }

      // Store extra data in dealMachineRawData (merge with existing)
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
      const agentRoles = {};
      for (const role of ["Acquisition Manager", "Lead Manager", "Owner", "Disposition Manager", "Closing Coordinator"]) {
        if (row[role]?.trim()) agentRoles[role] = row[role].trim();
      }
      if (Object.keys(agentRoles).length > 0) extraData.agentRoles = agentRoles;
      extraData.resimpleSource = true;

      if (Object.keys(extraData).length > 0) {
        // Merge with existing dealMachineRawData
        const [rawResult] = await conn.query(
          "SELECT dealMachineRawData FROM properties WHERE id = ?",
          [propertyId]
        );
        let existingRaw = {};
        try {
          if (rawResult[0]?.dealMachineRawData) {
            existingRaw = JSON.parse(rawResult[0].dealMachineRawData);
          }
        } catch (e) {}
        const merged = { ...existingRaw, ...extraData };
        await conn.query(
          "UPDATE properties SET dealMachineRawData = ? WHERE id = ?",
          [JSON.stringify(merged), propertyId]
        );
      }

      // Add "Recimple" tag (skip if already exists)
      try {
        await conn.query(
          `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt) VALUES (?, 'Recimple', ?, NOW())`,
          [propertyId, OWNER_USER_ID]
        );
      } catch (e) {
        // Duplicate tag - already has Recimple tag
      }

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
          } catch (e) {
            // Duplicate tag - skip
          }
        }
      }

      // Update/add contacts if we have new phone/email from CSV
      if (phone || email) {
        // Check if owner contact already exists
        const [existingContacts] = await conn.query(
          "SELECT id FROM contacts WHERE propertyId = ? AND relationship = 'Owner' LIMIT 1",
          [propertyId]
        );

        let contactId;
        if (existingContacts.length > 0) {
          contactId = existingContacts[0].id;
          // Update name if missing
          if (ownerName) {
            await conn.query(
              "UPDATE contacts SET name = COALESCE(NULLIF(name, ''), ?), firstName = COALESCE(NULLIF(firstName, ''), ?), lastName = COALESCE(NULLIF(lastName, ''), ?) WHERE id = ?",
              [ownerName, firstName || null, lastName || null, contactId]
            );
          }
        } else {
          // Create new owner contact
          const [contactResult] = await conn.query(
            `INSERT INTO contacts (propertyId, name, relationship, firstName, lastName, isDecisionMaker, currentAddress, createdAt, updatedAt)
             VALUES (?, ?, 'Owner', ?, ?, 1, ?, NOW(), NOW())`,
            [propertyId, ownerName, firstName || null, lastName || null, mailingAddress || null]
          );
          contactId = contactResult.insertId;
        }

        // Add phone if not already present
        if (phone && contactId) {
          const [existingPhones] = await conn.query(
            "SELECT id FROM contactPhones WHERE contactId = ? AND phoneNumber = ?",
            [contactId, phone]
          );
          if (existingPhones.length === 0) {
            await conn.query(
              `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, createdAt) VALUES (?, ?, 'Mobile', 0, NOW())`,
              [contactId, phone]
            );
          }
        }

        // Add email if not already present
        if (email && contactId) {
          const [existingEmails] = await conn.query(
            "SELECT id FROM contactEmails WHERE contactId = ? AND email = ?",
            [contactId, email]
          );
          if (existingEmails.length === 0) {
            await conn.query(
              `INSERT INTO contactEmails (contactId, email, isPrimary, createdAt) VALUES (?, ?, 0, NOW())`,
              [contactId, email]
            );
          }
        }
      }

      // Store REsimple Property ID
      const resimpleId = (row["Property ID"] || "").trim();
      if (resimpleId) {
        await conn.query(
          `UPDATE properties SET propertyId = COALESCE(propertyId, ?) WHERE id = ?`,
          [resimpleId, propertyId]
        );
      }

      updated++;
      if (updated % 20 === 0) {
        console.log(`  Updated ${updated} properties...`);
      }
    } catch (err) {
      console.error(`Error updating row ${row["Property ID"]}: ${err.message}`);
      errors++;
    }
  }

  console.log("\n=== Update Complete ===");
  console.log(`Total CSV rows: ${rows.length}`);
  console.log(`Updated (existing in CRM): ${updated}`);
  console.log(`Already imported (new leads): ${alreadyNew}`);
  console.log(`Not found in CRM: ${notFound}`);
  console.log(`Errors: ${errors}`);

  // Verify Recimple tag count
  const [tagCount] = await conn.query(
    "SELECT COUNT(DISTINCT propertyId) as count FROM propertyTags WHERE tag = 'Recimple'"
  );
  console.log(`\nTotal properties with 'Recimple' tag: ${tagCount[0].count}`);

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
