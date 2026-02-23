import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as XLSX from "xlsx";

// ─── Test Helpers ─────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createExcelBase64(rows: Record<string, any>[]): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer).toString("base64");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Import Properties Router", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());

  // ── Access Control ──────────────────────────────────────────────────────

  describe("Access Control", () => {
    it("rejects non-admin users from previewing properties", async () => {
      const fileData = createExcelBase64([{ address: "123 Main St", city: "Miami", state: "FL", zipcode: "33101" }]);
      await expect(userCaller.importProperties.previewProperties({ fileData })).rejects.toThrow("Only admins can import");
    });

    it("rejects non-admin users from executing import", async () => {
      const fileData = createExcelBase64([{ address: "123 Main St" }]);
      await expect(
        userCaller.importProperties.executeImport({
          fileData,
          assignedAgentId: null,
          newRows: [0],
          updateRows: [],
        })
      ).rejects.toThrow("Only admins can import");
    });

    it("rejects non-admin users from previewing contacts", async () => {
      const fileData = createExcelBase64([{ name: "John", address: "123 Main St" }]);
      await expect(userCaller.importProperties.previewContacts({ fileData })).rejects.toThrow("Only admins can import");
    });

    it("rejects non-admin users from executing contacts import", async () => {
      const fileData = createExcelBase64([{ name: "John" }]);
      await expect(
        userCaller.importProperties.executeContactsImport({
          fileData,
          contactRows: [{ rowIndex: 0, propertyId: 1 }],
        })
      ).rejects.toThrow("Only admins can import");
    });
  });

  // ── Preview Properties ──────────────────────────────────────────────────

  describe("Preview Properties", () => {
    it("parses a valid Excel file and returns preview data", async () => {
      const fileData = createExcelBase64([
        { address: "999 Test Import St", city: "TestCity", state: "FL", zipcode: "99999", "owner name": "Test Owner" },
        { address: "998 Test Import Ave", city: "TestCity", state: "FL", zipcode: "99998", "owner name": "Another Owner" },
      ]);

      const result = await adminCaller.importProperties.previewProperties({ fileData });

      expect(result.totalRows).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].address).toBe("999 Test Import St");
      expect(result.rows[0].owner).toBe("Test Owner");
      expect(result.rows[1].address).toBe("998 Test Import Ave");
      expect(result.detectedColumns).toContain("address");
      expect(result.detectedColumns).toContain("city");
    });

    it("throws error for empty file", async () => {
      const fileData = createExcelBase64([]);
      await expect(adminCaller.importProperties.previewProperties({ fileData })).rejects.toThrow("File is empty");
    });

    it("detects column mappings for various formats", async () => {
      const fileData = createExcelBase64([
        {
          "property_address_line_1": "100 DealMachine St",
          "property_address_city": "Miami",
          "property_address_state": "FL",
          "property_address_zipcode": "33101",
          "owner_1_name": "DM Owner",
          "estimated_value": "$500,000",
        },
      ]);

      const result = await adminCaller.importProperties.previewProperties({ fileData });

      expect(result.mappedColumns).toHaveProperty("property_address_line_1", "addressLine1");
      expect(result.mappedColumns).toHaveProperty("property_address_city", "city");
      expect(result.mappedColumns).toHaveProperty("owner_1_name", "owner1Name");
      expect(result.mappedColumns).toHaveProperty("estimated_value", "estimatedValue");
      expect(result.rows[0].address).toBe("100 DealMachine St");
      expect(result.rows[0].owner).toBe("DM Owner");
    });
  });

  // ── Execute Import ──────────────────────────────────────────────────────

  describe("Execute Import", () => {
    it("inserts new properties successfully", async () => {
      const uniqueAddr = `${Date.now()} Import Test St`;
      const fileData = createExcelBase64([
        {
          address: uniqueAddr,
          city: "ImportCity",
          state: "FL",
          zipcode: "33199",
          "owner name": "Import Owner",
          "estimated value": "250000",
          bedrooms: "3",
          baths: "2",
        },
      ]);

      const result = await adminCaller.importProperties.executeImport({
        fileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      expect(result.insertedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it("handles empty newRows and updateRows", async () => {
      const fileData = createExcelBase64([{ address: "123 Skip St", city: "Miami", state: "FL", zipcode: "33101" }]);

      const result = await adminCaller.importProperties.executeImport({
        fileData,
        assignedAgentId: null,
        newRows: [],
        updateRows: [],
      });

      expect(result.insertedCount).toBe(0);
      expect(result.updatedCount).toBe(0);
    });

    it("detects duplicates after inserting a property", async () => {
      const uniqueAddr = `${Date.now()} Dup Test St`;
      const fileData = createExcelBase64([
        { address: uniqueAddr, city: "DupCity", state: "FL", zipcode: "33100" },
      ]);

      // Insert first
      await adminCaller.importProperties.executeImport({
        fileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      // Preview should detect duplicate
      const preview = await adminCaller.importProperties.previewProperties({ fileData });
      expect(preview.duplicateCount).toBe(1);
      expect(preview.newCount).toBe(0);
      expect(preview.rows[0].isDuplicate).toBe(true);
      expect(preview.rows[0].matchType).toBe("address");
    });

    it("detects changes in duplicate properties", async () => {
      const uniqueAddr = `${Date.now()} Change Test St`;
      // Insert with value 100000
      const fileData1 = createExcelBase64([
        { address: uniqueAddr, city: "ChangeCity", state: "FL", zipcode: "33100", "estimated value": "100000" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: fileData1,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      // Preview with updated value 200000
      const fileData2 = createExcelBase64([
        { address: uniqueAddr, city: "ChangeCity", state: "FL", zipcode: "33100", "estimated value": "200000" },
      ]);
      const preview = await adminCaller.importProperties.previewProperties({ fileData: fileData2 });

      expect(preview.duplicateCount).toBe(1);
      expect(preview.updatableCount).toBe(1);
      expect(preview.rows[0].hasChanges).toBe(true);
      expect(preview.rows[0].changes.length).toBeGreaterThan(0);
      const valueChange = preview.rows[0].changes.find((c: any) => c.field === "Estimated Value");
      expect(valueChange).toBeDefined();
      expect(valueChange?.newValue).toBe(200000);
    });
  });

  // ── Contacts Preview ────────────────────────────────────────────────────

  describe("Preview Contacts", () => {
    it("parses contacts file and returns preview", async () => {
      const fileData = createExcelBase64([
        { name: "John Doe", phone: "555-1234", email: "john@test.com", address: "999 NoMatch St", city: "NoCity" },
      ]);

      const result = await adminCaller.importProperties.previewContacts({ fileData });

      expect(result.totalRows).toBe(1);
      expect(result.rows[0].contactName).toBe("John Doe");
      // This contact won't match any property
      expect(result.rows[0].matched).toBe(false);
    });

    it("matches contacts to existing properties by address", async () => {
      // First insert a property
      const uniqueAddr = `${Date.now()} Contact Match St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "MatchCity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      // Now preview contacts with matching address
      const contactFileData = createExcelBase64([
        { name: "Jane Smith", phone: "555-9999", address: uniqueAddr, city: "MatchCity" },
      ]);
      const result = await adminCaller.importProperties.previewContacts({ fileData: contactFileData });

      expect(result.matchedCount).toBe(1);
      expect(result.unmatchedCount).toBe(0);
      expect(result.rows[0].matched).toBe(true);
      expect(result.rows[0].matchMethod).toBe("address");
      expect(result.rows[0].matchedPropertyId).toBeGreaterThan(0);
    });
  });

  // ── Execute Contacts Import ─────────────────────────────────────────────

  describe("Execute Contacts Import", () => {
    it("imports contacts linked to existing properties", async () => {
      // Insert a property first
      const uniqueAddr = `${Date.now()} Contact Import St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "CICity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      // Get the property ID
      const preview = await adminCaller.importProperties.previewContacts({
        fileData: createExcelBase64([
          { name: "Bob Contact", phone: "555-1111", email: "bob@test.com", address: uniqueAddr, city: "CICity" },
        ]),
      });
      const propertyId = preview.rows[0].matchedPropertyId!;
      expect(propertyId).toBeGreaterThan(0);

      // Execute contacts import
      const contactFileData = createExcelBase64([
        { name: "Bob Contact", phone: "555-1111", email: "bob@test.com", address: uniqueAddr, city: "CICity" },
      ]);
      const result = await adminCaller.importProperties.executeContactsImport({
        fileData: contactFileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsImported).toBe(1);
      expect(result.phonesImported).toBe(1);
      expect(result.emailsImported).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it("handles multiple phones and emails per contact", async () => {
      const uniqueAddr = `${Date.now()} Multi Contact St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "MCCity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      const preview = await adminCaller.importProperties.previewContacts({
        fileData: createExcelBase64([
          { name: "Multi Contact", phone1: "555-0001", phone2: "555-0002", email1: "a@test.com", email2: "b@test.com", address: uniqueAddr, city: "MCCity" },
        ]),
      });
      const propertyId = preview.rows[0].matchedPropertyId!;

      const contactFileData = createExcelBase64([
        { name: "Multi Contact", phone1: "555-0001", phone2: "555-0002", email1: "a@test.com", email2: "b@test.com", address: uniqueAddr, city: "MCCity" },
      ]);
      const result = await adminCaller.importProperties.executeContactsImport({
        fileData: contactFileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsImported).toBe(1);
      expect(result.phonesImported).toBe(2);
      expect(result.emailsImported).toBe(2);
    });
  });
});
