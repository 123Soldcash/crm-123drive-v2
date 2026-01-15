/**
 * AI-Powered Merge Confidence Scoring
 * 
 * Analyzes duplicate leads and calculates confidence scores for auto-merge suggestions
 * based on multiple factors: similarity, data completeness, quality, and risk assessment.
 */

import { levenshteinDistance, normalizeAddress } from "./duplicateDetection";

export interface LeadData {
  id: number;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  owner1Name: string | null;
  leadTemperature: string | null;
  deskStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Related data counts
  contactsCount: number;
  notesCount: number;
  tasksCount: number;
  photosCount: number;
  assignedAgentsCount: number;
}

export interface MergeConfidenceScore {
  overallScore: number; // 0-100
  addressSimilarity: number; // 0-100
  ownerNameSimilarity: number; // 0-100
  dataCompletenessScore: number; // 0-100
  leadQualityScore: number; // 0-100
  riskScore: number; // 0-100 (higher = more risky)
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  reasoning: string[];
  suggestedPrimary: number; // ID of suggested primary lead
}

/**
 * Calculate address similarity score (0-100)
 */
function calculateAddressSimilarity(lead1: LeadData, lead2: LeadData): number {
  const addr1 = `${lead1.addressLine1} ${lead1.city} ${lead1.state} ${lead1.zipcode}`.toLowerCase();
  const addr2 = `${lead2.addressLine1} ${lead2.city} ${lead2.state} ${lead2.zipcode}`.toLowerCase();
  
  // Exact match
  if (addr1 === addr2) return 100;
  
  // Normalize and compare
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);
  
  if (norm1 === norm2) return 100;
  
  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Calculate owner name similarity score (0-100)
 */
