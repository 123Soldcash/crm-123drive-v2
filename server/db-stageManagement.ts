import { getDb } from "./db";
import { properties, stageHistory } from "../drizzle/schema";
import { eq, sql, and, desc } from "drizzle-orm";

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
  const propertyResult = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  const property = propertyResult[0];
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
  
  return await db
    .select()
    .from(stageHistory)
    .where(eq(stageHistory.propertyId, propertyId))
    .orderBy(desc(stageHistory.changedAt));
}

/**
 * Get properties by stage
 */
export async function getPropertiesByStage(stage?: string, agentId?: number) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }
  
  try {
    const conditions = [];
    
    if (stage) {
      conditions.push(eq(properties.dealStage, stage as any));
    }
    
    if (agentId) {
      conditions.push(eq(properties.assignedAgentId, agentId));
    }

    // Build the select fields for pipeline view
    const selectFields = {
      id: properties.id,
      leadId: properties.leadId,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      owner1Name: properties.owner1Name,
      estimatedValue: properties.estimatedValue,
      leadTemperature: properties.leadTemperature,
      dealStage: properties.dealStage,
      stageChangedAt: properties.stageChangedAt,
      deskName: properties.deskName,
      createdAt: properties.createdAt,
    };

    // Build query with or without conditions
    let query = db.select(selectFields).from(properties);
    
    if (conditions.length === 1) {
      query = query.where(conditions[0]) as any;
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as any;
    }
    // If no conditions, query all properties (no .where())
    
    const results = await query.orderBy(desc(properties.stageChangedAt));
    
    return results;
  } catch (error) {
    console.error("Error in getPropertiesByStage:", error);
    // Return empty array on error instead of throwing
    return [];
  }
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
      results.push({ propertyId, ...result });
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
