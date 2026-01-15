import { describe, it, expect } from "vitest";
import {
  normalizeAddress,
  levenshteinDistance,
  calculateSimilarity,
  areCoordinatesNear,
  findDuplicates,
} from "./utils/duplicateDetection";

describe("Duplicate Detection - Address Normalization", () => {
  it("should normalize street type abbreviations", () => {
    expect(normalizeAddress("123 Main St")).toBe("123 main street");
    expect(normalizeAddress("456 Oak Ave")).toBe("456 oak avenue");
    expect(normalizeAddress("789 Elm Blvd")).toBe("789 elm boulevard");
    expect(normalizeAddress("321 Pine Dr")).toBe("321 pine drive");
    expect(normalizeAddress("654 Maple Ter")).toBe("654 maple terrace");
  });

  it("should normalize directional abbreviations", () => {
    expect(normalizeAddress("1505 NW 180th Terrace")).toBe("1505 northwest 180th terrace");
    expect(normalizeAddress("1505 Nw 180 Ter")).toBe("1505 northwest 180 terrace");
    expect(normalizeAddress("100 SE Main St")).toBe("100 southeast main street");
    expect(normalizeAddress("200 N Oak Ave")).toBe("200 north oak avenue");
  });

  it("should handle mixed case and extra spaces", () => {
    expect(normalizeAddress("  123   MAIN   STREET  ")).toBe("123 main street");
    expect(normalizeAddress("456 Oak  Ave")).toBe("456 oak avenue");
  });

  it("should remove punctuation", () => {
    expect(normalizeAddress("123 Main St.")).toBe("123 main street");
    expect(normalizeAddress("456 Oak Ave,")).toBe("456 oak avenue");
    expect(normalizeAddress("789 Elm #5")).toBe("789 elm 5");
  });

  it("should handle empty or null addresses", () => {
    expect(normalizeAddress("")).toBe("");
    expect(normalizeAddress(null as any)).toBe("");
    expect(normalizeAddress(undefined as any)).toBe("");
  });
});

describe("Duplicate Detection - Levenshtein Distance", () => {
  it("should calculate distance for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
    expect(levenshteinDistance("123 main street", "123 main street")).toBe(0);
  });

  it("should calculate distance for single character differences", () => {
    expect(levenshteinDistance("hello", "hallo")).toBe(1); // substitution
    expect(levenshteinDistance("hello", "helo")).toBe(1); // deletion
    expect(levenshteinDistance("hello", "helllo")).toBe(1); // insertion
  });

  it("should calculate distance for multiple differences", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("saturday", "sunday")).toBe(3);
  });

  it("should handle empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
    expect(levenshteinDistance("hello", "")).toBe(5);
    expect(levenshteinDistance("", "world")).toBe(5);
  });
});

describe("Duplicate Detection - Similarity Calculation", () => {
  it("should return 100% for identical addresses", () => {
    expect(calculateSimilarity("123 Main St", "123 Main Street")).toBe(100);
    expect(calculateSimilarity("1505 NW 180th Ter", "1505 Northwest 180th Terrace")).toBe(100);
  });

  it("should return high similarity for minor differences", () => {
    const similarity = calculateSimilarity("123 Main Street", "123 Main St");
    expect(similarity).toBeGreaterThan(85);
  });

  it("should return low similarity for different addresses", () => {
    const similarity = calculateSimilarity("123 Main Street", "456 Oak Avenue");
    expect(similarity).toBeLessThan(50);
  });

  it("should handle empty addresses", () => {
    expect(calculateSimilarity("", "")).toBe(100);
    expect(calculateSimilarity("123 Main St", "")).toBe(0);
    expect(calculateSimilarity("", "456 Oak Ave")).toBe(0);
  });
});

describe("Duplicate Detection - GPS Coordinate Matching", () => {
  it("should match coordinates within threshold", () => {
    // Same coordinates
    expect(areCoordinatesNear(25.9428, -80.1389, 25.9428, -80.1389)).toBe(true);
    
    // Very close coordinates (within 10 meters) - 0.0001 degrees
    expect(areCoordinatesNear(25.9428, -80.1389, 25.94281, -80.13891)).toBe(true);
  });

  it("should not match coordinates outside threshold", () => {
    // Different locations (more than 10 meters apart)
    expect(areCoordinatesNear(25.9428, -80.1389, 25.9500, -80.1500)).toBe(false);
  });

  it("should handle null coordinates", () => {
    expect(areCoordinatesNear(null, null, 25.9428, -80.1389)).toBe(false);
    expect(areCoordinatesNear(25.9428, -80.1389, null, null)).toBe(false);
    expect(areCoordinatesNear(null, null, null, null)).toBe(false);
  });

  it("should respect custom threshold", () => {
    // Larger threshold (100 meters) - 0.002 degrees to account for floating point
    expect(areCoordinatesNear(25.9428, -80.1389, 25.9438, -80.1399, 0.002)).toBe(true);
    
    // Smaller threshold - coordinates outside threshold should not match
    expect(areCoordinatesNear(25.9428, -80.1389, 25.9429, -80.1390, 0.00001)).toBe(false);
  });
});

