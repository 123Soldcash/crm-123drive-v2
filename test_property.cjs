// Simple test to check if getPropertyById works
const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Test 1: Check if property 930017 exists
  const [rows] = await connection.execute('SELECT id, addressLine1, city, state FROM properties WHERE id = 930017');
  console.log('Property 930017:', rows);
  
  // Test 2: Check if there are contacts for this property
  const [contacts] = await connection.execute('SELECT id, name, propertyId FROM contacts WHERE propertyId = 930017');
  console.log('Contacts for 930017:', contacts);
  
  // Test 3: Check contactPhones table structure
  const [phoneStructure] = await connection.execute('DESCRIBE contactPhones');
  console.log('contactPhones structure:', phoneStructure.map(r => r.Field));
  
  await connection.end();
}

test().catch(console.error);
