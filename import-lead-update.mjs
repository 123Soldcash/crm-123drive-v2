import * as XLSX from 'xlsx';
import { getDb } from './server/db.ts';
import { properties, contactPhones, contactEmails } from './drizzle/schema.ts';

const filePath = '/home/ubuntu/upload/dealmachine-consolidated-2026-01-20-174202-841Sw1stAve.xlsx';

async function importLeadData() {
  try {
    console.log('📂 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Sheet1'];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`✅ Found ${data.length} rows in Excel file`);
    
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const propertyId = row.property_id;
        const leadId = row.lead_id;
        const address = row.property_address_line_1;
        const city = row.property_address_city;
        const state = row.property_address_state;
        const zipcode = row.property_address_zipcode;
        
        console.log(`\n📍 Processing: ${address}, ${city}, ${state} ${zipcode}`);
        
        // Check if property exists
        const existing = await db.query.properties.findFirst({
          where: (p, { eq }) => eq(p.propertyId, String(propertyId))
        });
        
        if (existing) {
          console.log(`   ✏️  Updating existing property (ID: ${existing.id})`);
          updatedCount++;
        } else {
          console.log(`   ➕ Creating new property`);
          importedCount++;
        }
        
        // Parse numeric values
        const parseNumber = (val) => {
          if (!val) return null;
          if (typeof val === 'string') {
            const cleaned = val.replace(/[$,]/g, '');
            const num = Number(cleaned);
            return isNaN(num) ? null : num;
          }
          return isNaN(val) ? null : Number(val);
        };
        
        const estimatedValue = parseNumber(row.estimated_value);
        const equityAmount = parseNumber(row.equity_amount);
        const equityPercent = parseNumber(row.equity_percent);
        const totalLoanBalance = parseNumber(row.total_loan_balance);
        const totalLoanPayment = parseNumber(row.total_loan_payment);
        
        // Prepare property data
        const propData = {
          propertyId: String(propertyId),
          leadId: leadId ? parseInt(leadId) : null,
          addressLine1: address || null,
          city: city || null,
          state: state || null,
          zipcode: zipcode || null,
          estimatedValue,
          equityAmount,
          equityPercent,
          totalLoanBalance,
          totalLoanPayment,
          owner1Name: row.owner_1_name || null,
          buildingSquareFeet: row.building_square_feet ? parseInt(row.building_square_feet) : null,
          totalBedrooms: row.total_bedrooms ? parseInt(row.total_bedrooms) : null,
          totalBaths: row.total_baths ? parseInt(row.total_baths) : null,
          yearBuilt: row.year_built ? parseInt(row.year_built) : null,
          propertyType: row.property_type || null,
          constructionType: row.construction_type || null,
          apnParcelId: row.apn_parcel_id ? String(row.apn_parcel_id) : null,
          dealMachinePropertyId: String(propertyId),
          dealMachineLeadId: String(leadId),
          source: 'DealMachine',
          status: row.lead_status || 'New',
          leadTemperature: 'WARM',
          dealMachineRawData: JSON.stringify({
            property_address_full: row.property_address_full,
            property_address_county: row.property_address_county,
            property_lat: row.property_lat,
            property_lng: row.property_lng,
            lead_status: row.lead_status,
            assigned_to: row.assigned_to,
            tags: row.tags,
            recent_note: row.recent_note,
            lead_source: row.lead_source,
            date_created: row.date_created,
            last_exported_date: row.last_exported_date,
            subdivisionName: row.subdivision_name,
            taxDelinquent: row.tax_delinquent,
            taxDelinquentYear: row.tax_delinquent_year,
            dealmachine_url: row.dealmachine_url
          })
        };
        
        if (existing) {
          // Update existing
          await db.update(properties)
            .set(propData)
            .where((p) => p.id === existing.id);
        } else {
          // Insert new
          await db.insert(properties).values(propData);
        }
        
        console.log(`   ✅ Success`);
        
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Created: ${importedCount}`);
    console.log(`   ✏️  Updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

importLeadData().then(() => {
  console.log('\n✨ Import complete!');
  process.exit(0);
});
