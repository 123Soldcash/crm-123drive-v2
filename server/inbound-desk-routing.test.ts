import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const webhookPath = path.resolve(__dirname, "twilio-webhooks.ts");
const webhookContent = fs.readFileSync(webhookPath, "utf-8");

// Helper: extract the inbound call section (from "INBOUND CALL" to the end of the else block)
const inboundStart = webhookContent.indexOf("// ── INBOUND CALL (external caller → CRM) ──");
const inboundEnd = webhookContent.indexOf("// ─── Connect Webhook");
const inboundSection = webhookContent.slice(inboundStart, inboundEnd);

// ─── 1. Variable Scoping: matchedDeskNames must be accessible across try blocks ───
describe("Variable scoping: matchedDeskNames is accessible across try blocks", () => {
  it("matchedDeskNames is declared BEFORE the first try block", () => {
    // The variable should be declared before `try {` so it's accessible in the logging try block
    const deskNamesDecl = inboundSection.indexOf("let matchedDeskNames");
    const firstTry = inboundSection.indexOf("try {");
    expect(deskNamesDecl).toBeGreaterThan(-1);
    expect(firstTry).toBeGreaterThan(-1);
    expect(deskNamesDecl).toBeLessThan(firstTry);
  });

  it("matchedDeskNames is used in the logging section (communicationLog insert)", () => {
    const logSection = inboundSection.indexOf("insert(communicationLog).values");
    expect(logSection).toBeGreaterThan(-1);
    const logEnd = inboundSection.indexOf("});", logSection);
    const logInsert = inboundSection.slice(logSection, logEnd);
    expect(logInsert).toContain("matchedDeskNames");
  });
});

// ─── 2. Desk-Based Routing: Complete flow validation ───
describe("Desk-based routing flow", () => {
  it("imports all required schema tables: users, twilioNumbers, twilioNumberDesks, userDesks, desks", () => {
    expect(inboundSection).toContain("users: usersTable");
    expect(inboundSection).toContain("twilioNumbers: twilioNumbersTable");
    expect(inboundSection).toContain("twilioNumberDesks");
    expect(inboundSection).toContain("userDesks");
    expect(inboundSection).toContain("desks: desksTable");
  });

  it("imports required drizzle operators: eq, and, inArray", () => {
    expect(inboundSection).toContain('{ eq, and, inArray }');
  });

  it("Step 1: normalizes the called number for matching", () => {
    expect(inboundSection).toContain("calledNumber");
    expect(inboundSection).toContain("calledDigits");
    expect(inboundSection).toContain('replace(/\\D/g, "")');
  });

  it("Step 2: finds the matching Twilio number record from the database", () => {
    expect(inboundSection).toContain("allTwilioNumbers");
    expect(inboundSection).toContain(".select().from(twilioNumbersTable)");
    expect(inboundSection).toContain("matchedTwilioNumber");
    expect(inboundSection).toContain("allTwilioNumbers.find");
  });

  it("Step 3: queries twilioNumberDesks junction table for desk IDs", () => {
    expect(inboundSection).toContain(".from(twilioNumberDesks)");
    expect(inboundSection).toContain("eq(twilioNumberDesks.twilioNumberId, matchedTwilioNumber.id)");
    expect(inboundSection).toContain("deskIds = numberDeskRows.map(r => r.deskId)");
  });

  it("Step 4: resolves desk names from desks table for logging", () => {
    expect(inboundSection).toContain(".from(desksTable)");
    expect(inboundSection).toContain("inArray(desksTable.id, deskIds)");
    expect(inboundSection).toContain("matchedDeskNames = deskRows.map");
  });

  it("Step 5: queries userDesks junction table to find users in those desks", () => {
    expect(inboundSection).toContain(".from(userDesks)");
    expect(inboundSection).toContain("inArray(userDesks.deskId, deskIds)");
    expect(inboundSection).toContain("deskUserIds");
  });

  it("Step 6: filters to only Active users in the matching desks", () => {
    expect(inboundSection).toContain('eq(usersTable.status, "Active")');
    expect(inboundSection).toContain("inArray(usersTable.id, deskUserIds)");
  });

  it("Step 7: deduplicates user IDs from desk assignments", () => {
    expect(inboundSection).toContain("new Set(userDeskRows.map(r => r.userId))");
  });
});

