import { getDb } from "./db";
import { properties, stageHistory } from "../drizzle/schema";
import { eq, sql, and } from "drizzle-orm";

/**
 * Update property deal stage and record history
 */
export async function updatePropertyStage(
  propertyId: number,
  newStage: string,
  userId: number,
  notes?: string
) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }
  
  // Get current property to calculate days in previous stage
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
  });

  if (!property) {
    throw new Error("Property not found");
  }

  const oldStage = property.dealStage;
  const stageChangedAt = property.stageChangedAt;
  
  // Calculate days in previous stage
  const daysInPreviousStage = stageChangedAt
    ? Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Update property stage
  await db
    .update(properties)
    .set({
      dealStage: newStage as any,
      stageChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  // Record stage history
  await db.insert(stageHistory).values({
    propertyId,
    oldStage,
    newStage,
    changedBy: userId,
    notes,
    daysInPreviousStage,
    changedAt: new Date(),
    createdAt: new Date(),
  });

  return { success: true, oldStage, newStage, daysInPreviousStage };
}

/**
 * Get stage history for a property
 */
export async function getPropertyStageHistory(propertyId: number) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }
  
  return await db.query.stageHistory.findMany({
    where: eq(stageHistory.propertyId, propertyId),
    orderBy: (stageHistory, { desc }) => [desc(stageHistory.changedAt)],
  });
}

/**
 * Get properties by stage
 */
export async function getPropertiesByStage(stage?: string, agentId?: number) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }
  
  const conditions = [];
  
  if (stage) {
    conditions.push(eq(properties.dealStage, stage as any));
  }
  
  if (agentId) {
    conditions.push(eq(properties.assignedAgentId, agentId));
  }

  // Use explicit select to include all columns needed for sorting
  return await db
    .select({
      id: properties.id,
      leadId: properties.leadId,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      state: properties.state,
      zipcode: properties.zipcode,
      subdivisionName: properties.subdivisionName,
      status: properties.status,
      trackingStatus: properties.trackingStatus,
      leadTemperature: properties.leadTemperature,
      ownerVerified: properties.ownerVerified,
      assignedAgentId: properties.assignedAgentId,
      marketStatus: properties.marketStatus,
      ownerLocation: properties.ownerLocation,
      estimatedValue: properties.estimatedValue,
      equityAmount: properties.equityAmount,
      equityPercent: properties.equityPercent,
      salePrice: properties.salePrice,
      saleDate: properties.saleDate,
      mortgageAmount: properties.mortgageAmount,
      totalLoanBalance: properties.totalLoanBalance,
      totalLoanPayment: properties.totalLoanPayment,
      estimatedRepairCost: properties.estimatedRepairCost,
      taxYear: properties.taxYear,
      taxAmount: properties.taxAmount,
      owner1Name: properties.owner1Name,
      owner2Name: properties.owner2Name,
      buildingSquareFeet: properties.buildingSquareFeet,
      totalBedrooms: properties.totalBedrooms,
      totalBaths: properties.totalBaths,
      yearBuilt: properties.yearBuilt,
      propertyType: properties.propertyType,
      constructionType: properties.constructionType,
      apnParcelId: properties.apnParcelId,
      taxDelinquent: properties.taxDelinquent,
      taxDelinquentYear: properties.taxDelinquentYear,
      parcelNumber: properties.parcelNumber,
      propertyId: properties.propertyId,
      dealMachinePropertyId: properties.dealMachinePropertyId,
      dealMachineLeadId: properties.dealMachineLeadId,
      dealMachineRawData: properties.dealMachineRawData,
      source: properties.source,
      listName: properties.listName,
      entryDate: properties.entryDate,
      deskName: properties.deskName,
      deskStatus: properties.deskStatus,
      dealStage: properties.dealStage,
      stageChangedAt: properties.stageChangedAt,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt,
    })
    .from(properties)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy((p) => [sql`${properties.stageChangedAt} DESC`]);
}

/**
 * Get stage statistics
 */
export async function getStageStats(agentId?: number) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }
  
  const conditions = agentId ? [eq(properties.assignedAgentId, agentId)] : [];
  
  // Count properties in each stage
  const stageCounts = await db
    .select({
      stage: properties.dealStage,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(properties.dealStage);

  // Calculate average days in each stage from history
  const avgDaysInStage = await db
    .select({
      stage: stageHistory.newStage,
      avgDays: sql<number>`avg(${stageHistory.daysInPreviousStage})`,
    })
    .from(stageHistory)
    .groupBy(stageHistory.newStage);

  return {
    stageCounts: stageCounts.map(s => ({
      stage: s.stage,
      count: Number(s.count),
    })),
    avgDaysInStage: avgDaysInStage.map(s => ({
      stage: s.stage,
      avgDays: Math.round(Number(s.avgDays) || 0),
    })),
  };
}

/**
 * Bulk update stages for multiple properties
 */
export async function bulkUpdateStages(
  propertyIds: number[],
  newStage: string,
  userId: number,
  notes?: string
) {
  const results = [];
  
  for (const propertyId of propertyIds) {
    try {
      const result = await updatePropertyStage(propertyId, newStage, userId, notes);
      results.push({ propertyId, success: true, ...result });
    } catch (error) {
      results.push({
        propertyId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  
  return results;
}
