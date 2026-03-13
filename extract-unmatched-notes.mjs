/**
 * Extract all notes from the CSV that were NOT imported into the CRM.
 * These belong to leads not present in the CRM (no matching Property ID).
 * Output: CSV + Markdown report with all details.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Step 1: Get all CRM propertyIds
const [crmProps] = await conn.query('SELECT id, propertyId FROM properties WHERE propertyId IS NOT NULL AND propertyId != ""');
const crmPids = new Set();
for (const p of crmProps) {
  crmPids.add(p.propertyId.trim());
}
console.log(`CRM properties with propertyId: ${crmPids.size}`);

// Step 2: Parse notes CSV
const csvContent = fs.readFileSync('/home/ubuntu/upload/Exported_Leads_94124AM.csv', 'utf-8');
const rows = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  relax_quotes: true,
});
console.log(`Notes CSV rows: ${rows.length}`);

// Step 3: Find unmatched rows and collect their data
const unmatchedRows = [];
let totalUnmatchedNotes = 0;

for (const row of rows) {
  const pid = (row['Property ID'] || '').trim();
  
  // Skip if this lead IS in the CRM
  if (pid && crmPids.has(pid)) continue;
  
  // Collect all comments
  const comments = [];
  for (let i = 1; i <= 150; i++) {
    const val = (row[`comment${i}`] || '').trim();
    if (val) comments.push(val);
  }
  
  totalUnmatchedNotes += comments.length;
  
  unmatchedRows.push({
    propertyId: pid,
    firstName: (row['First Name'] || '').trim(),
    lastName: (row['Last Name'] || '').trim(),
    phone: (row['Phone Number'] || '').trim(),
    email: (row['Email Address'] || '').trim(),
    leadStatus: (row['Lead Status'] || '').trim(),
    leadSource: (row['Lead Source'] || '').trim(),
    campaignName: (row['Campaign Name'] || '').trim(),
    address: (row['Property Street Address'] || '').trim(),
    address2: (row['Property Street Address 2'] || '').trim(),
    city: (row['Property City'] || '').trim(),
    state: (row['Property State'] || '').trim(),
    zip: (row['Property Zip'] || '').trim(),
    tags: (row['Tags'] || '').trim(),
    noteCount: comments.length,
    allNotes: comments.join(' ||| '),
  });
}

console.log(`Unmatched rows: ${unmatchedRows.length}`);
console.log(`Total unmatched notes: ${totalUnmatchedNotes}`);

// Step 4: Generate CSV
const csvHeaders = [
  'Property ID', 'First Name', 'Last Name', 'Phone', 'Email',
  'Lead Status', 'Lead Source', 'Campaign Name',
  'Address', 'Address 2', 'City', 'State', 'Zip',
  'Tags', 'Note Count', 'All Notes'
];

let csvOutput = csvHeaders.join(',') + '\n';
for (const r of unmatchedRows) {
  const escapeCsv = (val) => {
    if (!val) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  csvOutput += [
    escapeCsv(r.propertyId), escapeCsv(r.firstName), escapeCsv(r.lastName),
    escapeCsv(r.phone), escapeCsv(r.email), escapeCsv(r.leadStatus),
    escapeCsv(r.leadSource), escapeCsv(r.campaignName),
    escapeCsv(r.address), escapeCsv(r.address2), escapeCsv(r.city),
    escapeCsv(r.state), escapeCsv(r.zip), escapeCsv(r.tags),
    r.noteCount, escapeCsv(r.allNotes)
  ].join(',') + '\n';
}

fs.writeFileSync('/home/ubuntu/unmatched-notes-report.csv', csvOutput);
console.log('CSV saved to /home/ubuntu/unmatched-notes-report.csv');

// Step 5: Generate Markdown summary
const withNotes = unmatchedRows.filter(r => r.noteCount > 0);
const withoutNotes = unmatchedRows.filter(r => r.noteCount === 0);
const withAddress = unmatchedRows.filter(r => r.address && r.address !== '0');
const withoutAddress = unmatchedRows.filter(r => !r.address || r.address === '0');

let md = `# Unmatched Notes Report\n\n`;
md += `**Total unmatched rows:** ${unmatchedRows.length}\n`;
md += `**Total unmatched notes:** ${totalUnmatchedNotes}\n`;
md += `**Rows with notes:** ${withNotes.length}\n`;
md += `**Rows without notes:** ${withoutNotes.length}\n`;
md += `**Rows with address:** ${withAddress.length}\n`;
md += `**Rows without address:** ${withoutAddress.length}\n\n`;
md += `These are leads that exist in the REsimple notes export but were NOT in the 760-lead import file, so they have no matching property in the CRM.\n\n`;
md += `---\n\n`;

// Table of rows WITH notes and WITH address (most useful)
md += `## Leads with Notes and Address (${withNotes.filter(r => r.address && r.address !== '0').length} rows)\n\n`;
md += `| # | Address | City | State | Zip | Owner | Phone | Notes |\n`;
md += `|---|---------|------|-------|-----|-------|-------|-------|\n`;

let counter = 0;
for (const r of withNotes.filter(r => r.address && r.address !== '0').sort((a, b) => b.noteCount - a.noteCount)) {
  counter++;
  const owner = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'N/A';
  md += `| ${counter} | ${r.address} | ${r.city} | ${r.state} | ${r.zip} | ${owner} | ${r.phone} | ${r.noteCount} |\n`;
}

// Table of rows WITH notes but WITHOUT address
md += `\n## Leads with Notes but No Address (${withNotes.filter(r => !r.address || r.address === '0').length} rows)\n\n`;
md += `| # | Property ID | Owner | Phone | Email | Lead Status | Notes |\n`;
md += `|---|------------|-------|-------|-------|-------------|-------|\n`;

counter = 0;
for (const r of withNotes.filter(r => !r.address || r.address === '0').sort((a, b) => b.noteCount - a.noteCount)) {
  counter++;
  const owner = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'N/A';
  md += `| ${counter} | ${r.propertyId.substring(0, 12)}... | ${owner} | ${r.phone} | ${r.email} | ${r.leadStatus} | ${r.noteCount} |\n`;
}

// Table of rows WITHOUT notes
md += `\n## Leads without Notes (${withoutNotes.length} rows)\n\n`;
md += `| # | Address | City | State | Owner | Lead Status |\n`;
md += `|---|---------|------|-------|-------|-------------|\n`;

counter = 0;
for (const r of withoutNotes.slice(0, 50)) {
  counter++;
  const owner = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'N/A';
  const addr = (r.address && r.address !== '0') ? r.address : 'No address';
  md += `| ${counter} | ${addr} | ${r.city} | ${r.state} | ${owner} | ${r.leadStatus} |\n`;
}
if (withoutNotes.length > 50) {
  md += `\n*...and ${withoutNotes.length - 50} more rows without notes (see CSV for full list)*\n`;
}

fs.writeFileSync('/home/ubuntu/unmatched-notes-report.md', md);
console.log('Markdown saved to /home/ubuntu/unmatched-notes-report.md');

await conn.end();
console.log('Done!');
