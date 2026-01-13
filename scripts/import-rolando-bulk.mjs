#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get CSV file path from command line
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('❌ Usage: node import-rolando-bulk.mjs <csv-file-path>');
  process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`❌ File not found: ${csvFilePath}`);
  process.exit(1);
}

// Read CSV file
const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

// Parse CSV
const records = parse(fileContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});

console.log(`📊 Found ${records.length} properties to import`);

// Call the tRPC endpoint via HTTP
async function importViaTRPC() {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    console.log(`🌐 API URL: ${apiUrl}`);
    console.log(`📤 Importing ${records.length} properties...\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Import each property
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const address = record.property_address_full?.trim();
      
      if (!address) {
        console.log(`⏭️  Skipping row ${i + 1}: no address`);
        continue;
      }

      try {
        // Prepare tRPC request
        const payload = {
          json: {
            property: {
              propertyId: record.property_id,
              leadId: record.lead_id,
              addressFull: address,
              addressLine1: record.property_address_line_1,
              addressLine2: record.property_address_line_2 || null,
              city: record.property_address_city,
              state: record.property_address_state,
              zipcode: record.property_address_zipcode,
              county: record.property_address_county,
              lat: record.property_lat ? parseFloat(record.property_lat) : undefined,
              lng: record.property_lng ? parseFloat(record.property_lng) : undefined,
              ownerName: record.owner_1_name,
              propertyFlags: record.property_flags,
              dealMachineUrl: record.dealmachine_url,
            },
            contacts: extractContacts(record),
          },
        };

        const response = await fetch(`${apiUrl}/api/trpc/dealmachineRolando.importBulkRolando`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (result.error) {
          errorCount++;
          errors.push({
            address: address,
            error: result.error.json?.message || 'Unknown error',
          });
          console.log(`❌ [${i + 1}/${records.length}] ${address}`);
          console.log(`   Error: ${result.error.json?.message}`);
        } else if (result.result?.data) {
          successCount++;
          const data = result.result.data;
          const status = data.isNew ? '✅ NEW' : '⏭️  EXISTS';
          console.log(`${status} [${i + 1}/${records.length}] ${address}`);
          if (data.isNew) {
            console.log(`   Contacts: ${data.contactsCreated}, Phones: ${data.phonesCreated}, Emails: ${data.emailsCreated}`);
          }
        }
      } catch (error) {
        errorCount++;
        errors.push({
          address: address,
          error: error.message,
        });
        console.log(`❌ [${i + 1}/${records.length}] ${address}`);
        console.log(`   Error: ${error.message}`);
      }

      // Add small delay to avoid overwhelming the server
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📈 Total: ${records.length}`);

    if (errors.length > 0 && errors.length <= 10) {
      console.log(`\n⚠️  Errors:`);
      errors.forEach(err => {
        console.log(`   - ${err.address}: ${err.error}`);
      });
    }

    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

function extractContacts(record) {
  const contacts = [];
  
  // Extract up to 20 contacts
  for (let i = 1; i <= 20; i++) {
    const contactName = record[`contact_${i}_name`]?.trim();
    if (!contactName) continue;

    const contact = {
      name: contactName,
      flags: record[`contact_${i}_flags`]?.trim() || '',
      phones: [],
      emails: [],
    };

    // Add up to 3 phones
    for (let j = 1; j <= 3; j++) {
      const phone = record[`contact_${i}_phone${j}`]?.trim();
      if (phone) {
        contact.phones.push(phone);
      }
    }

    // Add up to 3 emails
    for (let j = 1; j <= 3; j++) {
      const email = record[`contact_${i}_email${j}`]?.trim();
      if (email) {
        contact.emails.push(email);
      }
    }

    contacts.push(contact);
  }

  return contacts;
}

importViaTRPC();
