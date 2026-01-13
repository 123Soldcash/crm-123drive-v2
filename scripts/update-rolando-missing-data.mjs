import * as XLSX from 'xlsx';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000/api/trpc';
const EXCEL_FILE = '/home/ubuntu/upload/dealmachine-properties-2026-01-12-220953_rolando.xlsx';

async function updateRolandoProperties() {
  console.log('📊 Reading Excel file...');
  
  // Read the Excel file
  const workbook = XLSX.readFile(EXCEL_FILE);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📈 Found ${data.length} properties to update`);
  
  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const progress = `[${i + 1}/${data.length}]`;
    
    try {
      // Extract property data
      const propertyData = {
        propertyId: row.property_id?.toString(),
        leadId: row.lead_id?.toString(),
        addressFull: row.property_address_full || '',
        lat: row.property_lat ? parseFloat(row.property_lat) : undefined,
        lng: row.property_lng ? parseFloat(row.property_lng) : undefined,
        county: (row.property_address_county || '').toString(),
        dealMachineUrl: (row.dealmachine_url || '').toString(),
        propertyFlags: (row.property_flags || '').toString(),
      };
      
      // Call the update mutation
      const response = await fetch(`${API_URL}/dealmachineRolando.updatePropertyData`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'dealmachineRolando.updatePropertyData',
          params: {
            input: propertyData,
          },
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        errorCount++;
        console.log(`${progress} ❌ HTTP ERROR ${response.status}: ${JSON.stringify(result)}`);
      } else if (result.result?.data?.json?.success) {
        successCount++;
        console.log(`${progress} ✅ Updated: ${propertyData.addressFull}`);
      } else if (result.error) {
        errorCount++;
        console.log(`${progress} ❌ ERROR: ${JSON.stringify(result.error)}`);
      } else {
        skipCount++;
        console.log(`${progress} ⏭️  SKIPPED: ${propertyData.addressFull}`);
      }
    } catch (error) {
      errorCount++;
      console.log(`${progress} ❌ EXCEPTION: ${error.message}`);
    }
  }
  
  console.log('\n📊 Update Summary:');
  console.log(`✅ Updated: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📈 Total: ${data.length}`);
}

updateRolandoProperties().catch(console.error);
