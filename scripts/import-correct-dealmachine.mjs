#!/usr/bin/env node
/**
 * Import DealMachine properties from CORRECT Excel file (393 columns)
 * Maps ALL fields: property details, financial info, owner data, contacts
 */

import XLSX from 'xlsx';
import mysql from 'mysql2/promise';
import { URL } from 'url';

// Parse DATABASE_URL
const dbUrl = new URL(process.env.DATABASE_URL);
const dbConfig = {
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
};

const EXCEL_FILE = process.argv[2] || '/home/ubuntu/crm-123drive-v2/dealmachine-properties-2026-01-12-220953_rolando_test.xlsx';
const LIMIT = parseInt(process.argv[3]) || 10; // Default: import 10 properties

console.log(`\n📊 DealMachine Import - CORRECT FILE (393 columns)`);
console.log(`=`.repeat(80));
console.log(`File: ${EXCEL_FILE}`);
console.log(`Limit: ${LIMIT} properties`);
console.log(`=`.repeat(80));
console.log();

// Read Excel file
console.log('📖 Reading Excel file...');
const workbook = XLSX.readFile(EXCEL_FILE);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`✅ Found ${rows.length} properties in Excel`);
console.log(`📦 Importing first ${LIMIT} properties...\n`);

// Connect to database
const connection = await mysql.createConnection(dbConfig);

let imported = {
  properties: 0,
  contacts: 0,
  phones: 0,
  emails: 0
};

