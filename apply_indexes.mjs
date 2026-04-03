import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sql = readFileSync('/home/ubuntu/apply_indexes.sql', 'utf8');

const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

let ok = 0, skip = 0, fail = 0;
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    ok++;
    process.stdout.write('.');
  } catch(e) {
    if (e.message.includes('Duplicate key name') || e.message.includes('already exists')) {
      skip++;
      process.stdout.write('s');
    } else {
      fail++;
      console.log('\nFAIL: ' + stmt.substring(0, 80) + ' => ' + e.message);
    }
  }
}

console.log(`\n\n✅ Results: ${ok} created | ${skip} already existed | ${fail} failed`);
await conn.end();
