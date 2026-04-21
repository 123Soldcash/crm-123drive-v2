/**
 * Tests for the unified notes system
 * Validates that:
 * 1. getUnifiedNotesForContact function exists and merges both sources
 * 2. The tRPC endpoint getUnifiedByContact is registered
 * 3. ContactNotesDialog uses the unified query
 * 4. Inline note editing creates callNote entries (not communicationLog)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Unified Notes System", () => {
  describe("Backend: db-callNotes.ts", () => {
    const src = readFileSync(join(ROOT, "server/db-callNotes.ts"), "utf-8");

    it("exports getUnifiedNotesForContact function", () => {
      expect(src).toContain("export async function getUnifiedNotesForContact");
    });

    it("queries callNotes table", () => {
      expect(src).toContain(".from(callNotes)");
    });

    it("queries communicationLog table", () => {
      expect(src).toContain(".from(communicationLog)");
    });

    it("joins users table for userName on both sources", () => {
      const userJoinCount = (src.match(/leftJoin\(users/g) || []).length;
      expect(userJoinCount).toBeGreaterThanOrEqual(2);
    });

    it("returns unified shape with source field", () => {
      expect(src).toContain('source: "callNote"');
      expect(src).toContain('source: "commLog"');
    });

    it("sorts unified results by date descending", () => {
      expect(src).toContain("unified.sort");
      expect(src).toContain("b.createdAt");
    });

    it("includes callResult from communicationLog entries", () => {
      expect(src).toContain("callResult: cl.callResult");
    });

    it("includes disposition from communicationLog entries", () => {
      expect(src).toContain("disposition: cl.disposition");
    });

    it("includes mood from communicationLog entries", () => {
      expect(src).toContain("mood: cl.mood");
    });

    it("parses propertyDetails JSON from communicationLog", () => {
      expect(src).toContain("JSON.parse(cl.propertyDetails)");
    });
  });

  describe("Backend: routers.ts", () => {
    const src = readFileSync(join(ROOT, "server/routers.ts"), "utf-8");

    it("registers getUnifiedByContact tRPC endpoint", () => {
      expect(src).toContain("getUnifiedByContact:");
    });

    it("imports getUnifiedNotesForContact in the endpoint", () => {
      expect(src).toContain("getUnifiedNotesForContact");
    });
  });

  describe("Frontend: ContactNotesDialog.tsx", () => {
    const src = readFileSync(join(ROOT, "client/src/components/ContactNotesDialog.tsx"), "utf-8");

    it("uses the unified query getUnifiedByContact", () => {
      expect(src).toContain("trpc.callNotes.getUnifiedByContact.useQuery");
    });

    it("does NOT use the old getByContact query", () => {
      expect(src).not.toContain("trpc.callNotes.getByContact.useQuery");
    });

    it("renders source badge (Call Log vs Note)", () => {
      expect(src).toContain('"Call Log"');
      expect(src).toContain('"Note"');
    });

    it("uses note.source to determine key and styling", () => {
      expect(src).toContain("note.source");
    });

    it("shows callResult badge for commLog entries", () => {
      expect(src).toContain("note.callResult");
    });

    it("shows direction icon for commLog entries", () => {
      expect(src).toContain("note.direction");
    });

    it("shows mood for commLog entries", () => {
      expect(src).toContain("note.mood");
    });

    it("shows userName for all entries", () => {
      expect(src).toContain("note.userName");
    });

    it("only allows deletion of callNote entries", () => {
      expect(src).toContain('source !== "callNote"');
    });
  });

  describe("Frontend: CallTrackingTable.tsx inline editing", () => {
    const src = readFileSync(join(ROOT, "client/src/components/CallTrackingTable.tsx"), "utf-8");

    it("uses callNotes.create mutation for inline notes", () => {
      expect(src).toContain("trpc.callNotes.create.useMutation");
    });

    it("handleNoteSave creates callNote instead of communicationLog", () => {
      expect(src).toContain("createInlineNoteMutation.mutate");
    });

    it("handleNoteSave does NOT create communicationLog for notes", () => {
      // The old pattern was logCommunicationMutation.mutate inside handleNoteSave
      // Extract the handleNoteSave function body
      const fnStart = src.indexOf("const handleNoteSave");
      const fnEnd = src.indexOf("};", fnStart) + 2;
      const fnBody = src.substring(fnStart, fnEnd);
      expect(fnBody).not.toContain("logCommunicationMutation.mutate");
      expect(fnBody).not.toContain("updateNotesMutation.mutate");
    });
  });
});
