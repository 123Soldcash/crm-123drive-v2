#!/usr/bin/env node
/**
 * PHASE 2: Enrich 10 leads with missing property data
 * - Use Google Maps reverse geocoding to get addresses from GPS coordinates
 * - Add unreconciled information to property notes
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

// Inline makeRequest function for Maps API
async function makeRequest(endpoint, params = {}) {
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  
  if (!baseUrl || !apiKey) {
    throw new Error('Maps API credentials missing');
  }
  
  const url = new URL(`${baseUrl}/v1/maps/proxy${endpoint}`);
  url.searchParams.append('key', apiKey);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Maps API error: ${response.status}`);
  }
  
  return response.json();
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

// Parse DATABASE_URL
const dbUrl = new URL(DATABASE_URL);
const connection = await mysql.createConnection({
  host: dbUrl.hostname,
  port: dbUrl.port || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('✅ Connected to database');

// Get properties that need enrichment
const [properties] = await connection.execute(
  `SELECT id, dealMachinePropertyId, dealMachineRawData, addressLine1
   FROM properties 
   WHERE id >= 750033 AND id <= 750042
   ORDER BY id`
);

console.log(`📊 Found ${properties.length} properties to enrich\\n`);

let enriched = 0;
let failed = 0;

for (const property of properties) {
  const rawData = JSON.parse(property.dealMachineRawData || '{}');
  const lat = rawData.property_lat;
  const lng = rawData.property_lng;
  const leadId = property.dealMachinePropertyId;
  
  console.log(`\\n🏠 Processing Property ID ${property.id} (Lead ${leadId})`);
  console.log(`   GPS: ${lat}, ${lng}`);
  
  if (!lat || !lng) {
    console.log(`   ❌ Missing GPS coordinates, skipping`);
    failed++;
    continue;
  }
  
  try {
    // Use Google Maps Geocoding API via Manus proxy
    const data = await makeRequest('/maps/api/geocode/json', { latlng: `${lat},${lng}` });
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log(`   ❌ No address found for coordinates (Status: ${data.status})`);
      failed++;
      continue;
    }
    
    // Parse address components
    const result = data.results[0];
    const addressComponents = result.address_components;
    
    let streetNumber = '';
    let route = '';
    let city = '';
    let state = '';
    let zipcode = '';
    let county = '';
    
    for (const component of addressComponents) {
      const types = component.types;
      if (types.includes('street_number')) streetNumber = component.long_name;
      if (types.includes('route')) route = component.long_name;
      if (types.includes('locality')) city = component.long_name;
      if (types.includes('administrative_area_level_1')) state = component.short_name;
      if (types.includes('postal_code')) zipcode = component.long_name;
      if (types.includes('administrative_area_level_2')) county = component.long_name;
    }
    
    const addressLine1 = `${streetNumber} ${route}`.trim() || result.formatted_address;
    
    console.log(`   ✅ Found address: ${addressLine1}, ${city}, ${state} ${zipcode}`);
    
    // Update property with enriched data
    const updatedRawData = {
      ...rawData,
      enriched_address: result.formatted_address,
      enriched_county: county,
      enrichment_date: new Date().toISOString(),
      enrichment_source: 'Google Maps Geocoding API',
    };
    
    await connection.execute(
      `UPDATE properties 
       SET addressLine1 = ?,
           city = ?,
           state = ?,
           zipcode = ?,
           dealMachineRawData = ?
       WHERE id = ?`,
      [
        addressLine1,
        city || 'Unknown',
        state || 'FL',
        zipcode || '00000',
        JSON.stringify(updatedRawData),
        property.id,
      ]
    );
    
    enriched++;
  } catch (error) {
    console.log(`   ❌ Error enriching property: ${error.message}`);
    failed++;
  }
}

console.log(`\\n${'='.repeat(80)}`);
console.log('PHASE 2 ENRICHMENT COMPLETE');
console.log(`${'='.repeat(80)}`);
console.log(`✅ Properties enriched: ${enriched}`);
console.log(`❌ Properties failed: ${failed}`);

await connection.end();
