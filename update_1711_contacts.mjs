import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function updateContacts() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // First, find the property ID for 1711 NW 55th Ave
    const [properties] = await connection.execute(
      "SELECT id FROM properties WHERE addressLine1 LIKE '%1711%55%' LIMIT 1"
    );
    
    if (properties.length === 0) {
      console.log("Property not found!");
      return;
    }
    
    const propertyId = properties[0].id;
    console.log(`Found property ID: ${propertyId}`);
    
    // Delete existing contact phones first (foreign key)
    const [existingContacts] = await connection.execute(
      "SELECT id FROM contacts WHERE propertyId = ?",
      [propertyId]
    );
    
    for (const contact of existingContacts) {
      await connection.execute(
        "DELETE FROM contactPhones WHERE contactId = ?",
        [contact.id]
      );
    }
    
    // Delete existing contacts for this property to replace with complete data
    await connection.execute(
      "DELETE FROM contacts WHERE propertyId = ?",
      [propertyId]
    );
    console.log("Cleared existing contacts");
    
    // Insert all contacts with complete phone numbers from REsimpli screenshot
    const contacts = [
      {
        name: "Anthony Trotman",
        relationship: "Owner",
        phones: ["(954) 839-4813"],
        deceased: 1,
        isDecisionMaker: 0,
        flags: "Deceased Owner"
      },
      {
        name: "Andrea Eulene Trotman",
        relationship: "Family",
        phones: ["(754) 308-2807", "(305) 335-3150", "(954) 714-2630"],
        deceased: 0,
        isDecisionMaker: 1,
        flags: "Primary Contact, Family"
      },
      {
        name: "Michael Todd Trotman",
        relationship: "Family",
        phones: ["(561) 635-6881", "(954) 593-5693", "(954) 955-0705"],
        deceased: 0,
        isDecisionMaker: 0,
        flags: "Family"
      },
      {
        name: "Mitchell Thomas Trotman",
        relationship: "Family",
        phones: ["(954) 955-0705", "(954) 593-5693", "(754) 422-7299"],
        deceased: 0,
        isDecisionMaker: 0,
        flags: "Family"
      }
    ];
    
    for (const contact of contacts) {
      // Insert contact with correct column names
      const [result] = await connection.execute(
        `INSERT INTO contacts (propertyId, name, relationship, deceased, isDecisionMaker, flags, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          propertyId,
          contact.name,
          contact.relationship,
          contact.deceased,
          contact.isDecisionMaker,
          contact.flags
        ]
      );
      
      const contactId = result.insertId;
      console.log(`Created contact: ${contact.name} (ID: ${contactId})`);
      
      // Insert phone numbers
      for (let i = 0; i < contact.phones.length; i++) {
        const phone = contact.phones[i];
        await connection.execute(
          `INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, createdAt)
           VALUES (?, ?, 'Mobile', ?, NOW())`,
          [contactId, phone, i === 0 ? 1 : 0]
        );
        console.log(`  Added phone: ${phone}`);
      }
    }
    
    console.log("\n✅ All contacts updated successfully!");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

updateContacts();
