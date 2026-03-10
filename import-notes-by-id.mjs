/**
 * Import REsimple notes into CRM General Notes — matched by Property ID.
 * 
 * Strategy:
 * 1. Load all CRM properties and build a map: propertyId (REsimple hex ID) → CRM internal id
 * 2. Read notes CSV with Python-style parsing (handles malformed quotes)
 * 3. For each CSV row, look up the Property ID in the map
 * 4. For each comment column (comment1..comment150), insert as a separate note
 * 5. Use userId=1 (Rosangela/admin) for all imported notes
 * 6. Mark notes with "[REsimple Import]" prefix for traceability
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const ADMIN_USER_ID = 1;
const BATCH_SIZE = 100;

/**
 * Parse CSV manually to handle malformed quotes that break standard parsers.
 * Uses a simple state machine approach.
 */
function parseCSV(content) {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    
    if (ch === '"') {
      // Check for escaped quote ""
      if (inQuotes && i + 1 < content.length && content[i + 1] === '"') {
        currentLine += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
        currentLine += ch;
      }
    } else if (ch === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else if (ch === '\r') {
      // skip carriage returns
    } else {
      currentLine += ch;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  
  if (lines.length === 0) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }
  
  return rows;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  
  return fields;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 1. Load all CRM properties and build propertyId → internal id map
  console.log('Loading CRM properties...');
  const [properties] = await conn.query(
    'SELECT id, propertyId, addressLine1 FROM properties WHERE propertyId IS NOT NULL'
  );
  console.log(`Loaded ${properties.length} properties with propertyId`);
  
  const idMap = new Map(); // REsimple Property ID → CRM internal id
  for (const prop of properties) {
    if (prop.propertyId) {
      idMap.set(prop.propertyId.trim(), { id: prop.id, addr: prop.addressLine1 });
    }
  }
  console.log(`ID lookup map: ${idMap.size} entries`);
  
  // 2. Read notes CSV
  console.log('Reading notes CSV...');
  const csvContent = fs.readFileSync('/home/ubuntu/upload/Exported_Leads_94124AM.csv', 'utf-8');
  const rows = parseCSV(csvContent);
  console.log(`CSV rows parsed: ${rows.length}`);
  
  // 3. Process each row - match by Property ID
  let matched = 0;
  let unmatched = 0;
  let rowsWithNotes = 0;
  let rowsWithoutNotes = 0;
  const notesToInsert = [];
  const unmatchedIds = [];
  
  for (const row of rows) {
    const resimpleId = (row['Property ID'] || '').trim();
    
    if (!resimpleId) {
      unmatched++;
      continue;
    }
    
    const crmProp = idMap.get(resimpleId);
    
    if (!crmProp) {
      unmatched++;
      const addr = (row['Property Street Address'] || '').trim();
      unmatchedIds.push({ id: resimpleId, addr });
      continue;
    }
    
    matched++;
    
    // Extract all comments
    const comments = [];
    for (let i = 1; i <= 150; i++) {
      const val = (row[`comment${i}`] || '').trim();
      if (val) {
        // Clean up: replace semicolons used as line breaks with newlines
        const cleaned = val.replace(/;\s*\n/g, '\n').trim();
        comments.push(`[REsimple Import] ${cleaned}`);
      }
    }
    
    if (comments.length > 0) {
      rowsWithNotes++;
      for (const comment of comments) {
        notesToInsert.push({ propertyId: crmProp.id, content: comment });
      }
    } else {
      rowsWithoutNotes++;
    }
  }
  
  console.log(`\nMatching by Property ID complete:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  Rows with notes: ${rowsWithNotes}`);
  console.log(`  Rows without notes: ${rowsWithoutNotes}`);
  console.log(`  Total notes to insert: ${notesToInsert.length}`);
  
  // 4. Check for existing notes to avoid duplicates
  console.log('\nChecking for existing imported notes...');
  const [existingNotes] = await conn.query(
    'SELECT propertyId, LEFT(content, 200) as contentPrefix FROM notes WHERE content LIKE "[REsimple Import]%"'
  );
  const existingSet = new Set();
  for (const n of existingNotes) {
    existingSet.add(`${n.propertyId}|${n.contentPrefix}`);
  }
  console.log(`Found ${existingNotes.length} existing imported notes`);
  
  // Filter out duplicates
  let duplicateNotes = 0;
  const newNotes = notesToInsert.filter(n => {
    const prefix = n.content.substring(0, 200);
    const key = `${n.propertyId}|${prefix}`;
    if (existingSet.has(key)) {
      duplicateNotes++;
      return false;
    }
    return true;
  });
  
  console.log(`New notes to insert (after dedup): ${newNotes.length}`);
  console.log(`Duplicate notes skipped: ${duplicateNotes}`);
  
  // 5. Insert in batches
  let totalInserted = 0;
  if (newNotes.length > 0) {
    console.log(`\nInserting ${newNotes.length} notes in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < newNotes.length; i += BATCH_SIZE) {
      const batch = newNotes.slice(i, i + BATCH_SIZE);
      const values = batch.map(n => [n.propertyId, ADMIN_USER_ID, n.content, 'general']);
      
      await conn.query(
        'INSERT INTO notes (propertyId, userId, content, noteType) VALUES ?',
        [values]
      );
      
      totalInserted += batch.length;
      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= newNotes.length) {
        console.log(`  Inserted ${Math.min(i + BATCH_SIZE, newNotes.length)} / ${newNotes.length}`);
      }
    }
  }
  
  // 6. Summary
  console.log('\n=== IMPORT SUMMARY ===');
  console.log(`CSV rows processed: ${rows.length}`);
  console.log(`Rows matched by Property ID: ${matched}`);
  console.log(`Rows unmatched: ${unmatched}`);
  console.log(`Rows with notes: ${rowsWithNotes}`);
  console.log(`Total notes inserted: ${totalInserted}`);
  console.log(`Duplicate notes skipped: ${duplicateNotes}`);
  
  if (unmatchedIds.length > 0) {
    // Count unique unmatched IDs
    const uniqueUnmatched = new Set(unmatchedIds.map(u => u.id));
    console.log(`\nUnique unmatched Property IDs: ${uniqueUnmatched.size}`);
    console.log('First 20 unmatched:');
    const shown = new Set();
    for (const u of unmatchedIds) {
      if (shown.size >= 20) break;
      if (!shown.has(u.id)) {
        shown.add(u.id);
        console.log(`  ID=${u.id}, addr=${u.addr}`);
      }
    }
  }
  
  // Verify final count
  const [finalCount] = await conn.query('SELECT COUNT(*) as count FROM notes');
  console.log(`\nTotal notes in CRM: ${finalCount[0].count}`);
  
  await conn.end();
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
