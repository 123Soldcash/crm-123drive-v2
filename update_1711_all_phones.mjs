import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function updateContacts() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // First, find the property ID for 1711 NW 55th Ave
    const [properties] = await connection.execute(
      `SELECT id FROM properties WHERE addressLine1 LIKE '%1711 NW 55%' OR addressLine1 LIKE '%1711 Nw 55%'`
    );
    
    if (properties.length === 0) {
      console.log('Property not found!');
      return;
    }
    
    const propertyId = properties[0].id;
    console.log(`Found property ID: ${propertyId}`);
    
    // Delete existing contacts and their phones for this property
    const [existingContacts] = await connection.execute(`SELECT id FROM contacts WHERE propertyId = ?`, [propertyId]);
    for (const contact of existingContacts) {
      await connection.execute(`DELETE FROM contactPhones WHERE contactId = ?`, [contact.id]);
    }
    await connection.execute(`DELETE FROM contacts WHERE propertyId = ?`, [propertyId]);
    console.log('Deleted existing contacts and phones');
    
    // All contacts from REsimpli with TrestleIQ verification status
    const contacts = [
      // Anthony Trotman - Owner (Deceased)
      {
        name: 'Anthony Trotman',
        relationship: 'Owner',
        phones: [
          { number: '9548394813', type: 'Mobile', status: 'Active', isPrimary: 1 }
        ],
        email1: 'andreatrotman2@gmail.com',
        deceased: 1,
        isDecisionMaker: 0,
        isLitigator: 0
      },
      // Andrea Eulene Trotman - Family (Decision Maker)
      {
        name: 'Andrea Eulene Trotman',
        relationship: 'Family',
        age: 62,
        phones: [
          { number: '7543082807', type: 'Mobile', status: 'Active', isPrimary: 1 },
          { number: '3053353150', type: 'Mobile', status: 'Active', isPrimary: 0 },
          { number: '9547142630', type: 'Landline', status: 'Disconnected', isPrimary: 0, dnc: 1 },
          { number: '9546876789', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9548394813', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '7543083807', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '5617686601', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9544716656', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9548189441', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9543066268', type: 'Landline', status: 'Not Verified', isPrimary: 0 },
          { number: '9544845990', type: 'Landline', status: 'Not Verified', isPrimary: 0 },
          { number: '3058295922', type: 'Landline', status: 'Not Verified', isPrimary: 0 },
          { number: '9547143172', type: 'Landline', status: 'Not Verified', isPrimary: 0 }
        ],
        email1: 'aesbaby@hotmail.com',
        email2: 'aesbaby@gmail.com',
        email3: 'andreatrotman2@gmail.com',
        deceased: 0,
        isDecisionMaker: 1,
        isLitigator: 0
      },
      // Michael Todd Trotman - Family
      {
        name: 'Michael Todd Trotman',
        relationship: 'Family',
        age: 43,
        phones: [
          { number: '5616356881', type: 'Mobile', status: 'Active', isPrimary: 1 },
          { number: '9545935693', type: 'Mobile', status: 'Active', isPrimary: 0 },
          { number: '9549550705', type: 'Mobile', status: 'Active', isPrimary: 0 },
          { number: '7544227299', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9549401626', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9546578150', type: 'Landline', status: 'Not Verified', isPrimary: 0 },
          { number: '9545849439', type: 'Landline', status: 'Not Verified', isPrimary: 0 },
          { number: '9545814516', type: 'Landline', status: 'Not Verified', isPrimary: 0 },
          { number: '9546897522', type: 'Landline', status: 'Not Verified', isPrimary: 0 }
        ],
        email1: 'aesbaby@gmail.com',
        email2: 'newbabymartin@yahoo.com',
        deceased: 0,
        isDecisionMaker: 0,
        isLitigator: 0
      },
      // Mitchell Thomas Trotman - Family
      {
        name: 'Mitchell Thomas Trotman',
        relationship: 'Family',
        age: 43,
        phones: [
          { number: '9549550705', type: 'Mobile', status: 'Active', isPrimary: 1 },
          { number: '9545935693', type: 'Mobile', status: 'Active', isPrimary: 0 },
          { number: '7544227299', type: 'Mobile', status: 'Active', isPrimary: 0 }
        ],
        email1: 'trotman2304@yahoo.com',
        email2: 'mitchelltrotman26@yahoo.com',
        deceased: 0,
        isDecisionMaker: 0,
        isLitigator: 0
      },
      // Michelle Swann - Third Party
      {
        name: 'Michelle Swann',
        relationship: 'Third Party',
        phones: [
          { number: '3053353150', type: 'Mobile', status: 'Not Verified', isPrimary: 1 },
          { number: '7862530837', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '6126693785', type: 'Mobile', status: 'Not Verified', isPrimary: 0 },
          { number: '9546876789', type: 'Mobile', status: 'Not Verified', isPrimary: 0 }
        ],
        email1: 'aesbaby@msn.com',
        deceased: 0,
        isDecisionMaker: 0,
        isLitigator: 0
      }
    ];
    
    for (const contact of contacts) {
      // Get up to 3 phones for the contact table (backward compatibility)
      const phone1 = contact.phones[0]?.number || null;
      const phone1Type = contact.phones[0]?.type || null;
      const phone2 = contact.phones[1]?.number || null;
      const phone2Type = contact.phones[1]?.type || null;
      const phone3 = contact.phones[2]?.number || null;
      const phone3Type = contact.phones[2]?.type || null;
      
      const [result] = await connection.execute(
        `INSERT INTO contacts (propertyId, name, relationship, age, phone1, phone1Type, phone2, phone2Type, phone3, phone3Type, email1, email2, email3, deceased, isDecisionMaker, isLitigator, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          propertyId,
          contact.name,
          contact.relationship,
          contact.age || null,
          phone1,
          phone1Type,
          phone2,
          phone2Type,
          phone3,
          phone3Type,
          contact.email1 || null,
          contact.email2 || null,
          contact.email3 || null,
          contact.deceased,
          contact.isDecisionMaker,
          contact.isLitigator
        ]
      );
      
      const contactId = result.insertId;
      
      // Insert all phones into contactPhones table
      for (const phone of contact.phones) {
        const dnc = phone.status === 'Disconnected' ? 1 : (phone.dnc || 0);
        await connection.execute(
          `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, dnc, createdAt)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [contactId, phone.number, phone.type, phone.isPrimary, dnc]
        );
      }
      
      console.log(`Added contact: ${contact.name} with ${contact.phones.length} phones`);
    }
    
    // Also update the deep search with TrestleIQ verification notes
    await connection.execute(
      `UPDATE propertyDeepSearch 
       SET skiptraceNotes = CONCAT(COALESCE(skiptraceNotes, ''), '\n\n=== TrestleIQ Verification (Jan 5, 2026) ===\n\nVERIFIED ACTIVE (Score 100, No Litigator):\n- 954-839-4813 (Anthony)\n- 754-308-2807 (Andrea)\n- 305-335-3150 (Andrea)\n- 561-635-6881 (Michael)\n- 954-593-5693 (Michael/Mitchell)\n- 954-955-0705 (Michael/Mitchell)\n- 754-422-7299 (Mitchell)\n\nDISCONNECTED:\n- 954-714-2630 (Andrea) - Score 30\n\nAll verified numbers are SAFE (no litigator flags).'),
           updatedAt = NOW()
       WHERE propertyId = ?`,
      [propertyId]
    );
    
    console.log('Updated deep search with TrestleIQ verification notes');
    console.log('\n✅ All contacts updated successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

updateContacts();
