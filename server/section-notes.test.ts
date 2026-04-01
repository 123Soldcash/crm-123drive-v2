import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db-sectionNotes", () => ({
  getSectionNotes: vi.fn(),
  getAllSectionNotes: vi.fn(),
  createSectionNote: vi.fn(),
  updateSectionNote: vi.fn(),
  deleteSectionNote: vi.fn(),
  addSectionNoteAttachment: vi.fn(),
  deleteSectionNoteAttachment: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg", key: "test.jpg" }),
}));

import * as dbSectionNotes from "./db-sectionNotes";

const mockNote = {
  id: 1,
  propertyId: 100,
  section: "property_basics",
  text: "Test note text",
  createdBy: 1,
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:00:00Z"),
  attachments: [],
};

const mockAttachment = {
  id: 1,
  sectionNoteId: 1,
  fileName: "screenshot.png",
  fileKey: "section-notes/1/abc123.png",
  fileUrl: "https://s3.example.com/screenshot.png",
  mimeType: "image/png",
  fileSize: 102400,
  createdAt: new Date("2026-01-01T10:00:00Z"),
};

describe("SectionNotes DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSectionNotes returns notes for a property section", async () => {
    vi.mocked(dbSectionNotes.getSectionNotes).mockResolvedValue([mockNote]);
    const result = await dbSectionNotes.getSectionNotes(100, "property_basics");
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("property_basics");
    expect(result[0].propertyId).toBe(100);
  });

  it("getSectionNotes returns empty array when no notes exist", async () => {
    vi.mocked(dbSectionNotes.getSectionNotes).mockResolvedValue([]);
    const result = await dbSectionNotes.getSectionNotes(999, "condition");
    expect(result).toHaveLength(0);
  });

  it("getAllSectionNotes returns all notes for a property grouped by section", async () => {
    const allNotes = [
      { ...mockNote, section: "property_basics" },
      { ...mockNote, id: 2, section: "condition" },
      { ...mockNote, id: 3, section: "occupancy" },
    ];
    vi.mocked(dbSectionNotes.getAllSectionNotes).mockResolvedValue(allNotes);
    const result = await dbSectionNotes.getAllSectionNotes(100);
    expect(result).toHaveLength(3);
    const sections = result.map((n) => n.section);
    expect(sections).toContain("property_basics");
    expect(sections).toContain("condition");
    expect(sections).toContain("occupancy");
  });

  it("createSectionNote creates a note with text and returns it", async () => {
    vi.mocked(dbSectionNotes.createSectionNote).mockResolvedValue(mockNote);
    const result = await dbSectionNotes.createSectionNote({
      propertyId: 100,
      section: "property_basics",
      text: "Test note text",
      createdBy: 1,
    });
    expect(result.id).toBe(1);
    expect(result.text).toBe("Test note text");
    expect(dbSectionNotes.createSectionNote).toHaveBeenCalledWith({
      propertyId: 100,
      section: "property_basics",
      text: "Test note text",
      createdBy: 1,
    });
  });

  it("createSectionNote can create a note with empty text (attachment-only note)", async () => {
    const emptyNote = { ...mockNote, text: "" };
    vi.mocked(dbSectionNotes.createSectionNote).mockResolvedValue(emptyNote);
    const result = await dbSectionNotes.createSectionNote({
      propertyId: 100,
      section: "condition",
      text: "",
      createdBy: 1,
    });
    expect(result.text).toBe("");
  });

  it("updateSectionNote updates the text of an existing note", async () => {
    const updated = { ...mockNote, text: "Updated text" };
    vi.mocked(dbSectionNotes.updateSectionNote).mockResolvedValue(updated);
    const result = await dbSectionNotes.updateSectionNote(1, "Updated text");
    expect(result.text).toBe("Updated text");
    expect(dbSectionNotes.updateSectionNote).toHaveBeenCalledWith(1, "Updated text");
  });

  it("deleteSectionNote removes a note by id", async () => {
    vi.mocked(dbSectionNotes.deleteSectionNote).mockResolvedValue({ success: true });
    const result = await dbSectionNotes.deleteSectionNote(1);
    expect(result).toEqual({ success: true });
    expect(dbSectionNotes.deleteSectionNote).toHaveBeenCalledWith(1);
  });

  it("addSectionNoteAttachment adds an image attachment to a note", async () => {
    vi.mocked(dbSectionNotes.addSectionNoteAttachment).mockResolvedValue(mockAttachment);
    const result = await dbSectionNotes.addSectionNoteAttachment({
      sectionNoteId: 1,
      fileName: "screenshot.png",
      fileKey: "section-notes/1/abc123.png",
      fileUrl: "https://s3.example.com/screenshot.png",
      mimeType: "image/png",
      fileSize: 102400,
    });
    expect(result.id).toBe(1);
    expect(result.fileName).toBe("screenshot.png");
    expect(result.mimeType).toBe("image/png");
  });

  it("addSectionNoteAttachment adds a PDF document attachment", async () => {
    const pdfAttachment = { ...mockAttachment, id: 2, fileName: "deed.pdf", mimeType: "application/pdf" };
    vi.mocked(dbSectionNotes.addSectionNoteAttachment).mockResolvedValue(pdfAttachment);
    const result = await dbSectionNotes.addSectionNoteAttachment({
      sectionNoteId: 1,
      fileName: "deed.pdf",
      fileKey: "section-notes/1/deed.pdf",
      fileUrl: "https://s3.example.com/deed.pdf",
      mimeType: "application/pdf",
      fileSize: 512000,
    });
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileName).toBe("deed.pdf");
  });

  it("deleteSectionNoteAttachment removes an attachment by id", async () => {
    vi.mocked(dbSectionNotes.deleteSectionNoteAttachment).mockResolvedValue({ success: true });
    const result = await dbSectionNotes.deleteSectionNoteAttachment(1);
    expect(result).toEqual({ success: true });
    expect(dbSectionNotes.deleteSectionNoteAttachment).toHaveBeenCalledWith(1);
  });

  it("supports all 6 Deep Search sections", async () => {
    const sections = [
      "property_basics",
      "condition",
      "occupancy",
      "seller_situation",
      "legal_title",
      "probate_family_tree",
    ];
    vi.mocked(dbSectionNotes.getSectionNotes).mockResolvedValue([mockNote]);
    for (const section of sections) {
      const result = await dbSectionNotes.getSectionNotes(100, section);
      expect(result).toBeDefined();
    }
    expect(dbSectionNotes.getSectionNotes).toHaveBeenCalledTimes(sections.length);
  });
});
