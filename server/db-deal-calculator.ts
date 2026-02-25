import { getDb } from "./db";
import { dealCalculations, properties } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Deal Calculator Database Functions
 * Handles all financial calculations and data persistence for wholesale deals
 */

/**
 * Calculate Maximum Allowable Offer (MAO)
 * Formula: MAO = ARV - Repair Costs - Closing Costs - Assignment Fee - Desired Profit
 */
export async function calculateMAO(
  arv: number,
  repairCost: number,
  closingCost: number,
  assignmentFee: number,
  desiredProfit: number
): Promise<{ mao: number; formula: string }> {
  const mao = arv - repairCost - closingCost - assignmentFee - desiredProfit;
  const formula = `MAO = $${arv.toFixed(2)} - $${repairCost.toFixed(2)} - $${closingCost.toFixed(2)} - $${assignmentFee.toFixed(2)} - $${desiredProfit.toFixed(2)} = $${mao.toFixed(2)}`;

  return {
    mao: Math.max(0, mao), // Ensure MAO is not negative
    formula,
  };
}

/**
 * Create or update a deal calculation for a property
 * Note: propertyId is used as the lookup key, but we need to get the APN from the property first
 */
export async function saveDealCalculation(
  propertyId: number,
  arv: number,
  repairCost: number,
  closingCost: number,
  assignmentFee: number,
  desiredProfit: number
) {
  const db = await getDb();

  // Validate inputs
  if (!db || !propertyId || propertyId <= 0) {
    console.error("[saveDealCalculation] Invalid parameters: db or propertyId missing/invalid");
    return null;
  }

  // Validate financial values
  if (arv <= 0) {
    console.error("[saveDealCalculation] ARV must be positive");
    return null;
  }

  try {
    // Get the property to find its APN
    const propertyResult = await db
      .select({ apn: properties.apnParcelId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!propertyResult || propertyResult.length === 0) {
      console.error("[saveDealCalculation] Property not found for propertyId:", propertyId);
      return null;
    }

    const apn = propertyResult[0].apn;

    // Calculate MAO
    const { mao, formula } = await calculateMAO(
      arv,
      repairCost,
      closingCost,
      assignmentFee,
      desiredProfit
    );

    // Check if calculation already exists
    const existing = await db
      .select({ id: dealCalculations.id })
      .from(dealCalculations)
      .where(eq(dealCalculations.apn, apn as string))
      .limit(1);

    if (existing.length > 0) {
      // Update existing calculation
      await db
        .update(dealCalculations)
        .set({
          arv: arv.toString(),
          repairCost: repairCost.toString(),
          closingCost: closingCost.toString(),
          assignmentFee: assignmentFee.toString(),
          desiredProfit: desiredProfit.toString(),
          maxOffer: mao.toString(),
          maoFormula: formula,
          updatedAt: new Date(),
        })
        .where(eq(dealCalculations.apn, apn as string));
    } else {
      // Create new calculation
      await db.insert(dealCalculations).values({
        apn: apn as string,
        arv: arv.toString(),
        repairCost: repairCost.toString(),
        closingCost: closingCost.toString(),
        assignmentFee: assignmentFee.toString(),
        desiredProfit: desiredProfit.toString(),
        maxOffer: mao.toString(),
        maoFormula: formula,
      });
    }

    return {
      propertyId,
      arv,
      repairCost,
      closingCost,
      assignmentFee,
      desiredProfit,
      maxOffer: mao,
      maoFormula: formula,
    };
  } catch (error) {
    console.error("[saveDealCalculation] Error:", error);
    return null;
  }
}

/**
 * Get deal calculation for a property by propertyId
 */
export async function getDealCalculation(propertyId: number | null | undefined) {
  const db = await getDb();
  
  if (!db) {
    console.error("[getDealCalculation] Database not available");
    return null;
  }

  // Validate propertyId
  if (!propertyId || propertyId <= 0) {
    console.error("[getDealCalculation] Invalid propertyId:", propertyId, "type:", typeof propertyId);
    return null;
  }

  try {
    // Get the property to find its APN
    const propertyResult = await db
      .select({ apn: properties.apnParcelId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!propertyResult || propertyResult.length === 0) {
      console.error("[getDealCalculation] Property not found for propertyId:", propertyId);
      return null;
    }

    const apn = propertyResult[0].apn;

    // If the property has no APN, we can't look up a deal calculation
    if (!apn) {
      return null;
    }

    const result = await db
      .select({
        id: dealCalculations.id,
        apn: dealCalculations.apn,
        arv: dealCalculations.arv,
        repairCost: dealCalculations.repairCost,
        closingCost: dealCalculations.closingCost,
        assignmentFee: dealCalculations.assignmentFee,
        desiredProfit: dealCalculations.desiredProfit,
        maxOffer: dealCalculations.maxOffer,
        maoFormula: dealCalculations.maoFormula,
        createdAt: dealCalculations.createdAt,
        updatedAt: dealCalculations.updatedAt,
      })
      .from(dealCalculations)
      .where(eq(dealCalculations.apn, apn as string))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      id: result[0].id,
      propertyId,
      arv: parseFloat(result[0].arv || "0"),
      repairCost: parseFloat(result[0].repairCost || "0"),
      closingCost: parseFloat(result[0].closingCost || "0"),
      assignmentFee: parseFloat(result[0].assignmentFee || "0"),
      desiredProfit: parseFloat(result[0].desiredProfit || "0"),
      maxOffer: parseFloat(result[0].maxOffer || "0"),
      maoFormula: result[0].maoFormula,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  } catch (_) {
    // Silently return null - query may fail if table schema is out of sync
    return null;
  }
}

/**
 * Delete deal calculation for a property by propertyId
 */
export async function deleteDealCalculation(propertyId: number | null | undefined) {
  const db = await getDb();

  if (!db || !propertyId || propertyId <= 0) {
    console.error("[deleteDealCalculation] Invalid parameters");
    return { success: false };
  }

  try {
    // Get the property to find its APN
    const propertyResult = await db
      .select({ apn: properties.apnParcelId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!propertyResult || propertyResult.length === 0) {
      console.error("[deleteDealCalculation] Property not found for propertyId:", propertyId);
      return { success: false };
    }

    const apn = propertyResult[0].apn;

    await db
      .delete(dealCalculations)
      .where(eq(dealCalculations.apn, apn as string));

    return { success: true };
  } catch (error) {
    console.error("[deleteDealCalculation] Error:", error);
    return { success: false };
  }
}

/**
 * Get all deal calculations with property details
 */
export async function getAllDealCalculations() {
  const db = await getDb();

  if (!db) {
    return [];
  }

  try {
    const results = await db
      .select({
        id: dealCalculations.id,
        apn: dealCalculations.apn,
        arv: dealCalculations.arv,
        repairCost: dealCalculations.repairCost,
        closingCost: dealCalculations.closingCost,
        assignmentFee: dealCalculations.assignmentFee,
        desiredProfit: dealCalculations.desiredProfit,
        maxOffer: dealCalculations.maxOffer,
        maoFormula: dealCalculations.maoFormula,
        propertyId: properties.id,
        propertyAddress: properties.addressLine1,
        propertyCity: properties.city,
        propertyState: properties.state,
        createdAt: dealCalculations.createdAt,
        updatedAt: dealCalculations.updatedAt,
      })
      .from(dealCalculations)
      .leftJoin(properties, eq(dealCalculations.apn, properties.apnParcelId));

    return results.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      arv: parseFloat(r.arv || "0"),
      repairCost: parseFloat(r.repairCost || "0"),
      closingCost: parseFloat(r.closingCost || "0"),
      assignmentFee: parseFloat(r.assignmentFee || "0"),
      desiredProfit: parseFloat(r.desiredProfit || "0"),
      maxOffer: parseFloat(r.maxOffer || "0"),
      maoFormula: r.maoFormula,
      propertyAddress: r.propertyAddress,
      propertyCity: r.propertyCity,
      propertyState: r.propertyState,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  } catch (error) {
    console.error("[getAllDealCalculations] Error:", error);
    return [];
  }
}

/**
 * Calculate profit margin based on offer price
 */
export async function calculateProfitMargin(
  propertyId: number | null | undefined,
  offerPrice: number
): Promise<{ profit: number; profitMargin: number }> {
  if (!propertyId || propertyId <= 0) {
    return { profit: 0, profitMargin: 0 };
  }
  const calculation = await getDealCalculation(propertyId);

  if (!calculation) {
    return { profit: 0, profitMargin: 0 };
  }

  const totalCosts =
    calculation.repairCost +
    calculation.closingCost +
    calculation.assignmentFee;
  const profit = calculation.arv - offerPrice - totalCosts;
  const profitMargin = calculation.arv > 0 ? (profit / calculation.arv) * 100 : 0;

  return {
    profit: Math.max(0, profit),
    profitMargin: Math.max(0, profitMargin),
  };
}

/**
 * Analyze deal viability
 */
export async function analyzeDeal(propertyId: number | null | undefined, offerPrice: number) {
  if (!propertyId || propertyId <= 0) {
    return null;
  }
  const calculation = await getDealCalculation(propertyId);

  if (!calculation) {
    return {
      isViable: false,
      reason: "No calculation found for this property",
    };
  }

  const { profit, profitMargin } = await calculateProfitMargin(
    propertyId,
    offerPrice
  );

  // Typical wholesale margins are 5-10% of ARV
  const minProfitMargin = 5;
  const isViable = profitMargin >= minProfitMargin && profit > 0;

  return {
    isViable,
    profit,
    profitMargin,
    minProfitMargin,
    reason: isViable
      ? `Deal is viable with ${profitMargin.toFixed(2)}% profit margin`
      : `Deal profit margin (${profitMargin.toFixed(2)}%) is below minimum (${minProfitMargin}%)`,
  };
}
