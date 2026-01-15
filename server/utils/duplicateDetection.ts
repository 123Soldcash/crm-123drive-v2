/**
 * Duplicate Lead Detection Utility
 * 
 * Provides fuzzy address matching using:
 * 1. Address normalization (Nw → Northwest, Ter → Terrace, etc.)
 * 2. Levenshtein distance for string similarity
 * 3. GPS coordinate matching
 */

/**
 * Normalize address for comparison
 * Converts abbreviations to full words and standardizes format
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  let normalized = address.toLowerCase().trim();
  
  // Common street type abbreviations
  const streetTypes: Record<string, string> = {
    'st': 'street',
    'ave': 'avenue',
    'blvd': 'boulevard',
    'dr': 'drive',
    'rd': 'road',
    'ln': 'lane',
    'ct': 'court',
    'cir': 'circle',
    'ter': 'terrace',
    'pl': 'place',
    'way': 'way',
    'pkwy': 'parkway',
    'hwy': 'highway',
  };
  
  // Directional abbreviations
  const directions: Record<string, string> = {
    'n': 'north',
    's': 'south',
    'e': 'east',
    'w': 'west',
    'ne': 'northeast',
    'nw': 'northwest',
    'se': 'southeast',
    'sw': 'southwest',
  };
  
  // Replace street types
  Object.entries(streetTypes).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  });
  
  // Replace directions
  Object.entries(directions).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  });
  
  // Remove extra spaces and punctuation
  normalized = normalized.replace(/[.,#]/g, '');
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100 where 100 is exact match
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 100; // Both empty = identical
  if (!str1 || !str2) return 0; // One empty = no match
  
  const normalized1 = normalizeAddress(str1);
  const normalized2 = normalizeAddress(str2);
  
  if (normalized1 === normalized2) return 100;
  
  const maxLen = Math.max(normalized1.length, normalized2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = ((maxLen - distance) / maxLen) * 100;
  
  return Math.round(similarity * 100) / 100; // Round to 2 decimal places
}

/**
 * Check if two GPS coordinates are within threshold distance
 * Threshold is approximately 10 meters (0.0001 degrees)
 */
export function areCoordinatesNear(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null,
  threshold: number = 0.0001
): boolean {
  if (!lat1 || !lng1 || !lat2 || !lng2) return false;
  
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lng1 - lng2);
  
  return latDiff <= threshold && lngDiff <= threshold;
}

/**
 * Match type for duplicate detection results
 */
export type DuplicateMatch = {
  propertyId: number;
  address: string;
  ownerName: string | null;
  leadTemperature: string | null;
  createdAt: Date;
  matchType: 'exact' | 'fuzzy' | 'gps';
  similarity: number;
};

/**
 * Find potential duplicate properties by address
 */
export function findDuplicates(
  searchAddress: string,
  existingProperties: Array<{
    id: number;
    address: string;
    ownerName: string | null;
    leadTemperature: string | null;
    createdAt: Date;
    lat: number | null;
    lng: number | null;
  }>,
  searchLat?: number | null,
  searchLng?: number | null,
  similarityThreshold: number = 85
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  
  const normalizedSearch = normalizeAddress(searchAddress);
  
  existingProperties.forEach((property) => {
    // Check GPS match first (most accurate)
    if (searchLat && searchLng && property.lat && property.lng) {
      if (areCoordinatesNear(searchLat, searchLng, property.lat, property.lng)) {
        matches.push({
          propertyId: property.id,
          address: property.address,
          ownerName: property.ownerName,
          leadTemperature: property.leadTemperature,
          createdAt: property.createdAt,
          matchType: 'gps',
          similarity: 99.9,
        });
        return; // Skip address matching if GPS matched
      }
    }
    
    // Check address similarity
    const similarity = calculateSimilarity(searchAddress, property.address);
    
    if (similarity === 100) {
      matches.push({
        propertyId: property.id,
        address: property.address,
        ownerName: property.ownerName,
        leadTemperature: property.leadTemperature,
        createdAt: property.createdAt,
        matchType: 'exact',
        similarity: 100,
      });
    } else if (similarity >= similarityThreshold) {
      matches.push({
        propertyId: property.id,
        address: property.address,
        ownerName: property.ownerName,
        leadTemperature: property.leadTemperature,
        createdAt: property.createdAt,
        matchType: 'fuzzy',
        similarity,
      });
    }
  });
  
  // Sort by similarity (highest first)
  return matches.sort((a, b) => b.similarity - a.similarity);
}
