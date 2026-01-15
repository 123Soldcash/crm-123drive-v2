/**
 * AI Scoring Weight Adjustment
 * 
 * Dynamically adjusts scoring weights based on user feedback to improve
 * confidence score accuracy over time.
 */

import { getFactorPerformance, getMergeFeedbackStats } from "../db-mergeFeedback";

export interface ScoringWeights {
  addressSimilarity: number; // 0-1
  ownerNameSimilarity: number; // 0-1
  dataCompleteness: number; // 0-1
  leadQuality: number; // 0-1
  riskPenalty: number; // 0-1
}

// Baseline weights (what we start with)
export const BASELINE_WEIGHTS: ScoringWeights = {
  addressSimilarity: 0.40,
  ownerNameSimilarity: 0.25,
  dataCompleteness: 0.15,
  leadQuality: 0.10,
  riskPenalty: 0.10,
};

// Maximum allowed weight adjustment (to prevent over-fitting)
const MAX_WEIGHT_ADJUSTMENT = 0.10; // ±10%

/**
 * Calculate adjusted scoring weights based on user feedback
 * 
 * This function analyzes which factors correlate most strongly with user
 * acceptance and adjusts weights accordingly, while staying within safe bounds.
 */
export async function getAdjustedWeights(): Promise<ScoringWeights> {
  try {
    const stats = await getMergeFeedbackStats();
    const factorPerformance = await getFactorPerformance();

    // Need at least 20 feedback samples to start adjusting
    if (stats.totalSuggestions < 20) {
      return BASELINE_WEIGHTS;
    }

    // Start with baseline weights
    const adjustedWeights = { ...BASELINE_WEIGHTS };

    // Calculate adjustment multipliers based on factor performance
    const adjustments: Record<string, number> = {};
    
    for (const factor of factorPerformance) {
      // Convert correlation (-100 to 100) to adjustment multiplier
      // Positive correlation = increase weight, negative = decrease weight
      const correlationStrength = factor.correlationWithAcceptance / 100; // -1 to 1
      
      // Scale adjustment based on correlation strength
      // Strong positive correlation (0.5) → +5% weight
      // Strong negative correlation (-0.5) → -5% weight
      const adjustment = correlationStrength * MAX_WEIGHT_ADJUSTMENT;
      
      adjustments[factor.factorName] = adjustment;
    }

    // Apply adjustments to weights
    if (adjustments.addressSimilarity !== undefined) {
      adjustedWeights.addressSimilarity = clampWeight(
        BASELINE_WEIGHTS.addressSimilarity + adjustments.addressSimilarity
      );
    }

    if (adjustments.ownerNameSimilarity !== undefined) {
      adjustedWeights.ownerNameSimilarity = clampWeight(
        BASELINE_WEIGHTS.ownerNameSimilarity + adjustments.ownerNameSimilarity
      );
    }

    if (adjustments.dataCompletenessScore !== undefined) {
      adjustedWeights.dataCompleteness = clampWeight(
        BASELINE_WEIGHTS.dataCompleteness + adjustments.dataCompletenessScore
      );
    }

    if (adjustments.leadQualityScore !== undefined) {
      adjustedWeights.leadQuality = clampWeight(
        BASELINE_WEIGHTS.leadQuality + adjustments.leadQualityScore
      );
    }

    if (adjustments.riskScore !== undefined) {
      // Risk score has inverse relationship (higher risk = worse)
      // So we invert the adjustment
      adjustedWeights.riskPenalty = clampWeight(
        BASELINE_WEIGHTS.riskPenalty - adjustments.riskScore
      );
    }

    // Normalize weights to sum to 1.0
    const totalWeight = 
      adjustedWeights.addressSimilarity +
      adjustedWeights.ownerNameSimilarity +
      adjustedWeights.dataCompleteness +
      adjustedWeights.leadQuality +
      adjustedWeights.riskPenalty;

    if (totalWeight > 0) {
      adjustedWeights.addressSimilarity /= totalWeight;
      adjustedWeights.ownerNameSimilarity /= totalWeight;
      adjustedWeights.dataCompleteness /= totalWeight;
      adjustedWeights.leadQuality /= totalWeight;
      adjustedWeights.riskPenalty /= totalWeight;
    }

    return adjustedWeights;
  } catch (error) {
    console.error("Error calculating adjusted weights:", error);
    return BASELINE_WEIGHTS;
  }
}

/**
 * Clamp weight to safe bounds (baseline ± max adjustment)
 */
function clampWeight(weight: number): number {
  return Math.max(0.05, Math.min(0.50, weight));
}

/**
 * Get weight adjustment summary for display
 */
export async function getWeightAdjustmentSummary() {
  const baseline = BASELINE_WEIGHTS;
  const adjusted = await getAdjustedWeights();
  const stats = await getMergeFeedbackStats();

  return {
    baseline,
    adjusted,
    isLearning: stats.totalSuggestions >= 20,
    feedbackCount: stats.totalSuggestions,
    changes: {
      addressSimilarity: {
        baseline: baseline.addressSimilarity,
        adjusted: adjusted.addressSimilarity,
        change: adjusted.addressSimilarity - baseline.addressSimilarity,
        changePercent: Math.round(
          ((adjusted.addressSimilarity - baseline.addressSimilarity) / baseline.addressSimilarity) * 100
        ),
      },
      ownerNameSimilarity: {
        baseline: baseline.ownerNameSimilarity,
        adjusted: adjusted.ownerNameSimilarity,
        change: adjusted.ownerNameSimilarity - baseline.ownerNameSimilarity,
        changePercent: Math.round(
          ((adjusted.ownerNameSimilarity - baseline.ownerNameSimilarity) / baseline.ownerNameSimilarity) * 100
        ),
      },
      dataCompleteness: {
        baseline: baseline.dataCompleteness,
        adjusted: adjusted.dataCompleteness,
        change: adjusted.dataCompleteness - baseline.dataCompleteness,
        changePercent: Math.round(
          ((adjusted.dataCompleteness - baseline.dataCompleteness) / baseline.dataCompleteness) * 100
        ),
      },
      leadQuality: {
        baseline: baseline.leadQuality,
        adjusted: adjusted.leadQuality,
        change: adjusted.leadQuality - baseline.leadQuality,
        changePercent: Math.round(
          ((adjusted.leadQuality - baseline.leadQuality) / baseline.leadQuality) * 100
        ),
      },
      riskPenalty: {
        baseline: baseline.riskPenalty,
        adjusted: adjusted.riskPenalty,
        change: adjusted.riskPenalty - baseline.riskPenalty,
        changePercent: Math.round(
          ((adjusted.riskPenalty - baseline.riskPenalty) / baseline.riskPenalty) * 100
        ),
      },
    },
  };
}
