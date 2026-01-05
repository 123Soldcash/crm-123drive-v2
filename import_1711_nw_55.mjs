import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function importLead() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Property data from REsimpli
    const propertyData = {
      addressLine1: '1711 NW 55th Ave',
      city: 'Lauderhill',
      state: 'FL',
      zipcode: '33313',
      propertyType: 'Single Family Residence',
      totalBedrooms: 2,
      totalBaths: 2,
      buildingSquareFeet: 1200,
      yearBuilt: 1969,
      owner1Name: 'Anthony Trotman',
      estimatedValue: 364000,
      equityAmount: 364000,
      equityPercent: 100,
      leadTemperature: 'HOT',
      trackingStatus: 'Follow Up',
      taxDelinquent: 'Yes',
      taxDelinquentYear: 2023,
      taxAmount: 25591
    };

    // Check if property already exists
    const [existing] = await connection.execute(
      'SELECT id FROM properties WHERE addressLine1 = ? AND city = ? AND state = ?',
      [propertyData.addressLine1, propertyData.city, propertyData.state]
    );

    let propertyId;
    
    if (existing.length > 0) {
      propertyId = existing[0].id;
      console.log('Property already exists with ID:', propertyId, '- updating...');
      
      // Update existing property
      await connection.execute(`
        UPDATE properties SET
          zipcode = ?,
          propertyType = ?,
          totalBedrooms = ?,
          totalBaths = ?,
          buildingSquareFeet = ?,
          yearBuilt = ?,
          owner1Name = ?,
          estimatedValue = ?,
          equityAmount = ?,
          equityPercent = ?,
          leadTemperature = ?,
          trackingStatus = ?,
          taxDelinquent = ?,
          taxDelinquentYear = ?,
          taxAmount = ?,
          updatedAt = NOW()
        WHERE id = ?
      `, [
        propertyData.zipcode,
        propertyData.propertyType,
        propertyData.totalBedrooms,
        propertyData.totalBaths,
        propertyData.buildingSquareFeet,
        propertyData.yearBuilt,
        propertyData.owner1Name,
        propertyData.estimatedValue,
        propertyData.equityAmount,
        propertyData.equityPercent,
        propertyData.leadTemperature,
        propertyData.trackingStatus,
        propertyData.taxDelinquent,
        propertyData.taxDelinquentYear,
        propertyData.taxAmount,
        propertyId
      ]);
    } else {
      console.log('Creating new property...');
      
      // Insert new property
      const [result] = await connection.execute(`
        INSERT INTO properties (
          addressLine1, city, state, zipcode, propertyType, totalBedrooms, totalBaths,
          buildingSquareFeet, yearBuilt, owner1Name, estimatedValue, equityAmount, equityPercent,
          leadTemperature, trackingStatus, taxDelinquent, taxDelinquentYear, taxAmount,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        propertyData.addressLine1,
        propertyData.city,
        propertyData.state,
        propertyData.zipcode,
        propertyData.propertyType,
        propertyData.totalBedrooms,
        propertyData.totalBaths,
        propertyData.buildingSquareFeet,
        propertyData.yearBuilt,
        propertyData.owner1Name,
        propertyData.estimatedValue,
        propertyData.equityAmount,
        propertyData.equityPercent,
        propertyData.leadTemperature,
        propertyData.trackingStatus,
        propertyData.taxDelinquent,
        propertyData.taxDelinquentYear,
        propertyData.taxAmount
      ]);
      
      propertyId = result.insertId;
    }

    console.log(`Property ID: ${propertyId}`);

    // Check if deep search record exists (correct table name: propertyDeepSearch)
    const [existingDeepSearch] = await connection.execute(
      'SELECT id FROM propertyDeepSearch WHERE propertyId = ?',
      [propertyId]
    );

    // Deep search data with correct column names
    const deepSearchData = {
      propertyId: propertyId,
      // Financial data
      zillowEstimate: 364000,
      dealMachineEstimate: 364000,
      ourEstimate: 364000,
      estimateNotes: 'REsimpli estimated value. Estate property.',
      // MLS Status
      mlsStatus: 'Not Listed',
      // Occupancy
      occupancy: 'Tenant-Occupied',
      // Delinquent taxes
      delinquentTax2025: 8099,
      delinquentTax2024: 9021,
      delinquentTax2023: 8470,
      delinquentTaxTotal: 25591,
      // Property condition
      propertyCondition: JSON.stringify({
        'Needs Repairs': true,
        'Fair': true
      }),
      // Issues
      issues: JSON.stringify(['Tax Delinquent', 'Estate/Probate', 'Tenant Occupied']),
      // Mortgage
      hasMortgage: 0,
      equityPercent: 100,
      // Repairs
      needsRepairs: 1,
      repairNotes: 'Property looks in need of repairs per REsimpli notes',
      // Skiptracing notes
      skiptracingNotes: 'Skip traced via REsimpli/Forewarn. Multiple phone numbers found for Andrea Eulene Trotman (Age 62), Mitchell Thomas Trotman (Age 43), and Michael Todd Trotman (Age 43). Primary contact: Andrea at 754-308-2807.',
      // Overview notes
      overviewNotes: 'Door Knocking lead from REsimpli. Tenant living in property. Will give number to attorney. Estate property (Anthony Trotman EST). 3 years behind in taxes totaling $25,590.64.'
    };

    if (existingDeepSearch.length > 0) {
      console.log('Updating deep search data...');
      await connection.execute(`
        UPDATE propertyDeepSearch SET
          zillowEstimate = ?,
          dealMachineEstimate = ?,
          ourEstimate = ?,
          estimateNotes = ?,
          mlsStatus = ?,
          occupancy = ?,
          delinquentTax2025 = ?,
          delinquentTax2024 = ?,
          delinquentTax2023 = ?,
          delinquentTaxTotal = ?,
          propertyCondition = ?,
          issues = ?,
          hasMortgage = ?,
          equityPercent = ?,
          needsRepairs = ?,
          repairNotes = ?,
          skiptracingNotes = ?,
          overviewNotes = ?,
          updatedAt = NOW()
        WHERE propertyId = ?
      `, [
        deepSearchData.zillowEstimate,
        deepSearchData.dealMachineEstimate,
        deepSearchData.ourEstimate,
        deepSearchData.estimateNotes,
        deepSearchData.mlsStatus,
        deepSearchData.occupancy,
        deepSearchData.delinquentTax2025,
        deepSearchData.delinquentTax2024,
        deepSearchData.delinquentTax2023,
        deepSearchData.delinquentTaxTotal,
        deepSearchData.propertyCondition,
        deepSearchData.issues,
        deepSearchData.hasMortgage,
        deepSearchData.equityPercent,
        deepSearchData.needsRepairs,
        deepSearchData.repairNotes,
        deepSearchData.skiptracingNotes,
        deepSearchData.overviewNotes,
        propertyId
      ]);
    } else {
      console.log('Creating deep search data...');
      await connection.execute(`
        INSERT INTO propertyDeepSearch (
          propertyId, zillowEstimate, dealMachineEstimate, ourEstimate,
          estimateNotes, mlsStatus, occupancy, delinquentTax2025, delinquentTax2024,
          delinquentTax2023, delinquentTaxTotal, propertyCondition, issues,
          hasMortgage, equityPercent, needsRepairs, repairNotes,
          skiptracingNotes, overviewNotes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        propertyId,
        deepSearchData.zillowEstimate,
        deepSearchData.dealMachineEstimate,
        deepSearchData.ourEstimate,
        deepSearchData.estimateNotes,
        deepSearchData.mlsStatus,
        deepSearchData.occupancy,
        deepSearchData.delinquentTax2025,
        deepSearchData.delinquentTax2024,
        deepSearchData.delinquentTax2023,
        deepSearchData.delinquentTaxTotal,
        deepSearchData.propertyCondition,
        deepSearchData.issues,
        deepSearchData.hasMortgage,
        deepSearchData.equityPercent,
        deepSearchData.needsRepairs,
        deepSearchData.repairNotes,
        deepSearchData.skiptracingNotes,
        deepSearchData.overviewNotes
      ]);
    }

    // Add contacts to contacts table
    const contacts = [
      {
        name: 'Anthony Trotman',
        relationship: 'Owner',
        phone1: '(954) 839-4813',
        phone1Type: 'Mobile',
        email1: 'andreatrotman2@gmail.com',
        currentAddress: '1711 NW 55th Ave, Lauderhill, FL 33313',
        deceased: 1,
        isDecisionMaker: 0
      },
      {
        name: 'Andrea Eulene Trotman',
        relationship: 'Family',
        age: 62,
        phone1: '(754) 308-2807',
        phone1Type: 'Mobile',
        phone2: '(305) 335-3150',
        phone2Type: 'Mobile',
        phone3: '(954) 714-2630',
        phone3Type: 'Landline',
        email1: 'aesbaby@hotmail.com',
        currentAddress: '1711 NW 55TH AVE, Fort Lauderdale, FL 33313',
        deceased: 0,
        isDecisionMaker: 1,
        flags: 'Primary Contact, Skip Traced'
      },
      {
        name: 'Michael Todd Trotman',
        relationship: 'Family',
        age: 43,
        phone1: '(561) 635-6881',
        phone1Type: 'Mobile',
        phone2: '(954) 593-5693',
        phone2Type: 'Mobile',
        phone3: '(954) 955-0705',
        phone3Type: 'Mobile',
        email1: 'aesbaby@gmail.com',
        currentAddress: '4441 NW 3RD PL, Fort Lauderdale, FL 33317',
        deceased: 0,
        isDecisionMaker: 0,
        flags: 'Skip Traced'
      },
      {
        name: 'Mitchell Thomas Trotman',
        relationship: 'Family',
        age: 43,
        phone1: '(954) 955-0705',
        phone1Type: 'Mobile',
        phone2: '(954) 593-5693',
        phone2Type: 'Mobile',
        phone3: '(754) 422-7299',
        phone3Type: 'Mobile',
        email1: '',
        currentAddress: '3944 INVERRARY DR # B1, Lauderhill, FL 33319',
        deceased: 0,
        isDecisionMaker: 0,
        flags: 'Skip Traced'
      }
    ];

    // Delete existing contacts for this property
    await connection.execute('DELETE FROM contacts WHERE propertyId = ?', [propertyId]);

    // Insert contacts
    for (const contact of contacts) {
      await connection.execute(`
        INSERT INTO contacts (
          propertyId, name, relationship, age, phone1, phone1Type, phone2, phone2Type,
          phone3, phone3Type, email1, currentAddress, deceased, isDecisionMaker, flags, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        propertyId,
        contact.name,
        contact.relationship,
        contact.age || null,
        contact.phone1,
        contact.phone1Type,
        contact.phone2 || null,
        contact.phone2Type || null,
        contact.phone3 || null,
        contact.phone3Type || null,
        contact.email1 || null,
        contact.currentAddress,
        contact.deceased,
        contact.isDecisionMaker,
        contact.flags || null
      ]);
    }

    console.log(`Added ${contacts.length} contacts`);
    console.log('Import completed successfully!');

  } catch (error) {
    console.error('Error importing lead:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

importLead();
