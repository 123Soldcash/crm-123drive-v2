import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { properties, familyMembers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe.skip("Family Tree Feature", () => {
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


// ============================================================================
// UI COMPONENT TESTS - Redundant Toggle Removal
// ============================================================================

import * as fs from "fs";
import * as path from "path";

const COMPONENT_PATH = path.join(__dirname, "../client/src/components/FamilyTreeEnhanced.tsx");
const PROPERTY_DETAIL_PATH = path.join(__dirname, "../client/src/pages/PropertyDetail.tsx");

function readFamilyTreeComponent(): string {
  return fs.readFileSync(COMPONENT_PATH, "utf-8");
}

function readPropertyDetailPage(): string {
  return fs.readFileSync(PROPERTY_DETAIL_PATH, "utf-8");
}

describe("Family Tree - Redundant Internal Toggle Removed", () => {
  it("should NOT have isExpanded state variable", () => {
    const content = readFamilyTreeComponent();
    expect(content).not.toContain("isExpanded");
    expect(content).not.toContain("setIsExpanded");
  });

  it("should NOT import ChevronDown or ChevronUp icons", () => {
    const content = readFamilyTreeComponent();
    expect(content).not.toContain("ChevronDown");
    expect(content).not.toContain("ChevronUp");
  });

  it("should NOT have conditional rendering with isExpanded", () => {
    const content = readFamilyTreeComponent();
    expect(content).not.toContain("{isExpanded &&");
  });

  it("should NOT have a redundant Family Tree h3 heading", () => {
    const content = readFamilyTreeComponent();
    expect(content).not.toContain('<h3 className="text-lg font-semibold">Family Tree</h3>');
  });
});

describe("Family Tree - Section-Level Collapse Preserved in PropertyDetail", () => {
  it("should have showFamilyTree state in PropertyDetail", () => {
    const content = readPropertyDetailPage();
    expect(content).toContain("showFamilyTree");
    expect(content).toContain("setShowFamilyTree");
  });

  it("should use CollapsibleSection for Family Tree", () => {
    const content = readPropertyDetailPage();
    expect(content).toContain('CollapsibleSection title="Family Tree"');
  });

  it("should pass showFamilyTree to CollapsibleSection isOpen", () => {
    const content = readPropertyDetailPage();
    expect(content).toMatch(/CollapsibleSection.*title="Family Tree".*isOpen=\{showFamilyTree\}/);
  });

  it("should persist showFamilyTree in localStorage", () => {
    const content = readPropertyDetailPage();
    expect(content).toContain("localStorage.setItem('showFamilyTree'");
    expect(content).toContain("localStorage.getItem('showFamilyTree')");
  });

  it("should render FamilyTreeEnhanced inside CollapsibleSection", () => {
    const content = readPropertyDetailPage();
    expect(content).toContain("<FamilyTreeEnhanced propertyId={propertyId} />");
  });
});

describe("Family Tree - Core Functionality Still Present", () => {
  it("should have the Add New Family Member form", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("Add New Family Member");
    expect(content).toContain("handleSaveNewMember");
  });

  it("should have name input with placeholder", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain('placeholder="Enter name..."');
  });

  it("should have relationship select with all options", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("RELATIONSHIPS");
    expect(content).toContain("SelectItem");
    expect(content).toContain('"Owner"');
    expect(content).toContain('"Spouse"');
    expect(content).toContain('"Son"');
    expect(content).toContain('"Daughter"');
  });

  it("should have inheritance percentage input", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("Inheritance %");
    expect(content).toContain("relationshipPercentage");
  });

  it("should have all checkbox options", () => {
    const content = readFamilyTreeComponent();
    const checkboxes = ["Current Resident", "Representative", "Deceased", "Contacted", "On Board", "NOT ON BOARD"];
    for (const cb of checkboxes) {
      expect(content).toContain(cb);
    }
  });

  it("should have family members table with headers", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("<table");
    expect(content).toContain("<thead");
    expect(content).toContain("familyMembers.map");
  });

  it("should have edit and delete actions", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("editingId");
    expect(content).toContain("handleEditSave");
    expect(content).toContain("deleteMutation");
    expect(content).toContain("Edit2");
    expect(content).toContain("Trash2");
  });

  it("should have Family Tree Notes section", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("Family Tree Notes");
    expect(content).toContain("treeNotes");
    expect(content).toContain("notesEditing");
  });

  it("should have empty state message", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("No family members added yet");
  });

  it("should use tRPC hooks for CRUD operations", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("trpc.properties.getFamilyMembers.useQuery");
    expect(content).toContain("trpc.properties.createFamilyMember.useMutation");
    expect(content).toContain("trpc.properties.updateFamilyMember.useMutation");
    expect(content).toContain("trpc.properties.deleteFamilyMember.useMutation");
  });

  it("should have Enter key handler for quick add", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("handleKeyDown");
    expect(content).toContain('e.key === "Enter"');
  });

  it("should have toast notifications for success and error", () => {
    const content = readFamilyTreeComponent();
    expect(content).toContain("toast.success");
    expect(content).toContain("toast.error");
  });
});
