#!/usr/bin/env node
/**
 * Complete Reimport Script for Rolando Excel Data
 * Run with: node scripts/reimport-rolando.mjs
 */

import XLSX from 'xlsx';
import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to clean phone numbers
function cleanPhone(phone) {
  if (!phone || phone === '' || phone === 'nan' || phone === 'NaN') return null;
  const phoneStr = String(phone).replace('.0', '').replace(/\.0$/, '').trim();
  if (!phoneStr || phoneStr === 'nan' || phoneStr === 'NaN') return null;
  const cleaned = phoneStr.replace(/[^\d+]/g, '');
  return cleaned || null;
}

// Helper to clean emails
function cleanEmail(email) {
  if (!email || email === '' || email === 'nan' || email === 'NaN') return null;
  const emailStr = String(email).trim().toLowerCase();
  if (!emailStr || emailStr === 'nan' || !emailStr.includes('@')) return null;
  return emailStr;
}

// Parse DATABASE_URL
function parseDbUrl(url) {
  // Remove ssl parameter if present
  const cleanUrl = url.split('?')[0];
  const match = cleanUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5]
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('ROLANDO EXCEL COMPLETE REIMPORT');
  console.log('='.repeat(80));
  
  // Read DATABASE_URL from environment or .env file
  let dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    // Try to read from .env file
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (match) {
        dbUrl = match[1];
      }
    }
  }
  
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found');
    process.exit(1);
  }
  
  // Parse connection details
  const dbConfig = parseDbUrl(dbUrl);
  console.log(`\n🔌 Connecting to database at ${dbConfig.host}:${dbConfig.port}...`);
  
  // Connect to database
  const connection = await mysql.createConnection({
    ...dbConfig,
    ssl: {
      rejectUnauthorized: true
    }
  });
  console.log('   Connected successfully!');
  
  // Load Excel file
  const excelPath = path.join(__dirname, '..', 'dealmachine-properties-2026-01-12-220953_rolando.xlsx');
  console.log(`\n📂 Loading Excel file: ${excelPath}`);
  
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log(`   Found ${data.length} properties in Excel`);
  
  // Step 1: Get all property IDs with dealMachinePropertyId
  console.log(`\n🔍 Finding existing Rolando properties...`);
  const [existingProps] = await connection.execute(
    'SELECT id, dealMachinePropertyId FROM properties WHERE dealMachinePropertyId IS NOT NULL'
  );
  
  const propMap = new Map();
  existingProps.forEach(p => {
    propMap.set(String(p.dealMachinePropertyId), p.id);
  });
  console.log(`   Found ${propMap.size} existing Rolando properties in database`);
  
  // Step 2: Delete existing contacts, phones, emails for these properties
  if (propMap.size > 0) {
    const propIds = Array.from(propMap.values());
    console.log(`\n🗑️  Cleaning existing contact data...`);
    
    // Get contact IDs for these properties
    const placeholders = propIds.map(() => '?').join(',');
    const [existingContacts] = await connection.execute(
      `SELECT id FROM contacts WHERE propertyId IN (${placeholders})`,
      propIds
    );
    
    const contactIds = existingContacts.map(c => c.id);
    
    if (contactIds.length > 0) {
      const contactPlaceholders = contactIds.map(() => '?').join(',');
      
      // Delete phones
      const [phoneResult] = await connection.execute(
        `DELETE FROM contactPhones WHERE contactId IN (${contactPlaceholders})`,
        contactIds
      );
      console.log(`   Deleted ${phoneResult.affectedRows} phone records`);
      
      // Delete emails
      const [emailResult] = await connection.execute(
        `DELETE FROM contactEmails WHERE contactId IN (${contactPlaceholders})`,
        contactIds
      );
      console.log(`   Deleted ${emailResult.affectedRows} email records`);
      
      // Delete contacts
      const [contactResult] = await connection.execute(
        `DELETE FROM contacts WHERE propertyId IN (${placeholders})`,
        propIds
      );
      console.log(`   Deleted ${contactResult.affectedRows} contact records`);
    }
  }
  
  // Step 3: Import all contacts from Excel
  console.log(`\n📥 Importing contacts from Excel...`);
  
  let totalContacts = 0;
  let totalPhones = 0;
  let totalEmails = 0;
  let propertiesUpdated = 0;
  
  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    const propertyIdDm = String(row['property_id'] || '');
    
    if (!propMap.has(propertyIdDm)) {
      continue;
    }
    
    const propertyId = propMap.get(propertyIdDm);
    propertiesUpdated++;
    
    // Update property with lat/lng/county/url/flags in dealMachineRawData
    const rawData = {};
    if (row['property_lat']) rawData.lat = Number(row['property_lat']);
    if (row['property_lng']) rawData.lng = Number(row['property_lng']);
    if (row['property_address_county']) rawData.county = String(row['property_address_county']);
    if (row['dealmachine_url']) rawData.dealMachineUrl = String(row['dealmachine_url']);
    
    // Store property flags in rawData
    const propertyFlags = row['property_flags'];
    if (propertyFlags && String(propertyFlags).trim()) {
      const flagsList = String(propertyFlags).split(',').map(f => f.trim()).filter(f => f);
      if (flagsList.length > 0) {
        rawData.propertyFlags = flagsList;
      }
    }
    
    if (Object.keys(rawData).length > 0) {
      await connection.execute(
        'UPDATE properties SET dealMachineRawData = ? WHERE id = ?',
        [JSON.stringify(rawData), propertyId]
      );
    }
    
    // Import ALL 20 contacts
    for (let contactNum = 1; contactNum <= 20; contactNum++) {
      const nameCol = `contact_${contactNum}_name`;
      const flagsCol = `contact_${contactNum}_flags`;
      
      const contactName = row[nameCol];
      if (!contactName || !String(contactName).trim()) {
        continue;
      }
      
      const cleanName = String(contactName).trim();
      const contactFlags = row[flagsCol] ? String(row[flagsCol]) : '';
      
      // Determine relationship from flags
      let relationship = 'Other';
      if (contactFlags.includes('Likely Owner')) {
        relationship = 'Owner';
      } else if (contactFlags.includes('Resident')) {
        relationship = 'Resident';
      } else if (contactFlags.includes('Relative')) {
        relationship = 'Relative';
      }
      
      // Insert contact
      const [contactResult] = await connection.execute(
        'INSERT INTO contacts (propertyId, name, relationship, flags, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [propertyId, cleanName, relationship, contactFlags]
      );
      
      const contactId = contactResult.insertId;
      totalContacts++;
      
      // Import all 3 phones
      for (let phoneNum = 1; phoneNum <= 3; phoneNum++) {
        const phoneCol = `contact_${contactNum}_phone${phoneNum}`;
        const phone = cleanPhone(row[phoneCol]);
        if (phone) {
          await connection.execute(
            'INSERT INTO contactPhones (contactId, phoneNumber, createdAt) VALUES (?, ?, NOW())',
            [contactId, phone]
          );
          totalPhones++;
        }
      }
      
      // Import all 3 emails
      for (let emailNum = 1; emailNum <= 3; emailNum++) {
        const emailCol = `contact_${contactNum}_email${emailNum}`;
        const email = cleanEmail(row[emailCol]);
        if (email) {
          await connection.execute(
            'INSERT INTO contactEmails (contactId, email, createdAt) VALUES (?, ?, NOW())',
            [contactId, email]
          );
          totalEmails++;
        }
      }
    }
    
    // Progress update every 50 properties
    if ((idx + 1) % 50 === 0) {
      console.log(`   Processed ${idx + 1}/${data.length} properties...`);
    }
  }
  
  // Step 4: Verify counts
  console.log(`\n✅ IMPORT COMPLETE!`);
  console.log('='.repeat(80));
  console.log(`   Properties updated: ${propertiesUpdated}`);
  console.log(`   Contacts imported: ${totalContacts}`);
  console.log(`   Phones imported: ${totalPhones}`);
  console.log(`   Emails imported: ${totalEmails}`);
  
  // Verify in database
  console.log(`\n🔍 Verifying database counts...`);
  const [[dbContacts]] = await connection.execute('SELECT COUNT(*) as cnt FROM contacts');
  const [[dbPhones]] = await connection.execute('SELECT COUNT(*) as cnt FROM contactPhones');
  const [[dbEmails]] = await connection.execute('SELECT COUNT(*) as cnt FROM contactEmails');
  
  console.log(`   Database contacts: ${dbContacts.cnt}`);
  console.log(`   Database phones: ${dbPhones.cnt}`);
  console.log(`   Database emails: ${dbEmails.cnt}`);
  
  // Close connection
  await connection.end();
  
  console.log(`\n🎉 Reimport completed successfully!`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
