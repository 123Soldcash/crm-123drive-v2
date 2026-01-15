import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Parse DATABASE_URL
const dbUrl = new URL(DATABASE_URL);
const connection = await mysql.createConnection({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('✅ Connected to database');

// Get all properties with equity data
const [properties] = await connection.execute(`
  SELECT id, estimatedValue, equityAmount, equityPercent, mortgageAmount
  FROM properties
  WHERE estimatedValue > 0 AND equityAmount IS NOT NULL
`);

console.log(`\n📊 Found ${properties.length} properties with equity data\n`);

let updated = 0;

for (const property of properties) {
  // Calculate correct equity percent
  const correctPercent = Math.round((property.equityAmount / property.estimatedValue) * 100);
  
  if (property.equityPercent !== correctPercent) {
    await connection.execute(
      `UPDATE properties SET equityPercent = ? WHERE id = ?`,
      [correctPercent, property.id]
    );
    
    console.log(`  ✅ Property #${property.id}: ${property.equityPercent}% → ${correctPercent}%`);
    updated++;
  }
}

await connection.end();

console.log(`\n================================================================================`);
console.log(`✅ COMPLETE`);
console.log(`================================================================================`);
console.log(`📊 Summary:`);
console.log(`   Properties checked: ${properties.length}`);
console.log(`   Properties updated: ${updated}`);
console.log(`================================================================================\n`);
