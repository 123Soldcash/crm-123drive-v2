import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { comparables, renovationEstimates } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Renovation cost calculation formulas
function calculateRenovationCosts(sf: number, bathrooms: number, estimatedValue: number) {
  const kitchenCost = Math.round(180 * (sf * 0.10));
  const bathroomCost = Math.round(110 * (sf * 0.03) * bathrooms);
  const paintingCost = Math.round(6 * sf);
  const flooringCost = Math.round(11 * (sf * 0.80));
  const roofCost = Math.round(15 * sf);
  const acCost = Math.round(6.5 * sf);
  const cleaningCost = Math.round(1.5 * sf);
  const gardensCost = Math.round(1.8 * sf);

  const renovationSubtotal = kitchenCost + bathroomCost + paintingCost + flooringCost + roofCost + acCost + cleaningCost + gardensCost;
  const miscellaneous = Math.round(renovationSubtotal * 0.05);
  const permitsAndRelated = Math.round(renovationSubtotal * 0.03);
  const holdCost = Math.round(2.00 * sf * 6);

  const subtotalWithExtras = renovationSubtotal + miscellaneous + permitsAndRelated + holdCost;
  const realEstateCommission = Math.round(0.06 * (estimatedValue + subtotalWithExtras));
  const totalGeral = subtotalWithExtras + realEstateCommission;

  const offer60 = Math.round(estimatedValue * 0.60);
  const offer70 = Math.round(estimatedValue * 0.70);
  const offer90 = Math.round(estimatedValue * 0.90);

  return {
    kitchenCost,
    bathroomCost,
    paintingCost,
    flooringCost,
    roofCost,
    acCost,
    cleaningCost,
    gardensCost,
    renovationSubtotal,
    miscellaneous,
    permitsAndRelated,
    holdCost,
    realEstateCommission,
    totalGeral,
    offer60,
    offer70,
    offer90,
  };
}

export const comparablesRouter = router({
  // ===== COMPARABLES CRUD =====

  // Get all comparables for a property
  getByProperty: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      const results = await db_.select().from(comparables).where(eq(comparables.propertyId, input.propertyId));
      return results;
    }),

  // Add a comparable
  addComparable: protectedProcedure
    .input(z.object({
      propertyId: z.number(),
      category: z.enum(["SOLD_6MO", "SOLD_12MO", "PENDING", "FOR_SALE", "FOR_RENT"]),
      address: z.string().min(1),
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      squareFeet: z.number().optional(),
      lotSize: z.string().optional(),
      yearBuilt: z.number().optional(),
      distanceFromSubject: z.string().optional(),
      saleDate: z.string().optional(),
      listedDate: z.string().optional(),
      amount: z.number().optional(),
      buyerName: z.string().optional(),
      overallCondition: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      const [result] = await db_.insert(comparables).values({
        propertyId: input.propertyId,
        category: input.category,
        address: input.address,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms?.toString(),
        squareFeet: input.squareFeet,
        lotSize: input.lotSize,
        yearBuilt: input.yearBuilt,
        distanceFromSubject: input.distanceFromSubject,
        saleDate: input.saleDate,
        listedDate: input.listedDate,
        amount: input.amount,
        buyerName: input.buyerName,
        overallCondition: input.overallCondition,
        source: input.source,
        notes: input.notes,
      });
      return { success: true, id: Number(result.insertId) };
    }),

  // Update a comparable
  updateComparable: protectedProcedure
    .input(z.object({
      id: z.number(),
      address: z.string().optional(),
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      squareFeet: z.number().optional(),
      lotSize: z.string().optional(),
      yearBuilt: z.number().optional(),
      distanceFromSubject: z.string().optional(),
      saleDate: z.string().optional(),
      listedDate: z.string().optional(),
      amount: z.number().optional(),
      buyerName: z.string().optional(),
      overallCondition: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          if (key === "bathrooms") {
            updateData[key] = value.toString();
          } else {
            updateData[key] = value;
          }
        }
      }
      if (Object.keys(updateData).length > 0) {
        await db_.update(comparables).set(updateData).where(eq(comparables.id, id));
      }
      return { success: true };
    }),

  // Delete a comparable
  deleteComparable: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      await db_.delete(comparables).where(eq(comparables.id, input.id));
      return { success: true };
    }),

  // ===== RENOVATION ESTIMATES =====

  // Get renovation estimate for a property
  getRenovationEstimate: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      const [result] = await db_.select().from(renovationEstimates).where(eq(renovationEstimates.propertyId, input.propertyId));
      return result || null;
    }),

  // Calculate and save renovation estimate
  saveRenovationEstimate: protectedProcedure
    .input(z.object({
      propertyId: z.number(),
      squareFeet: z.number().min(1),
      numberOfBathrooms: z.number().min(1).default(1),
      estimatedPropertyValue: z.number().min(0).default(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");

      const costs = calculateRenovationCosts(input.squareFeet, input.numberOfBathrooms, input.estimatedPropertyValue);

      const data = {
        propertyId: input.propertyId,
        squareFeet: input.squareFeet,
        numberOfBathrooms: input.numberOfBathrooms,
        estimatedPropertyValue: input.estimatedPropertyValue,
        ...costs,
        notes: input.notes,
      };

      // Check if estimate already exists
      const [existing] = await db_.select().from(renovationEstimates).where(eq(renovationEstimates.propertyId, input.propertyId));

      if (existing) {
        await db_.update(renovationEstimates).set(data).where(eq(renovationEstimates.propertyId, input.propertyId));
      } else {
        await db_.insert(renovationEstimates).values(data);
      }

      return { success: true, ...costs };
    }),

  // Quick calculate without saving (for live preview)
  calculateRenovation: protectedProcedure
    .input(z.object({
      squareFeet: z.number().min(1),
      numberOfBathrooms: z.number().min(1).default(1),
      estimatedPropertyValue: z.number().min(0).default(0),
    }))
    .mutation(async ({ input }) => {
      return calculateRenovationCosts(input.squareFeet, input.numberOfBathrooms, input.estimatedPropertyValue);
    }),
});
