import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { propertyDeepSearch } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const result = await db
  .select()
  .from(propertyDeepSearch)
  .where(eq(propertyDeepSearch.propertyId, 132))
  .limit(1);

console.log('=== DRIZZLE SELECT RESULT ===');
console.log('Full result:', result[0]);
console.log('\n=== taxesNotes field ===');
console.log('taxesNotes:', result[0]?.taxesNotes);
console.log('taxesNotes type:', typeof result[0]?.taxesNotes);
console.log('taxesNotes length:', result[0]?.taxesNotes?.length);

await connection.end();
