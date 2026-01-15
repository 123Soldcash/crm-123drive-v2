import { getDb } from "./db";
import { mergeFeedback } from "../drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import type { MergeConfidenceScore } from "./utils/aiMergeScoring";

export interface RecordFeedbackInput {
  lead1Id: number;
  lead2Id: number;
  aiSuggestion: MergeConfidenceScore;
  action: "accepted" | "rejected" | "ignored";
  actualPrimaryId?: number;
  rejectionReason?: "wrong_address" | "wrong_owner" | "not_duplicates" | "too_risky" | "other";
  rejectionNotes?: string;
  userId: number;
}

/**
 * Record user feedback on an AI merge suggestion
 */
export async function recordMergeFeedback(input: RecordFeedbackInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(mergeFeedback).values({
    lead1Id: input.lead1Id,
    lead2Id: input.lead2Id,
    suggestedPrimaryId: input.aiSuggestion.suggestedPrimary,
    overallScore: input.aiSuggestion.overallScore,
    addressSimilarity: input.aiSuggestion.addressSimilarity,
    ownerNameSimilarity: input.aiSuggestion.ownerNameSimilarity,
    dataCompletenessScore: input.aiSuggestion.dataCompletenessScore,
    leadQualityScore: input.aiSuggestion.leadQualityScore,
    riskScore: input.aiSuggestion.riskScore,
    confidenceLevel: input.aiSuggestion.confidenceLevel,
    action: input.action,
    actualPrimaryId: input.actualPrimaryId,
    rejectionReason: input.rejectionReason,
    rejectionNotes: input.rejectionNotes,
    userId: input.userId,
  });

  return { success: true };
}

export interface FeedbackStats {
  totalSuggestions: number;
  acceptedCount: number;
  rejectedCount: number;
  ignoredCount: number;
  acceptanceRate: number; // 0-100
  
  // Acceptance rate by confidence level
  highConfidenceAcceptanceRate: number;
  mediumConfidenceAcceptanceRate: number;
  lowConfidenceAcceptanceRate: number;
  
  // Over/under confident suggestions
  overConfidentCount: number; // HIGH confidence but rejected
  underConfidentCount: number; // LOW confidence but accepted
  
  // Recent feedback (last 30 days)
  recentFeedbackCount: number;
}

/**
 * Get overall feedback statistics
 */
