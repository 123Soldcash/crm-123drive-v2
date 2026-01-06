import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { properties } from './drizzle/schema.ts';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'crm',
});

const db = drizzle(connection);

const newProperties = [
  {
    leadId: '90004',
    address: '3750 SW 8th St, Fort Lauderdale, FL 33312',
    city: 'Fort Lauderdale',
    state: 'FL',
    zip: '33312',
    ownerName: 'Dwayne Christopher Bunsie (Estate)',
    ownerLocation: 'Broward County',
    propertyType: 'Single Family Home',
    yearBuilt: 1956,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1272,
    estimatedValue: 275000,
    marketStatus: 'Off Market',
    leadTemperature: 'PROBATE',
    customTags: JSON.stringify(['Probate', 'Deceased Owner', 'Active Case']),
    notes: 'Probate Case PRC230001157. Owner: Dwayne Christopher Bunsie (Deceased 01/28/2023). Personal Rep: Cecile A. Moise. Attorney: Patrick Jean-Gilles.',
    deskName: 'BIN',
    deskStatus: 'BIN'
  },
  {
    leadId: '90005',
    address: '2321 NW 27th Ave, Fort Lauderdale, FL 33311',
    city: 'Fort Lauderdale',
    state: 'FL',
    zip: '33311',
    ownerName: 'Willie Mae Wilson (Estate)',
    ownerLocation: 'Broward County',
    propertyType: 'Single Family Home',
    yearBuilt: 1970,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1584,
    estimatedValue: 226900,
    marketStatus: 'Off Market',
    leadTemperature: 'PROBATE',
    customTags: JSON.stringify(['Probate', 'Deceased Owner', 'Active Case', 'Multiple Heirs']),
    notes: 'Probate Case PRC210004322 (Active since 2021). Owner: Willie Mae Wilson (Deceased 01/22/2021). Personal Rep: James McTurch. Attorney: Beth M. Lazar. Heirs: James McTurch, Cornelius Kea, Kevin Kea.',
    deskName: 'BIN',
    deskStatus: 'BIN'
  }
];

async function addProperties() {
  try {
    for (const prop of newProperties) {
      await db.insert(properties).values(prop);
      console.log(`✅ Added: ${prop.address}`);
    }
    console.log('\n✅ All properties added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding properties:', error);
    process.exit(1);
  }
}

addProperties();
