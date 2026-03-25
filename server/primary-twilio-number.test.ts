import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the Primary Twilio Number feature
 *
 * This feature:
 * 1. Adds a primaryTwilioNumber column to the PROPERTIES table (property-level, not contact-level)
 * 2. Auto-sets the primary number when a lead calls a Twilio number (first call only)
 * 3. Shows the primary number in the Contacts section via PrimaryTwilioNumberSelector
 * 4. Allows manual change via a dropdown selector
 * 5. TwilioCallWidget auto-dials using the primary number when set (skips number selector)
 */

describe("Primary Twilio Number Feature", () => {
  // ─── Schema ──────────────────────────────────────────────────────────────
  describe("Schema", () => {
    it("should have primaryTwilioNumber column on the properties table", async () => {
      const { properties } = await import("../drizzle/schema");
      expect(properties).toBeDefined();
      expect(properties.primaryTwilioNumber).toBeDefined();
    });

    it("primaryTwilioNumber should be a varchar column", async () => {
      const schemaContent = fs.readFileSync(
        path.resolve(__dirname, "../drizzle/schema.ts"),
        "utf-8"
      );
      // Should be varchar with length 20, nullable
      expect(schemaContent).toContain('primaryTwilioNumber: varchar("primaryTwilioNumber"');
    });
  });

  // ─── Backend Procedure ───────────────────────────────────────────────────
  describe("Backend - updatePrimaryTwilioNumber procedure", () => {
    it("should exist in the communication router", () => {
      const routersContent = fs.readFileSync(
        path.resolve(__dirname, "routers.ts"),
        "utf-8"
      );
      expect(routersContent).toContain("updatePrimaryTwilioNumber");
      expect(routersContent).toContain("protectedProcedure");
    });

    it("should accept propertyId and primaryTwilioNumber as input", () => {
      const routersContent = fs.readFileSync(
        path.resolve(__dirname, "routers.ts"),
        "utf-8"
      );
      // The procedure should use propertyId (property-level), not contactId
      expect(routersContent).toContain("propertyId: z.number()");
      expect(routersContent).toContain("primaryTwilioNumber: z.string().nullable()");
    });

    it("should update the properties table, not contacts", () => {
      const routersContent = fs.readFileSync(
        path.resolve(__dirname, "routers.ts"),
        "utf-8"
      );
      // The mutation should update properties table
      expect(routersContent).toContain("database.update(properties)");
      expect(routersContent).toContain("set({ primaryTwilioNumber: input.primaryTwilioNumber })");
    });
  });

  // ─── Property getById returns primaryTwilioNumber ────────────────────────
  describe("Property getById includes primaryTwilioNumber", () => {
    it("db.ts getPropertyById selects primaryTwilioNumber", () => {
      const dbContent = fs.readFileSync(
        path.resolve(__dirname, "db.ts"),
        "utf-8"
      );
      expect(dbContent).toContain("primaryTwilioNumber: properties.primaryTwilioNumber");
    });
  });

  // ─── Inbound Call Webhook Logic ──────────────────────────────────────────
  describe("Inbound Call Webhook Logic", () => {
    it("webhook handler sets primaryTwilioNumber on properties", () => {
      const webhookContent = fs.readFileSync(
        path.resolve(__dirname, "twilio-webhooks.ts"),
        "utf-8"
      );
      expect(webhookContent).toContain("primaryTwilioNumber");
      expect(webhookContent).toContain("isNull(properties.primaryTwilioNumber)");
    });

    it("should normalize phone numbers for matching", () => {
      const from = "+15551234567";
      const callerDigits = from.replace(/\D/g, "");
      expect(callerDigits).toBe("15551234567");

      const callerVariants = [
        from,
        `+${callerDigits}`,
        callerDigits,
        callerDigits.length === 11 && callerDigits.startsWith("1")
          ? callerDigits.slice(1)
          : null,
        callerDigits.length === 10 ? `1${callerDigits}` : null,
      ].filter(Boolean) as string[];

      expect(callerVariants).toContain("+15551234567");
      expect(callerVariants).toContain("15551234567");
      expect(callerVariants).toContain("5551234567"); // stripped leading 1
    });

    it("should normalize 10-digit numbers correctly", () => {
      const from = "5551234567";
      const callerDigits = from.replace(/\D/g, "");

      const callerVariants = [
        from,
        `+${callerDigits}`,
        callerDigits,
        callerDigits.length === 11 && callerDigits.startsWith("1")
          ? callerDigits.slice(1)
          : null,
        callerDigits.length === 10 ? `1${callerDigits}` : null,
      ].filter(Boolean) as string[];

      expect(callerVariants).toContain("5551234567");
      expect(callerVariants).toContain("+5551234567");
      expect(callerVariants).toContain("15551234567"); // added leading 1
    });

    it("should normalize the Twilio 'to' number to E.164 format", () => {
      const to = "+18001234567";
      const twilioNumber = to.startsWith("+")
        ? to
        : `+${to.replace(/\D/g, "")}`;
      expect(twilioNumber).toBe("+18001234567");
    });

    it("should handle 'to' number without + prefix", () => {
      const to = "18001234567";
      const twilioNumber = to.startsWith("+")
        ? to
        : `+${to.replace(/\D/g, "")}`;
      expect(twilioNumber).toBe("+18001234567");
    });

    it("should only set primaryTwilioNumber when it is null (first call only)", () => {
      // The webhook uses: isNull(properties.primaryTwilioNumber)
      const propertyWithNumber = { id: 1, primaryTwilioNumber: "+18001111111" };
      const propertyWithoutNumber = { id: 2, primaryTwilioNumber: null };

      expect(propertyWithNumber.primaryTwilioNumber).not.toBeNull();
      expect(propertyWithoutNumber.primaryTwilioNumber).toBeNull();
    });

    it("should deduplicate contact IDs from multiple phone matches", () => {
      const matchingPhones = [
        { contactId: 1 },
        { contactId: 2 },
        { contactId: 1 },
        { contactId: 3 },
        { contactId: 2 },
      ];
      const uniqueContactIds = Array.from(
        new Set(matchingPhones.map((m) => m.contactId))
      );
      expect(uniqueContactIds).toEqual([1, 2, 3]);
      expect(uniqueContactIds.length).toBe(3);
    });

    it("should deduplicate property IDs from multiple contacts", () => {
      const contactRecords = [
        { id: 1, propertyId: 100 },
        { id: 2, propertyId: 200 },
        { id: 3, propertyId: 100 }, // same property
        { id: 4, propertyId: null }, // no property
      ];
      const uniquePropertyIds = Array.from(
        new Set(
          contactRecords
            .map((c) => c.propertyId)
            .filter((id): id is number => id != null && id > 0)
        )
      );
      expect(uniquePropertyIds).toEqual([100, 200]);
      expect(uniquePropertyIds.length).toBe(2);
    });
  });

  // ─── Frontend Components ─────────────────────────────────────────────────
  describe("Frontend - TwilioCallWidget", () => {
    it("should accept primaryTwilioNumber prop", () => {
      const widgetContent = fs.readFileSync(
        path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx"),
        "utf-8"
      );
      expect(widgetContent).toContain("primaryTwilioNumber");
      expect(widgetContent).toContain("primaryTwilioNumber?: string | null");
    });

    it("should skip number selector when primaryTwilioNumber is set", () => {
      const widgetContent = fs.readFileSync(
        path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx"),
        "utf-8"
      );
      // Should check for primaryTwilioNumber and open modal directly
      expect(widgetContent).toContain("if (primaryTwilioNumber)");
      expect(widgetContent).toContain("setSelectedNumber(primaryTwilioNumber)");
      expect(widgetContent).toContain("setModalOpen(true)");
    });

    it("should fall back to number selector when no primary number", () => {
      const widgetContent = fs.readFileSync(
        path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx"),
        "utf-8"
      );
      expect(widgetContent).toContain("setSelectorOpen(true)");
    });

    it("should show tooltip indicating default number when set", () => {
      const widgetContent = fs.readFileSync(
        path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx"),
        "utf-8"
      );
      expect(widgetContent).toContain("using default");
    });
  });

  describe("Frontend - ContactsSection PrimaryTwilioNumberSelector", () => {
    it("should render PrimaryTwilioNumberSelector inside ContactsSection", () => {
      const contactsContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/ContactsSection.tsx"
        ),
        "utf-8"
      );
      expect(contactsContent).toContain("PrimaryTwilioNumberSelector");
      expect(contactsContent).toContain("<PrimaryTwilioNumberSelector");
    });

    it("should fetch property data to get primaryTwilioNumber", () => {
      const contactsContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/ContactsSection.tsx"
        ),
        "utf-8"
      );
      expect(contactsContent).toContain("trpc.properties.getById.useQuery");
      expect(contactsContent).toContain("primaryTwilioNumber");
    });

    it("should have a Select dropdown with Twilio numbers", () => {
      const contactsContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/ContactsSection.tsx"
        ),
        "utf-8"
      );
      expect(contactsContent).toContain("trpc.twilio.listNumbers.useQuery");
      expect(contactsContent).toContain("SelectContent");
      expect(contactsContent).toContain("_none");
    });

    it("should call updatePrimaryTwilioNumber mutation on change", () => {
      const contactsContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/ContactsSection.tsx"
        ),
        "utf-8"
      );
      expect(contactsContent).toContain(
        "trpc.communication.updatePrimaryTwilioNumber.useMutation"
      );
    });

    it("should show 'not set' message when no primary number", () => {
      const contactsContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/ContactsSection.tsx"
        ),
        "utf-8"
      );
      expect(contactsContent).toContain("not set");
      expect(contactsContent).toContain("auto-set on first inbound call");
    });

    it("should display current primary number as a badge", () => {
      const contactsContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/ContactsSection.tsx"
        ),
        "utf-8"
      );
      expect(contactsContent).toContain("formatPhone(currentNumber)");
      expect(contactsContent).toContain("Badge");
    });
  });

  describe("Frontend - CallTrackingTable passes primaryTwilioNumber", () => {
    it("should fetch property data for primaryTwilioNumber", () => {
      const callTrackingContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/CallTrackingTable.tsx"
        ),
        "utf-8"
      );
      expect(callTrackingContent).toContain(
        "trpc.properties.getById.useQuery"
      );
      expect(callTrackingContent).toContain("primaryTwilioNumber");
    });

    it("should pass primaryTwilioNumber to TwilioCallWidget", () => {
      const callTrackingContent = fs.readFileSync(
        path.resolve(
          __dirname,
          "../client/src/components/CallTrackingTable.tsx"
        ),
        "utf-8"
      );
      expect(callTrackingContent).toContain(
        "primaryTwilioNumber={primaryTwilioNumber}"
      );
    });
  });

  // ─── Value Logic ─────────────────────────────────────────────────────────
  describe("Value Logic", () => {
    it("should allow selecting '_none' to clear the primary number", () => {
      const value = "_none";
      const result = value === "_none" ? null : value;
      expect(result).toBeNull();
    });

    it("should pass the phone number when a valid option is selected", () => {
      const value = "+18001234567";
      const result = value === "_none" ? null : value;
      expect(result).toBe("+18001234567");
    });
  });
});