function calculateOwnerNameSimilarity(lead1: LeadData, lead2: LeadData): number {
  if (!lead1.owner1Name || !lead2.owner1Name) return 0;
  
  const name1 = lead1.owner1Name.toLowerCase().trim();
  const name2 = lead2.owner1Name.toLowerCase().trim();
  
  // Exact match
  if (name1 === name2) return 100;
  
  // Fuzzy match
  const distance = levenshteinDistance(name1, name2);
  const maxLength = Math.max(name1.length, name2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Calculate data completeness score (0-100)
 * Higher score = more complete data
 */
function calculateDataCompleteness(lead: LeadData): number {
  let score = 0;
  let maxScore = 0;
  
  // Basic fields (40 points)
  maxScore += 40;
  if (lead.addressLine1) score += 10;
  if (lead.city) score += 5;
  if (lead.state) score += 5;
  if (lead.zipcode) score += 5;
  if (lead.owner1Name) score += 10;
  if (lead.leadTemperature) score += 5;
  
  // Related data (60 points)
  maxScore += 60;
  if (lead.contactsCount > 0) score += 20;
  if (lead.notesCount > 0) score += 15;
  if (lead.tasksCount > 0) score += 10;
  if (lead.photosCount > 0) score += 10;
  if (lead.assignedAgentsCount > 0) score += 5;
  
  return Math.round((score / maxScore) * 100);
}

/**
 * Calculate lead quality score (0-100)
 * Higher score = better quality lead
 */
function calculateLeadQuality(lead: LeadData): number {
  let score = 50; // Base score
  
  // Temperature bonus
  if (lead.leadTemperature === "HOT") score += 30;
  else if (lead.leadTemperature === "WARM") score += 15;
  else if (lead.leadTemperature === "COLD") score += 0;
  
  // Desk status bonus
  if (lead.deskStatus === "BIN") score -= 10;
  else if (lead.deskStatus === "ARCHIVED") score -= 20;
  
  // Activity bonus (more recent = better)
  const daysSinceUpdate = Math.floor((Date.now() - lead.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceUpdate < 7) score += 20;
  else if (daysSinceUpdate < 30) score += 10;
  else if (daysSinceUpdate < 90) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate risk score (0-100)
 * Higher score = more risky to merge
 */
function calculateRiskScore(lead1: LeadData, lead2: LeadData, addressSim: number, ownerSim: number): number {
  let risk = 0;
  
  // Low address similarity = high risk
  if (addressSim < 90) risk += 30;
  else if (addressSim < 95) risk += 15;
  
  // Low owner name similarity = high risk
  if (ownerSim < 80) risk += 25;
  else if (ownerSim < 90) risk += 10;
  
  // Both leads have significant data = higher risk (potential data loss)
  const completeness1 = calculateDataCompleteness(lead1);
  const completeness2 = calculateDataCompleteness(lead2);
  if (completeness1 > 70 && completeness2 > 70) risk += 15;
  
  // Both leads have assigned agents = higher risk (ownership conflict)
  if (lead1.assignedAgentsCount > 0 && lead2.assignedAgentsCount > 0) risk += 15;
  
  // Recent activity on both = higher risk
  const days1 = Math.floor((Date.now() - lead1.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const days2 = Math.floor((Date.now() - lead2.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  if (days1 < 7 && days2 < 7) risk += 10;
  
  return Math.min(100, risk);
}

/**
 * Determine which lead should be primary
 * Returns the ID of the better lead
 */
function determinePrimaryLead(lead1: LeadData, lead2: LeadData): number {
  const completeness1 = calculateDataCompleteness(lead1);
  const completeness2 = calculateDataCompleteness(lead2);
  const quality1 = calculateLeadQuality(lead1);
  const quality2 = calculateLeadQuality(lead2);
  
  // Weighted score: 60% completeness + 40% quality
  const score1 = (completeness1 * 0.6) + (quality1 * 0.4);
  const score2 = (completeness2 * 0.6) + (quality2 * 0.4);
  
  return score1 >= score2 ? lead1.id : lead2.id;
}

/**
 * Generate reasoning for merge suggestion
 */
function generateReasoning(
  lead1: LeadData,
  lead2: LeadData,
  scores: Omit<MergeConfidenceScore, "reasoning" | "confidenceLevel">
): string[] {
  const reasoning: string[] = [];
  
  // Address similarity
  if (scores.addressSimilarity === 100) {
    reasoning.push("✅ Addresses are identical");
  } else if (scores.addressSimilarity >= 90) {
    reasoning.push(`✅ Addresses are very similar (${scores.addressSimilarity}% match)`);
  } else if (scores.addressSimilarity >= 80) {
    reasoning.push(`⚠️ Addresses are somewhat similar (${scores.addressSimilarity}% match)`);
  } else {
    reasoning.push(`❌ Addresses have low similarity (${scores.addressSimilarity}% match)`);
  }
  
  // Owner name similarity
  if (scores.ownerNameSimilarity === 100) {
    reasoning.push("✅ Owner names are identical");
  } else if (scores.ownerNameSimilarity >= 80) {
    reasoning.push(`✅ Owner names are similar (${scores.ownerNameSimilarity}% match)`);
  } else if (scores.ownerNameSimilarity >= 60) {
    reasoning.push(`⚠️ Owner names are somewhat similar (${scores.ownerNameSimilarity}% match)`);
  } else if (scores.ownerNameSimilarity > 0) {
    reasoning.push(`❌ Owner names have low similarity (${scores.ownerNameSimilarity}% match)`);
  }
  
  // Data completeness
  const primaryId = scores.suggestedPrimary;
  const primary = primaryId === lead1.id ? lead1 : lead2;
  const secondary = primaryId === lead1.id ? lead2 : lead1;
  const primaryCompleteness = calculateDataCompleteness(primary);
  const secondaryCompleteness = calculateDataCompleteness(secondary);
  
  if (primaryCompleteness > 70) {
    reasoning.push(`✅ Primary lead has comprehensive data (${primaryCompleteness}% complete)`);
  }
  if (secondaryCompleteness < 30) {
    reasoning.push(`✅ Secondary lead has minimal data (${secondaryCompleteness}% complete) - safe to merge`);
  } else if (secondaryCompleteness > 60) {
    reasoning.push(`⚠️ Secondary lead has significant data (${secondaryCompleteness}% complete) - review before merging`);
  }
  
  // Risk factors
  if (scores.riskScore < 20) {
    reasoning.push("✅ Low risk - safe to merge");
  } else if (scores.riskScore < 40) {
    reasoning.push("⚠️ Moderate risk - review recommended");
  } else {
    reasoning.push("❌ High risk - manual review required");
  }
  
  // Data transfer summary
  const itemsToTransfer: string[] = [];
  if (secondary.contactsCount > 0) itemsToTransfer.push(`${secondary.contactsCount} contacts`);
  if (secondary.notesCount > 0) itemsToTransfer.push(`${secondary.notesCount} notes`);
  if (secondary.tasksCount > 0) itemsToTransfer.push(`${secondary.tasksCount} tasks`);
  if (secondary.photosCount > 0) itemsToTransfer.push(`${secondary.photosCount} photos`);
  
  if (itemsToTransfer.length > 0) {
    reasoning.push(`📦 Will transfer: ${itemsToTransfer.join(", ")}`);
  } else {
    reasoning.push("📦 No data to transfer from secondary lead");
  }
  
  return reasoning;
}

/**
 * Calculate overall merge confidence score
 * Main entry point for AI scoring
 */
export function calculateMergeConfidence(lead1: LeadData, lead2: LeadData): MergeConfidenceScore {
  // Calculate individual scores
  const addressSimilarity = calculateAddressSimilarity(lead1, lead2);
  const ownerNameSimilarity = calculateOwnerNameSimilarity(lead1, lead2);
  const suggestedPrimary = determinePrimaryLead(lead1, lead2);
  const riskScore = calculateRiskScore(lead1, lead2, addressSimilarity, ownerNameSimilarity);
  
  const primary = suggestedPrimary === lead1.id ? lead1 : lead2;
  const secondary = suggestedPrimary === lead1.id ? lead2 : lead1;
  
  const dataCompletenessScore = calculateDataCompleteness(primary);
  const leadQualityScore = calculateLeadQuality(primary);
  
  // Calculate overall score (weighted average)
  // Address similarity: 40%
  // Owner name similarity: 25%
  // Data completeness: 15%
  // Lead quality: 10%
  // Risk penalty: -10%
  const overallScore = Math.round(
    (addressSimilarity * 0.40) +
    (ownerNameSimilarity * 0.25) +
    (dataCompletenessScore * 0.15) +
    (leadQualityScore * 0.10) -
    (riskScore * 0.10)
  );
  
  // Determine confidence level
  let confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  if (overallScore >= 90) confidenceLevel = "HIGH";
  else if (overallScore >= 70) confidenceLevel = "MEDIUM";
  else if (overallScore >= 50) confidenceLevel = "LOW";
  else confidenceLevel = "VERY_LOW";
  
  const partialScores = {
    overallScore,
    addressSimilarity,
    ownerNameSimilarity,
    dataCompletenessScore,
    leadQualityScore,
    riskScore,
    suggestedPrimary,
  };
  
  const reasoning = generateReasoning(lead1, lead2, partialScores);
  
  return {
    ...partialScores,
    confidenceLevel,
    reasoning,
  };
}
