#!/usr/bin/env node
/**
 * Populate propertyTags table from existing property_flags in dealMachineRawData
 */

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

console.log(`\n🏷️  Populating Property Tags from Flags`);
console.log(`=`.repeat(80));

try {
  const connection = await mysql.createConnection(dbConfig);
  
  // Get all properties with dealMachineRawData
  const [properties] = await connection.execute(
    `SELECT id, dealMachineRawData FROM properties WHERE dealMachineRawData IS NOT NULL`
  );
  
  console.log(`✅ Found ${properties.length} properties with DealMachine data\n`);
  
  let processed = 0;
  let tagsCreated = 0;
  
  for (const property of properties) {
    try {
      const rawData = JSON.parse(property.dealMachineRawData);
      const propertyFlags = rawData.property_flags;
      
      if (!propertyFlags) continue;
      
      // Split flags and insert as tags
      const flags = propertyFlags.split(',').map(f => f.trim()).filter(f => f);
      
      if (flags.length === 0) continue;
      
      // Check if tags already exist
      const [existingTags] = await connection.execute(
        `SELECT tag FROM propertyTags WHERE propertyId = ?`,
        [property.id]
      );
      
      const existingTagNames = existingTags.map(t => t.tag);
      const newFlags = flags.filter(f => !existingTagNames.includes(f));
      
      if (newFlags.length === 0) {
        console.log(`  ⏭️  Property #${property.id}: Tags already exist`);
        processed++;
        continue;
      }
      
      // Insert new tags
      for (const flag of newFlags) {
        await connection.execute(
          `INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt)
           VALUES (?, ?, 1, NOW())`,
          [property.id, flag]
        );
        tagsCreated++;
      }
      
      console.log(`  ✅ Property #${property.id}: Added ${newFlags.length} tags (${newFlags.join(', ')})`);
      processed++;
      
    } catch (error) {
      console.error(`  ❌ Property #${property.id}: Error - ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ COMPLETE`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 Summary:`);
  console.log(`   Properties processed: ${processed}`);
  console.log(`   Tags created: ${tagsCreated}`);
  console.log(`${'='.repeat(80)}\n`);
  
  await connection.end();
  
} catch (error) {
  console.error(`\n❌ ERROR:`, error.message);
  console.error(error.stack);
  process.exit(1);
}
