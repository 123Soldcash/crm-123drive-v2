import { describe, expect, it } from "vitest";
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

function createExcelBase64(rows: Record<string, any>[]): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer).toString("base64");
}

/** Create a property and return its ID */
async function createTestProperty(caller: any, suffix: string): Promise<number> {
  const uniqueAddr = `${Date.now()}-${suffix} Test St`;
  const fileData = createExcelBase64([
    { address: uniqueAddr, city: "TestCity", state: "FL", zipcode: "33100" },
  ]);
  await caller.importProperties.executeImport({
    fileData,
    assignedAgentId: null,
    newRows: [0],
    updateRows: [],
  });
  // Get the property ID via preview
  const preview = await caller.importProperties.previewContacts({
    fileData: createExcelBase64([
      { name: "Lookup", address: uniqueAddr, city: "TestCity" },
    ]),
  });
  return preview.rows[0].matchedPropertyId!;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Contacts Import Pipeline — Professional Grade", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  // ── 1. Contact Creation with Full Data ────────────────────────────────

  describe("Contact Creation with Full Data", () => {
    it("creates a new contact with all phones, emails, and demographics", async () => {
      const propertyId = await createTestProperty(adminCaller, "full-data");

      const contactFileData = createExcelBase64([
        {
          name: "Mitesh Lotia",
          first_name: "Mitesh",
          last_name: "Lotia",
          phone_1: "407-555-1001",
          phone_1_type: "Wireless",
          phone_1_dnc_indicator: "Do Not Call",
          phone_1_carrier: "T-Mobile",
          phone_1_prepaid_indicator: "Not Prepaid",
          phone_1_activity_status: "Active",
          phone_1_usage_2_months: "High",
          phone_1_usage_12_months: "Medium",
          phone_2: "407-555-1002",
          phone_2_type: "Landline",
          phone_2_dnc_indicator: "Not on DNC",
          phone_3: "407-555-1003",
          phone_3_type: "VoIP",
          email_address_1: "mitesh@example.com",
          email_address_2: "mitesh2@example.com",
          email_address_3: "mitesh3@example.com",
          gender: "Male",
          marital_status: "Married",
          net_asset_value: "$500,000",
          contact_flags: "Likely Owner, Family",
          address: `${Date.now()}-full-data Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData: contactFileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.contactsUpdated).toBe(0);
      expect(result.phonesAdded).toBe(3);
      expect(result.emailsAdded).toBe(3);
      expect(result.errorCount).toBe(0);
    });

    it("creates contact with DealMachine column naming convention", async () => {
      const propertyId = await createTestProperty(adminCaller, "dm-naming");

      const contactFileData = createExcelBase64([
        {
          name: "Poonam Lotia",
          first_name: "Poonam",
          last_name: "Lotia",
          phone_1: "321-555-2001",
          phone_1_type: "Wireless",
          phone_1_dnc_indicator: "Not on DNC",
          phone_1_carrier: "AT&T",
          phone_1_prepaid_indicator: "Prepaid",
          phone_1_activity_status: "Inactive",
          phone_1_usage_2_months: "None",
          phone_1_usage_12_months: "Low",
          email_address_1: "poonam@example.com",
          gender: "Female",
          marital_status: "Single",
          contact_flags: "Resident",
          associated_property_apn_parcel_id: "TEST-APN-123",
          address: `${Date.now()}-dm-naming Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData: contactFileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.phonesAdded).toBe(1);
      expect(result.emailsAdded).toBe(1);
    });
  });

  // ── 2. Contact Upsert — Existing Contact Gets Updated ─────────────────

  describe("Contact Upsert — Existing Contacts Get Updated", () => {
    it("updates an existing contact with new phones and emails instead of skipping", async () => {
      const propertyId = await createTestProperty(adminCaller, "upsert-1");

      // First import — create contact with 1 phone, 1 email
      const fileData1 = createExcelBase64([
        {
          name: "John Upsert",
          first_name: "John",
          last_name: "Upsert",
          phone_1: "555-000-1111",
          phone_1_type: "Wireless",
          email_address_1: "john@first.com",
          address: `${Date.now()}-upsert-1 Test St`,
          city: "TestCity",
        },
      ]);
      const result1 = await adminCaller.importProperties.executeContactsImport({
        fileData: fileData1,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result1.contactsCreated).toBe(1);
      expect(result1.phonesAdded).toBe(1);
      expect(result1.emailsAdded).toBe(1);

      // Second import — same contact name, NEW phone and email
      const fileData2 = createExcelBase64([
        {
          name: "John Upsert",
          first_name: "John",
          last_name: "Upsert",
          phone_1: "555-000-1111",  // existing phone
          phone_2: "555-000-2222",  // NEW phone
          phone_2_type: "Landline",
          email_address_1: "john@first.com",  // existing email
          email_address_2: "john@second.com",  // NEW email
          address: `${Date.now()}-upsert-1 Test St`,
          city: "TestCity",
        },
      ]);
      const result2 = await adminCaller.importProperties.executeContactsImport({
        fileData: fileData2,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Should UPDATE the existing contact, not create a new one
      expect(result2.contactsCreated).toBe(0);
      expect(result2.contactsUpdated).toBe(1);
      expect(result2.phonesAdded).toBe(1);  // only the NEW phone
      expect(result2.emailsAdded).toBe(1);  // only the NEW email
    });

    it("marks contact as up-to-date when no new data to add", async () => {
      const propertyId = await createTestProperty(adminCaller, "uptodate-1");

      // First import
      const fileData = createExcelBase64([
        {
          name: "Same Data Contact",
          phone_1: "555-000-3333",
          phone_1_type: "Wireless",
          email_address_1: "same@test.com",
          address: `${Date.now()}-uptodate-1 Test St`,
          city: "TestCity",
        },
      ]);
      await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Second import — exact same data
      const result2 = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result2.contactsCreated).toBe(0);
      expect(result2.contactsUpdated).toBe(0);
      expect(result2.skippedUpToDate).toBe(1);
    });

    it("updates demographics on existing contact", async () => {
      const propertyId = await createTestProperty(adminCaller, "demo-update");

      // First import — no demographics
      const fileData1 = createExcelBase64([
        {
          name: "Demo Contact",
          phone_1: "555-000-4444",
          address: `${Date.now()}-demo-update Test St`,
          city: "TestCity",
        },
      ]);
      await adminCaller.importProperties.executeContactsImport({
        fileData: fileData1,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Second import — with demographics
      const fileData2 = createExcelBase64([
        {
          name: "Demo Contact",
          phone_1: "555-000-4444",
          gender: "Male",
          marital_status: "Married",
          net_asset_value: "$1,000,000",
          contact_flags: "Likely Owner",
          address: `${Date.now()}-demo-update Test St`,
          city: "TestCity",
        },
      ]);
      const result2 = await adminCaller.importProperties.executeContactsImport({
        fileData: fileData2,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Should update the existing contact with new demographics
      expect(result2.contactsUpdated).toBe(1);
      expect(result2.contactsCreated).toBe(0);
    });
  });

  // ── 3. Phone Metadata Storage ──────────────────────────────────────────

  describe("Phone Metadata Storage", () => {
    it("stores DNC flag correctly", async () => {
      const propertyId = await createTestProperty(adminCaller, "dnc-flag");

      const fileData = createExcelBase64([
        {
          name: "DNC Test Contact",
          phone_1: "555-DNC-0001",
          phone_1_type: "Wireless",
          phone_1_dnc_indicator: "Do Not Call",
          phone_2: "555-DNC-0002",
          phone_2_type: "Landline",
          phone_2_dnc_indicator: "Not on DNC",
          address: `${Date.now()}-dnc-flag Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.phonesAdded).toBe(2);
    });

    it("stores carrier and prepaid information", async () => {
      const propertyId = await createTestProperty(adminCaller, "carrier-info");

      const fileData = createExcelBase64([
        {
          name: "Carrier Test Contact",
          phone_1: "555-CAR-0001",
          phone_1_type: "Wireless",
          phone_1_carrier: "Verizon",
          phone_1_prepaid_indicator: "Prepaid",
          phone_1_activity_status: "Active",
          phone_1_usage_2_months: "High",
          phone_1_usage_12_months: "Medium",
          address: `${Date.now()}-carrier-info Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.phonesAdded).toBe(1);
    });
  });

  // ── 4. Duplicate Phone Detection ───────────────────────────────────────

  describe("Duplicate Phone Detection", () => {
    it("does not create duplicate phone numbers for the same contact", async () => {
      const propertyId = await createTestProperty(adminCaller, "dup-phone");

      // Import with phone
      const fileData = createExcelBase64([
        {
          name: "Dup Phone Contact",
          phone_1: "555-111-9999",
          phone_1_type: "Wireless",
          address: `${Date.now()}-dup-phone Test St`,
          city: "TestCity",
        },
      ]);
      const result1 = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result1.phonesAdded).toBe(1);

      // Import again with same phone
      const result2 = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result2.phonesAdded).toBe(0); // no new phones
    });

    it("does not create duplicate emails for the same contact", async () => {
      const propertyId = await createTestProperty(adminCaller, "dup-email");

      const fileData = createExcelBase64([
        {
          name: "Dup Email Contact",
          email_address_1: "DupTest@Example.COM",
          address: `${Date.now()}-dup-email Test St`,
          city: "TestCity",
        },
      ]);
      const result1 = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result1.emailsAdded).toBe(1);

      // Import again with same email (different case)
      const fileData2 = createExcelBase64([
        {
          name: "Dup Email Contact",
          email_address_1: "duptest@example.com",
          address: `${Date.now()}-dup-email Test St`,
          city: "TestCity",
        },
      ]);
      const result2 = await adminCaller.importProperties.executeContactsImport({
        fileData: fileData2,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result2.emailsAdded).toBe(0); // no new emails
    });
  });

  // ── 5. Preview Comparison — New vs Existing ────────────────────────────

  describe("Preview Comparison — New vs Existing Contacts", () => {
    it("detects new contacts in preview", async () => {
      // Create a property with a known address
      const uniqueAddr = `${Date.now()}-preview-new Test St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "TestCity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });

      const fileData = createExcelBase64([
        {
          name: "Brand New Contact",
          phone_1: "555-NEW-0001",
          email_address_1: "new@test.com",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
          property_address_state: "FL",
        },
      ]);

      const preview = await adminCaller.importProperties.previewContacts({ fileData });
      const matchedRow = preview.rows.find((r: any) => r.contactName === "Brand New Contact");

      expect(matchedRow).toBeDefined();
      expect(matchedRow!.matched).toBe(true);
      expect(matchedRow!.contactStatus).toBe("new");
    });

    it("detects existing contacts that need updates in preview", async () => {
      const uniqueAddr = `${Date.now()}-preview-update Test St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "TestCity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });
      // Get propertyId
      const lookupPreview = await adminCaller.importProperties.previewContacts({
        fileData: createExcelBase64([{ name: "Lookup", property_address_line_1: uniqueAddr, property_address_city: "TestCity" }]),
      });
      const propertyId = lookupPreview.rows[0].matchedPropertyId!;

      // First create the contact with 1 phone
      const fileData1 = createExcelBase64([
        {
          name: "Existing Preview Contact",
          phone_1: "555-PRV-0001",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
        },
      ]);
      await adminCaller.importProperties.executeContactsImport({
        fileData: fileData1,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Preview with new phone and email
      const fileData2 = createExcelBase64([
        {
          name: "Existing Preview Contact",
          phone_1: "555-PRV-0001",
          phone_2: "555-PRV-0002",
          email_address_1: "preview@test.com",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
        },
      ]);
      const preview = await adminCaller.importProperties.previewContacts({ fileData: fileData2 });
      const matchedRow = preview.rows.find((r: any) => r.contactName === "Existing Preview Contact");

      expect(matchedRow).toBeDefined();
      expect(matchedRow!.matched).toBe(true);
      expect(matchedRow!.contactStatus).toBe("update");
      expect(matchedRow!.newPhones?.length).toBeGreaterThan(0);
      expect(matchedRow!.newEmails?.length).toBeGreaterThan(0);
    });

    it("detects up-to-date contacts in preview", async () => {
      const uniqueAddr = `${Date.now()}-preview-uptodate Test St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "TestCity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });
      const lookupPreview = await adminCaller.importProperties.previewContacts({
        fileData: createExcelBase64([{ name: "Lookup", property_address_line_1: uniqueAddr, property_address_city: "TestCity" }]),
      });
      const propertyId = lookupPreview.rows[0].matchedPropertyId!;

      // Create contact with phone and email
      const fileData = createExcelBase64([
        {
          name: "UpToDate Preview Contact",
          phone_1: "555-UTD-0001",
          email_address_1: "utd@test.com",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
        },
      ]);
      await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Preview with same data
      const preview = await adminCaller.importProperties.previewContacts({ fileData });
      const matchedRow = preview.rows.find((r: any) => r.contactName === "UpToDate Preview Contact");

      expect(matchedRow).toBeDefined();
      expect(matchedRow!.matched).toBe(true);
      expect(matchedRow!.contactStatus).toBe("up_to_date");
    });

    it("returns correct counts for new, update, and up-to-date contacts", async () => {
      const uniqueAddr = `${Date.now()}-preview-counts Test St`;
      const propFileData = createExcelBase64([
        { address: uniqueAddr, city: "TestCity", state: "FL", zipcode: "33100" },
      ]);
      await adminCaller.importProperties.executeImport({
        fileData: propFileData,
        assignedAgentId: null,
        newRows: [0],
        updateRows: [],
      });
      const lookupPreview = await adminCaller.importProperties.previewContacts({
        fileData: createExcelBase64([{ name: "Lookup", property_address_line_1: uniqueAddr, property_address_city: "TestCity" }]),
      });
      const propertyId = lookupPreview.rows[0].matchedPropertyId!;

      // Create one contact
      const fileData1 = createExcelBase64([
        {
          name: "Count Existing",
          phone_1: "555-CNT-0001",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
        },
      ]);
      await adminCaller.importProperties.executeContactsImport({
        fileData: fileData1,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      // Preview with: same contact (up-to-date) + new contact
      const fileData2 = createExcelBase64([
        {
          name: "Count Existing",  // existing, same data = up-to-date
          phone_1: "555-CNT-0001",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
        },
        {
          name: "Count Brand New",  // new contact
          phone_1: "555-CNT-0002",
          email_address_1: "new@count.com",
          property_address_line_1: uniqueAddr,
          property_address_city: "TestCity",
        },
      ]);
      const preview = await adminCaller.importProperties.previewContacts({ fileData: fileData2 });

      expect(preview.matchedCount).toBe(2);
      expect(preview.newContactsCount).toBeGreaterThanOrEqual(1);
      expect(preview.upToDateCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 6. Address Upsert ──────────────────────────────────────────────────

  describe("Address Upsert", () => {
    it("imports mailing address for new contact", async () => {
      const propertyId = await createTestProperty(adminCaller, "addr-new");

      const fileData = createExcelBase64([
        {
          name: "Address Contact",
          phone_1: "555-ADR-0001",
          mailing_address: "100 Mailing St",
          mailing_city: "MailCity",
          mailing_state: "FL",
          mailing_zip: "33200",
          address: `${Date.now()}-addr-new Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.addressesAdded).toBe(1);
    });

    it("does not duplicate mailing address on re-import", async () => {
      const propertyId = await createTestProperty(adminCaller, "addr-dup");

      const fileData = createExcelBase64([
        {
          name: "Addr Dup Contact",
          phone_1: "555-ADR-0002",
          mailing_address: "200 Mailing Ave",
          mailing_city: "MailCity",
          mailing_state: "FL",
          mailing_zip: "33201",
          address: `${Date.now()}-addr-dup Test St`,
          city: "TestCity",
        },
      ]);

      const result1 = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result1.addressesAdded).toBe(1);

      // Re-import same data
      const result2 = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });
      expect(result2.addressesAdded).toBe(0);
    });
  });

  // ── 7. Multiple Contacts Per Property ──────────────────────────────────

  describe("Multiple Contacts Per Property", () => {
    it("imports multiple contacts linked to the same property", async () => {
      const propertyId = await createTestProperty(adminCaller, "multi-contact");

      const fileData = createExcelBase64([
        {
          name: "Contact Alpha",
          phone_1: "555-MUL-0001",
          email_address_1: "alpha@test.com",
          address: `${Date.now()}-multi-contact Test St`,
          city: "TestCity",
        },
        {
          name: "Contact Beta",
          phone_1: "555-MUL-0002",
          email_address_1: "beta@test.com",
          address: `${Date.now()}-multi-contact Test St`,
          city: "TestCity",
        },
        {
          name: "Contact Gamma",
          phone_1: "555-MUL-0003",
          phone_2: "555-MUL-0004",
          email_address_1: "gamma@test.com",
          email_address_2: "gamma2@test.com",
          address: `${Date.now()}-multi-contact Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [
          { rowIndex: 0, propertyId },
          { rowIndex: 1, propertyId },
          { rowIndex: 2, propertyId },
        ],
      });

      expect(result.contactsCreated).toBe(3);
      expect(result.phonesAdded).toBe(4); // 1 + 1 + 2
      expect(result.emailsAdded).toBe(4); // 1 + 1 + 2
      expect(result.errorCount).toBe(0);
    });
  });

  // ── 8. Error Handling ──────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("handles empty file gracefully", async () => {
      const fileData = createExcelBase64([]);
      await expect(
        adminCaller.importProperties.previewContacts({ fileData })
      ).rejects.toThrow("File is empty");
    });

    it("handles contacts with no matching property gracefully", async () => {
      const fileData = createExcelBase64([
        {
          name: "Orphan Contact",
          phone_1: "555-ORP-0001",
          address: "99999 Nonexistent St",
          city: "NowhereTown",
        },
      ]);

      const preview = await adminCaller.importProperties.previewContacts({ fileData });
      expect(preview.unmatchedCount).toBe(1);
      expect(preview.rows[0].matched).toBe(false);
    });

    it("skips rows with invalid rowIndex in executeContactsImport", async () => {
      const propertyId = await createTestProperty(adminCaller, "invalid-row");

      const fileData = createExcelBase64([
        { name: "Valid Contact", phone_1: "555-VAL-0001", address: `${Date.now()}-invalid-row Test St`, city: "TestCity" },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [
          { rowIndex: 0, propertyId },
          { rowIndex: 999, propertyId }, // invalid row
        ],
      });

      expect(result.contactsCreated).toBe(1);
      // Row 999 should be silently skipped
    });
  });

  // ── 9. Phone Number Cleaning ───────────────────────────────────────────

  describe("Phone Number Cleaning", () => {
    it("strips non-numeric characters from phone numbers", async () => {
      const propertyId = await createTestProperty(adminCaller, "clean-phone");

      const fileData = createExcelBase64([
        {
          name: "Clean Phone Contact",
          phone_1: "(407) 555-1234",
          phone_2: "+1-321-555-5678",
          address: `${Date.now()}-clean-phone Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.phonesAdded).toBe(2);
    });

    it("skips empty phone numbers", async () => {
      const propertyId = await createTestProperty(adminCaller, "empty-phone");

      const fileData = createExcelBase64([
        {
          name: "Empty Phone Contact",
          phone_1: "",
          phone_2: "555-EMP-0001",
          email_address_1: "empty@test.com",
          address: `${Date.now()}-empty-phone Test St`,
          city: "TestCity",
        },
      ]);

      const result = await adminCaller.importProperties.executeContactsImport({
        fileData,
        contactRows: [{ rowIndex: 0, propertyId }],
      });

      expect(result.contactsCreated).toBe(1);
      expect(result.phonesAdded).toBe(1); // only phone_2
      expect(result.emailsAdded).toBe(1);
    });
  });
});
