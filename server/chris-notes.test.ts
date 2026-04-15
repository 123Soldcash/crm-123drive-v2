import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const componentPath = path.resolve(__dirname, "../client/src/components/ChrisNotesSection.tsx");
const componentContent = fs.readFileSync(componentPath, "utf-8");

describe("ChrisNotesSection - Simple Notes System", () => {
  // ─── 1. Component structure ───
  it("filters notes by desk-chris noteType", () => {
    expect(componentContent).toContain('noteType === "desk-chris"');
  });

  it("sorts notes newest first", () => {
    expect(componentContent).toContain(".sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())");
  });

  it("uses notes.byProperty query to fetch notes", () => {
    expect(componentContent).toContain("trpc.notes.byProperty.useQuery");
  });

  it("uses notes.create mutation to add notes", () => {
    expect(componentContent).toContain("trpc.notes.create.useMutation");
  });

  it("uses notes.delete mutation to remove notes", () => {
    expect(componentContent).toContain("trpc.notes.delete.useMutation");
  });

  // ─── 2. Note creation ───
  it("creates notes with desk-chris noteType", () => {
    expect(componentContent).toContain('noteType: "desk-chris"');
  });

  it("has an input field with placeholder text", () => {
    expect(componentContent).toContain('placeholder="Type a note and press Enter…"');
  });

  it("supports Enter key to add notes", () => {
    expect(componentContent).toContain('e.key === "Enter"');
    expect(componentContent).toContain("handleAdd()");
  });

  it("has an Add button with Plus icon", () => {
    expect(componentContent).toContain("<Plus");
    expect(componentContent).toContain("Add");
  });

  it("disables Add button when text is empty", () => {
    expect(componentContent).toContain("!noteText.trim() || createNote.isPending");
  });

  // ─── 3. Note display - list format (not tags) ───
  it("displays notes as a list with rows, NOT as tags/chips", () => {
    // Should NOT have rounded-full (tag style)
    expect(componentContent).not.toContain("rounded-full");
    // Should have a list container with border
    expect(componentContent).toContain("border border-gray-200 rounded-lg");
    // Should have border-b for row separators
    expect(componentContent).toContain("border-b border-gray-100");
  });

  it("shows date for each note", () => {
    expect(componentContent).toContain("formatDate(note.createdAt)");
  });

  it("shows time for each note", () => {
    expect(componentContent).toContain("formatTime(note.createdAt)");
  });

  it("formats date as short month, day, year", () => {
    expect(componentContent).toContain('"short"'); // month: "short"
    expect(componentContent).toContain('"numeric"'); // day: "numeric"
  });

  it("formats time with AM/PM", () => {
    expect(componentContent).toContain("hour12: true");
  });

  it("shows note content as text paragraph", () => {
    expect(componentContent).toContain("note.content");
    expect(componentContent).toContain("break-words");
  });

  // ─── 4. Note deletion ───
  it("has a delete button with Trash icon", () => {
    expect(componentContent).toContain("<Trash2");
  });

  it("delete button is hidden by default, shown on hover", () => {
    expect(componentContent).toContain("opacity-0 group-hover:opacity-100");
  });

  it("calls handleDelete with note id on click", () => {
    expect(componentContent).toContain("handleDelete(note.id)");
  });

  it("shows success toast on delete", () => {
    expect(componentContent).toContain('toast.success("Note removed")');
  });

  // ─── 5. Empty state and loading ───
  it("shows loading state while fetching", () => {
    expect(componentContent).toContain("Loading…");
    expect(componentContent).toContain("animate-pulse");
  });

  it("shows empty state message when no notes", () => {
    expect(componentContent).toContain("No notes yet. Type above and press Enter.");
  });

  // ─── 6. Collapsible section ───
  it("uses CollapsibleSection wrapper", () => {
    expect(componentContent).toContain("<CollapsibleSection");
  });

  it("has title Chris Notes", () => {
    expect(componentContent).toContain('title="Chris Notes"');
  });

  it("uses purple accent color", () => {
    expect(componentContent).toContain('accentColor="purple"');
  });

  it("shows note count badge", () => {
    expect(componentContent).toContain("chrisNotes.length");
    expect(componentContent).toContain("bg-purple-100 text-purple-700");
  });

  // ─── 7. Data preservation ───
  it("preserves existing notes by using the same noteType filter (desk-chris)", () => {
    // The component still queries all notes and filters by desk-chris
    // This means existing tag-based notes (which are stored as desk-chris noteType) are preserved
    expect(componentContent).toContain('noteType === "desk-chris"');
    expect(componentContent).toContain("trpc.notes.byProperty.useQuery");
  });
});
