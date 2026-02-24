import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { deepSearchOverview, financialModule } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRESS SCORE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface DistressDriver {
  signal: string;
  points: number;
  category: string;
}

function calculateDistressScore(data: any): { score: number; drivers: DistressDriver[] } {
  const allDrivers: DistressDriver[] = [];

  // ── Seller Situation (cap 25) ──────────────────────────────────────────
  const sellerScoreMap: Record<string, number> = {
    "Need Cash Quickly": 8,
    "Job Loss": 6,
    "Medical Bills": 6,
    "Divorce": 5,
    "Death in the Family": 5,
    "Bankruptcy": 8,
    "Hoarder Situation": 4,
    "Relocating": 4,
    "Downsizing": 4,
    "Moving to Another City": 4,
    "Moving to Another County": 4,
    "Moving to Another State": 4,
    "Deportation": 10,
    "Going to Jail/Incarceration": 10,
  };

  let sellerRaw = 0;
  const financialPressure: string[] = safeParseJson(data.sellerFinancialPressure);
  const lifeEvents: string[] = safeParseJson(data.sellerLifeEvents);
  const legalBehavioral: string[] = safeParseJson(data.sellerLegalBehavioral);
  const allSellerSignals = [...financialPressure, ...lifeEvents, ...legalBehavioral];

  for (const signal of allSellerSignals) {
    const pts = sellerScoreMap[signal];
    if (pts) {
      sellerRaw += pts;
      allDrivers.push({ signal, points: pts, category: "Seller Situation" });
    }
  }
  const sellerScore = Math.min(sellerRaw, 25);

  // ── Condition (cap 25) ─────────────────────────────────────────────────
  const conditionRatingMap: Record<string, number> = {
    "Excellent": 0, "Good": 2, "Fair": 6, "Average": 10, "Poor": 15,
  };
  const conditionTagMap: Record<string, number> = {
    "Major Repairs Needed": 10,
    "Needs New Roof": 8,
    "Mold Damage": 7,
    "Water Damage": 7,
    "Fire Damage": 10,
    "Boarded Up": 6,
    "Condemned": 15,
    "Unlivable": 15,
    "Deferred Maintenance": 5,
  };

  let conditionRaw = 0;
  if (data.conditionRating && conditionRatingMap[data.conditionRating] !== undefined) {
    const pts = conditionRatingMap[data.conditionRating];
    if (pts > 0) {
      conditionRaw += pts;
      allDrivers.push({ signal: `Rating: ${data.conditionRating}`, points: pts, category: "Condition" });
    }
  }
  const conditionTags: string[] = safeParseJson(data.conditionTags);
  for (const tag of conditionTags) {
    const pts = conditionTagMap[tag];
    if (pts) {
      conditionRaw += pts;
      allDrivers.push({ signal: tag, points: pts, category: "Condition" });
    }
  }
  const conditionScore = Math.min(conditionRaw, 25);

  // ── Occupancy (cap 15) ─────────────────────────────────────────────────
  const occupancyMap: Record<string, number> = {
    "Vacant": 10, "Squatter Occupied": 15, "Tenant Occupied": 6, "Unknown": 4, "Owner Occupied": 0,
  };
  let occupancyRaw = 0;
  if (data.occupancy && occupancyMap[data.occupancy] !== undefined) {
    const pts = occupancyMap[data.occupancy];
    if (pts > 0) {
      occupancyRaw += pts;
      allDrivers.push({ signal: data.occupancy, points: pts, category: "Occupancy" });
    }
  }
  const occupancyScore = Math.min(occupancyRaw, 15);

  // ── Legal & Title (cap 20) ─────────────────────────────────────────────
  const legalMap: Record<string, number> = {
    "Break in Chain of Title": 15,
    "Title Issues": 12,
    "Unclear Ownership Interests": 10,
    "Pending Lawsuit": 10,
    "Judgments or Lawsuits": 8,
    "Trust Involved": 4,
    "Multiple Owners": 6,
    "Code Violations": 6,
    "Property Occupied Without Consent": 10,
  };

  let legalRaw = 0;
  const ownershipTitle: string[] = safeParseJson(data.legalOwnershipTitle);
  const courtLawsuit: string[] = safeParseJson(data.legalCourtLawsuit);
  const propertyStatus: string[] = safeParseJson(data.legalPropertyStatus);
  const allLegalSignals = [...ownershipTitle, ...courtLawsuit, ...propertyStatus];

  for (const signal of allLegalSignals) {
    const pts = legalMap[signal];
    if (pts) {
      legalRaw += pts;
      allDrivers.push({ signal, points: pts, category: "Legal & Title" });
    }
  }
  const legalScore = Math.min(legalRaw, 20);

  // ── Probate (cap 15) ───────────────────────────────────────────────────
  const probateMap: Record<string, number> = {
    "Missing or Unknown Heirs": 8,
    "Family Dispute": 6,
    "Executor Lacks Authority to Sell": 8,
    "Court Approval Required": 6,
    "Probate Not Completed": 6,
    "Will Contested": 10,
    "Minor Involved": 8,
  };

  let probateRaw = 0;
  if (data.probate === 1) {
    probateRaw += 10;
    allDrivers.push({ signal: "Probate = Yes", points: 10, category: "Probate" });
  }
  const probateFindings: string[] = safeParseJson(data.probateFindings);
  for (const finding of probateFindings) {
    const pts = probateMap[finding];
    if (pts) {
      probateRaw += pts;
      allDrivers.push({ signal: finding, points: pts, category: "Probate" });
    }
  }
  const probateScore = Math.min(probateRaw, 15);

  // ── Final Score ────────────────────────────────────────────────────────
  const totalScore = sellerScore + conditionScore + occupancyScore + legalScore + probateScore;

  // Sort drivers by points descending, take top 5
  allDrivers.sort((a, b) => b.points - a.points);
  const topDrivers = allDrivers.slice(0, 5);

  return { score: totalScore, drivers: topDrivers };
}

