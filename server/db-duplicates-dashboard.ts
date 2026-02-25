import { getDb } from "./db";
import { properties } from "../drizzle/schema";
import { findDuplicates } from "./utils/duplicateDetection";

export interface DuplicateGroup {
  primaryProperty: {
    id: number;
    address: string;
    ownerName: string | null;
    leadTemperature: string | null;
    createdAt: Date;
  };
  duplicates: Array<{
    propertyId: number;
    address: string;
    ownerName: string | null;
    leadTemperature: string | null;
    createdAt: Date;
    matchType: "exact" | "fuzzy" | "gps";
    similarity: number;
  }>;
  totalDuplicates: number;
}

/**
 * Find all duplicate groups in the database
 * Groups properties that are likely duplicates of each other
 */
export async function getAllDuplicateGroups(
  similarityThreshold: number = 85
): Promise<DuplicateGroup[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all properties
  const allProperties = await db.select().from(properties);

  // Transform to format expected by duplicate detection
  const propertiesForMatching = allProperties.map((p) => ({
    id: p.id,
    address: `${p.addressLine1}${p.addressLine2 ? " " + p.addressLine2 : ""}, ${p.city}, ${p.state} ${p.zipcode}`,
    ownerName: p.owner1Name,
    leadTemperature: p.leadTemperature,
    createdAt: p.createdAt,
    lat: null as number | null,
    lng: null as number | null,
  }));

  const duplicateGroups: DuplicateGroup[] = [];
  const processedIds = new Set<number>();

  // For each property, find its duplicates
  for (const property of propertiesForMatching) {
    // Skip if already processed as part of another group
    if (processedIds.has(property.id)) continue;

    // Find duplicates for this property
    const duplicates = findDuplicates(
      property.address,
      propertiesForMatching.filter((p) => p.id !== property.id),
      property.lat,
      property.lng,
      similarityThreshold,
      property.ownerName
    );

    // If duplicates found, create a group
    if (duplicates.length > 0) {
      duplicateGroups.push({
        primaryProperty: {
          id: property.id,
          address: property.address,
          ownerName: property.ownerName,
          leadTemperature: property.leadTemperature,
          createdAt: property.createdAt,
        },
        duplicates,
        totalDuplicates: duplicates.length,
      });

      // Mark all properties in this group as processed
      processedIds.add(property.id);
      duplicates.forEach((d) => processedIds.add(d.propertyId));
    }
  }

  // Sort by number of duplicates (highest first)
  return duplicateGroups.sort((a, b) => b.totalDuplicates - a.totalDuplicates);
}
