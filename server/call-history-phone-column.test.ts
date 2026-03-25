import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import fs from "fs";
import path from "path";

// ─── 1. Schema: communicationLog has twilioNumber and contactPhoneNumber columns ───

describe("Schema: communicationLog phone number columns", () => {
  it("communicationLog table has twilioNumber column", () => {
    const schemaContent = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    expect(schemaContent).toContain('twilioNumber: varchar("twilioNumber"');
  });

  it("communicationLog table has contactPhoneNumber column", () => {
    const schemaContent = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    expect(schemaContent).toContain('contactPhoneNumber: varchar("contactPhoneNumber"');
  });

  it("twilioNumber and contactPhoneNumber are varchar(20)", () => {
    const schemaContent = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    expect(schemaContent).toMatch(/twilioNumber.*varchar.*\{.*length:\s*20/);
    expect(schemaContent).toMatch(/contactPhoneNumber.*varchar.*\{.*length:\s*20/);
  });
});

// ─── 2. Backend: getCallHistory returns twilioNumber and contactPhoneNumber ───

describe("Backend: getCallHistory returns phone number fields", () => {
  it("getCallHistory select includes twilioNumber", () => {
    const communicationContent = fs.readFileSync(
      path.resolve(__dirname, "communication.ts"),
      "utf-8"
    );
    expect(communicationContent).toContain("twilioNumber: communicationLog.twilioNumber");
  });

  it("getCallHistory select includes contactPhoneNumber", () => {
    const communicationContent = fs.readFileSync(
      path.resolve(__dirname, "communication.ts"),
      "utf-8"
    );
    expect(communicationContent).toContain("contactPhoneNumber: communicationLog.contactPhoneNumber");
  });
});

// ─── 3. Router: addCommunicationLog accepts twilioNumber and contactPhoneNumber ───

describe("Router: addCommunicationLog input schema", () => {
  it("addCommunicationLog procedure accepts twilioNumber", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers.ts"),
      "utf-8"
    );
    // Find the addCommunicationLog section and check for twilioNumber
    const addCommLogSection = routersContent.substring(
      routersContent.indexOf("addCommunicationLog:"),
      routersContent.indexOf("addCommunicationLog:") + 2000
    );
    expect(addCommLogSection).toContain("twilioNumber: z.string().optional()");
  });

  it("addCommunicationLog procedure accepts contactPhoneNumber", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers.ts"),
      "utf-8"
    );
    const addCommLogSection = routersContent.substring(
      routersContent.indexOf("addCommunicationLog:"),
      routersContent.indexOf("addCommunicationLog:") + 2500
    );
    expect(addCommLogSection).toContain("contactPhoneNumber:");
    expect(addCommLogSection).toContain("z.string().optional()");
  });
});

// ─── 4. Twilio Webhooks: inbound call logs twilioNumber and contactPhoneNumber ───

describe("Twilio Webhooks: inbound call logging", () => {
  it("inbound voice webhook logs twilioNumber (the To number)", () => {
    const webhooksContent = fs.readFileSync(
      path.resolve(__dirname, "twilio-webhooks.ts"),
      "utf-8"
    );
    expect(webhooksContent).toContain("twilioNumber: to");
  });

  it("inbound voice webhook logs contactPhoneNumber (the From number)", () => {
    const webhooksContent = fs.readFileSync(
      path.resolve(__dirname, "twilio-webhooks.ts"),
      "utf-8"
    );
    expect(webhooksContent).toContain("contactPhoneNumber: from");
  });
});

// ─── 5. Frontend: CallHistory page shows Phone Number column ───

describe("Frontend: CallHistory page phone number column", () => {
  it("CallHistory page has Phone Number column header", () => {
    const callHistoryContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CallHistory.tsx"),
      "utf-8"
    );
    expect(callHistoryContent).toContain("Phone Number");
  });

  it("CallHistory page renders contactPhoneNumber", () => {
    const callHistoryContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CallHistory.tsx"),
      "utf-8"
    );
    expect(callHistoryContent).toContain("call.contactPhoneNumber");
  });

  it("CallHistory page renders twilioNumber as 'via' subtext", () => {
    const callHistoryContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CallHistory.tsx"),
      "utf-8"
    );
    expect(callHistoryContent).toContain("call.twilioNumber");
    expect(callHistoryContent).toContain("via {call.twilioNumber}");
  });

  it("CallHistory page has phoneNumber in SortField type", () => {
    const callHistoryContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CallHistory.tsx"),
      "utf-8"
    );
    expect(callHistoryContent).toContain('"phoneNumber"');
  });

  it("CallHistory page sorts by contactPhoneNumber", () => {
    const callHistoryContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CallHistory.tsx"),
      "utf-8"
    );
    expect(callHistoryContent).toContain('case "phoneNumber"');
    expect(callHistoryContent).toContain("a.contactPhoneNumber");
  });
});

// ─── 6. Frontend: CallTrackingTable passes twilioNumber when logging calls ───

describe("Frontend: CallTrackingTable passes phone numbers to log", () => {
  it("CallTrackingTable passes twilioNumber in logCommunicationMutation", () => {
    const callTrackingContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/CallTrackingTable.tsx"),
      "utf-8"
    );
    expect(callTrackingContent).toContain("twilioNumber: primaryTwilioNumber");
  });

  it("CallTrackingTable passes contactPhoneNumber in logCommunicationMutation", () => {
    const callTrackingContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/CallTrackingTable.tsx"),
      "utf-8"
    );
    expect(callTrackingContent).toContain("contactPhoneNumber:");
  });
});

// ─── 7. Frontend: CallModal passes phone numbers to log ───

describe("Frontend: CallModal passes phone numbers to log", () => {
  it("CallModal passes twilioNumber (callerPhone) in logCommunicationMutation", () => {
    const callModalContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/CallModal.tsx"),
      "utf-8"
    );
    expect(callModalContent).toContain("twilioNumber: callerPhone");
  });

  it("CallModal passes contactPhoneNumber in logCommunicationMutation", () => {
    const callModalContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/CallModal.tsx"),
      "utf-8"
    );
    expect(callModalContent).toContain("contactPhoneNumber: phoneNumber");
  });
});
