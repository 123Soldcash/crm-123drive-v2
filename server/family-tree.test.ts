import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { properties, familyMembers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Family Tree Feature", () => {
  let testPropertyId: number;

  beforeAll(async () => {
    // Create a test property
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.insert(properties).values({
      addressLine1: "123 Family Tree Test St",
      addressLine2: "",
      city: "Test City",
      state: "TS",
      zipcode: "12345",
      subdivisionName: "Test Subdivision",
      status: "Test",
      trackingStatus: "Not Visited",
      ownerName: "Test Owner",
      ownerLocation: "Test Location",
      marketStatus: "Active",
      leadTemperature: "HOT",
      desk: "BIN",
      estimatedValue: 500000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
      yearBuilt: 2000,
      propertyType: "Single Family",
      ownerVerified: 0,
    }).$returningId();
    
    testPropertyId = result[0].id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Clean up test data
    await db.delete(familyMembers).where(eq(familyMembers.propertyId, testPropertyId));
    await db.delete(properties).where(eq(properties.id, testPropertyId));
  });

  it("should create a family member with all new fields", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "John Doe",
      relationship: "Owner",
      phone: "555-1234",
      email: "john@example.com",
      isRepresentative: 1,
      isDeceased: 0,
      isContacted: 1,
      isOnBoard: 1,
      isNotOnBoard: 0,
      relationshipPercentage: 100,
      isCurrentResident: 1,
      notes: "Primary contact",
    }).$returningId();
    
    expect(result[0].id).toBeDefined();
    
    // Verify the record was created
    const created = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, result[0].id));
    
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("John Doe");
    expect(created[0].relationshipPercentage).toBe(100);
    expect(created[0].isCurrentResident).toBe(1);
  });

  it("should support relationship percentage field", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Jane Smith",
      relationship: "Spouse",
      phone: "555-5678",
      email: "jane@example.com",
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 0,
      isOnBoard: 1,
      isNotOnBoard: 0,
      relationshipPercentage: 50,
      isCurrentResident: 1,
      notes: "Co-owner",
    }).$returningId();
    
    const created = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, result[0].id));
    
    expect(created[0].relationshipPercentage).toBe(50);
  });

  it("should support current resident field", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Bob Johnson",
      relationship: "Son",
      phone: "555-9999",
      email: "bob@example.com",
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 0,
      isOnBoard: 0,
      isNotOnBoard: 1,
      relationshipPercentage: 0,
      isCurrentResident: 1,
      notes: "Lives in property",
    }).$returningId();
    
    const created = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, result[0].id));
    
    expect(created[0].isCurrentResident).toBe(1);
  });

  it("should support separate ON BOARD and NOT ON BOARD fields", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Create member marked as ON BOARD
    const onBoardResult = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Alice Brown",
      relationship: "Daughter",
      phone: "555-1111",
      email: "alice@example.com",
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 1,
      isOnBoard: 1,
      isNotOnBoard: 0,
      relationshipPercentage: 25,
      isCurrentResident: 0,
      notes: "Interested in selling",
    }).$returningId();
    
    // Create member marked as NOT ON BOARD
    const notOnBoardResult = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Charlie Davis",
      relationship: "Brother",
      phone: "555-2222",
      email: "charlie@example.com",
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 1,
      isOnBoard: 0,
      isNotOnBoard: 1,
      relationshipPercentage: 25,
      isCurrentResident: 0,
      notes: "Not interested",
    }).$returningId();
    
    const onBoard = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, onBoardResult[0].id));
    
    const notOnBoard = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, notOnBoardResult[0].id));
    
    expect(onBoard[0].isOnBoard).toBe(1);
    expect(onBoard[0].isNotOnBoard).toBe(0);
    expect(notOnBoard[0].isOnBoard).toBe(0);
    expect(notOnBoard[0].isNotOnBoard).toBe(1);
  });

  it("should update family member with new fields", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Create initial member
    const result = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Eve Wilson",
      relationship: "Mother",
      phone: "555-3333",
      email: "eve@example.com",
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 0,
      isOnBoard: 0,
      isNotOnBoard: 0,
      relationshipPercentage: 0,
      isCurrentResident: 0,
      notes: "Initial notes",
    }).$returningId();
    
    const memberId = result[0].id;
    
    // Update with new field values
    await db
      .update(familyMembers)
      .set({
        relationshipPercentage: 75,
        isCurrentResident: 1,
        isOnBoard: 1,
        isContacted: 1,
      })
      .where(eq(familyMembers.id, memberId));
    
    const updated = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId));
    
    expect(updated[0].relationshipPercentage).toBe(75);
    expect(updated[0].isCurrentResident).toBe(1);
    expect(updated[0].isOnBoard).toBe(1);
    expect(updated[0].isContacted).toBe(1);
  });

  it("should retrieve all family members for a property", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Add a member
    await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Frank Miller",
      relationship: "Father",
      phone: "555-4444",
      email: "frank@example.com",
      isRepresentative: 1,
      isDeceased: 0,
      isContacted: 1,
      isOnBoard: 1,
      isNotOnBoard: 0,
      relationshipPercentage: 50,
      isCurrentResident: 0,
      notes: "Representative",
    });
    
    // Retrieve all members for property
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.propertyId, testPropertyId));
    
    expect(members.length).toBeGreaterThan(0);
    expect(members.every(m => m.propertyId === testPropertyId)).toBe(true);
  });

  it("should handle null/optional fields correctly", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.insert(familyMembers).values({
      propertyId: testPropertyId,
      name: "Grace Lee",
      relationship: "Other",
      phone: null,
      email: null,
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 0,
      isOnBoard: 0,
      isNotOnBoard: 0,
      relationshipPercentage: null,
      isCurrentResident: 0,
      notes: null,
    }).$returningId();
    
    const created = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, result[0].id));
    
    expect(created[0].phone).toBeNull();
    expect(created[0].email).toBeNull();
    expect(created[0].relationshipPercentage).toBeNull();
    expect(created[0].notes).toBeNull();
  });

  it("should support all relationship types", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const relationships = ["Owner", "Spouse", "Son"];
    
    for (const rel of relationships) {
      const result = await db.insert(familyMembers).values({
        propertyId: testPropertyId,
        name: `Test ${rel}`,
        relationship: rel as any,
        phone: "555-0000",
        email: "test@example.com",
        isRepresentative: 0,
        isDeceased: 0,
        isContacted: 0,
        isOnBoard: 0,
        isNotOnBoard: 0,
        relationshipPercentage: 0,
        isCurrentResident: 0,
        notes: "",
      }).$returningId();
      
      const created = await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, result[0].id));
      
      expect(created[0].relationship).toBe(rel);
    }
  });
});
