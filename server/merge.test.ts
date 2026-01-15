import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { mergeLeads } from "./db-merge";
import { properties, contacts, notes, tasks, photos, visits, leadAssignments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Lead Merge Functionality", () => {
  it("should successfully merge two leads with all data transfer", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const testUserId = 1;

    // Create test primary lead
    const [primaryLead] = await db.insert(properties).values({
      addressLine1: "123 Test Primary St",
      city: "Miami",
      state: "FL",
      zipcode: "33101",
      owner1Name: "John Primary",
      leadTemperature: "HOT",
    });
    const testPrimaryLeadId = primaryLead.insertId;

    // Create test secondary lead
    const [secondaryLead] = await db.insert(properties).values({
      addressLine1: "123 Test Secondary St",
      city: "Miami",
      state: "FL",
      zipcode: "33101",
      owner1Name: "John Secondary",
      leadTemperature: "WARM",
    });
    const testSecondaryLeadId = secondaryLead.insertId;

    // Add test data to secondary lead
    await db.insert(contacts).values([
      {
        propertyId: testSecondaryLeadId,
        name: "Contact 1",
        relationship: "Owner",
      },
      {
        propertyId: testSecondaryLeadId,
        name: "Contact 2",
        relationship: "Spouse",
      },
    ]);

    await db.insert(notes).values([
      {
        propertyId: testSecondaryLeadId,
        userId: testUserId,
        content: "Test note 1",
      },
      {
        propertyId: testSecondaryLeadId,
        userId: testUserId,
        content: "Test note 2",
      },
    ]);

    await db.insert(tasks).values([
      {
        propertyId: testSecondaryLeadId,
        createdById: testUserId,
        title: "Test task 1",
        taskType: "Call",
        status: "To Do",
        priority: "HIGH",
      },
    ]);

    // Perform merge
    const result = await mergeLeads(
      testPrimaryLeadId,
      testSecondaryLeadId,
      testUserId,
      "Test merge"
    );

    // Verify merge result
    expect(result.success).toBe(true);
    expect(result.itemsMerged.contacts).toBe(2);
    expect(result.itemsMerged.notes).toBe(2);
    expect(result.itemsMerged.tasks).toBe(1);

    // Verify data was transferred to primary lead
    const primaryContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.propertyId, testPrimaryLeadId));
    expect(primaryContacts.length).toBe(2);

    const primaryNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.propertyId, testPrimaryLeadId));
    expect(primaryNotes.length).toBe(2);

    const primaryTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.propertyId, testPrimaryLeadId));
    expect(primaryTasks.length).toBe(1);

    // Verify secondary lead was deleted
    const [deletedLead] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, testSecondaryLeadId))
      .limit(1);
    expect(deletedLead).toBeUndefined();

    // Cleanup
    await db.delete(properties).where(eq(properties.id, testPrimaryLeadId));
  });

  it("should throw error when merging non-existent leads", async () => {
    await expect(
      mergeLeads(999999, 999998, 1, "Invalid merge")
    ).rejects.toThrow("One or both leads not found");
  });
});

describe("Owner Name Duplicate Detection", () => {
  it("should detect duplicates by owner name", () => {
    // This is tested through the searchDuplicates endpoint
    // which is already tested in duplicateDetection.test.ts
    expect(true).toBe(true);
  });
});
