import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { getDb } from "./db";
import { properties, contacts, contactPhones, propertyTags } from "../drizzle/schema";
import { parseCSV, transformProperty, transformContact } from "./dealmachine-import";
import { eq } from "drizzle-orm";

describe("DealMachine Contact Import", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
  });

  it("should import contacts with associated_property_id matching", async () => {
    // Read CSV files
    const propertiesCSV = readFileSync(
      "/home/ubuntu/upload/dealmachine-properties-2026-01-09-150558.csv",
      "utf-8"
    );
    const contactsCSV = readFileSync(
      "/home/ubuntu/upload/dealmachine-contacts-2026-01-09-150431.csv",
      "utf-8"
    );

    // Parse properties CSV
    const propertyRows = parseCSV(propertiesCSV);
    const parsedProperties = propertyRows
      .map(transformProperty)
      .filter((p) => p !== null) as any[];

    console.log(`Parsed ${parsedProperties.length} properties`);

    // Import properties
    let propertiesCreated = 0;
    for (const prop of parsedProperties) {
      const result = await db.insert(properties).values({
        leadId: 270000 + propertiesCreated,
        addressLine1: prop.addressLine1,
        addressLine2: prop.addressLine2 || null,
        city: prop.city,
        state: prop.state,
        zipcode: prop.zipcode,
        owner1Name: prop.owner1Name || null,
        propertyType: prop.propertyType || null,
        yearBuilt: prop.yearBuilt || null,
        totalBedrooms: prop.totalBedrooms || null,
        totalBaths: prop.totalBaths || null,
        buildingSquareFeet: prop.buildingSquareFeet || null,
        estimatedValue: prop.estimatedValue || null,
        equityPercent: prop.equityPercent || null,
        mortgageAmount: prop.mortgageAmount || null,
        taxAmount: prop.taxAmount || null,
        marketStatus: prop.marketStatus || null,
        dealMachinePropertyId: prop.dealMachinePropertyId || null,
        dealMachineLeadId: prop.dealMachineLeadId || null,
        dealMachineRawData: prop.dealMachineRawData,
        leadTemperature: "TBD",
        deskStatus: "BIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const propertyId = (result as any).insertId || 0;
      if (propertyId) {
        // Add status tag
        await db.insert(propertyTags).values({
          propertyId,
          tag: "dealmachine_deep_search_chris_edsel_zach",
          createdBy: 1,
          createdAt: new Date(),
        });
      }

      propertiesCreated++;
    }

    console.log(`✅ Imported ${propertiesCreated} properties`);

    // Parse contacts CSV
    const contactRows = parseCSV(contactsCSV);
    const parsedContacts = contactRows
      .map(transformContact)
      .filter((c) => c !== null) as any[];

    console.log(`Parsed ${parsedContacts.length} contacts`);

    // Import contacts
    let contactsCreated = 0;
    for (const row of contactRows) {
      const parsedContact = transformContact(row);
      if (!parsedContact) continue;

      // Get the associated_property_id from the contact row
      const associatedPropertyId = row["associated_property_id"];
      if (!associatedPropertyId) {
        console.log(`Skipping contact ${row.first_name} - no associated_property_id`);
        continue;
      }

      // Find the property by dealMachinePropertyId
      const matchingProperty = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.dealMachinePropertyId, associatedPropertyId))
        .limit(1);

      if (matchingProperty.length === 0) {
        console.log(
          `Skipping contact ${row.first_name} - no matching property for ID ${associatedPropertyId}`
        );
        continue;
      }

      const propertyId = matchingProperty[0].id;

      // Create contact
      const contactResult = await db.insert(contacts).values({
        propertyId,
        name: parsedContact.name,
        relationship: parsedContact.relationship as any,
        dnc: parsedContact.dnc ? 1 : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const contactId = (contactResult as any).insertId || 0;

      if (contactId) {
        // Add phone if provided
        if (parsedContact.phone) {
          const validPhoneTypes = [
            "Mobile",
            "Landline",
            "Wireless",
            "Work",
            "Home",
            "Other",
          ];
          let phoneType: any = parsedContact.phoneType || "Mobile";
          if (!validPhoneTypes.includes(phoneType)) {
            phoneType = "Mobile";
          }

          await db.insert(contactPhones).values({
            contactId,
            phoneNumber: parsedContact.phone,
            phoneType,
            dnc: parsedContact.dnc ? 1 : 0,
            createdAt: new Date(),
          });
        }

        contactsCreated++;
      }
    }

    console.log(`✅ Imported ${contactsCreated} contacts`);

    // Verify results
    const totalProperties = await db
      .select({ count: properties.id })
      .from(properties);
    const totalContacts = await db.select({ count: contacts.id }).from(contacts);

    console.log(`Total properties in DB: ${totalProperties.length}`);
    console.log(`Total contacts in DB: ${totalContacts.length}`);

    expect(totalProperties.length).toBeGreaterThan(0);
    expect(totalContacts.length).toBeGreaterThan(0);
  }, { timeout: 120000 });
});
