import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { taxUrls } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const taxUrlsRouter = router({
  // List all URLs for a property
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (!db) return [];
      return await db
        .select()
        .from(taxUrls)
        .where(eq(taxUrls.propertyId, input.propertyId))
        .orderBy(taxUrls.createdAt);
    }),

  // Add a new URL
  add: protectedProcedure
    .input(z.object({
      propertyId: z.number(),
      label: z.string().min(1).max(255),
      url: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (!db) throw new Error("DB not available");
      const result = await db.insert(taxUrls).values({
        propertyId: input.propertyId,
        label: input.label,
        url: input.url,
        isSelected: 0,
      });
      return { id: Number((result as any).insertId) };
    }),

  // Remove a URL
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(taxUrls).where(eq(taxUrls.id, input.id));
      return { success: true };
    }),

  // Set selected URL (deselects all others for the property, then selects this one)
  setSelected: protectedProcedure
    .input(z.object({ id: z.number(), propertyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (!db) throw new Error("DB not available");
      // Deselect all for this property
      await db
        .update(taxUrls)
        .set({ isSelected: 0 })
        .where(eq(taxUrls.propertyId, input.propertyId));
      // Select this one
      await db
        .update(taxUrls)
        .set({ isSelected: 1 })
        .where(eq(taxUrls.id, input.id));
      return { success: true };
    }),

  // Deselect all (clear selection)
  clearSelected: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(taxUrls)
        .set({ isSelected: 0 })
        .where(eq(taxUrls.propertyId, input.propertyId));
      return { success: true };
    }),

  // Update label
  updateLabel: protectedProcedure
    .input(z.object({ id: z.number(), label: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(taxUrls)
        .set({ label: input.label })
        .where(eq(taxUrls.id, input.id));
      return { success: true };
    }),
});
