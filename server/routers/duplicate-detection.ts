import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { properties, contacts, contactPhones, contactEmails, contactAddresses } from "../../drizzle/schema";
import { eq, or, like, and } from "drizzle-orm";

export const duplicateDetectionRouter = router({
  /**
   * Search for potential duplicate leads by address, phone, or email
   * Returns similar leads found in the system
   */
  searchPotentialDuplicates: protectedProcedure
    .input(
      z.object({
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        ownerName: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const results = new Map<number, any>();

        // Search by address (exact and partial match)
        if (input.address && input.address.trim()) {
          const addressParts = input.address.trim().toLowerCase().split(/\s+/);
          const addressQuery = addressParts.map(part => `%${part}%`).join('%');
          
          const addressMatches = await db
            .select({
              id: properties.id,
              address: properties.addressLine1,
              city: properties.city,
              state: properties.state,
              zipcode: properties.zipcode,
              owner: properties.owner1Name,
              leadTemperature: properties.leadTemperature,
            })
            .from(properties)
            .where(
              or(
                like(properties.addressLine1, `%${input.address}%`),
                like(properties.city, `%${input.address}%`)
              )
            )
            .limit(5);

          addressMatches.forEach(match => {
            results.set(match.id, {
              ...match,
              matchType: 'address',
              matchScore: 90,
            });
          });
        }

        // Search by phone
        if (input.phone && input.phone.trim()) {
          const cleanPhone = input.phone.replace(/\D/g, '');
          
          const phoneMatches = await db
            .select({
              id: properties.id,
              address: properties.addressLine1,
              city: properties.city,
              state: properties.state,
              zipcode: properties.zipcode,
              owner: properties.owner1Name,
              leadTemperature: properties.leadTemperature,
            })
            .from(contactPhones)
            .innerJoin(contacts, eq(contactPhones.contactId, contacts.id))
            .innerJoin(properties, eq(contacts.propertyId, properties.id))
            .where(like(contactPhones.phone, `%${cleanPhone}%`))
            .limit(5);

          phoneMatches.forEach(match => {
            const existing = results.get(match.properties.id);
            if (existing) {
              existing.matchScore += 50;
              existing.matchTypes = [...(existing.matchTypes || []), 'phone'];
            } else {
              results.set(match.properties.id, {
                id: match.properties.id,
                address: match.properties.addressLine1,
                city: match.properties.city,
                state: match.properties.state,
                zipcode: match.properties.zipcode,
                owner: match.properties.owner1Name,
                leadTemperature: match.properties.leadTemperature,
                matchType: 'phone',
                matchScore: 85,
              });
            }
          });
        }

        // Search by email
        if (input.email && input.email.trim()) {
          const emailMatches = await db
            .select({
              id: properties.id,
              address: properties.addressLine1,
              city: properties.city,
              state: properties.state,
              zipcode: properties.zipcode,
              owner: properties.owner1Name,
              leadTemperature: properties.leadTemperature,
            })
            .from(contactEmails)
            .innerJoin(contacts, eq(contactEmails.contactId, contacts.id))
            .innerJoin(properties, eq(contacts.propertyId, properties.id))
            .where(eq(contactEmails.email, input.email.toLowerCase()))
            .limit(5);

          emailMatches.forEach(match => {
            const existing = results.get(match.properties.id);
            if (existing) {
              existing.matchScore = Math.min(100, existing.matchScore + 60);
              existing.matchTypes = [...(existing.matchTypes || []), 'email'];
            } else {
              results.set(match.properties.id, {
                id: match.properties.id,
                address: match.properties.addressLine1,
                city: match.properties.city,
                state: match.properties.state,
                zipcode: match.properties.zipcode,
                owner: match.properties.owner1Name,
                leadTemperature: match.properties.leadTemperature,
                matchType: 'email',
                matchScore: 95,
              });
            }
          });
        }

        // Convert Map to sorted array
        const duplicates = Array.from(results.values())
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 10);

        return {
          found: duplicates.length > 0,
          count: duplicates.length,
          duplicates: duplicates,
        };
      } catch (error) {
        console.error("Duplicate detection error:", error);
        return {
          found: false,
          count: 0,
          duplicates: [],
          error: (error as Error).message,
        };
      }
    }),
});