function safeParseJson(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getDistressBand(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score <= 25) return "LOW";
  if (score <= 55) return "MEDIUM";
  return "HIGH";
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEP SEARCH OVERVIEW ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export const deepSearchRouter = router({
  // ── Get Overview ─────────────────────────────────────────────────────────
  getOverview: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const result = await db!
        .select()
        .from(deepSearchOverview)
        .where(eq(deepSearchOverview.propertyId, input.propertyId))
        .limit(1);

      if (!result.length) return null;

      const row = result[0];
      const { score, drivers } = calculateDistressScore(row);
      const band = getDistressBand(score);

      return {
        ...row,
        distressScore: score,
        distressBand: band,
        distressDrivers: JSON.stringify(drivers),
      };
    }),

  // ── Update Overview ──────────────────────────────────────────────────────
  updateOverview: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        propertyType: z.enum(["Single Family Home", "Condo", "Duplex", "Triplex", "Fourplex", "Townhouse", "Mobile Home", "Vacant Lot", "Other"]).nullable().optional(),
        propertyUse: z.enum(["Residential", "Commercial", "Mixed Use"]).nullable().optional(),
        propertyTags: z.string().nullable().optional(),
        conditionRating: z.enum(["Excellent", "Good", "Fair", "Average", "Poor"]).nullable().optional(),
        conditionTags: z.string().nullable().optional(),
        occupancy: z.enum(["Vacant", "Owner Occupied", "Tenant Occupied", "Squatter Occupied", "Unknown"]).nullable().optional(),
        evictionRisk: z.enum(["Low", "Medium", "High"]).nullable().optional(),
        evictionNotes: z.string().nullable().optional(),
        sellerFinancialPressure: z.string().nullable().optional(),
        sellerLifeEvents: z.string().nullable().optional(),
        sellerLegalBehavioral: z.string().nullable().optional(),
        legalOwnershipTitle: z.string().nullable().optional(),
        legalCourtLawsuit: z.string().nullable().optional(),
        legalPropertyStatus: z.string().nullable().optional(),
        probate: z.number().nullable().optional(),
        probateStage: z.enum(["Not Started", "Open Case", "Executor Assigned", "Court Approval Required", "Ready to Sell", "Probate Not Completed", "Finished"]).nullable().optional(),
        probateFindings: z.string().nullable().optional(),
        generalNotes: z.string().nullable().optional(),
        probateNotes: z.string().nullable().optional(),
        internalNotes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { propertyId, ...updateData } = input;

      // Calculate distress score from the data we're about to save
      // First get existing data to merge with updates
      const existing = await db!
        .select()
        .from(deepSearchOverview)
        .where(eq(deepSearchOverview.propertyId, propertyId))
        .limit(1);

      const merged = { ...(existing[0] || {}), ...updateData };
      const { score, drivers } = calculateDistressScore(merged);

      const dataWithScore = {
        ...updateData,
        distressScore: score,
        distressDrivers: JSON.stringify(drivers),
      };

      // Remove undefined values
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(dataWithScore)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }

      if (existing.length > 0) {
        await db!
          .update(deepSearchOverview)
          .set(cleanData)
          .where(eq(deepSearchOverview.propertyId, propertyId));
      } else {
        await db!
          .insert(deepSearchOverview)
          .values({ propertyId, ...cleanData } as any);
      }

      return { success: true, distressScore: score, distressBand: getDistressBand(score) };
    }),

  // ── Get Financial ────────────────────────────────────────────────────────
  getFinancial: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const result = await db!
        .select()
        .from(financialModule)
        .where(eq(financialModule.propertyId, input.propertyId))
        .limit(1);

      return result.length ? result[0] : null;
    }),

  // ── Update Financial ─────────────────────────────────────────────────────
  updateFinancial: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        // Card 1: Delinquent Taxes
        delinquentTax2025: z.number().nullable().optional(),
        delinquentTax2024: z.number().nullable().optional(),
        delinquentTax2023: z.number().nullable().optional(),
        delinquentTax2022: z.number().nullable().optional(),
        delinquentTax2021: z.number().nullable().optional(),
        delinquentTax2020: z.number().nullable().optional(),
        taxNotes: z.string().nullable().optional(),
        // Card 2: Repairs
        needsRepairs: z.number().nullable().optional(),
        repairCategories: z.string().nullable().optional(),
        estimatedRepairCost: z.number().nullable().optional(),
        repairNotes: z.string().nullable().optional(),
        // Card 3: Debt & Liens
        mortgage: z.enum(["Yes", "No", "Unknown"]).nullable().optional(),
        mortgageNotes: z.string().nullable().optional(),
        liens: z.number().nullable().optional(),
        totalLienAmount: z.number().nullable().optional(),
        lienTypes: z.string().nullable().optional(),
        lienNotes: z.string().nullable().optional(),
        // Card 4: Foreclosure
        preForeclosure: z.number().nullable().optional(),
        auctionScheduled: z.number().nullable().optional(),
        lisPendens: z.number().nullable().optional(),
        nodFiled: z.number().nullable().optional(),
        foreclosureNotes: z.string().nullable().optional(),
        // Card 5: Code / Tax Lien
        codeViolations: z.number().nullable().optional(),
        taxLien: z.number().nullable().optional(),
        codeTaxNotes: z.string().nullable().optional(),
        // Card 6: Deed History
        deedHistory: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { propertyId, ...updateData } = input;

      // Auto-calculate total delinquent taxes
      const taxYears = [
        updateData.delinquentTax2025,
        updateData.delinquentTax2024,
        updateData.delinquentTax2023,
        updateData.delinquentTax2022,
        updateData.delinquentTax2021,
        updateData.delinquentTax2020,
      ];

      // Only calculate total if at least one tax year is provided
      const hasTaxData = taxYears.some(v => v !== undefined && v !== null);
      const delinquentTaxTotal = hasTaxData
        ? taxYears.reduce((sum: number, v) => sum + (v || 0), 0)
        : undefined;

      const dataWithTotal = {
        ...updateData,
        ...(delinquentTaxTotal !== undefined ? { delinquentTaxTotal } : {}),
      };

      // Remove undefined values
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(dataWithTotal)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }

      const existing = await db!
        .select({ id: financialModule.id })
        .from(financialModule)
        .where(eq(financialModule.propertyId, propertyId))
        .limit(1);

      if (existing.length > 0) {
        await db!
          .update(financialModule)
          .set(cleanData)
          .where(eq(financialModule.propertyId, propertyId));
      } else {
        await db!
          .insert(financialModule)
          .values({ propertyId, ...cleanData } as any);
      }

      return { success: true };
    }),

  // ── Get Distress Score Only (lightweight) ────────────────────────────────
  getDistressScore: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const result = await db!
        .select({
          distressScore: deepSearchOverview.distressScore,
          distressDrivers: deepSearchOverview.distressDrivers,
        })
        .from(deepSearchOverview)
        .where(eq(deepSearchOverview.propertyId, input.propertyId))
        .limit(1);

      if (!result.length) return { score: 0, band: "LOW" as const, drivers: [] };

      const score = result[0].distressScore || 0;
      const band = getDistressBand(score);
      const drivers = safeParseJson(result[0].distressDrivers);

      return { score, band, drivers };
    }),
});

// Export the calculator for testing
export { calculateDistressScore, getDistressBand, safeParseJson };
