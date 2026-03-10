/**
 * Clean import of REsimple notes into CRM General Notes.
 * 
 * Strategy:
 * 1. Load all CRM properties and build a map: propertyId (REsimple ID) → CRM internal id
 * 2. Parse the notes CSV
 * 3. For each row, match by Property ID to a CRM lead
 * 4. Extract all comment1..comment150 fields
 * 5. Insert each comment as a separate note in the CRM
 * 
 * Only imports notes for leads that ALREADY exist in the CRM.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import crypto from 'crypto';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Step 1: Build Property ID → CRM id map
console.log('Step 1: Loading CRM properties...');
const [crmProps] = await conn.query('SELECT id, propertyId FROM properties WHERE propertyId IS NOT NULL AND propertyId != ""');
const pidToCrmId = new Map();
for (const p of crmProps) {
  pidToCrmId.set(p.propertyId.trim(), p.id);
}
console.log(`  CRM properties with propertyId: ${pidToCrmId.size}`);

// Step 2: Get the owner user ID for note authorship
const [users] = await conn.query("SELECT id FROM users LIMIT 1");
const userId = users[0]?.id || 'system';
console.log(`  Using userId: ${userId}`);

// Step 3: Parse notes CSV
console.log('\nStep 2: Parsing notes CSV...');
const csvContent = fs.readFileSync('/home/ubuntu/upload/Exported_Leads_94124AM.csv', 'utf-8');
const rows = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  relax_quotes: true,
});
console.log(`  CSV rows parsed: ${rows.length}`);

// Step 3: Match and collect notes
console.log('\nStep 3: Matching notes to CRM leads by Property ID...');
let matchedRows = 0;
let unmatchedRows = 0;
let totalNotes = 0;
let rowsWithNotes = 0;
const notesToInsert = []; // { crmId, content, createdAt }

for (const row of rows) {
  const pid = (row['Property ID'] || '').trim();
  
  if (!pid || !pidToCrmId.has(pid)) {
    unmatchedRows++;
    continue;
  }
  
  matchedRows++;
  const crmId = pidToCrmId.get(pid);
  const addr = (row['Property Street Address'] || '').trim();
  
  // Extract all comments (comment1 through comment150)
  const comments = [];
  for (let i = 1; i <= 150; i++) {
    const val = (row[`comment${i}`] || '').trim();
    if (val) {
      comments.push(val);
    }
  }
  
  if (comments.length === 0) continue;
  rowsWithNotes++;
  
  // Each comment becomes a separate note
  // Reverse order so comment1 (newest) gets the latest timestamp
  for (let idx = comments.length - 1; idx >= 0; idx--) {
    const comment = comments[idx];
    const noteId = crypto.randomUUID();
    
    // Stagger timestamps so notes appear in order (oldest first)
    // comment150 = oldest, comment1 = newest
    const baseTime = Date.now() - (comments.length - idx) * 60000; // 1 min apart
    
    notesToInsert.push({
      propertyId: crmId,
      userId: userId,
      content: `[REsimple Import] ${comment}`,
      noteType: 'general',
      createdAt: new Date(baseTime),
    });
    totalNotes++;
  }
}

console.log(`  Matched rows: ${matchedRows}`);
console.log(`  Unmatched rows (not in CRM): ${unmatchedRows}`);
console.log(`  Rows with notes: ${rowsWithNotes}`);
console.log(`  Total notes to insert: ${totalNotes}`);

// Step 4: Insert notes in batches
console.log('\nStep 4: Inserting notes in batches of 200...');
const BATCH_SIZE = 200;
let inserted = 0;
let errors = 0;

for (let i = 0; i < notesToInsert.length; i += BATCH_SIZE) {
  const batch = notesToInsert.slice(i, i + BATCH_SIZE);
  
  const values = batch.map(n => [n.propertyId, n.userId, n.content, n.noteType, n.createdAt]);
  
  try {
    await conn.query(
      'INSERT INTO notes (propertyId, userId, content, noteType, createdAt) VALUES ?',
      [values]
    );
    inserted += batch.length;
    
    if (inserted % 1000 === 0 || inserted === totalNotes) {
      console.log(`  Inserted ${inserted} / ${totalNotes}`);
    }
  } catch (err) {
    errors += batch.length;
    console.error(`  Error inserting batch at ${i}: ${err.message}`);
    
    // Try one by one for this batch
    for (const n of batch) {
      try {
        await conn.query(
          'INSERT INTO notes (propertyId, userId, content, noteType, createdAt) VALUES (?, ?, ?, ?, ?)',
          [n.propertyId, n.userId, n.content, n.noteType, n.createdAt]
        );
        inserted++;
        errors--;
      } catch (err2) {
        console.error(`    Failed note for property ${n.propertyId}: ${err2.message}`);
      }
    }
  }
}

// Step 5: Verify
console.log('\n=== IMPORT SUMMARY ===');
console.log(`CSV rows processed: ${rows.length}`);
console.log(`Rows matched by Property ID: ${matchedRows}`);
console.log(`Rows with notes: ${rowsWithNotes}`);
console.log(`Rows unmatched (not in CRM): ${unmatchedRows}`);
console.log(`Total notes inserted: ${inserted}`);
console.log(`Errors: ${errors}`);

const [totalCount] = await conn.query('SELECT COUNT(*) as cnt FROM notes');
console.log(`Total notes in CRM now: ${totalCount[0].cnt}`);

const [recimpleCount] = await conn.query("SELECT COUNT(*) as cnt FROM notes WHERE content LIKE '%[REsimple Import]%'");
console.log(`REsimple imported notes: ${recimpleCount[0].cnt}`);

const [propsWithNotes] = await conn.query("SELECT COUNT(DISTINCT propertyId) as cnt FROM notes WHERE content LIKE '%[REsimple Import]%'");
console.log(`Properties with imported notes: ${propsWithNotes[0].cnt}`);

await conn.end();
console.log('\nDone!');
