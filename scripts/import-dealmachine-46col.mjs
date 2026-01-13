#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('❌ Missing database environment variables');
  process.exit(1);
}

// Get CSV file path from command line
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('❌ Usage: node import-dealmachine-46col.mjs <csv-file-path>');
  process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`❌ File not found: ${csvFilePath}`);
  process.exit(1);
}

async function importCSV() {
  let connection;
  try {
    // Read and parse CSV
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    console.log(`📊 Found ${records.length} properties to import`);

    // Connect to database
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });

    let importedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      try {
        // Extract property data
        const propertyId = record.property_id?.trim();
        const address = record.property_address_full?.trim();
        const street = record.property_address_line_1?.trim();
        const city = record.property_address_city?.trim();
        const state = record.property_address_state?.trim();
        const zipcode = record.property_address_zipcode?.trim();
        const ownerName = record.owner_1_name?.trim();

        // Validate required fields
        if (!address || !city || !state || !zipcode) {
          console.log(`⏭️  Skipping property (missing required fields): ${address}`);
          skippedCount++;
          continue;
        }

        // Check for duplicates
        const [existing] = await connection.execute(
          'SELECT id FROM properties WHERE addressFull = ?',
          [address]
        );

        if (existing.length > 0) {
          console.log(`⏭️  Skipping duplicate: ${address}`);
          skippedCount++;
          continue;
        }

        // Insert property
        const [result] = await connection.execute(
          `INSERT INTO properties (
            addressFull, addressLine1, addressCity, addressState, addressZipcode,
            ownerName, leadTemperature, deskStatus, source, listName, entryDate,
            propertyId, dealMachinePropertyId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            address,
            street,
            city,
            state,
            zipcode,
            ownerName || 'Unknown',
            'TBD',
            'BIN',
            'DealMachine',
            'DealMachine Import',
            new Date(),
            propertyId,
            propertyId,
          ]
        );

        const newPropertyId = result.insertId;
        console.log(`✅ Imported: ${address} (ID: ${newPropertyId})`);

        // Import contacts
        let contactCount = 0;
        for (let i = 1; i <= 4; i++) {
          const contactName = record[`contact_${i}_name`]?.trim();
          if (!contactName) continue;

          const contactPhone1 = record[`contact_${i}_phone1`]?.trim();
          const contactEmail1 = record[`contact_${i}_email1`]?.trim();

          // Insert contact
          const [contactResult] = await connection.execute(
            `INSERT INTO contacts (propertyId, name, relationship, phone) VALUES (?, ?, ?, ?)`,
            [newPropertyId, contactName, 'Owner', contactPhone1 || null]
          );

          const contactId = contactResult.insertId;

          // Add phone if exists
          if (contactPhone1) {
            await connection.execute(
              `INSERT INTO contactPhones (contactId, phone, isPrimary) VALUES (?, ?, ?)`,
              [contactId, contactPhone1, 1]
            );
          }

          // Add emails if exist
          if (contactEmail1) {
            await connection.execute(
              `INSERT INTO contactEmails (contactId, email) VALUES (?, ?)`,
              [contactId, contactEmail1]
            );
          }

          contactCount++;
        }

        if (contactCount > 0) {
          console.log(`   └─ Added ${contactCount} contacts`);
        }

        importedCount++;
      } catch (error) {
        console.error(`❌ Error importing property:`, error.message);
      }
    }

    console.log(`\n📈 Import Summary:`);
    console.log(`   ✅ Imported: ${importedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📊 Total: ${records.length}`);

    if (importedCount > 0) {
      console.log(`\n✨ Successfully imported ${importedCount} properties!`);
    }
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

importCSV();
