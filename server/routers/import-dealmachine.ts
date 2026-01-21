import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { properties, contacts, contactPhones, contactEmails, contactAddresses } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { makeRequest } from "../_core/map";

// Helper function to convert Excel serial date to JavaScript Date
function excelDateToJSDate(serial: number): Date | null {
  if (!serial || serial <= 0) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info;
}

// Helper function to safely parse numbers
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  // Handle currency strings like "$278,000"
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// Helper function to safely parse percentage strings like "100.00%"
// Returns integer percentage (e.g., "100.00%" -> 100, "75.5%" -> 76)
function parsePercent(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').trim();
    const num = Number(cleaned);
    // Return as integer percentage (round to nearest whole number)
    return isNaN(num) ? null : Math.round(num);
  }
  const num = Number(value);
  // If it's already a decimal (0-1), convert to percentage
  if (num > 0 && num <= 1) {
    return Math.round(num * 100);
  }
  return isNaN(num) ? null : Math.round(num);
}

// Helper function to safely parse dates
function parseDate(value: any): Date | null {
  if (!value) return null;
  
  // If it's a number, treat it as Excel serial date
  if (typeof value === 'number') {
    return excelDateToJSDate(value);
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

export const importDealMachineRouter = router({
  uploadDealMachine: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // Base64 encoded Excel file
        assignedAgentId: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only admin can import properties
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can import properties');
      }

      const XLSX = await import('xlsx');
      
      // Decode base64 to buffer
      const buffer = Buffer.from(input.fileData, 'base64');
      
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      console.log(`[DealMachine Import] Starting import of ${data.length} rows`);
      
      const dbInstance = await getDb();
      if (!dbInstance) throw new Error('Database not available');
      
      let propertiesCount = 0;
      let contactsCount = 0;
      let phonesCount = 0;
      let emailsCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      const debug: string[] = [];
      
      debug.push(`Starting import: ${data.length} rows found in Excel file`);
      
      // PHASE 1: Import all properties and contacts with ALL 393 fields
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        try {
          // Extract property data
          const leadId = row.lead_id ? String(row.lead_id) : null;
          const propertyId = row.property_id ? String(row.property_id) : null;
          // Support both parcel_number and apn_parcel_id
          const parcelNumber = row.parcel_number ? String(row.parcel_number).trim() : 
                               row.apn_parcel_id ? String(row.apn_parcel_id).trim() : null;
          
          console.log(`[DealMachine Import] Row ${rowIndex + 1}: propertyId=${propertyId}, parcelNumber=${parcelNumber}, address=${row.property_address_line_1}`);
          debug.push(`Row ${rowIndex + 1}: Processing ${row.property_address_line_1 || 'NO ADDRESS'}`);
          
          // Skip if duplicate - check by APN first, then by address
          try {
            if (parcelNumber) {
              // Check by parcel number (APN)
              const existing = await dbInstance
                .select({ id: properties.id })
                .from(properties)
                .where(eq(properties.parcelNumber, parcelNumber))
                .limit(1);
              
              if (existing.length > 0) {
                console.log(`[DealMachine Import] Row ${rowIndex + 1}: Parcel ${parcelNumber} already exists. Skipping.`);
                debug.push(`Row ${rowIndex + 1}: SKIPPED - Parcel ${parcelNumber} already exists`);
                skippedCount++;
                continue;
              }
            } else {
              // No APN - check by address (addressLine1 + city + zipcode)
              const addressLine1 = row.property_address_line_1;
              const city = row.property_address_city;
              const zipcode = row.property_address_zipcode;
              
              if (addressLine1 && city && zipcode) {
                const existing = await dbInstance
                  .select({ id: properties.id })
                  .from(properties)
                  .where(
                    and(
                      eq(properties.addressLine1, addressLine1),
                      eq(properties.city, city),
                      eq(properties.zipcode, zipcode)
                    )
                  )
                  .limit(1);
                
                if (existing.length > 0) {
                  console.log(`[DealMachine Import] Row ${rowIndex + 1}: Address ${addressLine1}, ${city} ${zipcode} already exists. Skipping.`);
                  debug.push(`Row ${rowIndex + 1}: SKIPPED - Address already exists`);
                  skippedCount++;
                  continue;
                }
              }
            }
            debug.push(`Row ${rowIndex + 1}: No duplicate found - Proceeding with import`);
          } catch (dupCheckError: any) {
            console.error(`[DealMachine Import] Row ${rowIndex + 1}: Duplicate check failed:`, dupCheckError.message);
            debug.push(`Row ${rowIndex + 1}: WARNING - Duplicate check failed, proceeding anyway`);
            // Continue with import even if duplicate check fails
          }
          
          // Prepare comprehensive dealMachineRawData with ALL 393 fields
          const rawData: any = {
            // Lead fields
            lead_id: row.lead_id,
            owner_1_name: row.owner_1_name,
            dealmachine_url: row.dealmachine_url,
            
            // Property fields (53 total)
            property_id: propertyId,
            property_address_line_1: row.property_address_line_1,
            property_address_line_2: row.property_address_line_2,
            property_address_city: row.property_address_city,
            property_address_state: row.property_address_state,
            property_address_zipcode: row.property_address_zipcode,
            property_address_county: row.property_address_county,
            property_lat: row.property_lat,
            property_lng: row.property_lng,
            property_flags: row.property_flags,
            
            // Property details
            property_type: row.property_type,
            year_built: row.year_built,
            bedrooms: row.total_bedrooms || row.bedrooms,
            bathrooms: row.total_baths || row.bathrooms,
            total_sqft: row.building_square_feet || row.total_sqft,
            construction_type: row.construction_type,
            heating_type: row.heating_type,
            roof_type: row.roof_type,
            lot_sqft: row.lot_square_feet || row.lot_sqft,
            zoning: row.zoning,
            flood_zone: row.flood_zone,
            
            // Financial fields (26 total)
            estimated_value: row.estimated_value,
            estimated_equity: row.equity_amount,
            estimated_equity_percent: row.equity_percent,
            total_open_loans: row.total_open_loans,
            total_loan_amt: row.total_loan_amt,
            total_loan_balance: row.total_loan_balance,
            
            // Mortgage details (up to 4 mortgages)
            mortgage_amount: row.mortgage_amount,
            mortgage_balance: row.mortgage_balance,
            mortgage_payment: row.mortgage_payment,
            mortgage_interest_rate: row.mortgage_interest_rate,
            mortgage_loan_type: row.mortgage_loan_type,
            mortgage_lender: row.mortgage_lender,
            
            mortgage_2_amount: row.second_mortgage_amount,
            mortgage_2_balance: row.mtg2_est_loan_balance,
            mortgage_2_payment: row.mtg2_est_payment_amount,
            mortgage_2_interest_rate: row.second_mortgage_interest_rate,
            mortgage_2_loan_type: row.mortgage_2_loan_type,
            mortgage_2_lender: row.mortgage_2_lender,
            
            mortgage_3_amount: row.mtg3_loan_amt,
            mortgage_3_balance: row.mtg3_est_loan_balance,
            mortgage_3_payment: row.mtg3_est_payment_amount,
            mortgage_3_interest_rate: row.mtg3_est_interest_rate,
            mortgage_3_loan_type: row.mortgage_3_loan_type,
            mortgage_3_lender: row.mortgage_3_lender,
            
            mortgage_4_amount: row.mtg4_loan_amt,
            mortgage_4_balance: row.mtg4_est_loan_balance,
            mortgage_4_payment: row.mortgage_4_payment,
            mortgage_4_interest_rate: row.mtg4_est_interest_rate,
            mortgage_4_loan_type: row.mortgage_4_loan_type,
            mortgage_4_lender: row.mortgage_4_lender,
            
            // Tax and assessment
            tax_amount: row.tax_amt,
            tax_year: row.tax_year,
            tax_delinquent: row.tax_delinquent,
            tax_delinquent_year: row.tax_delinquent_year,
            assessed_land_value: row.assessed_land_value,
            assessed_improvement_value: row.assessed_improvement_value,
            assessed_total_value: row.assd_total_value,
            calculated_land_value: row.calculated_land_value,
            calculated_improvement_value: row.calculated_improvement_value,
            calculated_total_value: row.calculated_total_value,
            
            // Sale history
            sale_date: row.sale_date,
            sale_price: row.sale_price,
            sale_deed_type: row.sale_deed_type,
            
            // Owner fields (8 total)
            owner_1_first_name: row.owner_1_first_name,
            owner_1_last_name: row.owner_1_last_name,
            owner_2_name: row.owner_2_name,
            owner_2_first_name: row.owner_2_first_name,
            owner_2_last_name: row.owner_2_last_name,
            owner_address_full: row.owner_address_full,
            owner_address_line_1: row.owner_address_line_1,
            owner_address_city: row.owner_address_city,
            owner_address_state: row.owner_address_state,
            owner_address_zip: row.owner_address_zip,
            owner_location: row.owner_location,
            is_corporate_owner: row.is_corporate_owner,
            out_of_state_owner: row.out_of_state_owner,
            
            // Research URLs
            county_records_url: row.county_records_url,
            tax_search_url: row.tax_search_url,
            violations_url: row.violations_url,
            
            // Notes (5 fields)
            notes_1: row.notes_1,
            notes_2: row.notes_2,
            notes_3: row.notes_3,
            notes_4: row.notes_4,
            notes_5: row.notes_5,
            
            // Tracking fields
            creator: row.creator,
            date_created: row.date_created,
            last_exported: row.last_exported_date,
            mail_sent_date: row.mail_sent_date,
            tags: row.tags,
            assigned_to: row.assigned_to,
            lead_status: row.lead_status,
            lead_source: row.lead_source,
            
            // Additional property details
            building_condition: row.building_condition,
            building_quality: row.building_quality,
            estimated_repair_cost: row.estimated_repair_cost,
            estimated_repair_cost_per_sqft: row.estimated_repair_cost_per_sqft,
            market_status: row.market_status,
            active_lien: row.active_lien,
            legal_description: row.legal_description,
            subdivision_name: row.subdivision_name,
            property_class: row.property_class,
            stories: row.stories,
            air_conditioning: row.air_conditioning,
            exterior_walls: row.exterior_walls,
            interior_walls: row.interior_walls,
            floor_cover: row.floor_cover,
            pool: row.pool,
            deck: row.deck,
            roof_cover: row.roof_cover,
          };
          
          // Parse financial data for direct database columns
          const estimatedValue = parseNumber(row.estimated_value);
          const equityAmount = parseNumber(row.equity_amount);
          const mortgageBalance = parseNumber(row.total_loan_balance) || parseNumber(row.mortgage_balance);
          const taxAmount = parseNumber(row.tax_amt);
          const salePrice = parseNumber(row.sale_price);
          
          // Calculate equity percent - handle percentage strings like "100.00%"
          let equityPercent = parsePercent(row.equity_percent);
          if (!equityPercent && estimatedValue && equityAmount) {
            equityPercent = equityAmount / estimatedValue;
          }
          
          // Parse property details
          const bedrooms = parseNumber(row.total_bedrooms);
          const bathrooms = parseNumber(row.total_baths);
          const sqft = parseNumber(row.building_square_feet);
          const yearBuilt = parseNumber(row.year_built);
          
          // Parse dates
          const saleDate = parseDate(row.sale_date);
          
          console.log(`[DealMachine Import] Row ${rowIndex + 1}: Parsed values - estimatedValue=${estimatedValue}, equityAmount=${equityAmount}, equityPercent=${equityPercent}`);
          
          // Insert property with all available fields
          const propertyData: any = {
            // Core identifiers (FIXED: added leadId and propertyId)
            leadId: leadId ? parseInt(leadId) : null,
            propertyId: propertyId,
            parcelNumber: parcelNumber || null,
            apnParcelId: row.apn_parcel_id ? String(row.apn_parcel_id) : null,
            
            // Address information
            addressLine1: row.property_address_line_1 || 'TBD',
            addressLine2: row.property_address_line_2 || null,
            city: row.property_address_city || 'TBD',
            state: row.property_address_state || 'FL',
            zipcode: row.property_address_zipcode ? String(row.property_address_zipcode) : '00000',
            subdivisionName: row.subdivision_name || null,
            
            // Property details
            propertyType: row.property_type || null,
            constructionType: row.construction_type || null,
            yearBuilt: yearBuilt,
            totalBedrooms: bedrooms,
            totalBaths: bathrooms,
            buildingSquareFeet: sqft,
            
            // Financial information
            estimatedValue: estimatedValue,
            equityAmount: equityAmount,
            equityPercent: equityPercent,
            mortgageAmount: parseNumber(row.mortgage_amount),
            totalLoanBalance: mortgageBalance,
            totalLoanPayment: parseNumber(row.total_loan_payment),
            estimatedRepairCost: parseNumber(row.estimated_repair_cost),
            salePrice: salePrice,
            saleDate: saleDate,
            
            // Tax information
            taxAmount: taxAmount,
            taxYear: parseNumber(row.tax_year),
            taxDelinquent: row.tax_delinquent || null,
            taxDelinquentYear: parseNumber(row.tax_delinquent_year),
            
            // Owner information
            owner1Name: row.owner_1_name || null,
            owner2Name: row.owner_2_name || null,
            ownerLocation: row.owner_location || null,
            // NOTE: ownerMailingAddress, ownerMailingCity, ownerMailingState, ownerMailingZip
            // were REMOVED because they don't exist in the CRM schema
            // Owner mailing data is stored in dealMachineRawData JSON
            
            // Market information
            marketStatus: row.market_status || null,
            status: row.lead_status || null, // Original status from DealMachine
            
            // DealMachine references
            dealMachinePropertyId: propertyId,
            dealMachineLeadId: leadId,
            dealMachineRawData: JSON.stringify(rawData),
            
            // Assignment and defaults
            assignedAgentId: input.assignedAgentId,
            leadTemperature: 'TBD',
            deskStatus: 'BIN',
            source: 'DealMachine',
            trackingStatus: 'Not Visited',
            ownerVerified: 0,
            dealStage: 'NEW_LEAD',
            
            // Timestamp fields (required with defaults)
            entryDate: new Date(),
            stageChangedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          console.log(`[DealMachine Import] Row ${rowIndex + 1}: Inserting property...`);
          debug.push(`Row ${rowIndex + 1}: Attempting INSERT into database...`);
          
          // Log the property data for debugging
          console.log(`[DealMachine Import] Row ${rowIndex + 1}: PropertyData keys:`, Object.keys(propertyData));
          console.log(`[DealMachine Import] Row ${rowIndex + 1}: PropertyData values:`, JSON.stringify(propertyData, null, 2));
          
          try {
            await dbInstance.insert(properties).values(propertyData);
          } catch (insertError: any) {
            console.error(`[DealMachine Import] Row ${rowIndex + 1}: INSERT FAILED:`, insertError.message);
            console.error(`[DealMachine Import] Row ${rowIndex + 1}: Full error:`, insertError);
            throw insertError;
          }
          propertiesCount++;
          
          console.log(`[DealMachine Import] Row ${rowIndex + 1}: Property inserted successfully!`);
          debug.push(`Row ${rowIndex + 1}: SUCCESS - Property inserted!`);
          
          // Get inserted property ID
          const [insertedProperty] = await dbInstance
            .select({ id: properties.id })
            .from(properties)
            .where(eq(properties.propertyId, propertyId!))
            .limit(1);
          
          if (!insertedProperty) {
            console.log(`[DealMachine Import] Row ${rowIndex + 1}: Could not find inserted property to add contacts`);
            continue;
          }
          
          const insertedPropertyId = insertedProperty.id;
          
          // PHASE 1: Import contacts (1-20) with all fields each
          for (let i = 1; i <= 20; i++) {
            const contactName = row[`contact_${i}_name`];
            if (!contactName) continue;
            
            const contactFlags = row[`contact_${i}_flags`] || null;
            
            // Insert contact
            const contactData: any = {
              propertyId: insertedPropertyId,
              name: contactName,
              flags: contactFlags,
            };
            
            const contactResult = await dbInstance.insert(contacts).values(contactData);
            const insertedContactId = contactResult[0].insertId;
            contactsCount++;
            
            // Import ALL phones (up to 10)
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
            
            // Import ALL emails (up to 10)
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

            // Import Mailing Address
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
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[DealMachine Import] Row ${rowIndex + 1}: Error importing row:`, errorMsg);
          errors.push(`Row ${rowIndex + 1} (${row.property_address_line_1 || 'unknown'}): ${errorMsg}`);
          debug.push(`Row ${rowIndex + 1}: ERROR - ${errorMsg}`);
          // Continue with next row
        }
      }
      
      console.log(`[DealMachine Import] Phase 1 complete: ${propertiesCount} properties, ${contactsCount} contacts, ${phonesCount} phones, ${emailsCount} emails, ${skippedCount} skipped, ${errors.length} errors`);
      
      // PHASE 2: Enrich addresses using Google Maps (only for properties with TBD address)
      const propertiesWithGPS = await dbInstance
        .select({
          id: properties.id,
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state,
          zipcode: properties.zipcode,
          dealMachineRawData: properties.dealMachineRawData,
        })
        .from(properties)
        .where(eq(properties.addressLine1, 'TBD'));
      
      for (const property of propertiesWithGPS) {
        try {
          if (!property.dealMachineRawData) continue;
          
          const rawData = JSON.parse(property.dealMachineRawData);
          const lat = rawData.property_lat;
          const lng = rawData.property_lng;
          
          if (!lat || !lng) continue;
          
          // Call Google Maps Geocoding API
          const response: any = await makeRequest(
            `/maps/api/geocode/json?latlng=${lat},${lng}`,
            { method: 'GET' }
          );
          
          if (response?.results && response.results.length > 0) {
            const result = response.results[0];
            const addressComponents = result.address_components;
            
            let streetNumber = '';
            let route = '';
            let city = '';
            let state = '';
            let zipcode = '';
            
            for (const component of addressComponents) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name;
              }
              if (component.types.includes('route')) {
                route = component.long_name;
              }
              if (component.types.includes('locality')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
              if (component.types.includes('postal_code')) {
                zipcode = component.long_name;
              }
            }
            
            const addressLine1 = `${streetNumber} ${route}`.trim();
            
            if (addressLine1) {
              await dbInstance
                .update(properties)
                .set({
                  addressLine1,
                  city: city || 'TBD',
                  state: state || 'FL',
                  zipcode: zipcode || '00000',
                })
                .where(eq(properties.id, property.id));
            }
          }
        } catch (error) {
          console.error('Error enriching address:', error);
          // Continue with next property
        }
      }
      
      return {
        propertiesCount,
        contactsCount,
        phonesCount,
        emailsCount,
        skippedCount,
        errors,
        debug,
      };
    }),
});