try {
  for (let i = 0; i < Math.min(LIMIT, rows.length); i++) {
    const row = rows[i];
    
    console.log(`\n[${i + 1}/${LIMIT}] Processing: ${row.property_address_full || 'No address'}`);
    
    // Build dealMachineRawData JSON with ALL extended fields
    const rawData = {
      // GPS & Location
      property_lat: row.property_lat,
      property_lng: row.property_lng,
      property_address_county: row.property_address_county,
      
      // Property Extended
      construction_type: row.construction_type,
      effective_year_built: row.effective_year_built,
      heating_type: row.heating_type,
      heating_fuel_type: row.heating_fuel_type,
      roof_type: row.roof_type,
      property_class: row.property_class,
      county_land_use_code: row.county_land_use_code,
      lot_square_feet: row.lot_square_feet,
      lot_acreage: row.lot_acreage,
      legal_description: row.legal_description,
      apn_parcel_id: row.apn_parcel_id,
      zoning: row.zoning,
      flood_zone: row.flood_zone,
      
      // Property Style & Amenities
      style: row.style,
      stories: row.stories,
      units_count: row.units_count,
      sum_buildings_nbr: row.sum_buildings_nbr,
      sum_commercial_units: row.sum_commercial_units,
      sum_garage_sq_ft: row.sum_garage_sq_ft,
      air_conditioning: row.air_conditioning,
      basement: row.basement,
      deck: row.deck,
      exterior_walls: row.exterior_walls,
      interior_walls: row.interior_walls,
      num_of_fireplaces: row.num_of_fireplaces,
      floor_cover: row.floor_cover,
      garage: row.garage,
      driveway: row.driveway,
      other_rooms: row.other_rooms,
      pool: row.pool,
      patio: row.patio,
      porch: row.porch,
      roof_cover: row.roof_cover,
      sewer: row.sewer,
      topography: row.topography,
      water: row.water,
      geographic_features: row.geographic_features,
      
      // Financial Extended
      calculated_total_value: row.calculated_total_value,
      calculated_land_value: row.calculated_land_value,
      calculated_improvement_value: row.calculated_improvement_value,
      assd_total_value: row.assd_total_value,
      assd_land_value: row.assd_land_value,
      assd_improvement_value: row.assd_improvement_value,
      assd_year: row.assd_year,
      
      // Mortgage Details
      mortgage_amount: row.mortgage_amount,
      mtg1_est_loan_balance: row.mtg1_est_loan_balance,
      mtg1_est_payment_amount: row.mtg1_est_payment_amount,
      mortgage_interest_rate: row.mortgage_interest_rate,
      mortgage_date: row.mortgage_date,
      mortgage_term: row.mortgage_term,
      mortgage_due_date: row.mortgage_due_date,
      mortgage_loan_type: row.mortgage_loan_type,
      mortgage_financing_type: row.mortgage_financing_type,
      lender_name: row.lender_name,
      
      // Second Mortgage
      second_mortgage_amount: row.second_mortgage_amount,
      mtg2_est_loan_balance: row.mtg2_est_loan_balance,
      mtg2_est_payment_amount: row.mtg2_est_payment_amount,
      second_mortgage_interest_rate: row.second_mortgage_interest_rate,
      second_mortgage_loan_type: row.second_mortgage_loan_type,
      second_mortgage_financing_type: row.second_mortgage_financing_type,
      
      // Third & Fourth Mortgages
      mtg3_loan_amt: row.mtg3_loan_amt,
      mtg3_est_loan_balance: row.mtg3_est_loan_balance,
      mtg3_est_payment_amount: row.mtg3_est_payment_amount,
      mtg3_est_interest_rate: row.mtg3_est_interest_rate,
      mtg3_loan_type: row.mtg3_loan_type,
      mtg3_type_financing: row.mtg3_type_financing,
      mtg4_loan_amt: row.mtg4_loan_amt,
      mtg4_est_loan_balance: row.mtg4_est_loan_balance,
      mtg4_est_payment_amount: row.mtg4_est_payment_amount,
      mtg4_est_interest_rate: row.mtg4_est_interest_rate,
      mtg4_loan_type: row.mtg4_loan_type,
      mtg4_type_financing: row.mtg4_type_financing,
      
      // Tax Details
      tax_delinquent: row.tax_delinquent,
      tax_delinquent_year: row.tax_delinquent_year,
      
      // Sale Details
      document_type: row.document_type,
      last_sale_doc_type: row.last_sale_doc_type,
      recording_date: row.recording_date,
      
      // Owner Extended
      owner_1_firstname: row.owner_1_firstname,
      owner_1_lastname: row.owner_1_lastname,
      owner_2_firstname: row.owner_2_firstname,
      owner_2_lastname: row.owner_2_lastname,
      is_corporate_owner: row.is_corporate_owner,
      out_of_state_owner: row.out_of_state_owner,
      mailing_addresses: row.mailing_addresses,
      owner_address_full: row.owner_address_full,
      owner_address_line_1: row.owner_address_line_1,
      owner_address_line_2: row.owner_address_line_2,
      owner_address_city: row.owner_address_city,
      owner_address_state: row.owner_address_state,
      owner_address_zip: row.owner_address_zip,
      
      // Property Flags
      property_flags: row.property_flags,
      
      // HOA
      hoa_fee_amount: row.hoa_fee_amount,
      h_o_a1_name: row.h_o_a1_name,
      h_o_a1_type: row.h_o_a1_type,
      
      // Foreclosure
      auction_date: row.auction_date,
      default_date: row.default_date,
      past_due_amount: row.past_due_amount,
      active_lien: row.active_lien,
      market_status: row.market_status,
      market_sub_status: row.market_sub_status,
      
      // Building Condition
      estimated_repair_cost: row.estimated_repair_cost,
      estimated_repair_cost_per_sqft: row.estimated_repair_cost_per_sqft,
      building_condition: row.building_condition,
      building_quality: row.building_quality,
      
      // Research URLs
      dealmachine_url: row.dealmachine_url,
      httpsofficialrecords_broward_org: row['httpsofficialrecords.broward.orgacclaimwebsearchsearchtypename'],
      httpscounty_taxes_net: row['httpscounty-taxes.netbrowardbrowardproperty-tax'],
      violationsearch: row.violationsearch,
      httpsofficialrecords_simplesearch: row['httpsofficialrecords.broward.orgacclaimwebsearchsearchtypesimplesearch'],
      address_of_the_property: row.address_of_the_property,
      
      // Notes
      notes_1: row.notes_1,
      notes_2: row.notes2,
      notes_3: row.notes3,
      notes_4: row.notes4,
      notes_5: row.notes5,
      recent_note: row.recent_note,
      
      // Tracking
      creator: row.creator,
      date_created: row.date_created,
      last_exported_date: row.last_exported_date,
      total_times_mail_was_sent: row.total_times_mail_was_sent,
      last_mail_sent_date: row.last_mail_sent_date,
      tags: row.tags,
      assigned_to: row.assigned_to,
      
      // Additional tracking fields
      priority: row.priority,
      mail: row.mail,
      facebookprofile1: row.facebookprofile1,
      facebookprofile2: row.facebookprofile2,
      facebookprofile3: row.facebookprofile3,
      facebookprofile4: row.facebookprofile4,
      skiptracetruepeoplesearch: row.skiptracetruepeoplesearch,
      calledtruepeoplesearch: row.calledtruepeoplesearch,
      done_with_facebook: row.done_with_facebook,
      donemailing_onwers: row['donemailing_-_onwers'],
      donemailingrelatives: row.donemailingrelatives,
      emailonwersinstantly_ai: row['emailonwersinstantly.ai'],
      idi_search: row['idi_-_search'],
      skiptracemanus: row.skiptracemanus,
      calledmanus: row.calledmanus
    };
    
    // Insert property
    const [propertyResult] = await connection.execute(
      `INSERT INTO properties (
        dealMachinePropertyId,
        dealMachineLeadId,
        status,
        addressLine1,
        addressLine2,
        city,
        state,
        zipcode,
        subdivisionName,
        buildingSquareFeet,
        totalBedrooms,
        totalBaths,
        yearBuilt,
        propertyType,
        constructionType,
        estimatedValue,
        equityAmount,
        equityPercent,
        mortgageAmount,
        totalLoanBalance,
        totalLoanPayment,
        salePrice,
        saleDate,
        taxAmount,
        taxYear,
        owner1Name,
        owner2Name,
        ownerLocation,
        dealMachineRawData,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        row.property_id?.toString() || null,
        row.lead_id?.toString() || null,
        row.lead_status || 'New',
        row.property_address_line_1 || null,
        row.property_address_line_2 || null,
        row.property_address_city || null,
        row.property_address_state || null,
        row.property_address_zipcode || null,
        row.subdivision_name || null,
        row.building_square_feet || null,
        row.total_bedrooms || null,
        row.total_baths || null,
        row.year_built || null,
        row.property_type || null,
        row.construction_type || null,
        row.estimated_value || null,
        row.equity_amount || null,
        row.equity_percent || null,
        row.mortgage_amount || row.total_loan_amt || null,
        row.total_loan_balance || null,
        row.total_loan_payment || null,
        row.sale_price || null,
        row.sale_date && typeof row.sale_date === 'number' ? new Date((row.sale_date - 25569) * 86400 * 1000) : (row.sale_date ? new Date(row.sale_date) : null),
        row.tax_amt || null,
        row.tax_year || null,
        row.owner_1_name || null,
        row.owner_2_name || null,
        row.owner_location || null,
        JSON.stringify(rawData)
      ]
    );
    
    const propertyId = propertyResult.insertId;
    imported.properties++;
    
    // Insert property flags as tags
    if (row.property_flags) {
      const flags = row.property_flags.split(',').map(f => f.trim()).filter(f => f);
      for (const flag of flags) {
        await connection.execute(
          `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt)
           VALUES (?, ?, 1, NOW())`,
          [propertyId, flag]
        );
      }
      console.log(`     🏷️  Tags: ${flags.join(', ')}`);
    }
    
    console.log(`  ✅ Property #${propertyId} created`);
    console.log(`     Address: ${row.property_address_full}`);
    console.log(`     Value: $${row.estimated_value?.toLocaleString() || 0}`);
    console.log(`     Equity: $${row.equity_amount?.toLocaleString() || 0} (${Math.round((row.equity_percent || 0) * 100)}%)`);
    console.log(`     Mortgage: $${row.total_loan_balance?.toLocaleString() || 0}`);
    console.log(`     Tax: $${row.tax_amt?.toLocaleString() || 0} (Delinquent: ${row.tax_delinquent || 'No'})`);
    
    // Import contacts (up to 20)
    let contactCount = 0;
    for (let c = 1; c <= 20; c++) {
      const contactName = row[`contact_${c}_name`];
      if (!contactName) continue;
      
      const contactFlags = row[`contact_${c}_flags`] || null;
      
      // Insert contact
      const [contactResult] = await connection.execute(
        `INSERT INTO contacts (propertyId, name, flags, createdAt)
         VALUES (?, ?, ?, NOW())`,
        [propertyId, contactName, contactFlags]
      );
      
      const contactId = contactResult.insertId;
      contactCount++;
      imported.contacts++;
      
      // Insert phones
      let phoneCount = 0;
      for (let p = 1; p <= 3; p++) {
        const phone = row[`contact_${c}_phone${p}`];
        if (!phone) continue;
        
        const phoneType = row[`contact_${c}_phone${p}_type`] || 'mobile';
        
        await connection.execute(
          `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, createdAt)
           VALUES (?, ?, ?, NOW())`,
          [contactId, phone.toString(), phoneType]
        );
        
        phoneCount++;
        imported.phones++;
      }
      
      // Insert emails
      let emailCount = 0;
      for (let e = 1; e <= 3; e++) {
        const email = row[`contact_${c}_email${e}`];
        if (!email) continue;
        
        await connection.execute(
          `INSERT INTO contactEmails (contactId, email, createdAt)
           VALUES (?, ?, NOW())`,
          [contactId, email.toString()]
        );
        
        emailCount++;
        imported.emails++;
      }
      
      console.log(`     📞 Contact: ${contactName} (${phoneCount} phones, ${emailCount} emails)`);
    }
    
    if (contactCount === 0) {
      console.log(`     ⚠️  No contacts found`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ IMPORT COMPLETE`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 Summary:`);
  console.log(`   Properties: ${imported.properties}`);
  console.log(`   Contacts: ${imported.contacts}`);
  console.log(`   Phones: ${imported.phones}`);
  console.log(`   Emails: ${imported.emails}`);
  console.log(`${'='.repeat(80)}\n`);
  
} catch (error) {
  console.error(`\n❌ ERROR:`, error.message);
  console.error(error.stack);
} finally {
  await connection.end();
}
