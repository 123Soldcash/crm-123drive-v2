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

  import46col: publicProcedure
    .input(
      z.object({
        propertiesCSV: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Parse CSV with 46 columns format
        const lines = input.propertiesCSV.trim().split('\n');
        if (lines.length < 2) throw new Error("CSV must have header and data rows");

        const headers = lines[0].split(',').map(h => h.trim());
        const dataLine = lines[1];

        // Simple CSV parsing that handles quoted fields
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < dataLine.length; i++) {
          const char = dataLine[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current.trim());

        // Map fields to data
        const data: Record<string, string> = {};
        headers.forEach((header, index) => {
          data[header] = fields[index] || '';
        });

        // Extract property data
        const address = data.property_address_full?.trim();
        const street = data.property_address_line_1?.trim();
        const city = data.property_address_city?.trim();
        const state = data.property_address_state?.trim();
        const zipcode = data.property_address_zipcode?.trim();
        const ownerName = data.owner_1_name?.trim();

        // Validate required fields
        if (!address || !city || !state || !zipcode) {
          throw new Error("Missing required fields: address, city, state, zipcode");
        }

        // Check for duplicate
        const key = `${street}|${city}|${state}|${zipcode}`.toLowerCase();
        const existing = await db.select().from(properties).where(eq(properties.addressLine1, street));
        if (existing.length > 0) {
          throw new Error(`Duplicate property: ${address}`);
        }

        // Get next LEAD ID
        const nextLeadId = await getNextLeadId();

        // Insert property
        const result = await db.insert(properties).values({
          leadId: nextLeadId,
          addressLine1: street,
          addressLine2: null,
          city: city,
          state: state,
          zipcode: zipcode,
          owner1Name: ownerName || 'Unknown',
          leadTemperature: 'TBD',
          deskStatus: 'BIN',
          source: 'DealMachine',
          listName: 'DealMachine Import',
          entryDate: new Date(),
          dealMachinePropertyId: data.property_id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const propertyId = (result as any).insertId || 0;
        let contactsCreated = 0;
        let phonesCreated = 0;
        let emailsCreated = 0;

        if (propertyId) {
          // Add status tag
          await db.insert(propertyTags).values({
            propertyId,
            tag: 'dealmachine_46col_import',
            createdBy: 1,
            createdAt: new Date(),
          });

          // Import up to 4 contacts
          for (let i = 1; i <= 4; i++) {
            const contactName = data[`contact_${i}_name`]?.trim();
            if (!contactName) continue;

            const contactPhone1 = data[`contact_${i}_phone1`]?.trim();
            const contactEmail1 = data[`contact_${i}_email1`]?.trim();

            // Insert contact
            const contactResult = await db.insert(contacts).values({
              propertyId,
              name: contactName,
              relationship: 'Owner',
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const contactId = (contactResult as any).insertId || 0;

            if (contactId) {
              // Add phone if exists
              if (contactPhone1) {
                await db.insert(contactPhones).values({
                  contactId,
                  phoneNumber: contactPhone1,
                  phoneType: 'Mobile',
                  createdAt: new Date(),
                });
                phonesCreated++;
              }

              // Add email if exists
              if (contactEmail1) {
                await db.insert(contactEmails).values({
                  contactId,
                  email: contactEmail1,
                  isPrimary: 1,
                  createdAt: new Date(),
                });
                emailsCreated++;
              }

              contactsCreated++;
            }
          }
        }

        return {
          success: true,
          propertyId,
          address,
          contactsCreated,
          phonesCreated,
          emailsCreated,
          message: `Imported property: ${address} with ${contactsCreated} contacts`,
        };
      } catch (error) {
        console.error("Import 46col error:", error);
        throw new Error(`Import failed: ${(error as Error).message}`);
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
