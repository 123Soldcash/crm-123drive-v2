import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb, getNextLeadId } from "../db";
import { properties, contacts, contactPhones, contactEmails, propertyTags } from "../../drizzle/schema";
import { parseCSV, transformPropertyWithContacts, validateProperty, getPropertyKey } from "../dealmachine-import";
import { eq } from "drizzle-orm";

export const dealmachineRouter = router({
  preview: publicProcedure
    .input(
      z.object({
        propertiesCSV: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        // Parse properties CSV (consolidated format with embedded contacts)
        const propertyRows = parseCSV(input.propertiesCSV);
        const parsedData = propertyRows
          .map(transformPropertyWithContacts)
          .filter((p) => p !== null) as any[];

        // Count total contacts
        let totalContacts = 0;
        for (const item of parsedData) {
          totalContacts += item.contacts.length;
        }

        return {
          propertiesCount: parsedData.length,
          contactsCount: totalContacts,
          preview: {
            properties: parsedData.slice(0, 3).map((d: any) => ({
              property: d.property,
              contactCount: d.contacts.length,
            })),
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
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Parse properties CSV (consolidated format with embedded contacts)
        const propertyRows = parseCSV(input.propertiesCSV);
        const parsedData = propertyRows
          .map(transformPropertyWithContacts)
          .filter((p) => p !== null) as any[];

        // Check for duplicate properties
        const existingAddresses = new Set<string>();
        const allProperties = await db.select().from(properties);
        for (const prop of allProperties) {
          const key = `${prop.addressLine1}|${prop.city}|${prop.state}|${prop.zipcode}`.toLowerCase();
          existingAddresses.add(key);
        }

        // Import properties and their embedded contacts
        let propertiesCreated = 0;
        let contactsCreated = 0;
        let phonesCreated = 0;
        let emailsCreated = 0;

        for (const item of parsedData) {
          const prop = item.property;
          const embeddedContacts = item.contacts;

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
              equityAmount: prop.equityAmount || null,
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
              // Add status tag for this import batch
              await db.insert(propertyTags).values({
                propertyId,
                tag: "dealmachine_deep_search_chris_edsel_zach",
                createdBy: 1,
                createdAt: new Date(),
              });

              // Import embedded contacts
              for (const parsedContact of embeddedContacts) {
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
                    phonesCreated++;
                  }

                  // Add email if provided
                  if (parsedContact.email) {
                    await db.insert(contactEmails).values({
                      contactId,
                      email: parsedContact.email,
                      isPrimary: 1,
                      createdAt: new Date(),
                    });
                    emailsCreated++;
                  }

                  contactsCreated++;
                }
              }

              propertiesCreated++;
              existingAddresses.add(key);
            }
          }
        }

        return {
          success: true,
          propertiesCreated,
          contactsCreated,
          phonesCreated,
          emailsCreated,
          message: `Imported ${propertiesCreated} properties, ${contactsCreated} contacts, ${phonesCreated} phones, ${emailsCreated} emails`,
        };
      } catch (error) {
        console.error("Import error:", error);
        throw new Error(`Import failed: ${(error as Error).message}`);
      }
    }),
});
