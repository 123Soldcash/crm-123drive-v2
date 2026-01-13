import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb, getNextLeadId } from "../db";
import { properties, contacts, contactPhones, contactEmails, propertyTags } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const dealmachineRolandoRouter = router({
  importBulkRolando: publicProcedure
    .input(
      z.object({
        property: z.object({
          propertyId: z.string().optional(),
          leadId: z.string().optional(),
          addressFull: z.string(),
          addressLine1: z.string(),
          addressLine2: z.string().nullable(),
          city: z.string(),
          state: z.string(),
          zipcode: z.string(),
          county: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          ownerName: z.string().optional(),
          propertyFlags: z.string().optional(),
          dealMachineUrl: z.string().optional(),
        }),
        contacts: z.array(
          z.object({
            name: z.string(),
            flags: z.string().optional(),
            phones: z.array(z.string()).optional(),
            emails: z.array(z.string()).optional(),
          })
        ).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { property, contacts: contactsData } = input;

        // Check for duplicate
        const existing = await db
          .select()
          .from(properties)
          .where(eq(properties.addressLine1, property.addressLine1));

        if (existing.length > 0) {
          // Property already exists - just return success
          return {
            success: true,
            propertyId: existing[0].id,
            address: property.addressFull,
            contactsCreated: 0,
            phonesCreated: 0,
            emailsCreated: 0,
            message: `Property already exists: ${property.addressFull}`,
            isNew: false,
          };
        }

        // Get next LEAD ID
        const nextLeadId = await getNextLeadId();

        // Insert property
        const result = await db.insert(properties).values({
          leadId: nextLeadId,
          addressLine1: property.addressLine1,
          addressLine2: property.addressLine2,
          city: property.city,
          state: property.state,
          zipcode: property.zipcode,
          owner1Name: property.ownerName || 'Unknown',
          leadTemperature: 'TBD',
          deskStatus: 'BIN',
          source: 'DealMachine',
          listName: 'Rolando',
          entryDate: new Date(),
          dealMachinePropertyId: property.propertyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const propertyId = (result as any).insertId || 0;
        let contactsCreated = 0;
        let phonesCreated = 0;
        let emailsCreated = 0;

        if (propertyId) {
          // Add property flags as tags
          if (property.propertyFlags) {
            const flags = property.propertyFlags.split(',').map(f => f.trim());
            for (const flag of flags) {
              if (flag) {
                await db.insert(propertyTags).values({
                  propertyId,
                  tag: flag,
                  createdBy: 1,
                  createdAt: new Date(),
                });
              }
            }
          }

          // Add list tag
          await db.insert(propertyTags).values({
            propertyId,
            tag: 'rolando_import',
            createdBy: 1,
            createdAt: new Date(),
          });

          // Import contacts
          if (contactsData && contactsData.length > 0) {
            for (const contactData of contactsData) {
              // Insert contact
              const contactResult = await db.insert(contacts).values({
                propertyId,
                name: contactData.name,
                relationship: extractRelationship(contactData.flags),
                dnc: contactData.flags?.includes('DNC') ? 1 : 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              const contactId = (contactResult as any).insertId || 0;

              if (contactId) {
                // Add phones
                if (contactData.phones && contactData.phones.length > 0) {
                  for (const phone of contactData.phones) {
                    if (phone) {
                      await db.insert(contactPhones).values({
                        contactId,
                        phoneNumber: phone,
                        phoneType: 'Mobile',
                        dnc: contactData.flags?.includes('DNC') ? 1 : 0,
                        createdAt: new Date(),
                      });
                      phonesCreated++;
                    }
                  }
                }

                // Add emails
                if (contactData.emails && contactData.emails.length > 0) {
                  for (const email of contactData.emails) {
                    if (email) {
                      await db.insert(contactEmails).values({
                        contactId,
                        email,
                        isPrimary: contactData.emails[0] === email ? 1 : 0,
                        createdAt: new Date(),
                      });
                      emailsCreated++;
                    }
                  }
                }

                contactsCreated++;
              }
            }
          }
        }

        return {
          success: true,
          propertyId,
          address: property.addressFull,
          contactsCreated,
          phonesCreated,
          emailsCreated,
          message: `Imported property: ${property.addressFull} with ${contactsCreated} contacts`,
          isNew: true,
        };
      } catch (error) {
        console.error("Import Rolando error:", error);
        throw new Error(`Import failed: ${(error as Error).message}`);
      }
    }),
});

function extractRelationship(flags?: string): string {
  if (!flags) return 'Owner';
  if (flags.includes('Likely Owner')) return 'Owner';
  if (flags.includes('Resident')) return 'Resident';
  if (flags.includes('Tenant')) return 'Tenant';
  return 'Owner';
}
