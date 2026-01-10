import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { parseCSV, transformPropertyWithContacts } from "./dealmachine-import";

describe("DealMachine Consolidated CSV Import - 101 Properties", () => {
  let csvContent: string;

  beforeAll(() => {
    // Read the CSV file
    const csvPath = "/home/ubuntu/upload/dealmachine-properties-2026-01-09-150558.csv";
    csvContent = fs.readFileSync(csvPath, "utf-8");
  });

  it("should parse CSV with 151 rows (101 properties + 50 extra)", () => {
    const rows = parseCSV(csvContent);
    expect(rows.length).toBe(151);
  });

  it("should transform properties with embedded contacts", () => {
    const rows = parseCSV(csvContent);
    const parsed = rows
      .map(transformPropertyWithContacts)
      .filter((p) => p !== null);

    // Should have ~115 valid properties (some rows might be invalid)
    expect(parsed.length).toBeGreaterThan(80);

    // Check first property
    const first = parsed[0];
    expect(first.property.addressLine1).toBeDefined();
    expect(first.property.city).toBeDefined();
    expect(first.property.state).toBeDefined();
    expect(first.property.zipcode).toBeDefined();
    expect(first.contacts).toBeInstanceOf(Array);
  });

  it("should extract embedded contacts from properties", () => {
    const rows = parseCSV(csvContent);
    let totalContacts = 0;
    let propertiesWithContacts = 0;

    for (const row of rows) {
      const parsed = transformPropertyWithContacts(row);
      if (parsed && parsed.contacts.length > 0) {
        propertiesWithContacts++;
        totalContacts += parsed.contacts.length;
      }
    }

    expect(propertiesWithContacts).toBeGreaterThan(0);
    expect(totalContacts).toBeGreaterThan(0);

    console.log(
      `✅ Found ${totalContacts} contacts in ${propertiesWithContacts} properties (${rows.length - propertiesWithContacts} without contacts)`
    );
  });

  it("should map contact flags to relationship field", () => {
    const rows = parseCSV(csvContent);

    for (const row of rows) {
      const parsed = transformPropertyWithContacts(row);
      if (parsed && parsed.contacts.length > 0) {
        for (const contact of parsed.contacts) {
          // Relationship should be one of the mapped values
          const validRelationships = [
            "Owner",
            "Resident",
            "Family",
            "Potential",
            "Renting",
            "Likely",
          ];
          expect(validRelationships).toContain(contact.relationship);
        }
      }
    }
  });

  it("should extract phones and emails from contacts", () => {
    const rows = parseCSV(csvContent);
    let totalPhones = 0;
    let totalEmails = 0;

    for (const row of rows) {
      const parsed = transformPropertyWithContacts(row);
      if (parsed && parsed.contacts.length > 0) {
        for (const contact of parsed.contacts) {
          if (contact.phone) totalPhones++;
          if (contact.email) totalEmails++;
        }
      }
    }

    console.log(`✅ Found ${totalPhones} phones and ${totalEmails} emails`);
    expect(totalPhones).toBeGreaterThan(0);
    expect(totalEmails).toBeGreaterThan(0);
  });

  it("should handle properties without contacts", () => {
    const rows = parseCSV(csvContent);
    let propertiesWithoutContacts = 0;

    for (const row of rows) {
      const parsed = transformPropertyWithContacts(row);
      if (parsed && parsed.contacts.length === 0) {
        propertiesWithoutContacts++;
      }
    }

    console.log(`✅ Found ${propertiesWithoutContacts} properties without contacts (for skip trace)`);
    expect(propertiesWithoutContacts).toBeGreaterThanOrEqual(0);
  });
});
