#!/usr/bin/env node
/**
 * Script to import lead data from Excel files into the CRM database.
 * Run with: node import_leads.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

// Parse DATABASE_URL
function parseDbUrl(url) {
  // mysql://user:pass@host:port/database
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5].split('?')[0]
  };
}

const dbConfig = parseDbUrl(DATABASE_URL);
console.log(`Connecting to database at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

// Lead 1: Margate Property
const margateProperty = {
  addressLine1: '5771 NW 24th Ct',
  city: 'Margate',
  state: 'FL',
  zipcode: '33063',
  propertyType: 'Single Family Home',
  yearBuilt: 1959,
  totalBedrooms: 3,
  totalBaths: 1,
  buildingSquareFeet: 920,
  owner1Name: 'Florence M. Giroux',
  estimatedValue: 335530,
  taxAmount: 5489,
  leadTemperature: 'WARM',
  trackingStatus: 'Not Visited',
  ownerVerified: 1,
  ownerLocation: 'Same as Property'
};

const margateDeepSearch = {
  occupancy: 'Owner-Occupied',
  mlsStatus: 'Off Market',
  zillowEstimate: 335530,
  hasCodeViolation: 0,
  hasLiens: 0,
  recordsCheckedNotes: `KEY FINDINGS:
1. Florence M. Giroux (age 84) is current owner and active resident
2. No probate case or deceased owner identified
3. Property is owner-occupied and well-maintained
4. Current market value estimated at $335,530
5. Property taxes current and paid ($5,489 in 2024)
6. No code violations or enforcement actions found
7. Property is off-market and not currently for sale
8. Secondary owner listed (possibly spouse)

RECOMMENDED NEXT STEPS:
1. Contact Florence M. Giroux at (561) 699-2623 or (954) 972-1885
2. Obtain certified deed from Broward County Official Records
3. Search for mortgage and lien information in official records

SOURCES SEARCHED:
- Broward County Property Appraiser Database
- Broward County Clerk of Courts (Probate Case Search)
- Broward County Official Records (Deeds and Liens)
- City of Margate Code Enforcement Database
- Redfin, Zillow, Realtor.com (Property Valuation)`,
  recordsChecked: JSON.stringify(["County", "Property Taxes", "Code Enforcement", "Probate Court"]),
  probateFinds: JSON.stringify(["No Probate Case Found"]),
  probateNotes: 'Property Not in Probate - No deceased owner identified'
};

const margateContacts = [
  {
    name: 'Florence M. Giroux',
    relationship: 'Owner',
    age: 84,
    phone1: '(561) 699-2623',
    phone1Type: 'Mobile',
    phone2: '(954) 972-1885',
    phone2Type: 'Landline',
    email1: 'f******x@yahoo.com',
    currentAddress: '5771 NW 24th Ct, Margate, FL 33063',
    isDecisionMaker: 1
  },
  {
    name: 'M****** G*****',
    relationship: 'Secondary Owner (Possibly Spouse)',
    currentAddress: '5771 NW 24th Ct, Margate, FL 33063'
  }
];

// Lead 2: Miramar Property
const miramarProperty = {
  addressLine1: '6717 Arbor Dr',
  city: 'Miramar',
  state: 'FL',
  zipcode: '33023',
  propertyType: 'Single Family Home',
  yearBuilt: 1965,
  totalBedrooms: 3,
  totalBaths: 2,
  buildingSquareFeet: 1544,
  owner1Name: 'Len D. Sumlar',
  estimatedValue: 459014,
  taxAmount: 4750,
  leadTemperature: 'WARM',
  trackingStatus: 'Not Visited',
  ownerVerified: 0,
  salePrice: 200000,
  ownerLocation: 'Miami-Dade County'
};

const miramarDeepSearch = {
  occupancy: 'Tenant-Occupied',
  mlsStatus: 'Off Market',
  zillowEstimate: 459014,
  dealMachineEstimate: 544857,
  ourEstimate: 501936,
  hasCodeViolation: 0,
  hasLiens: 0,
  recordsCheckedNotes: `KEY FINDINGS:
1. Property is currently owned by Len D. Sumlar (purchased 2019 for $200,000)
2. No probate case has been identified for this property
3. Current market value estimated at $459,014 - $544,857 (significant appreciation since 1994)
4. Property is off-market and not currently for sale
5. Current residents include Davion Hudson (age 36) and family members
6. Property has no code violations or enforcement actions
7. Property taxes are current and paid
8. Last recorded sale was February 2, 1994 for $85,000
9. Property appreciation of 440-540% since 1994 sale

RECOMMENDED NEXT STEPS:
1. Contact Len D. Sumlar through Miami-Dade County Medical Examiner's office
2. Contact Davion Hudson at (954) 966-0140 to verify resident status
3. Conduct title search to verify clear ownership

SOURCES SEARCHED:
- Broward County Property Appraiser Database
- Broward County Clerk of Courts (Probate Case Search)
- Broward County Official Records (Deeds and Liens)
- City of Miramar Code Enforcement Database
- Redfin, Zillow, Realtor.com, Homes.com (Property Valuation)
- FastPeopleSearch, Voter Records (Resident Information)`,
  recordsChecked: JSON.stringify(["County", "Property Taxes", "Code Enforcement", "Probate Court", "Voter Records"]),
  probateFinds: JSON.stringify(["No Probate Case Found"]),
  probateNotes: 'No probate case identified in Broward County system',
  deedType: JSON.stringify([
    { type: "Warranty Deed", deedDate: "2019-01-01", amount: 200000, notes: "Len D. Sumlar purchase" },
    { type: "Previous Sale", deedDate: "1994-02-02", amount: 85000, notes: "Last recorded sale" }
  ])
};

const miramarContacts = [
  {
    name: 'Len D. Sumlar',
    relationship: 'Owner',
    currentAddress: 'Miami-Dade County (Employer - Medical Examiner)',
    isDecisionMaker: 1,
    flags: 'Manager, Morgue Bureau Operations, Medical Examiner'
  },
  {
    name: 'Davion Hudson',
    relationship: 'Current Resident',
    age: 36,
    phone1: '(954) 966-0140',
    phone1Type: 'Mobile',
    currentAddress: '6717 Arbor Dr, Miramar, FL 33023',
    flags: 'Democratic Party voter; born November 1989'
  },
  {
    name: 'Frona S. Hudson',
    relationship: 'Resident/Family',
    age: 63,
    phone1: '(954) 986-8378',
    phone1Type: 'Landline',
    currentAddress: '6717 Arbor Dr, Miramar, FL 33023',
    flags: 'Born November 1961; family member'
  },
  {
    name: 'Donovan Hudson',
    relationship: 'Resident/Family',
    age: 36,
    phone1: '(954) 986-8378',
    phone1Type: 'Landline',
    phone2: '(954) 966-0140',
    phone2Type: 'Mobile',
    currentAddress: '6717 Arbor Dr, Miramar, FL 33023',
    flags: 'Family member; living at property'
  }
];

async function main() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected to database');

  async function insertProperty(prop) {
    // Check if property exists
    const [existing] = await conn.execute(
      'SELECT id FROM properties WHERE addressLine1 = ? AND city = ?',
      [prop.addressLine1, prop.city]
    );

    if (existing.length > 0) {
      const id = existing[0].id;
      console.log(`Property ${prop.addressLine1} already exists with ID ${id}, updating...`);
      await conn.execute(`
        UPDATE properties SET
          state = ?, zipcode = ?, propertyType = ?, yearBuilt = ?,
          totalBedrooms = ?, totalBaths = ?, buildingSquareFeet = ?,
          owner1Name = ?, estimatedValue = ?, taxAmount = ?,
          leadTemperature = ?, trackingStatus = ?, ownerVerified = ?,
          ownerLocation = ?, salePrice = ?, updatedAt = NOW()
        WHERE id = ?
      `, [
        prop.state, prop.zipcode, prop.propertyType, prop.yearBuilt,
        prop.totalBedrooms, prop.totalBaths, prop.buildingSquareFeet,
        prop.owner1Name, prop.estimatedValue, prop.taxAmount,
        prop.leadTemperature, prop.trackingStatus, prop.ownerVerified,
        prop.ownerLocation || null, prop.salePrice || null, id
      ]);
      return id;
    } else {
      console.log(`Creating new property: ${prop.addressLine1}, ${prop.city}`);
      const [result] = await conn.execute(`
        INSERT INTO properties (
          addressLine1, city, state, zipcode, propertyType, yearBuilt,
          totalBedrooms, totalBaths, buildingSquareFeet, owner1Name,
          estimatedValue, taxAmount, leadTemperature, trackingStatus,
          ownerVerified, ownerLocation, salePrice, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        prop.addressLine1, prop.city, prop.state, prop.zipcode, prop.propertyType,
        prop.yearBuilt, prop.totalBedrooms, prop.totalBaths, prop.buildingSquareFeet,
        prop.owner1Name, prop.estimatedValue, prop.taxAmount, prop.leadTemperature,
        prop.trackingStatus, prop.ownerVerified, prop.ownerLocation || null, prop.salePrice || null
      ]);
      return result.insertId;
    }
  }

  async function insertDeepSearch(propertyId, ds) {
    const [existing] = await conn.execute(
      'SELECT id FROM propertyDeepSearch WHERE propertyId = ?',
      [propertyId]
    );

    if (existing.length > 0) {
      console.log(`Updating deep search for property ${propertyId}`);
      await conn.execute(`
        UPDATE propertyDeepSearch SET
          occupancy = ?, mlsStatus = ?, zillowEstimate = ?,
          dealMachineEstimate = ?, ourEstimate = ?,
          hasCodeViolation = ?, hasLiens = ?,
          recordsCheckedNotes = ?, recordsChecked = ?,
          probateFinds = ?, probateNotes = ?, deedType = ?,
          updatedAt = NOW()
        WHERE propertyId = ?
      `, [
        ds.occupancy, ds.mlsStatus, ds.zillowEstimate,
        ds.dealMachineEstimate || null, ds.ourEstimate || null,
        ds.hasCodeViolation, ds.hasLiens,
        ds.recordsCheckedNotes, ds.recordsChecked || null,
        ds.probateFinds || null, ds.probateNotes || null, ds.deedType || null,
        propertyId
      ]);
    } else {
      console.log(`Creating deep search for property ${propertyId}`);
      await conn.execute(`
        INSERT INTO propertyDeepSearch (
          propertyId, occupancy, mlsStatus, zillowEstimate,
          dealMachineEstimate, ourEstimate,
          hasCodeViolation, hasLiens,
          recordsCheckedNotes, recordsChecked,
          probateFinds, probateNotes, deedType,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        propertyId, ds.occupancy, ds.mlsStatus, ds.zillowEstimate,
        ds.dealMachineEstimate || null, ds.ourEstimate || null,
        ds.hasCodeViolation, ds.hasLiens,
        ds.recordsCheckedNotes, ds.recordsChecked || null,
        ds.probateFinds || null, ds.probateNotes || null, ds.deedType || null
      ]);
    }
  }

  async function insertContact(propertyId, contact) {
    const [existing] = await conn.execute(
      'SELECT id FROM contacts WHERE propertyId = ? AND name = ?',
      [propertyId, contact.name]
    );

    if (existing.length > 0) {
      console.log(`Contact ${contact.name} already exists, updating...`);
      await conn.execute(`
        UPDATE contacts SET
          relationship = ?, age = ?, phone1 = ?, phone1Type = ?,
          phone2 = ?, phone2Type = ?, email1 = ?,
          currentAddress = ?, isDecisionMaker = ?, flags = ?,
          updatedAt = NOW()
        WHERE id = ?
      `, [
        contact.relationship || null, contact.age || null,
        contact.phone1 || null, contact.phone1Type || null,
        contact.phone2 || null, contact.phone2Type || null,
        contact.email1 || null, contact.currentAddress || null,
        contact.isDecisionMaker || 0, contact.flags || null,
        existing[0].id
      ]);
    } else {
      console.log(`Creating contact: ${contact.name}`);
      await conn.execute(`
        INSERT INTO contacts (
          propertyId, name, relationship, age, phone1, phone1Type,
          phone2, phone2Type, email1, currentAddress, isDecisionMaker, flags,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        propertyId, contact.name, contact.relationship || null, contact.age || null,
        contact.phone1 || null, contact.phone1Type || null,
        contact.phone2 || null, contact.phone2Type || null,
        contact.email1 || null, contact.currentAddress || null,
        contact.isDecisionMaker || 0, contact.flags || null
      ]);
    }
  }

  try {
    // Import Margate lead
    console.log('\n=== Importing Margate Lead ===');
    const margateId = await insertProperty(margateProperty);
    await insertDeepSearch(margateId, margateDeepSearch);
    for (const contact of margateContacts) {
      await insertContact(margateId, contact);
    }
    console.log(`Margate lead imported with ID: ${margateId}`);

    // Import Miramar lead
    console.log('\n=== Importing Miramar Lead ===');
    const miramarId = await insertProperty(miramarProperty);
    await insertDeepSearch(miramarId, miramarDeepSearch);
    for (const contact of miramarContacts) {
      await insertContact(miramarId, contact);
    }
    console.log(`Miramar lead imported with ID: ${miramarId}`);

    console.log('\n=== Import Complete ===');
    console.log(`Margate Property ID: ${margateId}`);
    console.log(`Miramar Property ID: ${miramarId}`);

  } catch (error) {
    console.error('Error importing leads:', error);
  } finally {
    await conn.end();
  }
}

main();
