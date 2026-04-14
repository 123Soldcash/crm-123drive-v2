import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── 1. Schema: communicationLog has deskName column ───
describe("Schema: communicationLog has deskName column", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  it("communicationLog table includes deskName varchar column", () => {
    // Find the communicationLog table definition
    const tableStart = schemaContent.indexOf('communicationLog = mysqlTable("communicationLog"');
    expect(tableStart).toBeGreaterThan(-1);

    // Extract the table definition (until the closing ");")
    const tableEnd = schemaContent.indexOf("});", tableStart);
    const tableDef = schemaContent.slice(tableStart, tableEnd);

    expect(tableDef).toContain('deskName');
    expect(tableDef).toContain('varchar("deskName"');
  });
});

// ─── 2. UnifiedCommRecord type includes deskName ───
describe("UnifiedCommRecord type includes deskName", () => {
  const commPath = path.resolve(__dirname, "communication.ts");
  const commContent = fs.readFileSync(commPath, "utf-8");

  it("UnifiedCommRecord type has deskName field", () => {
    const typeStart = commContent.indexOf("export type UnifiedCommRecord");
    expect(typeStart).toBeGreaterThan(-1);
    const typeEnd = commContent.indexOf("};", typeStart);
    const typeDef = commContent.slice(typeStart, typeEnd);
    expect(typeDef).toContain("deskName");
  });

  it("getUnifiedCommunications accepts deskFilter parameter", () => {
    const funcStart = commContent.indexOf("export async function getUnifiedCommunications");
    expect(funcStart).toBeGreaterThan(-1);
    const funcSignatureEnd = commContent.indexOf("): Promise", funcStart);
    const funcSignature = commContent.slice(funcStart, funcSignatureEnd);
    expect(funcSignature).toContain("deskFilter");
  });

  it("call records query selects deskName from communicationLog", () => {
    // In the getUnifiedCommunications function, the call records select should include deskName
    const funcStart = commContent.indexOf("export async function getUnifiedCommunications");
    const funcEnd = commContent.indexOf("export async function getUnifiedCommStats");
    const funcBody = commContent.slice(funcStart, funcEnd);
    expect(funcBody).toContain("deskName: communicationLog.deskName");
  });

  it("call records mapping includes deskName", () => {
    const funcStart = commContent.indexOf("export async function getUnifiedCommunications");
    const funcEnd = commContent.indexOf("export async function getUnifiedCommStats");
    const funcBody = commContent.slice(funcStart, funcEnd);
    expect(funcBody).toContain("deskName: c.deskName");
  });

  it("SMS records mapping sets deskName to null", () => {
    const funcStart = commContent.indexOf("export async function getUnifiedCommunications");
    const funcEnd = commContent.indexOf("export async function getUnifiedCommStats");
    const funcBody = commContent.slice(funcStart, funcEnd);
    expect(funcBody).toContain("deskName: null");
  });
});

// ─── 3. Router: unified procedure accepts deskFilter ───
describe("Router: unified procedure accepts deskFilter", () => {
  const routersPath = path.resolve(__dirname, "routers.ts");
  const routersContent = fs.readFileSync(routersPath, "utf-8");

  it("callHistory.unified input schema includes deskFilter", () => {
    // Find the unified procedure definition
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
    // Find the communicationLog insert for inbound calls
    const insertStart = webhookContent.indexOf("insert(communicationLog).values");
    expect(insertStart).toBeGreaterThan(-1);
    const insertEnd = webhookContent.indexOf("});", insertStart);
    const insertSection = webhookContent.slice(insertStart, insertEnd);
    expect(insertSection).toContain("deskName");
    expect(insertSection).toContain("matchedDeskNames");
  });

  it("resolves desk names from desksTable during routing", () => {
    expect(webhookContent).toContain("desks: desksTable");
    expect(webhookContent).toContain("matchedDeskNames");
    // Should query desksTable to resolve names
    expect(webhookContent).toContain(".from(desksTable)");
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
