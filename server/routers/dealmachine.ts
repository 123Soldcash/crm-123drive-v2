import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb, getNextLeadId } from "../db";
import { properties, contacts, contactPhones, contactEmails, propertyTags } from "../../drizzle/schema";
import { parseCSV, transformProperty, transformContact, validateProperty, getPropertyKey } from "../dealmachine-import";
import { eq, and } from "drizzle-orm";

export const dealmachineRouter = router({
  preview: publicProcedure
    .input(
      z.object({
        propertiesCSV: z.string(),
        contactsCSV: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Parse properties CSV
        const propertyRows = parseCSV(input.propertiesCSV);
        const parsedProperties = propertyRows
          .map(transformProperty)
          .filter((p) => p !== null) as any[];

        // Parse contacts CSV if provided
        let parsedContacts = [];
        if (input.contactsCSV) {
          const contactRows = parseCSV(input.contactsCSV);
          parsedContacts = contactRows
            .map(transformContact)
            .filter((c) => c !== null) as any[];
        }

        return {
          propertiesCount: parsedProperties.length,
          contactsCount: parsedContacts.length,
          preview: {
            properties: parsedProperties.slice(0, 3),
            contacts: parsedContacts.slice(0, 3),
          },
        };
      } catch (error) {
        console.error("Preview error:", error);
        throw new Error(`Preview failed: ${(error as Error).message}`);
      }
    }),

  import: publicProcedure
    .input(
      z.object({
        propertiesCSV: z.string(),
        contactsCSV: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Parse properties CSV
        const propertyRows = parseCSV(input.propertiesCSV);
        const parsedProperties = propertyRows
          .map(transformProperty)
          .filter((p) => p !== null) as any[];

        // Check for duplicates
        const existingAddresses = new Set<string>();
        const allProperties = await db.select().from(properties);
        for (const prop of allProperties) {
          const key = `${prop.addressLine1}|${prop.city}|${prop.state}|${prop.zipcode}`.toLowerCase();
          existingAddresses.add(key);
        }

        // Import new properties with LEAD IDs
        let propertiesCreated = 0;
        const dealMachineIdMap = new Map<string, number>(); // Map dealMachinePropertyId to our property ID
        
        for (const prop of parsedProperties) {
          const key = getPropertyKey(prop);
          if (!existingAddresses.has(key)) {
            // Get next LEAD ID
            const nextLeadId = await getNextLeadId();
            
            const result = await db.insert(properties).values({
              leadId: nextLeadId,
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
            
            // Store property ID for contact import
            const propertyId = (result as any).insertId || 0;
            if (propertyId && prop.dealMachinePropertyId) {
              dealMachineIdMap.set(prop.dealMachinePropertyId, propertyId);
              
              // Add status tag for this import batch
              await db.insert(propertyTags).values({
                propertyId,
                tag: "dealmachine_deep_search_chris_edsel_zach",
                createdBy: 1,
                createdAt: new Date(),
              });
            }
            
            propertiesCreated++;
            existingAddresses.add(key);
          }
        }

        // Import contacts if provided
        let contactsCreated = 0;
        if (input.contactsCSV) {
          const contactRows = parseCSV(input.contactsCSV);
          
          for (const row of contactRows) {
            const parsedContact = transformContact(row);
            if (!parsedContact) continue;
            
            // Get the associated_property_id from the contact row
            const associatedPropertyId = row["associated_property_id"];
            if (!associatedPropertyId) continue;
            
            // Find the property by dealMachinePropertyId
            const matchingProperty = await db
              .select({ id: properties.id })
              .from(properties)
              .where(eq(properties.dealMachinePropertyId, associatedPropertyId))
              .limit(1);
            
            if (matchingProperty.length === 0) continue;
            
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
            
            // Get the inserted contact ID
            const contactId = (contactResult as any).insertId || 0;
            
            if (contactId) {
              // Add phone if provided
              if (parsedContact.phone) {
                // Validate phoneType is one of the allowed enum values
                const validPhoneTypes = ["Mobile", "Landline", "Wireless", "Work", "Home", "Other"];
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
              
              // Add email if provided
              if (parsedContact.email) {
                await db.insert(contactEmails).values({
                  contactId,
                  email: parsedContact.email,
                  isPrimary: 1,
                  createdAt: new Date(),
                });
              }
              
              contactsCreated++;
            }
          }
        }

        return {
          success: true,
          propertiesCreated,
          contactsCreated,
          message: `Imported ${propertiesCreated} properties and ${contactsCreated} contacts`,
        };
      } catch (error) {
        console.error("Import error:", error);
        throw new Error(`Import failed: ${(error as Error).message}`);
      }
    }),
});
