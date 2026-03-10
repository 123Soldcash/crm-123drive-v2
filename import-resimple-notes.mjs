/**
 * Import REsimple notes (comment1..comment150) into CRM General Notes.
 * 
 * Strategy:
 * 1. Load all properties from CRM with their addresses
 * 2. Build a lookup map: normalized address+zip → propertyId
 * 3. For each CSV row, match by address+zip
 * 4. For each comment column (comment1..comment150), insert as a separate note
 * 5. Use userId=1 (Rosangela/admin) for all imported notes
 * 6. Mark notes with "[REsimple Import]" prefix for traceability
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
require('dotenv').config();

const ADMIN_USER_ID = 1; // Rosangela Russo
const BATCH_SIZE = 100; // Insert in batches

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 1. Load all properties from CRM
  console.log('Loading CRM properties...');
  const [properties] = await conn.query(
    'SELECT id, addressLine1, city, state, zipcode FROM properties'
  );
  console.log(`Loaded ${properties.length} properties from CRM`);
  
  // 2. Build lookup map: normalized address+zip → propertyId
  const addressMap = new Map(); // key → propertyId
  for (const prop of properties) {
    const addr = (prop.addressLine1 || '').trim().toLowerCase();
    const zip = (prop.zipcode || '').trim();
    if (addr) {
      const key = `${addr}|${zip}`;
      // If multiple properties have same address, use the first one
      if (!addressMap.has(key)) {
        addressMap.set(key, prop.id);
      }
    }
  }
  console.log(`Address lookup map: ${addressMap.size} unique address+zip entries`);
  
  // 3. Read CSV
  console.log('Reading notes CSV...');
  const csvContent = fs.readFileSync('/home/ubuntu/upload/Exported_Leads_94124AM.csv', 'utf-8');
  const rows = parse(csvContent, { 
    columns: true, 
    skip_empty_lines: true, 
    relax_column_count: true,
    relax_quotes: true,
    escape: '\\',
    quote: '"',
    ltrim: false,
    rtrim: false
  });
  console.log(`CSV rows: ${rows.length}`);
  
  // 4. Process each row
  let matched = 0;
  let unmatched = 0;
  let totalNotesInserted = 0;
  let rowsWithNotes = 0;
  let rowsSkippedNoNotes = 0;
  let duplicateNotes = 0;
  const unmatchedAddresses = [];
  
  // Collect all notes to insert
  const notesToInsert = [];
  
  for (const row of rows) {
    const addr = (row['Property Street Address'] || '').trim().toLowerCase();
    const zip = (row['Property Zip'] || '').trim();
    
    if (!addr) {
      unmatched++;
      continue;
    }
    
    const key = `${addr}|${zip}`;
    const propertyId = addressMap.get(key);
    
    if (!propertyId) {
      // Try looser match: just address without zip
      let found = false;
      for (const [mapKey, mapPropId] of addressMap.entries()) {
        const mapAddr = mapKey.split('|')[0];
        if (mapAddr === addr) {
          // Match by address only
          const comments = extractComments(row);
          if (comments.length > 0) {
            for (const comment of comments) {
              notesToInsert.push({ propertyId: mapPropId, content: comment });
            }
            rowsWithNotes++;
            matched++;
          } else {
            rowsSkippedNoNotes++;
            matched++;
          }
          found = true;
          break;
        }
      }
      if (!found) {
        unmatched++;
        if (addr) {
          unmatchedAddresses.push(`${addr}, ${zip}`);
        }
      }
      continue;
    }
    
    matched++;
    const comments = extractComments(row);
    if (comments.length > 0) {
      for (const comment of comments) {
        notesToInsert.push({ propertyId, content: comment });
      }
      rowsWithNotes++;
    } else {
      rowsSkippedNoNotes++;
    }
  }
  
  console.log(`\nMatching complete:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  Rows with notes: ${rowsWithNotes}`);
  console.log(`  Rows without notes: ${rowsSkippedNoNotes}`);
  console.log(`  Total notes to insert: ${notesToInsert.length}`);
  
  // 5. Check for existing notes to avoid duplicates
  console.log('\nChecking for existing imported notes...');
  const [existingNotes] = await conn.query(
    'SELECT propertyId, content FROM notes WHERE content LIKE "[REsimple Import]%"'
  );
  const existingSet = new Set();
  for (const n of existingNotes) {
    existingSet.add(`${n.propertyId}|${n.content}`);
  }
  console.log(`Found ${existingNotes.length} existing imported notes`);
  
  // Filter out duplicates
  const newNotes = notesToInsert.filter(n => {
    const key = `${n.propertyId}|${n.content}`;
    if (existingSet.has(key)) {
      duplicateNotes++;
      return false;
    }
    return true;
  });
  
  console.log(`New notes to insert (after dedup): ${newNotes.length}`);
  console.log(`Duplicate notes skipped: ${duplicateNotes}`);
  
  // 6. Insert in batches
  if (newNotes.length > 0) {
    console.log(`\nInserting ${newNotes.length} notes in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < newNotes.length; i += BATCH_SIZE) {
      const batch = newNotes.slice(i, i + BATCH_SIZE);
      const values = batch.map(n => [n.propertyId, ADMIN_USER_ID, n.content, 'general']);
      
      await conn.query(
        'INSERT INTO notes (propertyId, userId, content, noteType) VALUES ?',
        [values]
      );
      
      totalNotesInserted += batch.length;
      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= newNotes.length) {
        console.log(`  Inserted ${Math.min(i + BATCH_SIZE, newNotes.length)} / ${newNotes.length}`);
      }
    }
  }
  
  // 7. Summary
  console.log('\n=== IMPORT SUMMARY ===');
  console.log(`CSV rows processed: ${rows.length}`);
  console.log(`Rows matched to CRM: ${matched}`);
  console.log(`Rows unmatched: ${unmatched}`);
  console.log(`Rows with notes: ${rowsWithNotes}`);
  console.log(`Total notes inserted: ${totalNotesInserted}`);
  console.log(`Duplicate notes skipped: ${duplicateNotes}`);
  
  if (unmatchedAddresses.length > 0) {
    console.log(`\nUnmatched addresses (first 20):`);
    for (const addr of unmatchedAddresses.slice(0, 20)) {
      console.log(`  - ${addr}`);
    }
    if (unmatchedAddresses.length > 20) {
      console.log(`  ... and ${unmatchedAddresses.length - 20} more`);
    }
  }
  
  // Verify final count
  const [finalCount] = await conn.query('SELECT COUNT(*) as count FROM notes');
  console.log(`\nTotal notes in CRM: ${finalCount[0].count}`);
  
  await conn.end();
}

function extractComments(row) {
  const comments = [];
  for (let i = 1; i <= 150; i++) {
    const val = (row[`comment${i}`] || '').trim();
    if (val) {
      // Prefix with [REsimple Import] for traceability
      // Replace semicolons used as line breaks in the CSV with actual newlines
      const cleaned = val.replace(/;\s*/g, '\n').trim();
      comments.push(`[REsimple Import] ${cleaned}`);
    }
  }
  return comments;
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
