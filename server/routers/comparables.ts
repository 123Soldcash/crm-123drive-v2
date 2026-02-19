import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { comparables, renovationEstimates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Default formula values
const DEFAULTS = {
  kitchenRate: 180, kitchenPct: 10,
  bathroomRate: 110, bathroomPct: 3,
  paintingRate: 6,
  flooringRate: 11, flooringPct: 80,
  roofRate: 15,
  acRate: 6.5,
  cleaningRate: 1.5,
  gardensRate: 1.8,
  miscPct: 5, permitsPct: 3,
  holdCostRate: 2, holdCostMonths: 6,
  commissionPct: 6,
};

// Renovation cost calculation with custom formulas
function calculateRenovationCosts(
  sf: number,
  bathrooms: number,
  estimatedValue: number,
  formulas: typeof DEFAULTS = DEFAULTS
) {
  const f = { ...DEFAULTS, ...formulas };

  const kitchenCost = Math.round(f.kitchenRate * (sf * (f.kitchenPct / 100)));
  const bathroomCost = Math.round(f.bathroomRate * (sf * (f.bathroomPct / 100)) * bathrooms);
  const paintingCost = Math.round(f.paintingRate * sf);
  const flooringCost = Math.round(f.flooringRate * (sf * (f.flooringPct / 100)));
  const roofCost = Math.round(f.roofRate * sf);
  const acCost = Math.round(f.acRate * sf);
  const cleaningCost = Math.round(f.cleaningRate * sf);
  const gardensCost = Math.round(f.gardensRate * sf);

  const renovationSubtotal = kitchenCost + bathroomCost + paintingCost + flooringCost + roofCost + acCost + cleaningCost + gardensCost;
  const miscellaneous = Math.round(renovationSubtotal * (f.miscPct / 100));
  const permitsAndRelated = Math.round(renovationSubtotal * (f.permitsPct / 100));
  const holdCost = Math.round(f.holdCostRate * sf * f.holdCostMonths);

  const subtotalWithExtras = renovationSubtotal + miscellaneous + permitsAndRelated + holdCost;
  const realEstateCommission = Math.round((f.commissionPct / 100) * (estimatedValue + subtotalWithExtras));
  const totalGeral = subtotalWithExtras + realEstateCommission;

  const offer60 = Math.round(estimatedValue * 0.60);
  const offer70 = Math.round(estimatedValue * 0.70);
  const offer90 = Math.round(estimatedValue * 0.90);

  return {
    kitchenCost, bathroomCost, paintingCost, flooringCost, roofCost, acCost, cleaningCost, gardensCost,
    renovationSubtotal, miscellaneous, permitsAndRelated, holdCost, realEstateCommission, totalGeral,
    offer60, offer70, offer90,
  };
}

export const comparablesRouter = router({
  // ===== COMPARABLES CRUD =====

  getByProperty: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      const results = await db_.select().from(comparables).where(eq(comparables.propertyId, input.propertyId));
      return results;
    }),

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

  deleteComparable: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      await db_.delete(comparables).where(eq(comparables.id, input.id));
      return { success: true };
    }),

  // ===== RENOVATION ESTIMATES =====

  getRenovationEstimate: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");
      const [result] = await db_.select().from(renovationEstimates).where(eq(renovationEstimates.propertyId, input.propertyId));
      return result || null;
    }),

  saveRenovationEstimate: protectedProcedure
    .input(z.object({
      propertyId: z.number(),
      squareFeet: z.number().min(1),
      numberOfBathrooms: z.number().min(1).default(1),
      estimatedPropertyValue: z.number().min(0).default(0),
      // Custom formula rates
      kitchenRate: z.number().optional(),
      kitchenPct: z.number().optional(),
      bathroomRate: z.number().optional(),
      bathroomPct: z.number().optional(),
      paintingRate: z.number().optional(),
      flooringRate: z.number().optional(),
      flooringPct: z.number().optional(),
      roofRate: z.number().optional(),
      acRate: z.number().optional(),
      cleaningRate: z.number().optional(),
      gardensRate: z.number().optional(),
      miscPct: z.number().optional(),
      permitsPct: z.number().optional(),
      holdCostRate: z.number().optional(),
      holdCostMonths: z.number().optional(),
      commissionPct: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db_ = await getDb();
      if (!db_) throw new Error("Database not available");

      const formulas = {
        kitchenRate: input.kitchenRate ?? DEFAULTS.kitchenRate,
        kitchenPct: input.kitchenPct ?? DEFAULTS.kitchenPct,
        bathroomRate: input.bathroomRate ?? DEFAULTS.bathroomRate,
        bathroomPct: input.bathroomPct ?? DEFAULTS.bathroomPct,
        paintingRate: input.paintingRate ?? DEFAULTS.paintingRate,
        flooringRate: input.flooringRate ?? DEFAULTS.flooringRate,
        flooringPct: input.flooringPct ?? DEFAULTS.flooringPct,
        roofRate: input.roofRate ?? DEFAULTS.roofRate,
        acRate: input.acRate ?? DEFAULTS.acRate,
        cleaningRate: input.cleaningRate ?? DEFAULTS.cleaningRate,
        gardensRate: input.gardensRate ?? DEFAULTS.gardensRate,
        miscPct: input.miscPct ?? DEFAULTS.miscPct,
        permitsPct: input.permitsPct ?? DEFAULTS.permitsPct,
        holdCostRate: input.holdCostRate ?? DEFAULTS.holdCostRate,
        holdCostMonths: input.holdCostMonths ?? DEFAULTS.holdCostMonths,
        commissionPct: input.commissionPct ?? DEFAULTS.commissionPct,
      };

      const costs = calculateRenovationCosts(input.squareFeet, input.numberOfBathrooms, input.estimatedPropertyValue, formulas);

      const data = {
        propertyId: input.propertyId,
        squareFeet: input.squareFeet,
        numberOfBathrooms: input.numberOfBathrooms,
        estimatedPropertyValue: input.estimatedPropertyValue,
        ...costs,
        // Save custom rates as strings for decimal columns
        kitchenRate: formulas.kitchenRate.toString(),
        kitchenPct: formulas.kitchenPct.toString(),
        bathroomRate: formulas.bathroomRate.toString(),
        bathroomPct: formulas.bathroomPct.toString(),
        paintingRate: formulas.paintingRate.toString(),
        flooringRate: formulas.flooringRate.toString(),
        flooringPct: formulas.flooringPct.toString(),
        roofRate: formulas.roofRate.toString(),
        acRate: formulas.acRate.toString(),
        cleaningRate: formulas.cleaningRate.toString(),
        gardensRate: formulas.gardensRate.toString(),
        miscPct: formulas.miscPct.toString(),
        permitsPct: formulas.permitsPct.toString(),
        holdCostRate: formulas.holdCostRate.toString(),
        holdCostMonths: formulas.holdCostMonths,
        commissionPct: formulas.commissionPct.toString(),
        notes: input.notes,
      };

      const [existing] = await db_.select().from(renovationEstimates).where(eq(renovationEstimates.propertyId, input.propertyId));

      if (existing) {
        await db_.update(renovationEstimates).set(data).where(eq(renovationEstimates.propertyId, input.propertyId));
      } else {
        await db_.insert(renovationEstimates).values(data);
      }

      return { success: true, ...costs };
    }),

  calculateRenovation: protectedProcedure
    .input(z.object({
      squareFeet: z.number().min(1),
      numberOfBathrooms: z.number().min(1).default(1),
      estimatedPropertyValue: z.number().min(0).default(0),
      kitchenRate: z.number().optional(),
      kitchenPct: z.number().optional(),
      bathroomRate: z.number().optional(),
      bathroomPct: z.number().optional(),
      paintingRate: z.number().optional(),
      flooringRate: z.number().optional(),
      flooringPct: z.number().optional(),
      roofRate: z.number().optional(),
      acRate: z.number().optional(),
      cleaningRate: z.number().optional(),
      gardensRate: z.number().optional(),
      miscPct: z.number().optional(),
      permitsPct: z.number().optional(),
      holdCostRate: z.number().optional(),
      holdCostMonths: z.number().optional(),
      commissionPct: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const formulas = {
        kitchenRate: input.kitchenRate ?? DEFAULTS.kitchenRate,
        kitchenPct: input.kitchenPct ?? DEFAULTS.kitchenPct,
        bathroomRate: input.bathroomRate ?? DEFAULTS.bathroomRate,
        bathroomPct: input.bathroomPct ?? DEFAULTS.bathroomPct,
        paintingRate: input.paintingRate ?? DEFAULTS.paintingRate,
        flooringRate: input.flooringRate ?? DEFAULTS.flooringRate,
        flooringPct: input.flooringPct ?? DEFAULTS.flooringPct,
        roofRate: input.roofRate ?? DEFAULTS.roofRate,
        acRate: input.acRate ?? DEFAULTS.acRate,
        cleaningRate: input.cleaningRate ?? DEFAULTS.cleaningRate,
        gardensRate: input.gardensRate ?? DEFAULTS.gardensRate,
        miscPct: input.miscPct ?? DEFAULTS.miscPct,
        permitsPct: input.permitsPct ?? DEFAULTS.permitsPct,
        holdCostRate: input.holdCostRate ?? DEFAULTS.holdCostRate,
        holdCostMonths: input.holdCostMonths ?? DEFAULTS.holdCostMonths,
        commissionPct: input.commissionPct ?? DEFAULTS.commissionPct,
      };
      return calculateRenovationCosts(input.squareFeet, input.numberOfBathrooms, input.estimatedPropertyValue, formulas);
    }),
});
