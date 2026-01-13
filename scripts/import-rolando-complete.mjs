import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api/trpc';
const EXCEL_FILE = process.env.EXCEL_FILE || '/home/ubuntu/upload/dealmachine-properties-2026-01-12-220953_rolando.xlsx';

async function importRolandoComplete() {
  try {
    console.log('📊 Reading Excel file...');
    const workbook = XLSX.readFile(EXCEL_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📈 Found ${data.length} properties to import`);

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const progress = `[${i + 1}/${data.length}]`;

      try {
        // Extract property data
        const propertyData = {
          propertyId: row.property_id?.toString(),
          leadId: row.lead_id?.toString(),
          addressFull: row.property_address_full || '',
          addressLine1: row.property_address_line_1 || '',
          addressLine2: row.property_address_line_2 || null,
          city: row.property_address_city || '',
          state: row.property_address_state || '',
          zipcode: (row.property_address_zipcode || '').toString(),
          county: (row.property_address_county || '').toString(),
          lat: row.property_lat ? parseFloat(row.property_lat) : undefined,
          lng: row.property_lng ? parseFloat(row.property_lng) : undefined,
          ownerName: (row.owner_1_name || 'Unknown').toString(),
          propertyFlags: (row.property_flags || '').toString(),
          dealMachineUrl: (row.dealmachine_url || '').toString(),
        };

        // Extract contacts
        const contacts = [];
        for (let j = 1; j <= 20; j++) {
          const contactName = row[`contact_${j}_name`];
          if (contactName) {
            const contact = {
              name: contactName,
              flags: row[`contact_${j}_flags`] || '',
              phones: [],
              emails: [],
            };

            // Add phones
            for (let k = 1; k <= 3; k++) {
              const phone = row[`contact_${j}_phone${k}`];
              if (phone) {
                contact.phones.push(phone.toString());
              }
            }

            // Add emails
            for (let k = 1; k <= 3; k++) {
              const email = row[`contact_${j}_email${k}`];
              if (email) {
                contact.emails.push(email.toString());
              }
            }

            contacts.push(contact);
          }
        }

        // Call tRPC API
        const response = await fetch(`${API_URL}/dealmachineRolando.importBulkRolando`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            json: {
              property: propertyData,
              contacts: contacts.length > 0 ? contacts : undefined,
            },
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          errorCount++;
          console.log(`${progress} ❌ HTTP ERROR ${response.status}: ${JSON.stringify(result)}`);
        } else if (result.result?.data?.json?.isNew) {
          successCount++;
          console.log(`${progress} ✅ ${propertyData.addressFull}`);
        } else if (result.result?.data?.json?.isNew === false) {
          duplicateCount++;
          console.log(`${progress} ⏭️  DUPLICATE: ${propertyData.addressFull}`);
        } else if (result.error) {
          errorCount++;
          console.log(`${progress} ❌ ERROR: ${JSON.stringify(result.error)}`);
        } else {
          successCount++;
          console.log(`${progress} ✅ ${propertyData.addressFull}`);
        }
      } catch (error) {
        errorCount++;
        console.log(`${progress} ❌ EXCEPTION: ${error.message}`);
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⏭️  Duplicates: ${duplicateCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total: ${data.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

importRolandoComplete();
