/**
 * Manual DealMachine Import Script
 * Run this inside the Manus project to import data directly to the database
 * 
 * Usage:
 * 1. Upload this file to the Manus project
 * 2. Upload the Excel file to the project
 * 3. Run: npx tsx manual-import.ts
 */

import { getDb } from "./server/db";
import { properties, contacts, contactPhones, contactEmails, contactAddresses } from "./drizzle/schema";
import { eq } from "drizzle-orm";
import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Helper functions
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parsePercent(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').trim();
    const num = Number(cleaned);
    return isNaN(num) ? null : num / 100;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const utc_days = Math.floor(value - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

async function main() {
  console.log("=".repeat(60));
  console.log("MANUAL DEALMACHINE IMPORT");
  console.log("=".repeat(60));

  // Read Excel file
  const filePath = './dealmachine-consolidated-2026-01-19-230853.xlsx';
  console.log(`\n[1/4] Reading Excel file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log("\nPlease upload the Excel file to the project root directory.");
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as any[];

  console.log(`✓ Found ${data.length} rows to import`);

  // Connect to database
  console.log("\n[2/4] Connecting to database...");
  const dbInstance = await getDb();
  if (!dbInstance) {
    console.error("❌ Database not available");
    process.exit(1);
  }
  console.log("✓ Database connected");

  // Import data
  console.log("\n[3/4] Importing properties...");
  let propertiesCount = 0;
  let contactsCount = 0;
  let phonesCount = 0;
  let emailsCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    try {
      const leadId = row.lead_id ? String(row.lead_id) : null;
      const propertyId = row.property_id ? String(row.property_id) : null;
      const parcelNumber = row.parcel_number ? String(row.parcel_number).trim() : 
                           row.apn_parcel_id ? String(row.apn_parcel_id).trim() : null;

      console.log(`\n  Row ${rowIndex + 1}: ${row.property_address_line_1 || 'Unknown'}`);
      console.log(`    Property ID: ${propertyId}, Parcel: ${parcelNumber}`);

      // Check for duplicates
      if (parcelNumber) {
        const existing = await dbInstance
          .select({ id: properties.id })
          .from(properties)
          .where(eq(properties.parcelNumber, parcelNumber))
          .limit(1);

        if (existing.length > 0) {
          console.log(`    ⚠️  Skipped: Parcel ${parcelNumber} already exists`);
          skippedCount++;
          continue;
        }
      }

      // Parse financial data
      const estimatedValue = parseNumber(row.estimated_value);
      const equityAmount = parseNumber(row.equity_amount);
      const mortgageBalance = parseNumber(row.total_loan_balance) || parseNumber(row.mortgage_balance);
      const taxAmount = parseNumber(row.tax_amt);
      const salePrice = parseNumber(row.sale_price);
      let equityPercent = parsePercent(row.equity_percent);
      if (!equityPercent && estimatedValue && equityAmount) {
        equityPercent = equityAmount / estimatedValue;
      }

      // Parse property details
      const bedrooms = parseNumber(row.total_bedrooms);
      const bathrooms = parseNumber(row.total_baths);
      const sqft = parseNumber(row.building_square_feet);
      const yearBuilt = parseNumber(row.year_built);
      const saleDate = parseDate(row.sale_date);

      // Prepare raw data
      const rawData: any = {
        lead_id: row.lead_id,
        property_id: propertyId,
        owner_1_name: row.owner_1_name,
        owner_2_name: row.owner_2_name,
        dealmachine_url: row.dealmachine_url,
        property_address_full: row.property_address_full,
        property_address_line_1: row.property_address_line_1,
        property_address_city: row.property_address_city,
        property_address_state: row.property_address_state,
        property_address_zipcode: row.property_address_zipcode,
        property_address_county: row.property_address_county,
        property_lat: row.property_lat,
        property_lng: row.property_lng,
        apn_parcel_id: parcelNumber,
        estimated_value: row.estimated_value,
        equity_amount: row.equity_amount,
        equity_percent: row.equity_percent,
        total_bedrooms: row.total_bedrooms,
        total_baths: row.total_baths,
        building_square_feet: row.building_square_feet,
        year_built: row.year_built,
        property_type: row.property_type,
        tax_amt: row.tax_amt,
        sale_price: row.sale_price,
        sale_date: row.sale_date,
        total_loan_balance: row.total_loan_balance,
        owner_address_full: row.owner_address_full,
        owner_address_line_1: row.owner_address_line_1,
        owner_address_city: row.owner_address_city,
        owner_address_state: row.owner_address_state,
        owner_address_zip: row.owner_address_zip,
        out_of_state_owner: row.out_of_state_owner,
      };

      // Insert property
      const propertyData: any = {
        propertyId,
        parcelNumber: parcelNumber || undefined,
        leadId,
        addressLine1: row.property_address_line_1 || 'TBD',
        addressLine2: row.property_address_line_2 || null,
        city: row.property_address_city || 'TBD',
        state: row.property_address_state || 'FL',
        zipcode: row.property_address_zipcode ? String(row.property_address_zipcode) : '00000',
        propertyType: row.property_type || null,
        yearBuilt: yearBuilt,
        totalBedrooms: bedrooms,
        totalBaths: bathrooms,
        buildingSquareFeet: sqft,
        estimatedValue: estimatedValue,
        equityAmount: equityAmount,
        equityPercent: equityPercent,
        totalLoanBalance: mortgageBalance,
        salePrice: salePrice,
        saleDate: saleDate,
        taxAmount: taxAmount,
        owner1Name: row.owner_1_name || null,
        owner2Name: row.owner_2_name || null,
        ownerMailingAddress: row.owner_address_line_1 || row.mailing_address || null,
        ownerMailingCity: row.owner_address_city || row.mailing_city || null,
        ownerMailingState: row.owner_address_state || row.mailing_state || null,
        ownerMailingZip: row.owner_address_zip || row.mailing_zipcode || null,
        dealMachinePropertyId: propertyId,
        dealMachineLeadId: leadId,
        dealMachineRawData: JSON.stringify(rawData),
        assignedAgentId: null,
        leadTemperature: 'TBD',
        deskStatus: 'BIN',
        source: 'DealMachine',
      };

      await dbInstance.insert(properties).values(propertyData);
      propertiesCount++;
      console.log(`    ✓ Property inserted`);

      // Get inserted property ID
      const [insertedProperty] = await dbInstance
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.propertyId, propertyId!))
        .limit(1);

      if (!insertedProperty) {
        console.log(`    ⚠️  Could not retrieve inserted property ID`);
        continue;
      }

      const insertedPropertyId = insertedProperty.id;

      // Import contacts
      for (let i = 1; i <= 20; i++) {
        const contactName = row[`contact_${i}_name`];
        if (!contactName) continue;

        const contactFlags = row[`contact_${i}_flags`] || null;

        const contactData: any = {
          propertyId: insertedPropertyId,
          name: contactName,
          flags: contactFlags,
        };

        const contactResult = await dbInstance.insert(contacts).values(contactData);
        const insertedContactId = contactResult[0].insertId;
        contactsCount++;

        // Import phones
        for (let p = 1; p <= 10; p++) {
          const phoneNumber = row[`contact_${i}_phone${p}`];
          if (phoneNumber && String(phoneNumber).trim()) {
            const phoneType = row[`contact_${i}_phone${p}_type`] || (p === 1 ? 'Mobile' : p === 2 ? 'Home' : 'Work');
            await dbInstance.insert(contactPhones).values({
              contactId: insertedContactId,
              phoneNumber: String(phoneNumber).trim(),
              phoneType: phoneType,
              isPrimary: p === 1 ? 1 : 0,
            } as any);
            phonesCount++;
          }
        }

        // Import emails
        for (let e = 1; e <= 10; e++) {
          const email = row[`contact_${i}_email${e}`];
          if (email && String(email).trim()) {
            await dbInstance.insert(contactEmails).values({
              contactId: insertedContactId,
              email: String(email).trim(),
              isPrimary: e === 1 ? 1 : 0,
            });
            emailsCount++;
          }
        }

        // Import mailing address
        const mailingAddressLine1 = row[`contact_${i}_mailing_address_line1`];
        const mailingCity = row[`contact_${i}_mailing_city`];
        const mailingState = row[`contact_${i}_mailing_state`];
        const mailingZipcode = row[`contact_${i}_mailing_zipcode`];

        if (mailingAddressLine1 && mailingCity && mailingState && mailingZipcode) {
          await dbInstance.insert(contactAddresses).values({
            contactId: insertedContactId,
            addressLine1: String(mailingAddressLine1).trim(),
            addressLine2: row[`contact_${i}_mailing_address_line2`] ? String(row[`contact_${i}_mailing_address_line2`]).trim() : null,
            city: String(mailingCity).trim(),
            state: String(mailingState).trim().substring(0, 2).toUpperCase(),
            zipcode: String(mailingZipcode).trim(),
            addressType: 'Mailing',
            isPrimary: 1,
          } as any);
        }
      }

      console.log(`    ✓ Imported ${contactsCount} contacts`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`    ❌ Error: ${errorMsg}`);
      errors.push(`Row ${rowIndex + 1}: ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n[4/4] Import Summary");
  console.log("=".repeat(60));
  console.log(`✓ Properties imported: ${propertiesCount}`);
  console.log(`✓ Contacts imported: ${contactsCount}`);
  console.log(`✓ Phones imported: ${phonesCount}`);
  console.log(`✓ Emails imported: ${emailsCount}`);
  console.log(`⚠️  Skipped (duplicates): ${skippedCount}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log("\n✅ Import complete!");
}

main().catch(console.error);
