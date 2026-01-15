import { getDb } from "./db";
import { 
  properties, 
  contacts, 
  notes, 
  tasks, 
  photos, 
  leadAssignments 
} from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { calculateMergeConfidence, type LeadData, type MergeConfidenceScore } from "./utils/aiMergeScoring";

export interface DuplicateGroup {
  leads: LeadData[];
  aiSuggestion: MergeConfidenceScore;
}

/**
 * Get lead data with related counts for AI scoring
 */
async function getLeadDataWithCounts(propertyId: number): Promise<LeadData | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get property
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  
  if (!property) return null;
  
  // Get counts for related data
  const [contactsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.propertyId, propertyId));
  
  const [notesResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(eq(notes.propertyId, propertyId));
  
  const [tasksResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.propertyId, propertyId));
  
  const [photosResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(photos)
    .where(eq(photos.propertyId, propertyId));
  
  const [agentsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leadAssignments)
    .where(eq(leadAssignments.propertyId, propertyId));
  
  return {
    id: property.id,
    addressLine1: property.addressLine1,
    city: property.city,
    state: property.state,
    zipcode: property.zipcode,
    owner1Name: property.owner1Name,
    leadTemperature: property.leadTemperature,
    deskStatus: property.deskStatus,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    contactsCount: Number(contactsResult?.count || 0),
    notesCount: Number(notesResult?.count || 0),
    tasksCount: Number(tasksResult?.count || 0),
    photosCount: Number(photosResult?.count || 0),
    assignedAgentsCount: Number(agentsResult?.count || 0),
  };
}

/**
 * Get AI merge suggestions for all duplicate groups
 * Returns groups sorted by confidence score (highest first)
 */
export async function getAIMergeSuggestions(minConfidence: number = 50): Promise<DuplicateGroup[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get all duplicate groups (reuse logic from getAllDuplicates)
  const allProperties = await db.select().from(properties);
  
  const duplicateGroups: Map<string, number[]> = new Map();
  
  // Group properties by normalized address
  for (const property of allProperties) {
    const address = `${property.addressLine1} ${property.city} ${property.state} ${property.zipcode}`.toLowerCase().trim();
    
    if (!duplicateGroups.has(address)) {
      duplicateGroups.set(address, []);
    }
    duplicateGroups.get(address)!.push(property.id);
  }
  
  // Filter to only groups with 2+ properties
  const duplicateGroupsArray = Array.from(duplicateGroups.values()).filter(group => group.length >= 2);
  
  // Calculate AI suggestions for each group
  const suggestions: DuplicateGroup[] = [];
  
  for (const group of duplicateGroupsArray) {
    // For simplicity, analyze first two leads in each group
    // In production, you might want to analyze all pairs
    if (group.length >= 2) {
      const lead1Data = await getLeadDataWithCounts(group[0]);
      const lead2Data = await getLeadDataWithCounts(group[1]);
      
      if (lead1Data && lead2Data) {
        const aiSuggestion = calculateMergeConfidence(lead1Data, lead2Data);
        
        // Only include if meets minimum confidence threshold
        if (aiSuggestion.overallScore >= minConfidence) {
          // Get all leads in group with counts
          const leadsData: LeadData[] = [];
          for (const leadId of group) {
            const leadData = await getLeadDataWithCounts(leadId);
            if (leadData) leadsData.push(leadData);
          }
          
          suggestions.push({
            leads: leadsData,
            aiSuggestion,
          });
        }
      }
    }
  }
  
  // Sort by confidence score (highest first)
  suggestions.sort((a, b) => b.aiSuggestion.overallScore - a.aiSuggestion.overallScore);
  
  return suggestions;
}

/**
 * Get AI suggestion for a specific pair of leads
 */
export async function getAISuggestionForPair(lead1Id: number, lead2Id: number): Promise<MergeConfidenceScore | null> {
  const lead1Data = await getLeadDataWithCounts(lead1Id);
  const lead2Data = await getLeadDataWithCounts(lead2Id);
  
  if (!lead1Data || !lead2Data) return null;
  
  return calculateMergeConfidence(lead1Data, lead2Data);
}
