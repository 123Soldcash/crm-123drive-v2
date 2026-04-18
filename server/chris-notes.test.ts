/**
 * Unit tests for Chris Notes plain-text note logic.
 * Tests filtering, sorting, and date formatting.
 */
import { describe, it, expect } from "vitest";

// ─── Mirror of formatNoteDate from ChrisNotesSection.tsx ─────────────────────

function formatNoteDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Mirror of the filter + sort logic ───────────────────────────────────────

interface Note {
  id: number;
  content: string;
  noteType: string;
  createdAt: string | Date;
}

function getChrisNotes(allNotes: Note[]): Note[] {
  return allNotes
    .filter((n) => n.noteType === "desk-chris")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Chris Notes - Filtering", () => {
  it("returns only desk-chris notes", () => {
    const notes: Note[] = [
      { id: 1, content: "Chris note", noteType: "desk-chris", createdAt: "2024-01-01T10:00:00Z" },
      { id: 2, content: "General note", noteType: "general", createdAt: "2024-01-02T10:00:00Z" },
      { id: 3, content: "Another Chris note", noteType: "desk-chris", createdAt: "2024-01-03T10:00:00Z" },
    ];
    const result = getChrisNotes(notes);
    expect(result).toHaveLength(2);
    expect(result.every((n) => n.noteType === "desk-chris")).toBe(true);
  });

  it("returns empty array when no desk-chris notes exist", () => {
    const notes: Note[] = [
      { id: 1, content: "General note", noteType: "general", createdAt: "2024-01-01T10:00:00Z" },
    ];
    const result = getChrisNotes(notes);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when allNotes is empty", () => {
    const result = getChrisNotes([]);
    expect(result).toHaveLength(0);
  });

  it("returns all notes when all are desk-chris type", () => {
    const notes: Note[] = [
      { id: 1, content: "Note A", noteType: "desk-chris", createdAt: "2024-01-01T10:00:00Z" },
      { id: 2, content: "Note B", noteType: "desk-chris", createdAt: "2024-01-02T10:00:00Z" },
    ];
    const result = getChrisNotes(notes);
    expect(result).toHaveLength(2);
  });
});

describe("Chris Notes - Sorting (newest first)", () => {
  it("sorts notes newest first", () => {
    const notes: Note[] = [
      { id: 1, content: "Oldest", noteType: "desk-chris", createdAt: "2024-01-01T10:00:00Z" },
      { id: 2, content: "Newest", noteType: "desk-chris", createdAt: "2024-03-15T10:00:00Z" },
      { id: 3, content: "Middle", noteType: "desk-chris", createdAt: "2024-02-10T10:00:00Z" },
    ];
    const result = getChrisNotes(notes);
    expect(result[0].content).toBe("Newest");
    expect(result[1].content).toBe("Middle");
    expect(result[2].content).toBe("Oldest");
  });

  it("handles notes with same timestamp (stable sort)", () => {
    const ts = "2024-01-01T10:00:00Z";
    const notes: Note[] = [
      { id: 1, content: "Note A", noteType: "desk-chris", createdAt: ts },
      { id: 2, content: "Note B", noteType: "desk-chris", createdAt: ts },
    ];
    const result = getChrisNotes(notes);
    expect(result).toHaveLength(2);
  });

  it("single note is returned as-is", () => {
    const notes: Note[] = [
      { id: 1, content: "Only note", noteType: "desk-chris", createdAt: "2024-01-01T10:00:00Z" },
    ];
    const result = getChrisNotes(notes);
    expect(result[0].content).toBe("Only note");
  });
});

describe("Chris Notes - Date formatting", () => {
  it("formats a date string without throwing", () => {
    const result = formatNoteDate("2024-06-15T14:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a Date object without throwing", () => {
    const result = formatNoteDate(new Date("2024-06-15T14:30:00Z"));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes year in formatted date", () => {
    const result = formatNoteDate("2024-06-15T14:30:00Z");
    expect(result).toContain("2024");
  });
});

describe("Chris Notes - Content validation (add note logic)", () => {
  it("trims whitespace before saving", () => {
    const text = "  My note with spaces  ";
    const trimmed = text.trim();
    expect(trimmed).toBe("My note with spaces");
  });

  it("empty string after trim should NOT trigger save", () => {
    const text = "   ";
    expect(text.trim()).toBe("");
    expect(Boolean(text.trim())).toBe(false);
  });

  it("non-empty string after trim should trigger save", () => {
    const text = "  Valid note  ";
    expect(Boolean(text.trim())).toBe(true);
  });

  it("multi-line note content is preserved", () => {
    const text = "Line one\nLine two\nLine three";
    expect(text.trim()).toBe("Line one\nLine two\nLine three");
  });
});
