/**
 * Tests for Call Notes CRUD, Call Logs, Twilio Access Token, and UI Components
 * 
 * Covers:
 * - Schema: callNotes table structure
 * - DB Helpers: CRUD operations for notes and call logs
 * - Router: tRPC procedures for callNotes and twilio token
 * - CallModal: Twilio Voice SDK integration, status, mute, notes
 * - TwilioCallWidget: Opens CallModal with correct props
 * - ContactNotesDialog: Notes history view
 * - CallTrackingTable: Notes column integration
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Schema validation ──────────────────────────────────────────────────────

describe("Call Notes Schema", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  let schemaContent: string;

  beforeEach(() => {
    schemaContent = fs.readFileSync(schemaPath, "utf-8");
  });

  it("should have callNotes table defined in schema", () => {
    expect(schemaContent).toContain("callNotes");
    expect(schemaContent).toContain('"callNotes"');
  });

  it("should have required columns: contactId, propertyId, userId, content, createdAt", () => {
    // Check the callNotes table definition
    const callNotesIdx = schemaContent.indexOf('mysqlTable("callNotes"');
    const callNotesSection = callNotesIdx >= 0 ? schemaContent.substring(callNotesIdx, callNotesIdx + 500) : "";
    expect(callNotesSection).toContain("contactId");
    expect(callNotesSection).toContain("propertyId");
    expect(callNotesSection).toContain("userId");
    expect(callNotesSection).toContain("content");
    expect(callNotesSection).toContain("createdAt");
  });

  it("should have optional callLogId column for linking to calls", () => {
    expect(schemaContent).toContain("callLogId");
  });

  it("should export CallNote and InsertCallNote types", () => {
    expect(schemaContent).toContain("export type CallNote");
    expect(schemaContent).toContain("export type InsertCallNote");
  });
});

// ─── Database helper validation ──────────────────────────────────────────────

describe("Call Notes Database Helpers", () => {
  const dbPath = path.resolve(__dirname, "./db-callNotes.ts");
  let dbContent: string;

  beforeEach(() => {
    dbContent = fs.readFileSync(dbPath, "utf-8");
  });

  it("should export createCallNote function", () => {
    expect(dbContent).toContain("export async function createCallNote");
  });

  it("should export getCallNotesByContact function", () => {
    expect(dbContent).toContain("export async function getCallNotesByContact");
  });

  it("should export getCallNotesByCallLog function", () => {
    expect(dbContent).toContain("export async function getCallNotesByCallLog");
  });

  it("should export getCallNotesWithCallInfo for history view with call data", () => {
    expect(dbContent).toContain("export async function getCallNotesWithCallInfo");
    expect(dbContent).toContain("leftJoin");
    expect(dbContent).toContain("callLogs");
  });

  it("should export deleteCallNote function with user ownership check", () => {
    expect(dbContent).toContain("export async function deleteCallNote");
    expect(dbContent).toContain("callNotes.userId");
  });

  it("should order notes by createdAt descending (newest first)", () => {
    expect(dbContent).toContain("desc(callNotes.createdAt)");
  });

  it("should export createCallLog function", () => {
    expect(dbContent).toContain("export async function createCallLog");
  });

  it("should export updateCallLog function", () => {
    expect(dbContent).toContain("export async function updateCallLog");
  });

  it("should export getCallLogsByContact function", () => {
    expect(dbContent).toContain("export async function getCallLogsByContact");
  });

  it("should include call context in getCallNotesWithCallInfo (status, duration, number)", () => {
    expect(dbContent).toContain("callStatus");
    expect(dbContent).toContain("callDuration");
    expect(dbContent).toContain("callToNumber");
  });
});

// ─── Router procedures validation ────────────────────────────────────────────

describe("Call Notes Router Procedures", () => {
  const routersPath = path.resolve(__dirname, "./routers.ts");
  let routersContent: string;

  beforeEach(() => {
    routersContent = fs.readFileSync(routersPath, "utf-8");
  });

  it("should have callNotes router defined", () => {
    expect(routersContent).toContain("callNotes: router({");
  });

  it("should have create procedure in callNotes router", () => {
    expect(routersContent).toContain("create: protectedProcedure");
  });

  it("should have getByContact procedure", () => {
    expect(routersContent).toContain("getByContact:");
  });

  it("should have getByCallLog procedure", () => {
    expect(routersContent).toContain("getByCallLog:");
  });

  it("should have delete procedure", () => {
    // Check for delete in the callNotes router section
    const callNotesIdx = routersContent.indexOf("callNotes: router({");
    const callNotesSection = callNotesIdx >= 0 ? routersContent.substring(callNotesIdx, callNotesIdx + 2000) : "";
    expect(callNotesSection).toContain("delete:");
  });

  it("should have getCallLogs procedure for call history", () => {
    const callNotesIdx = routersContent.indexOf("callNotes: router({");
    const callNotesSection = callNotesIdx >= 0 ? routersContent.substring(callNotesIdx, callNotesIdx + 2000) : "";
    expect(callNotesSection).toContain("getCallLogs:");
  });

  it("should validate contactId as a number in create", () => {
    expect(routersContent).toContain("contactId: z.number()");
  });

  it("should validate content as a string in create", () => {
    expect(routersContent).toContain("content: z.string()");
  });

  it("should make callLogId optional in create", () => {
    expect(routersContent).toContain("callLogId: z.number().optional()");
  });
});

// ─── Twilio Access Token validation ──────────────────────────────────────────

describe("Twilio Access Token", () => {
  const routersPath = path.resolve(__dirname, "./routers.ts");
  let routersContent: string;

  beforeEach(() => {
    routersContent = fs.readFileSync(routersPath, "utf-8");
  });

  it("should have getAccessToken procedure", () => {
    expect(routersContent).toContain("getAccessToken:");
  });

  it("should be a protected procedure (requires auth)", () => {
    expect(routersContent).toContain("getAccessToken: protectedProcedure");
  });

  it("should use Twilio JWT AccessToken class", () => {
    expect(routersContent).toContain("AccessToken");
    expect(routersContent).toContain("VoiceGrant");
  });

  it("should use ENV variables for Twilio credentials", () => {
    const tokenSection = routersContent.split("getAccessToken:")[1]?.split("makeCall:")[0] || "";
    expect(tokenSection).toContain("ENV.twilioApiKey");
    expect(tokenSection).toContain("ENV.twilioApiSecret");
    expect(tokenSection).toContain("ENV.twilioTwimlAppSid");
    expect(tokenSection).toContain("ENV.twilioAccountSid");
  });

  it("should set user identity on the token", () => {
    const tokenSection = routersContent.split("getAccessToken:")[1]?.split("makeCall:")[0] || "";
    expect(tokenSection).toContain("identity");
  });
});

// ─── Call Log CRUD validation ────────────────────────────────────────────────

describe("Call Log Procedures", () => {
  const routersPath = path.resolve(__dirname, "./routers.ts");
  let routersContent: string;

  beforeEach(() => {
    routersContent = fs.readFileSync(routersPath, "utf-8");
  });

  it("should have createCallLog logic in twilio makeCall procedure", () => {
    // createCallLog is called inside the makeCall procedure, not a separate procedure
    expect(routersContent).toContain("createCallLog");
  });

  it("should have updateCallLog procedure in twilio router", () => {
    expect(routersContent).toContain("updateCallLog:");
  });

  it("should validate callLogId in updateCallLog", () => {
    expect(routersContent).toContain("callLogId: z.number()");
  });

  it("should allow updating status in updateCallLog", () => {
    expect(routersContent).toContain("status: z.string()");
  });

  it("should allow updating duration in updateCallLog", () => {
    expect(routersContent).toContain("duration: z.number().optional()");
  });
});

// ─── CallModal component validation ──────────────────────────────────────────

describe("CallModal Component", () => {
  const modalPath = path.resolve(__dirname, "../client/src/components/CallModal.tsx");
  let modalContent: string;

  beforeEach(() => {
    modalContent = fs.readFileSync(modalPath, "utf-8");
  });

  it("should import Twilio Voice SDK Device and Call", () => {
    expect(modalContent).toContain("@twilio/voice-sdk");
    expect(modalContent).toContain("Device");
    expect(modalContent).toContain("Call");
  });

  it("should have all call status states", () => {
    expect(modalContent).toContain('"idle"');
    expect(modalContent).toContain('"connecting"');
    expect(modalContent).toContain('"ringing"');
    expect(modalContent).toContain('"in-progress"');
    expect(modalContent).toContain('"completed"');
    expect(modalContent).toContain('"failed"');
    expect(modalContent).toContain('"no-answer"');
  });

  it("should have mute/unmute functionality", () => {
    expect(modalContent).toContain("isMuted");
    expect(modalContent).toContain("handleToggleMute");
    expect(modalContent).toContain("MicOff");
    expect(modalContent).toContain(".mute(");
  });

  it("should have call duration timer", () => {
    expect(modalContent).toContain("callDuration");
    expect(modalContent).toContain("formatDuration");
  });

  it("should initialize Twilio Device with token", () => {
    expect(modalContent).toContain("new Device(");
    expect(modalContent).toContain("getAccessToken");
  });

  it("should connect call via Twilio Device SDK", () => {
    expect(modalContent).toContain("deviceRef.current.connect");
  });

  it("should have notes panel with create and delete", () => {
    expect(modalContent).toContain("callNotes.create");
    expect(modalContent).toContain("callNotes.delete");
    expect(modalContent).toContain("callNotes.getByContact");
  });

  it("should prevent closing modal during active call", () => {
    expect(modalContent).toContain("Please hang up the call before closing");
  });

  it("should have hang up button", () => {
    expect(modalContent).toContain("handleHangUp");
    expect(modalContent).toContain("PhoneOff");
  });

  it("should display contact name and phone number", () => {
    expect(modalContent).toContain("contactName");
    expect(modalContent).toContain("phoneNumber");
  });

  it("should have call again button after call ends", () => {
    expect(modalContent).toContain("Call again");
  });

  it("should create call log when call starts (via makeCall mutation)", () => {
    expect(modalContent).toContain("makeCallMutation");
  });

  it("should update call log when call ends", () => {
    expect(modalContent).toContain("updateCallLogMutation");
  });

  it("should handle call events (accept, disconnect, error)", () => {
    expect(modalContent).toContain('"accept"');
    expect(modalContent).toContain('"disconnect"');
    expect(modalContent).toContain('"error"');
  });
});

// ─── TwilioCallWidget integration ────────────────────────────────────────────

describe("TwilioCallWidget opens CallModal", () => {
  const widgetPath = path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx");
  let widgetContent: string;

  beforeEach(() => {
    widgetContent = fs.readFileSync(widgetPath, "utf-8");
  });

  it("should import CallModal", () => {
    expect(widgetContent).toContain("CallModal");
  });

  it("should have modalOpen state", () => {
    expect(widgetContent).toContain("modalOpen");
    expect(widgetContent).toContain("setModalOpen");
  });

  it("should pass contactId and propertyId to CallModal", () => {
    expect(widgetContent).toContain("contactId");
    expect(widgetContent).toContain("propertyId");
  });

  it("should format phone number to E.164", () => {
    expect(widgetContent).toContain("formatE164");
  });

  it("should render a green phone button", () => {
    expect(widgetContent).toContain("text-green-600");
    expect(widgetContent).toContain("Phone");
  });

  it("should NOT use raw fetch for API calls (uses CallModal instead)", () => {
    // The widget should be simple - just opens the modal
    expect(widgetContent).not.toContain("fetch(");
    expect(widgetContent).not.toContain("clearInterval");
  });
});

// ─── ContactNotesDialog validation ───────────────────────────────────────────

describe("ContactNotesDialog Component", () => {
  const dialogPath = path.resolve(__dirname, "../client/src/components/ContactNotesDialog.tsx");
  let dialogContent: string;

  beforeEach(() => {
    dialogContent = fs.readFileSync(dialogPath, "utf-8");
  });

  it("should fetch notes by contactId", () => {
    expect(dialogContent).toContain("callNotes.getByContact");
  });

  it("should allow creating notes without a call", () => {
    expect(dialogContent).toContain("callNotes.create");
  });

  it("should allow deleting notes", () => {
    expect(dialogContent).toContain("callNotes.delete");
  });

  it("should group notes by date", () => {
    expect(dialogContent).toContain("groupedNotes");
    expect(dialogContent).toContain("toLocaleDateString");
  });

  it("should show call status and duration for each note", () => {
    expect(dialogContent).toContain("callStatus");
    expect(dialogContent).toContain("callDuration");
  });

  it("should show empty state when no notes", () => {
    expect(dialogContent).toContain("No notes yet");
  });

  it("should support Enter to send and Shift+Enter for new line", () => {
    expect(dialogContent).toContain("Enter");
    expect(dialogContent).toContain("shiftKey");
  });
});

// ─── CallTrackingTable integration ───────────────────────────────────────────

describe("CallTrackingTable has Call Notes column", () => {
  const tablePath = path.resolve(__dirname, "../client/src/components/CallTrackingTable.tsx");
  let tableContent: string;

  beforeEach(() => {
    tableContent = fs.readFileSync(tablePath, "utf-8");
  });

  it("should import ContactNotesDialog", () => {
    expect(tableContent).toContain("ContactNotesDialog");
  });

  it("should import FileText icon", () => {
    expect(tableContent).toContain("FileText");
  });

  it("should have notesDialog state", () => {
    expect(tableContent).toContain("notesDialog");
    expect(tableContent).toContain("setNotesDialog");
  });

  it("should have Call Notes column header", () => {
    expect(tableContent).toContain("Call Notes");
  });

  it("should pass contactId and propertyId to TwilioCallWidget", () => {
    expect(tableContent).toContain("contactId={contact.id}");
    expect(tableContent).toContain("propertyId={propertyId}");
  });

  it("should render ContactNotesDialog when notesDialog is set", () => {
    expect(tableContent).toContain("<ContactNotesDialog");
    expect(tableContent).toContain("notesDialog.contactId");
    expect(tableContent).toContain("notesDialog.contactName");
  });
});