export async function getMergeFeedbackStats(): Promise<FeedbackStats> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Total counts
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback);
  
  const totalSuggestions = Number(totalResult?.count || 0);

  // Count by action
  const [acceptedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(eq(mergeFeedback.action, "accepted"));
  
  const [rejectedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(eq(mergeFeedback.action, "rejected"));
  
  const [ignoredResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(eq(mergeFeedback.action, "ignored"));

  const acceptedCount = Number(acceptedResult?.count || 0);
  const rejectedCount = Number(rejectedResult?.count || 0);
  const ignoredCount = Number(ignoredResult?.count || 0);

  const acceptanceRate = totalSuggestions > 0 
    ? Math.round((acceptedCount / (acceptedCount + rejectedCount)) * 100)
    : 0;

  // Acceptance rate by confidence level
  const highConfidenceStats = await getAcceptanceRateByLevel(db, "HIGH");
  const mediumConfidenceStats = await getAcceptanceRateByLevel(db, "MEDIUM");
  const lowConfidenceStats = await getAcceptanceRateByLevel(db, "LOW");

  // Over-confident: HIGH confidence but rejected
  const [overConfidentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(
      and(
        eq(mergeFeedback.confidenceLevel, "HIGH"),
        eq(mergeFeedback.action, "rejected")
      )
    );
  
  const overConfidentCount = Number(overConfidentResult?.count || 0);

  // Under-confident: LOW confidence but accepted
  const [underConfidentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(
      and(
        eq(mergeFeedback.confidenceLevel, "LOW"),
        eq(mergeFeedback.action, "accepted")
      )
    );
  
  const underConfidentCount = Number(underConfidentResult?.count || 0);

  // Recent feedback (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [recentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(gte(mergeFeedback.feedbackAt, thirtyDaysAgo));
  
  const recentFeedbackCount = Number(recentResult?.count || 0);

  return {
    totalSuggestions,
    acceptedCount,
    rejectedCount,
    ignoredCount,
    acceptanceRate,
    highConfidenceAcceptanceRate: highConfidenceStats,
    mediumConfidenceAcceptanceRate: mediumConfidenceStats,
    lowConfidenceAcceptanceRate: lowConfidenceStats,
    overConfidentCount,
    underConfidentCount,
    recentFeedbackCount,
  };
}

async function getAcceptanceRateByLevel(
  db: any,
  level: "HIGH" | "MEDIUM" | "LOW"
): Promise<number> {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(eq(mergeFeedback.confidenceLevel, level));
  
  const total = Number(totalResult?.count || 0);
  
  if (total === 0) return 0;

  const [acceptedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mergeFeedback)
    .where(
      and(
        eq(mergeFeedback.confidenceLevel, level),
        eq(mergeFeedback.action, "accepted")
      )
    );
  
  const accepted = Number(acceptedResult?.count || 0);
  
  return Math.round((accepted / total) * 100);
}

export interface FactorPerformance {
  factorName: string;
  averageScoreWhenAccepted: number;
  averageScoreWhenRejected: number;
  correlationWithAcceptance: number; // -100 to 100
  importance: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Analyze which factors best predict user acceptance
 */
export async function getFactorPerformance(): Promise<FactorPerformance[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allFeedback = await db
    .select()
    .from(mergeFeedback)
    .where(sql`action IN ('accepted', 'rejected')`);

  if (allFeedback.length === 0) {
    return [];
  }

  const factors = [
    { name: "addressSimilarity", key: "addressSimilarity" as const },
    { name: "ownerNameSimilarity", key: "ownerNameSimilarity" as const },
    { name: "dataCompletenessScore", key: "dataCompletenessScore" as const },
    { name: "leadQualityScore", key: "leadQualityScore" as const },
    { name: "riskScore", key: "riskScore" as const },
  ];

  const performance: FactorPerformance[] = [];

  for (const factor of factors) {
    const accepted = allFeedback.filter(f => f.action === "accepted");
    const rejected = allFeedback.filter(f => f.action === "rejected");

    const avgAccepted = accepted.length > 0
      ? accepted.reduce((sum, f) => sum + f[factor.key], 0) / accepted.length
      : 0;

    const avgRejected = rejected.length > 0
      ? rejected.reduce((sum, f) => sum + f[factor.key], 0) / rejected.length
      : 0;

    // Simple correlation: positive difference means higher scores lead to acceptance
    // For riskScore, invert the correlation (lower risk = better)
    let correlation = avgAccepted - avgRejected;
    if (factor.key === "riskScore") {
      correlation = -correlation;
    }

    // Normalize to -100 to 100 scale
    const normalizedCorrelation = Math.max(-100, Math.min(100, correlation));

    // Determine importance based on correlation strength
    const absCorrelation = Math.abs(normalizedCorrelation);
    const importance = absCorrelation > 20 ? "HIGH" : absCorrelation > 10 ? "MEDIUM" : "LOW";

    performance.push({
      factorName: factor.name,
      averageScoreWhenAccepted: Math.round(avgAccepted),
      averageScoreWhenRejected: Math.round(avgRejected),
      correlationWithAcceptance: Math.round(normalizedCorrelation),
      importance,
    });
  }

  // Sort by absolute correlation (most important first)
  performance.sort((a, b) => 
    Math.abs(b.correlationWithAcceptance) - Math.abs(a.correlationWithAcceptance)
  );

  return performance;
}

/**
 * Get recent feedback timeline (last 30 days)
 */
export async function getRecentFeedbackTimeline() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentFeedback = await db
    .select({
      id: mergeFeedback.id,
      action: mergeFeedback.action,
      confidenceLevel: mergeFeedback.confidenceLevel,
      overallScore: mergeFeedback.overallScore,
      rejectionReason: mergeFeedback.rejectionReason,
      feedbackAt: mergeFeedback.feedbackAt,
    })
    .from(mergeFeedback)
    .where(gte(mergeFeedback.feedbackAt, thirtyDaysAgo))
    .orderBy(sql`feedbackAt DESC`)
    .limit(50);

  return recentFeedback;
}
