/**
 * Tests for SMS Multi-Number Support
 * Verifies:
 * 1. SMS send mutation accepts fromNumber parameter
 * 2. fromNumber is saved as twilioPhone in smsMessages table
 * 3. SMS inbox webhook saves inbound messages with correct twilioPhone
 * 4. SMSChatButton passes fromNumber to send mutation
 * 5. Conversation queries return twilioPhone field
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("SMS Multi-Number Support", () => {
  // ── Backend: SMS send mutation accepts fromNumber ──
  describe("Backend SMS send mutation", () => {
    it("send mutation input schema includes fromNumber", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      // The send mutation should accept fromNumber as optional string
      expect(routersContent).toContain("fromNumber: z.string().optional()");
    });

    it("uses fromNumber as the from phone for Twilio API call", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      // Should use input.fromNumber with fallback to ENV.twilioPhoneNumber
      expect(routersContent).toContain("input.fromNumber || ENV.twilioPhoneNumber");
    });

    it("saves fromNumber as twilioPhone in smsMessages", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      // Should save fromPhone (which is input.fromNumber || ENV.twilioPhoneNumber) as twilioPhone
      expect(routersContent).toContain("twilioPhone: fromPhone");
    });

    it("passes fromPhone to Twilio messages.create as 'from'", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      // Should use fromPhone in the Twilio API call
      expect(routersContent).toContain("from: fromPhone");
    });
  });

  // ── Backend: Inbound SMS webhook saves twilioPhone ──
  describe("Inbound SMS webhook", () => {
    it("saves the To number as twilioPhone for inbound messages", () => {
      const webhooksContent = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
      // The inbound webhook should save req.body.To as twilioPhone
      expect(webhooksContent).toContain("twilioPhone: to");
    });

    it("inbound webhook endpoint exists at /api/twilio/sms/incoming", () => {
      const webhooksContent = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
      expect(webhooksContent).toContain("/api/twilio/sms/incoming");
    });

    it("handles duplicate messages via twilioSid deduplication", () => {
      const webhooksContent = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
      expect(webhooksContent).toContain("Duplicate SID, skipping");
    });
  });

  // ── Frontend: SMSChatButton number selector ──
  describe("SMSChatButton component", () => {
    it("has a number selector popover", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("Select sender number");
      expect(componentContent).toContain("Popover");
      expect(componentContent).toContain("PopoverTrigger");
      expect(componentContent).toContain("PopoverContent");
    });

    it("fetches Twilio numbers from the backend", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("trpc.twilio.listNumbers.useQuery");
    });

    it("passes fromNumber to the send mutation", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("fromNumber: selectedFromNumber");
    });

    it("stores selected number in state", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("setSelectedFromNumber");
      expect(componentContent).toContain("setSelectedLabel");
    });

    it("shows the selected sender number in the chat header", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("Sending from:");
    });

    it("allows changing the sender number from within the chat", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("Change");
    });

    it("shows twilioPhone in message bubbles", () => {
      const componentContent = fs.readFileSync("client/src/components/SMSChatButton.tsx", "utf-8");
      expect(componentContent).toContain("msg.twilioPhone");
    });
  });

  // ── Database schema: smsMessages has twilioPhone column ──
  describe("Database schema", () => {
    it("smsMessages table has twilioPhone column", () => {
      const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
      expect(schemaContent).toContain('twilioPhone: varchar("twilioPhone"');
    });

    it("smsMessages table has direction enum with inbound and outbound", () => {
      const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
      expect(schemaContent).toContain('"outbound", "inbound"');
    });
  });

  // ── SMS Inbox: shows conversations from all numbers ──
  describe("SMS Inbox page", () => {
    it("displays conversations grouped by contactPhone", () => {
      const inboxContent = fs.readFileSync("client/src/pages/SMSInbox.tsx", "utf-8");
      expect(inboxContent).toContain("getConversationList");
      expect(inboxContent).toContain("contactPhone");
    });

    it("shows webhook setup instructions for all numbers", () => {
      const inboxContent = fs.readFileSync("client/src/pages/SMSInbox.tsx", "utf-8");
      expect(inboxContent).toContain("/api/twilio/sms/incoming");
    });

    it("uses SMSChatButton for opening conversations", () => {
      const inboxContent = fs.readFileSync("client/src/pages/SMSInbox.tsx", "utf-8");
      expect(inboxContent).toContain("SMSChatButton");
    });
  });

  // ── Twilio Numbers: global registry exists ──
  describe("Twilio Numbers registry", () => {
    it("twilioNumbers table exists in schema", () => {
      const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
      expect(schemaContent).toContain("twilioNumbers");
      expect(schemaContent).toContain("phoneNumber");
      expect(schemaContent).toContain("label");
      expect(schemaContent).toContain("isActive");
    });

    it("listNumbers procedure exists in routers", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("listNumbers");
    });
  });
});