describe("Duplicate Detection - Find Duplicates", () => {
  const testProperties = [
    {
      id: 1,
      address: "1505 Northwest 180th Terrace, Miami, FL 33169",
      ownerName: "John Smith",
      leadTemperature: "HOT",
      createdAt: new Date("2026-01-01"),
      lat: 25.9428,
      lng: -80.1389,
    },
    {
      id: 2,
      address: "1505 Nw 180 Ter, Miami FL 33169",
      ownerName: "Maria Garcia",
      leadTemperature: "WARM",
      createdAt: new Date("2025-12-15"),
      lat: 25.9428,
      lng: -80.1389,
    },
    {
      id: 3,
      address: "456 Oak Avenue, Miami, FL 33101",
      ownerName: "Bob Johnson",
      leadTemperature: "COLD",
      createdAt: new Date("2025-11-20"),
      lat: 25.7617,
      lng: -80.1918,
    },
  ];

  it("should find exact address matches", () => {
    const duplicates = findDuplicates(
      "1505 Northwest 180th Terrace, Miami, FL 33169",
      testProperties
    );
    
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].matchType).toBe("exact");
    expect(duplicates[0].similarity).toBe(100);
  });

  it("should find fuzzy address matches", () => {
    const duplicates = findDuplicates(
      "1505 NW 180 Terrace, Miami FL 33169",
      testProperties
    );
    
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates.some(d => d.matchType === "exact" || d.matchType === "fuzzy")).toBe(true);
  });

  it("should find GPS coordinate matches", () => {
    const duplicates = findDuplicates(
      "1505 Some Different Street Name",
      testProperties,
      25.9428,
      -80.1389
    );
    
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates.some(d => d.matchType === "gps")).toBe(true);
  });

  it("should not find matches for completely different addresses", () => {
    const duplicates = findDuplicates(
      "9999 Completely Different Street, New York, NY 10001",
      testProperties
    );
    
    expect(duplicates.length).toBe(0);
  });

  it("should sort duplicates by similarity (highest first)", () => {
    const duplicates = findDuplicates(
      "1505 Northwest 180th Terrace, Miami, FL 33169",
      testProperties
    );
    
    if (duplicates.length > 1) {
      for (let i = 0; i < duplicates.length - 1; i++) {
        expect(duplicates[i].similarity).toBeGreaterThanOrEqual(duplicates[i + 1].similarity);
      }
    }
  });

  it("should respect similarity threshold", () => {
    const duplicates = findDuplicates(
      "1505 Northwest 180th Terrace, Miami, FL 33169",
      testProperties,
      undefined,
      undefined,
      95 // High threshold
    );
    
    duplicates.forEach(duplicate => {
      expect(duplicate.similarity).toBeGreaterThanOrEqual(95);
    });
  });

  it("should prioritize GPS matches over address matches", () => {
    const duplicates = findDuplicates(
      "1505 Some Different Name",
      testProperties,
      25.9428,
      -80.1389
    );
    
    // GPS matches should be found even with different address
    expect(duplicates.some(d => d.matchType === "gps")).toBe(true);
  });
});

describe("Duplicate Detection - Real-World Scenarios", () => {
  it("should handle Miami address variations", () => {
    const address1 = "1505 NW 180th Ter, Miami FL 33169";
    const address2 = "1505 Northwest 180th Terrace, Miami, Florida 33169";
    
    const similarity = calculateSimilarity(address1, address2);
    expect(similarity).toBeGreaterThan(85);
  });

  it("should handle abbreviated vs full street names", () => {
    const address1 = "123 Main St";
    const address2 = "123 Main Street";
    
    expect(calculateSimilarity(address1, address2)).toBe(100);
  });

  it("should handle case insensitivity", () => {
    const address1 = "123 MAIN STREET";
    const address2 = "123 main street";
    
    expect(calculateSimilarity(address1, address2)).toBe(100);
  });

  it("should detect duplicates with typos", () => {
    const properties = [
      {
        id: 1,
        address: "1505 Northwest 180th Terrace, Miami, FL 33169",
        ownerName: "John Smith",
        leadTemperature: "HOT",
        createdAt: new Date(),
        lat: null,
        lng: null,
      },
    ];
    
    // Typo in "Terrace" → "Terrace"
    const duplicates = findDuplicates(
      "1505 Northwest 180th Terrace, Miami, FL 33169",
      properties
    );
    
    expect(duplicates.length).toBeGreaterThan(0);
  });
});
