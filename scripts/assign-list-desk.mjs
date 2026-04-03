/**
 * Script to:
 * 1. Create a desk called "List"
 * 2. Assign all recently imported leads (source='Import') to the "List" desk
 * 3. Add tags with insertion date + batch identifier to those leads
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL + "&ssl={}");

  try {
    // 1. Create the "List" desk if it doesn't exist
    console.log("Step 1: Creating desk 'List'...");
    await conn.execute(
      `INSERT IGNORE INTO desks (name, description, color, sortOrder, isSystem) VALUES (?, ?, ?, ?, ?)`,
      ["List", "Imported leads list desk", "#3B82F6", 0, 0]
    );
    console.log("  ✅ Desk 'List' created (or already exists)");

    // 2. Count how many imported leads we have that are not yet assigned to "List"
    const [countResult] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM properties WHERE source = 'Import'`
    );
    const totalImported = countResult[0].cnt;
    console.log(`  Found ${totalImported} imported leads total`);

    // 3. Update all imported leads to desk "List"
    console.log("Step 2: Assigning imported leads to desk 'List'...");
    const [updateResult] = await conn.execute(
      `UPDATE properties SET deskName = 'List' WHERE source = 'Import'`
    );
    console.log(`  ✅ Updated ${updateResult.affectedRows} properties to desk 'List'`);

    // 4. Get the current date for the tag
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // e.g., "2026-04-03"
    const batchTag = `Import-${dateStr}`;
    const dateTag = `Imported: ${dateStr}`;

    console.log(`Step 3: Adding tags '${batchTag}' and '${dateTag}' to imported leads...`);

    // Get all imported property IDs
    const [importedProps] = await conn.execute(
      `SELECT id FROM properties WHERE source = 'Import'`
    );
    console.log(`  Processing ${importedProps.length} properties...`);

    // Check which properties already have these tags to avoid duplicates
    const [existingBatchTags] = await conn.execute(
      `SELECT propertyId FROM propertyTags WHERE tag = ?`,
      [batchTag]
    );
    const existingBatchSet = new Set(existingBatchTags.map((r) => r.propertyId));

    const [existingDateTags] = await conn.execute(
      `SELECT propertyId FROM propertyTags WHERE tag = ?`,
      [dateTag]
    );
    const existingDateSet = new Set(existingDateTags.map((r) => r.propertyId));

    // Batch insert tags (in chunks of 500 to avoid query size limits)
    const CHUNK_SIZE = 500;
    let batchTagCount = 0;
    let dateTagCount = 0;

    // Insert batch identifier tags
    const batchInserts = importedProps
      .filter((p) => !existingBatchSet.has(p.id))
      .map((p) => [p.id, batchTag, 1]); // createdBy=1 (system/admin)

    for (let i = 0; i < batchInserts.length; i += CHUNK_SIZE) {
      const chunk = batchInserts.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
      const values = chunk.flat();
      await conn.execute(
        `INSERT INTO propertyTags (propertyId, tag, createdBy) VALUES ${placeholders}`,
        values
      );
      batchTagCount += chunk.length;
      process.stdout.write(`  Batch tag: ${batchTagCount}/${batchInserts.length}\r`);
    }
    console.log(`\n  ✅ Added '${batchTag}' tag to ${batchTagCount} properties`);

    // Insert date tags
    const dateInserts = importedProps
      .filter((p) => !existingDateSet.has(p.id))
      .map((p) => [p.id, dateTag, 1]);

    for (let i = 0; i < dateInserts.length; i += CHUNK_SIZE) {
      const chunk = dateInserts.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
      const values = chunk.flat();
      await conn.execute(
        `INSERT INTO propertyTags (propertyId, tag, createdBy) VALUES ${placeholders}`,
        values
      );
      dateTagCount += chunk.length;
      process.stdout.write(`  Date tag: ${dateTagCount}/${dateInserts.length}\r`);
    }
    console.log(`\n  ✅ Added '${dateTag}' tag to ${dateTagCount} properties`);

    // Summary
    console.log("\n=== SUMMARY ===");
    console.log(`Desk 'List' created: ✅`);
    console.log(`Properties assigned to 'List': ${updateResult.affectedRows}`);
    console.log(`Tag '${batchTag}' added to: ${batchTagCount} properties`);
    console.log(`Tag '${dateTag}' added to: ${dateTagCount} properties`);
    console.log("\nYou can now search by tag 'Import-2026-04-03' or 'Imported: 2026-04-03' or filter by desk 'List'.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
