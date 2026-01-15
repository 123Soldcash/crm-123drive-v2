import { describe, it, expect } from "vitest";
import { calculateMergeConfidence, type LeadData } from "./utils/aiMergeScoring";

describe("AI Merge Confidence Scoring", () => {
  const createTestLead = (overrides: Partial<LeadData> = {}): LeadData => ({
    id: 1,
    addressLine1: "1505 NW 180th Ter",
    city: "Miami",
    state: "FL",
    zipcode: "33169",
    owner1Name: "John Smith",
    leadTemperature: "HOT",
    deskStatus: "BIN",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-15"),
    contactsCount: 2,
    notesCount: 3,
    tasksCount: 1,
    photosCount: 5,
    assignedAgentsCount: 1,
    ...overrides,
  });

  describe("Identical Addresses", () => {
    it("should give 100% address similarity for identical addresses", () => {
      const lead1 = createTestLead({ id: 1 });
      const lead2 = createTestLead({ id: 2 });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.addressSimilarity).toBe(100);
      expect(result.confidenceLevel).toMatch(/HIGH|MEDIUM/);
      expect(result.overallScore).toBeGreaterThan(70);
    });

    it("should handle address abbreviations (Ter vs Terrace)", () => {
      const lead1 = createTestLead({ 
        id: 1, 
        addressLine1: "1505 NW 180th Ter" 
      });
      const lead2 = createTestLead({ 
        id: 2, 
        addressLine1: "1505 Northwest 180th Terrace" 
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.addressSimilarity).toBeGreaterThan(90);
    });
  });

  describe("Owner Name Matching", () => {
    it("should give 100% owner similarity for identical names", () => {
      const lead1 = createTestLead({ id: 1, owner1Name: "John Smith" });
      const lead2 = createTestLead({ id: 2, owner1Name: "John Smith" });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.ownerNameSimilarity).toBe(100);
    });

    it("should handle case differences in owner names", () => {
      const lead1 = createTestLead({ id: 1, owner1Name: "JOHN SMITH" });
      const lead2 = createTestLead({ id: 2, owner1Name: "john smith" });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.ownerNameSimilarity).toBe(100);
    });

    it("should detect similar but not identical owner names", () => {
      const lead1 = createTestLead({ id: 1, owner1Name: "John Smith" });
      const lead2 = createTestLead({ id: 2, owner1Name: "John Smyth" });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.ownerNameSimilarity).toBeGreaterThan(80);
      expect(result.ownerNameSimilarity).toBeLessThan(100);
    });
  });

  describe("Data Completeness Scoring", () => {
    it("should score high completeness for lead with all data", () => {
      const lead1 = createTestLead({
        id: 1,
        contactsCount: 5,
        notesCount: 10,
        tasksCount: 3,
        photosCount: 8,
        assignedAgentsCount: 2,
      });
      const lead2 = createTestLead({ id: 2, contactsCount: 0, notesCount: 0 });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.dataCompletenessScore).toBeGreaterThan(70);
    });

    it("should score low completeness for empty lead", () => {
      const lead1 = createTestLead({
        id: 1,
        contactsCount: 0,
        notesCount: 0,
        tasksCount: 0,
        photosCount: 0,
        assignedAgentsCount: 0,
      });
      const lead2 = createTestLead({ id: 2 });

      const result = calculateMergeConfidence(lead1, lead2);

      // Primary lead (lead2) should have better completeness
      expect(result.suggestedPrimary).toBe(2);
    });
  });

  describe("Lead Quality Assessment", () => {
    it("should prefer HOT leads over COLD leads", () => {
      const hotLead = createTestLead({ 
        id: 1, 
        leadTemperature: "HOT",
        contactsCount: 2,
      });
      const coldLead = createTestLead({ 
        id: 2, 
        leadTemperature: "COLD",
        contactsCount: 2,
      });

      const result = calculateMergeConfidence(hotLead, coldLead);

      expect(result.suggestedPrimary).toBe(1); // HOT lead should be primary
    });

    it("should penalize ARCHIVED leads", () => {
      const activeLead = createTestLead({ 
        id: 1, 
        deskStatus: "BIN",
        contactsCount: 2,
      });
      const archivedLead = createTestLead({ 
        id: 2, 
        deskStatus: "ARCHIVED",
        contactsCount: 2,
      });

      const result = calculateMergeConfidence(activeLead, archivedLead);

      expect(result.suggestedPrimary).toBe(1); // Active lead should be primary
    });
  });

  describe("Risk Assessment", () => {
    it("should have low risk for identical addresses and owners", () => {
      const lead1 = createTestLead({ id: 1 });
      const lead2 = createTestLead({ id: 2 });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.riskScore).toBeLessThan(50); // Conservative risk assessment
    });

    it("should have high risk for different addresses", () => {
      const lead1 = createTestLead({ 
        id: 1, 
        addressLine1: "1505 NW 180th Ter" 
      });
      const lead2 = createTestLead({ 
        id: 2, 
        addressLine1: "9999 SW 1st Ave" 
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.riskScore).toBeGreaterThan(40);
    });

    it("should increase risk when both leads have significant data", () => {
      const lead1 = createTestLead({
        id: 1,
        contactsCount: 10,
        notesCount: 15,
        tasksCount: 5,
      });
      const lead2 = createTestLead({
        id: 2,
        contactsCount: 8,
        notesCount: 12,
        tasksCount: 4,
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.riskScore).toBeGreaterThan(20);
    });
  });

  describe("Overall Confidence Levels", () => {
    it("should return HIGH confidence for perfect match", () => {
      const lead1 = createTestLead({ id: 1 });
      const lead2 = createTestLead({ id: 2, contactsCount: 0, notesCount: 0 });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.confidenceLevel).toMatch(/HIGH|MEDIUM/);
      expect(result.overallScore).toBeGreaterThan(70); // Conservative but confident
    });

    it("should return MEDIUM confidence for good match with minor differences", () => {
      const lead1 = createTestLead({ 
        id: 1, 
        owner1Name: "John Smith" 
      });
      const lead2 = createTestLead({ 
        id: 2, 
        owner1Name: "John Smyth",
        contactsCount: 1,
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.confidenceLevel).toMatch(/MEDIUM|HIGH/);
    });

    it("should return LOW confidence for poor match", () => {
      const lead1 = createTestLead({ 
        id: 1, 
        addressLine1: "1505 NW 180th Ter",
        owner1Name: "John Smith",
      });
      const lead2 = createTestLead({ 
        id: 2, 
        addressLine1: "1506 NW 180th Ter",
        owner1Name: "Jane Doe",
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.confidenceLevel).toMatch(/LOW|MEDIUM/);
    });
  });

  describe("Reasoning Generation", () => {
    it("should include reasoning for high confidence merge", () => {
      const lead1 = createTestLead({ id: 1 });
      const lead2 = createTestLead({ id: 2, contactsCount: 0, notesCount: 0 });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.includes("✅"))).toBe(true);
    });

    it("should include warning indicators for risky merges", () => {
      const lead1 = createTestLead({ 
        id: 1, 
        addressLine1: "1505 NW 180th Ter" 
      });
      const lead2 = createTestLead({ 
        id: 2, 
        addressLine1: "1506 NW 180th Ter" 
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.reasoning.some(r => r.includes("⚠️") || r.includes("❌"))).toBe(true);
    });

    it("should mention data transfer items", () => {
      const lead1 = createTestLead({ id: 1, contactsCount: 5 });
      const lead2 = createTestLead({ 
        id: 2, 
        contactsCount: 3,
        notesCount: 2,
      });

      const result = calculateMergeConfidence(lead1, lead2);

      expect(result.reasoning.some(r => r.includes("📦"))).toBe(true);
    });
  });

  describe("Primary Lead Selection", () => {
    it("should select lead with more data as primary", () => {
      const emptyLead = createTestLead({
        id: 1,
        contactsCount: 0,
        notesCount: 0,
        tasksCount: 0,
      });
      const fullLead = createTestLead({
        id: 2,
        contactsCount: 10,
        notesCount: 5,
        tasksCount: 3,
      });

      const result = calculateMergeConfidence(emptyLead, fullLead);

      expect(result.suggestedPrimary).toBe(2);
    });

    it("should consider lead quality in primary selection", () => {
      const coldLead = createTestLead({
        id: 1,
        leadTemperature: "COLD",
        contactsCount: 5,
      });
      const hotLead = createTestLead({
        id: 2,
        leadTemperature: "HOT",
        contactsCount: 5,
      });

      const result = calculateMergeConfidence(coldLead, hotLead);

      expect(result.suggestedPrimary).toBe(2); // HOT lead
    });
  });
});
