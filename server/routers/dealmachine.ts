import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { properties } from "../../drizzle/schema";
import { parseCSV, transformProperty, validateProperty, getPropertyKey } from "../dealmachine-import";

export const dealmachineRouter = router({
  preview: publicProcedure
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

        const previewProperties = parsedProperties.slice(0, 5).map((prop) => {
          const key = getPropertyKey(prop);
          return {
            ...prop,
            isDuplicate: existingAddresses.has(key),
          };
        });

        let duplicates = 0;
        for (const prop of parsedProperties) {
          if (existingAddresses.has(getPropertyKey(prop))) {
            duplicates++;
          }
        }

        // Parse contacts if provided
        let previewContacts: any[] = [];
        let totalContacts = 0;
        if (input.contactsCSV) {
          const contactRows = parseCSV(input.contactsCSV);
          totalContacts = contactRows.length;
          previewContacts = contactRows
            .slice(0, 5)
            .map((row) => ({
              name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
              phone: row.phone_1 || "",
              email: row.email_address_1 || "",
              dnc: row.phone_1_do_not_call?.toLowerCase() === "yes",
            }))
            .filter((c) => c.name);
        }

        return {
          totalProperties: parsedProperties.length,
          duplicates,
          newProperties: parsedProperties.length - duplicates,
          properties: previewProperties,
          totalContacts,
          contacts: previewContacts,
        };
      } catch (error) {
        console.error("Preview error:", error);
        throw error;
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

        // Import new properties
        let propertiesCreated = 0;
        for (const prop of parsedProperties) {
          const key = getPropertyKey(prop);
          if (!existingAddresses.has(key)) {
            await db.insert(properties).values({
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
            propertiesCreated++;
            existingAddresses.add(key);
          }
        }

        // TODO: Import contacts if needed
        // For now, just return property count
        return {
          propertiesCreated,
          contactsCreated: 0,
        };
      } catch (error) {
        console.error("Import error:", error);
        throw error;
      }
    }),
});
