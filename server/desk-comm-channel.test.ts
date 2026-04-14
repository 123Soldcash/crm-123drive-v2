import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── 1. Schema: communicationLog has deskName column ───
describe("Schema: communicationLog has deskName column", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  it("communicationLog table includes deskName varchar column", () => {
    const tableStart = schemaContent.indexOf('communicationLog = mysqlTable("communicationLog"');
    expect(tableStart).toBeGreaterThan(-1);
    const tableEnd = schemaContent.indexOf("});", tableStart);
    const tableDef = schemaContent.slice(tableStart, tableEnd);
    expect(tableDef).toContain('deskName');
    expect(tableDef).toContain('varchar("deskName"');
  });
});

// ─── 2. UnifiedCommRecord type and desk-based filter logic ───
describe("Desk filter uses twilioNumber-to-desk junction mapping", () => {
  const commPath = path.resolve(__dirname, "communication.ts");
  const commContent = fs.readFileSync(commPath, "utf-8");

  const getFuncBody = () => {
    const funcStart = commContent.indexOf("export async function getUnifiedCommunications");
    const funcEnd = commContent.indexOf("export async function getUnifiedCommStats");
    return commContent.slice(funcStart, funcEnd);
  };

  it("UnifiedCommRecord type has deskName field", () => {
    const typeStart = commContent.indexOf("export type UnifiedCommRecord");
    expect(typeStart).toBeGreaterThan(-1);
    const typeEnd = commContent.indexOf("};", typeStart);
    const typeDef = commContent.slice(typeStart, typeEnd);
    expect(typeDef).toContain("deskName");
  });

  it("getUnifiedCommunications accepts deskFilter parameter", () => {
    const funcStart = commContent.indexOf("export async function getUnifiedCommunications");
    const funcSignatureEnd = commContent.indexOf("): Promise", funcStart);
    const funcSignature = commContent.slice(funcStart, funcSignatureEnd);
    expect(funcSignature).toContain("deskFilter");
  });

  it("imports twilioNumbers, twilioNumberDesks, and desks tables", () => {
    const body = getFuncBody();
    expect(body).toContain("twilioNumbers");
    expect(body).toContain("twilioNumberDesks");
    expect(body).toContain("desks: desksTable");
  });

  it("builds a phoneToDesks map from junction table", () => {
    const body = getFuncBody();
    expect(body).toContain("phoneToDesks");
    expect(body).toContain("new Map<string, string[]>()");
  });

  it("queries allDeskMappings with innerJoin on twilioNumberDesks, desks, and twilioNumbers", () => {
    const body = getFuncBody();
    expect(body).toContain("allDeskMappings");
    expect(body).toContain(".from(twilioNumberDesks)");
    expect(body).toContain(".innerJoin(desksTable");
    expect(body).toContain(".innerJoin(twilioNumbers");
  });

  it("resolves deskTwilioPhones when deskFilter is active", () => {
    const body = getFuncBody();
    expect(body).toContain("deskTwilioPhones");
    expect(body).toContain("filters.deskFilter");
  });

  it("call filter uses OR condition: deskName match OR twilioNumber in desk phones", () => {
    const body = getFuncBody();
    // Should use or() with eq(deskName) and inArray(twilioNumber)
    expect(body).toContain("or(");
    expect(body).toContain("eq(communicationLog.deskName, filters.deskFilter)");
    expect(body).toContain("inArray(communicationLog.twilioNumber, deskTwilioPhones)");
  });

  it("SMS filter uses inArray on twilioPhone for desk filtering", () => {
    const body = getFuncBody();
    expect(body).toContain("inArray(smsMessages.twilioPhone, deskTwilioPhones)");
  });

  it("enriches call deskName from phoneToDesks when record has no saved deskName", () => {
    const body = getFuncBody();
    expect(body).toContain("resolvedDeskName = c.deskName");
    expect(body).toContain("phoneToDesks.has(c.twilioNumber)");
    expect(body).toContain("phoneToDesks.get(c.twilioNumber)");
  });

  it("enriches SMS deskName from phoneToDesks based on twilioNumber", () => {
    const body = getFuncBody();
    expect(body).toContain("resolvedDeskName: string | null = null");
    expect(body).toContain("phoneToDesks.has(s.twilioNumber)");
    expect(body).toContain("phoneToDesks.get(s.twilioNumber)");
  });

  it("call records query still selects deskName from communicationLog", () => {
    const body = getFuncBody();
    expect(body).toContain("deskName: communicationLog.deskName");
  });
});

// ─── 3. Router: unified procedure accepts deskFilter ───
describe("Router: unified procedure accepts deskFilter", () => {
  const routersPath = path.resolve(__dirname, "routers.ts");
  const routersContent = fs.readFileSync(routersPath, "utf-8");

  it("callHistory.unified input schema includes deskFilter", () => {
    const unifiedStart = routersContent.indexOf("unified: protectedProcedure");
    expect(unifiedStart).toBeGreaterThan(-1);
    const inputEnd = routersContent.indexOf(".query(", unifiedStart);
    const inputSection = routersContent.slice(unifiedStart, inputEnd);
    expect(inputSection).toContain("deskFilter");
  });
});

// ─── 4. Twilio webhook logs deskName for inbound calls ───
describe("Twilio webhook logs deskName for inbound calls", () => {
  const webhookPath = path.resolve(__dirname, "twilio-webhooks.ts");
  const webhookContent = fs.readFileSync(webhookPath, "utf-8");

  it("inbound call log insert includes deskName field", () => {
    const insertStart = webhookContent.indexOf("insert(communicationLog).values");
    expect(insertStart).toBeGreaterThan(-1);
    const insertEnd = webhookContent.indexOf("});", insertStart);
    const insertSection = webhookContent.slice(insertStart, insertEnd);
    expect(insertSection).toContain("deskName");
    expect(insertSection).toContain("matchedDeskNames");
  });
});

// ─── 5. Frontend: CallHistory page has desk column and filter ───
describe("Frontend: CallHistory page has desk column and filter", () => {
  const callHistoryPath = path.resolve(__dirname, "../client/src/pages/CallHistory.tsx");
  const callHistoryContent = fs.readFileSync(callHistoryPath, "utf-8");

  it("has deskFilter state variable", () => {
    expect(callHistoryContent).toContain("deskFilter");
    expect(callHistoryContent).toContain('setDeskFilter');
  });

  it("passes deskFilter to the unified query", () => {
    expect(callHistoryContent).toContain('deskFilter: deskFilter !== "all" ? deskFilter : undefined');
  });

  it("has Desk column header in the table", () => {
    expect(callHistoryContent).toContain('field="desk"');
    expect(callHistoryContent).toContain(">Desk<");
  });

  it("renders desk name badge in table rows", () => {
    expect(callHistoryContent).toContain("rec.deskName");
  });

  it("has desk filter dropdown with All Desks option", () => {
    expect(callHistoryContent).toContain("All Desks");
    expect(callHistoryContent).toContain("desks.list");
  });

  it("clears deskFilter when Clear Filters is clicked", () => {
    expect(callHistoryContent).toContain('setDeskFilter("all")');
  });

  it("includes desk in sort field type", () => {
    expect(callHistoryContent).toContain('"desk"');
    expect(callHistoryContent).toContain("a.deskName");
  });
});
