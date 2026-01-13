#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get CSV file path from command line
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('❌ Usage: node import-46col-via-trpc.mjs <csv-file-path>');
  process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`❌ File not found: ${csvFilePath}`);
  process.exit(1);
}

// Read CSV file
const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

// Call the tRPC endpoint via HTTP
async function importViaTRPC() {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    console.log(`📊 Importing from: ${csvFilePath}`);
    console.log(`🌐 API URL: ${apiUrl}`);

    // Prepare tRPC request
    const payload = {
      json: {
        propertiesCSV: fileContent,
      },
    };

    console.log('📤 Sending request to tRPC endpoint...');
    const response = await fetch(`${apiUrl}/api/trpc/dealmachine.import46col`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`📡 Response status: ${response.status}`);
    const result = await response.json();
    console.log('📦 Response:', JSON.stringify(result).substring(0, 500));

    if (result.error) {
      console.error('❌ Error:', result.error.message);
      process.exit(1);
    }

    if (result.result?.data) {
      const data = result.result.data;
      console.log('\n✅ Import successful!');
      console.log(`   Property: ${data.address}`);
      console.log(`   Property ID: ${data.propertyId}`);
      console.log(`   Contacts: ${data.contactsCreated}`);
      console.log(`   Phones: ${data.phonesCreated}`);
      console.log(`   Emails: ${data.emailsCreated}`);
      console.log(`\n📝 Message: ${data.message}`);
    } else {
      console.error('❌ Unexpected response:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

importViaTRPC();
