import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { taxUrls, financialModule } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export const taxUrlsRouter = router({
  // ── Global URL list ────────────────────────────────────────────────────────

  // List ALL global tax URLs (shared across all properties)
  listAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db
      .select()
      .from(taxUrls)
      .orderBy(asc(taxUrls.createdAt));
  }),

  // Add a new global URL
  add: protectedProcedure
    .input(z.object({
      label: z.string().min(1).max(255),
      url: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const result = await db.insert(taxUrls).values({
        label: input.label,
        url: input.url,
      });
      return { id: Number((result as any).insertId) };
    }),

  // Remove a global URL
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(taxUrls).where(eq(taxUrls.id, input.id));
      return { success: true };
    }),

  // Update label of a global URL
  updateLabel: protectedProcedure
    .input(z.object({ id: z.number(), label: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(taxUrls)
        .set({ label: input.label })
        .where(eq(taxUrls.id, input.id));
      return { success: true };
    }),

  // Update URL of a global URL entry
  updateUrl: protectedProcedure
    .input(z.object({ id: z.number(), url: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(taxUrls)
        .set({ url: input.url })
        .where(eq(taxUrls.id, input.id));
      return { success: true };
    }),

  // ── Per-property selection ─────────────────────────────────────────────────

  // Get the selected tax URL id for a specific property
  getSelected: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select({ selectedTaxUrlId: financialModule.selectedTaxUrlId })
        .from(financialModule)
        .where(eq(financialModule.propertyId, input.propertyId))
        .limit(1);
      if (!rows.length) return null;
      const selectedId = rows[0].selectedTaxUrlId;
      if (!selectedId) return null;
      // Return the full URL record
      const urlRows = await db
        .select()
        .from(taxUrls)
        .where(eq(taxUrls.id, selectedId))
        .limit(1);
      return urlRows[0] ?? null;
    }),

  // Set the selected tax URL for a property (upserts financialModule row)
  setSelected: protectedProcedure
    .input(z.object({ propertyId: z.number(), taxUrlId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Check if financialModule row exists
      const existing = await db
        .select({ id: financialModule.id })
        .from(financialModule)
        .where(eq(financialModule.propertyId, input.propertyId))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(financialModule)
          .set({ selectedTaxUrlId: input.taxUrlId })
          .where(eq(financialModule.propertyId, input.propertyId));
      } else {
        await db.insert(financialModule).values({
          propertyId: input.propertyId,
          selectedTaxUrlId: input.taxUrlId,
        });
      }
      return { success: true };
    }),
});
