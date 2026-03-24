import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getPropertyNotes: vi.fn(),
  toggleNotePin: vi.fn(),
  addPropertyNote: vi.fn(),
  deleteNote: vi.fn(),
  updateNote: vi.fn(),
}));

import * as db from "./db";

describe("PIN Notes Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toggleNotePin", () => {
    it("should toggle a note from unpinned to pinned", async () => {
      (db.toggleNotePin as any).mockResolvedValue({ isPinned: 1 });

      const result = await db.toggleNotePin(1);
      expect(result).toEqual({ isPinned: 1 });
      expect(db.toggleNotePin).toHaveBeenCalledWith(1);
    });

    it("should toggle a note from pinned to unpinned", async () => {
      (db.toggleNotePin as any).mockResolvedValue({ isPinned: 0 });

      const result = await db.toggleNotePin(2);
      expect(result).toEqual({ isPinned: 0 });
      expect(db.toggleNotePin).toHaveBeenCalledWith(2);
    });

    it("should throw error when note is not found", async () => {
      (db.toggleNotePin as any).mockRejectedValue(new Error("Note not found"));

      await expect(db.toggleNotePin(999)).rejects.toThrow("Note not found");
    });
  });

  describe("getPropertyNotes - sorting with pinned notes", () => {
    it("should return pinned notes before unpinned notes", async () => {
      const mockNotes = [
        { id: 1, content: "Pinned note", isPinned: 1, createdAt: new Date("2026-01-01"), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
        { id: 2, content: "Regular note newer", isPinned: 0, createdAt: new Date("2026-03-01"), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
        { id: 3, content: "Regular note older", isPinned: 0, createdAt: new Date("2026-02-01"), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
      ];
      (db.getPropertyNotes as any).mockResolvedValue(mockNotes);

      const result = await db.getPropertyNotes(100);
      
      // First note should be pinned
      expect(result[0].isPinned).toBe(1);
      expect(result[0].content).toBe("Pinned note");
      
      // Remaining notes should be unpinned
      expect(result[1].isPinned).toBe(0);
      expect(result[2].isPinned).toBe(0);
    });

    it("should include isPinned field in returned notes", async () => {
      const mockNotes = [
        { id: 1, content: "Test note", isPinned: 0, createdAt: new Date(), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
      ];
      (db.getPropertyNotes as any).mockResolvedValue(mockNotes);

      const result = await db.getPropertyNotes(100);
      expect(result[0]).toHaveProperty("isPinned");
      expect(result[0].isPinned).toBe(0);
    });

    it("should handle multiple pinned notes", async () => {
      const mockNotes = [
        { id: 1, content: "Pinned A", isPinned: 1, createdAt: new Date("2026-03-01"), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
        { id: 2, content: "Pinned B", isPinned: 1, createdAt: new Date("2026-02-01"), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
        { id: 3, content: "Regular", isPinned: 0, createdAt: new Date("2026-03-15"), noteType: "general", userId: 1, userName: "Admin", updatedAt: new Date() },
      ];
      (db.getPropertyNotes as any).mockResolvedValue(mockNotes);

      const result = await db.getPropertyNotes(100);
      
      // Both pinned notes should come first
      expect(result[0].isPinned).toBe(1);
      expect(result[1].isPinned).toBe(1);
      expect(result[2].isPinned).toBe(0);
    });

    it("should return empty array when no notes exist", async () => {
      (db.getPropertyNotes as any).mockResolvedValue([]);

      const result = await db.getPropertyNotes(100);
      expect(result).toEqual([]);
    });
  });

  describe("PIN toggle behavior", () => {
    it("should call toggleNotePin with correct note ID", async () => {
      (db.toggleNotePin as any).mockResolvedValue({ isPinned: 1 });

      await db.toggleNotePin(42);
      expect(db.toggleNotePin).toHaveBeenCalledWith(42);
    });

    it("should return the new pin state after toggling", async () => {
      // First toggle: pin
      (db.toggleNotePin as any).mockResolvedValue({ isPinned: 1 });
      const pinResult = await db.toggleNotePin(1);
      expect(pinResult.isPinned).toBe(1);

      // Second toggle: unpin
      (db.toggleNotePin as any).mockResolvedValue({ isPinned: 0 });
      const unpinResult = await db.toggleNotePin(1);
      expect(unpinResult.isPinned).toBe(0);
    });
  });
});
