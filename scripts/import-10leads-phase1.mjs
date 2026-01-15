#!/usr/bin/env node
/**
 * PHASE 1: Import 10 new leads with available data from Excel
 * - Contacts, phones, emails, property flags, GPS coordinates
 * - Missing data will be enriched in Phase 2
 */

import XLSX from 'xlsx';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

// Parse DATABASE_URL
const dbUrl = new URL(DATABASE_URL);
const connection = await mysql.createConnection({
  host: dbUrl.hostname,
  port: dbUrl.port || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('✅ Connected to database');

// Read Excel file
const workbook = XLSX.readFile('/home/ubuntu/crm-123drive-v2/dealmachine-properties-2026-01-12-220953_rolando10leads.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`📊 Found ${data.length} properties in Excel`);
console.log(`📊 Processing first 10 properties only\n`);

let imported = 0;
let totalContacts = 0;
let totalPhones = 0;
let totalEmails = 0;

for (const row of data.slice(0, 10)) {
  const leadId = row.lead_id;
  const propertyFlags = row.property_flags || '';
  const lat = row.property_lat;
  const lng = row.property_lng;
  
  console.log(`\n🏠 Processing Lead ID: ${leadId}`);
  console.log(`   Flags: ${propertyFlags}`);
  console.log(`   GPS: ${lat}, ${lng}`);
  
  // Create property with placeholder address (will be enriched in Phase 2)
  const [propertyResult] = await connection.execute(
    `INSERT INTO properties (
      addressLine1,
      city,
      state,
      zipcode,
      leadTemperature,
      dealMachinePropertyId,
      dealMachineRawData,
      createdAt,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      `[To be enriched - Lead ${leadId}]`,
      'TBD',
      'FL',
      '00000',
      'TBD',
      String(leadId),
      JSON.stringify({
        property_flags: propertyFlags,
        property_lat: lat,
        property_lng: lng,
        dealmachine_url: row.dealmachine_url || '',
        import_phase: 'phase1_partial',
        import_date: new Date().toISOString(),
      }),
    ]
  );
  
  const propertyId = propertyResult.insertId;
  console.log(`   ✅ Property created (ID: ${propertyId})`);
  
  // Import contacts
  let contactCount = 0;
  for (let i = 1; i <= 20; i++) {
    const contactName = row[`contact_${i}_name`];
    if (!contactName) continue;
    
    const contactFlags = row[`contact_${i}_flags`] || '';
    
    // Insert contact
    const [contactResult] = await connection.execute(
      `INSERT INTO contacts (
        propertyId,
        name,
        relationship,
        flags,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [
        propertyId,
        contactName,
        'Contact',
        contactFlags,
      ]
    );
    
    const contactId = contactResult.insertId;
    contactCount++;
    
    // Import phones
    let phoneCount = 0;
    for (let j = 1; j <= 3; j++) {
      const phone = row[`contact_${i}_phone${j}`];
      if (!phone) continue;
      
      await connection.execute(
        `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, createdAt)
         VALUES (?, ?, ?, ?, NOW())`,
        [contactId, String(phone), j === 1 ? 'Mobile' : 'Other', j === 1 ? 1 : 0]
      );
      phoneCount++;
      totalPhones++;
    }
    
    // Import emails
    let emailCount = 0;
    for (let j = 1; j <= 3; j++) {
      const email = row[`contact_${i}_email${j}`];
      if (!email) continue;
      
      await connection.execute(
        `INSERT INTO contactEmails (contactId, email, isPrimary, createdAt)
         VALUES (?, ?, ?, NOW())`,
        [contactId, email, j === 1 ? 1 : 0]
      );
      emailCount++;
      totalEmails++;
    }
    
    console.log(`   📇 Contact ${i}: ${contactName} (${phoneCount} phones, ${emailCount} emails)`);
  }
  
  totalContacts += contactCount;
  imported++;
  console.log(`   ✅ Imported ${contactCount} contacts for Lead ${leadId}`);
}

console.log(`\n${'='.repeat(80)}`);
console.log('PHASE 1 IMPORT COMPLETE');
console.log(`${'='.repeat(80)}`);
console.log(`✅ Properties imported: ${imported}`);
console.log(`✅ Contacts imported: ${totalContacts}`);
console.log(`✅ Phones imported: ${totalPhones}`);
console.log(`✅ Emails imported: ${totalEmails}`);
console.log(`\n📝 Note: Addresses are placeholders and will be enriched in Phase 2`);

await connection.end();