// ─── 3. Fallback behavior ───
describe("Fallback behavior when no desk routing applies", () => {
  it("falls back to ALL active users when usersToRing is empty", () => {
    expect(inboundSection).toContain("if (usersToRing.length === 0)");
    // The fallback query should select all active users
    const fallbackIdx = inboundSection.indexOf("if (usersToRing.length === 0)");
    const fallbackSection = inboundSection.slice(fallbackIdx, fallbackIdx + 500);
    expect(fallbackSection).toContain('eq(usersTable.status, "Active")');
    // Should NOT have inArray filter (ring ALL active users)
    expect(fallbackSection).not.toContain("inArray(usersTable.id");
  });

  it("logs a warning when falling back to all users", () => {
    expect(inboundSection).toContain("FALLBACK: No desk-based users found");
  });

  it("logs a warning when no desks are assigned to the Twilio number", () => {
    expect(inboundSection).toContain("No desks assigned to Twilio number");
  });

  it("logs a warning when no users are assigned to the desks", () => {
    expect(inboundSection).toContain("No users assigned to desks");
  });
});

// ─── 4. TwiML generation ───
describe("TwiML generation for inbound calls", () => {
  it("creates a Dial verb with callerId set to the external caller's number", () => {
    expect(inboundSection).toContain("response.dial({");
    expect(inboundSection).toContain("callerId: from");
  });

  it("sets a 30-second timeout on the Dial", () => {
    expect(inboundSection).toContain("timeout: 30");
  });

  it("rings users as Client identities with crm-user-{id} pattern", () => {
    expect(inboundSection).toContain("dial.client(`crm-user-${user.id}`)");
  });

  it("has an action URL for inbound-status callback", () => {
    expect(inboundSection).toContain('action: "/api/twilio/inbound-status"');
  });

  it("plays unavailable message when no users are found", () => {
    expect(inboundSection).toContain("No agents are currently available");
    expect(inboundSection).toContain("response.hangup()");
  });

  it("handles database unavailability gracefully", () => {
    expect(inboundSection).toContain("System is temporarily unavailable");
  });

  it("has error catch fallback that rings crm-user-1", () => {
    expect(inboundSection).toContain('dial.client("crm-user-1")');
  });
});

// ─── 5. Communication log entry ───
describe("Communication log entry for inbound calls", () => {
  it("guards against undefined caller phone (ghost calls)", () => {
    expect(inboundSection).toContain('from !== "undefined"');
    expect(inboundSection).toContain('!from.startsWith("client:")');
  });

  it("logs the Twilio number that received the call", () => {
    const logSection = inboundSection.indexOf("insert(communicationLog).values");
    const logEnd = inboundSection.indexOf("});", logSection);
    const logInsert = inboundSection.slice(logSection, logEnd);
    expect(logInsert).toContain("twilioNumber: to");
  });

  it("logs the caller's phone number", () => {
    const logSection = inboundSection.indexOf("insert(communicationLog).values");
    const logEnd = inboundSection.indexOf("});", logSection);
    const logInsert = inboundSection.slice(logSection, logEnd);
    expect(logInsert).toContain("contactPhoneNumber: from");
  });

  it("logs the matched desk names", () => {
    const logSection = inboundSection.indexOf("insert(communicationLog).values");
    const logEnd = inboundSection.indexOf("});", logSection);
    const logInsert = inboundSection.slice(logSection, logEnd);
    expect(logInsert).toContain("deskName: matchedDeskNames");
  });

  it("sets direction to Inbound", () => {
    const logSection = inboundSection.indexOf("insert(communicationLog).values");
    const logEnd = inboundSection.indexOf("});", logSection);
    const logInsert = inboundSection.slice(logSection, logEnd);
    expect(logInsert).toContain('direction: "Inbound"');
  });
});

// ─── 6. Detailed logging for debugging ───
describe("Detailed logging for debugging desk routing", () => {
  it("logs matched Twilio number details", () => {
    expect(inboundSection).toContain("Matched Twilio number: ID=");
  });

  it("logs desk IDs found for the number", () => {
    expect(inboundSection).toContain("Desk IDs for this number:");
  });

  it("logs users assigned to the desks", () => {
    expect(inboundSection).toContain("Users assigned to these desks:");
  });

  it("logs the final desk routing decision with user IDs", () => {
    expect(inboundSection).toContain("DESK ROUTING: Ringing");
    expect(inboundSection).toContain("user IDs [");
  });
});

// ─── 7. Schema validation: junction tables exist ───
describe("Schema: junction tables for desk routing exist", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  it("twilioNumberDesks junction table exists with twilioNumberId and deskId", () => {
    expect(schemaContent).toContain('twilioNumberDesks = mysqlTable("twilioNumberDesks"');
    expect(schemaContent).toContain('twilioNumberId');
    expect(schemaContent).toContain('deskId');
  });

  it("userDesks junction table exists with userId and deskId", () => {
    expect(schemaContent).toContain('userDesks = mysqlTable("userDesks"');
    expect(schemaContent).toContain('userId');
    expect(schemaContent).toContain('deskId');
  });
});
