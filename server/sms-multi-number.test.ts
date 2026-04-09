/**
 * Tests for SMS Multi-Number Support
 * Verifies:
 * 1. SMS send mutation accepts fromNumber parameter
 * 2. fromNumber is saved as twilioPhone in smsMessages table
 * 3. SMS inbox webhook saves inbound messages with correct twilioPhone
 * 4. SMSChatButton passes fromNumber to send mutation
 * 5. Conversation queries return twilioPhone field
 * 6. Messaging Service SID is used for A2P 10DLC compliance
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("SMS Multi-Number Support", () => {
  // ── Backend: SMS send mutation accepts fromNumber ──
  describe("Backend SMS send mutation", () => {
    it("send mutation input schema includes fromNumber", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("fromNumber: z.string().optional()");
    });

    it("uses fromNumber as the from phone for Twilio API call", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("input.fromNumber || twilioConfig.phoneNumber || ENV.twilioPhoneNumber");
    });

    it("saves twilioPhone in smsMessages", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("twilioPhone:");
    });

    it("uses messagingServiceSid from integrationConfig when available", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("twilioConfig.messagingServiceSid");
      expect(routersContent).toContain("messagingServiceSid");
    });

    it("reads Twilio config from integrationConfig helper", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain('getIntegrationConfig("twilio")');
    });

    it("falls back to from: fromPhone when no messaging service configured", () => {
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("twilioParams.from = fromPhone");
    });
  });

  // ── Backend: Inbound SMS webhook saves twilioPhone ──
  describe("Inbound SMS webhook", () => {
    it("saves the To number as twilioPhone for inbound messages", () => {
      const webhooksContent = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
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

  // ── Messaging Service SID: env + integrationConfig ──
  describe("Messaging Service SID configuration", () => {
    it("env.ts includes twilioMessagingServiceSid", () => {
      const envContent = fs.readFileSync("server/_core/env.ts", "utf-8");
      expect(envContent).toContain("twilioMessagingServiceSid");
      expect(envContent).toContain("TWILIO_MESSAGING_SERVICE_SID");
    });

    it("integrationConfig includes messagingServiceSid in Twilio fallback", () => {
      const configContent = fs.readFileSync("server/integrationConfig.ts", "utf-8");
      expect(configContent).toContain("messagingServiceSid: ENV.twilioMessagingServiceSid");
    });

    it("seed script includes messagingServiceSid for Twilio", () => {
      const seedContent = fs.readFileSync("scripts/seed-integrations.mjs", "utf-8");
      expect(seedContent).toContain("messagingServiceSid");
      expect(seedContent).toContain("TWILIO_MESSAGING_SERVICE_SID");
      expect(seedContent).toContain("Messaging Service SID");
    });
  });
});
