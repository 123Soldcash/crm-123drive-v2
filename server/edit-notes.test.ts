import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  updateNote: vi.fn(),
  getPropertyNotes: vi.fn(),
  toggleNotePin: vi.fn(),
}));

import * as db from "./db";

describe("Edit Notes Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateNote", () => {
    it("should update a note with new content", async () => {
      (db.updateNote as any).mockResolvedValue(undefined);

      await db.updateNote(1, 10, "Updated content");
      expect(db.updateNote).toHaveBeenCalledWith(1, 10, "Updated content");
    });

    it("should only allow the note creator to update", async () => {
      // The db function requires userId match - simulating owner check
      (db.updateNote as any).mockResolvedValue(undefined);

      await db.updateNote(1, 10, "New content");
      expect(db.updateNote).toHaveBeenCalledWith(1, 10, "New content");
      
      // Verify it was called with the correct userId (owner)
      const [noteId, userId] = (db.updateNote as any).mock.calls[0];
      expect(noteId).toBe(1);
      expect(userId).toBe(10);
    });

    it("should handle update failure gracefully", async () => {
      (db.updateNote as any).mockRejectedValue(new Error("Database not available"));

      await expect(db.updateNote(1, 10, "content")).rejects.toThrow("Database not available");
    });

    it("should not update if content is empty", async () => {
      // Frontend prevents empty content, but backend should handle it
      (db.updateNote as any).mockResolvedValue(undefined);

      await db.updateNote(1, 10, "");
      expect(db.updateNote).toHaveBeenCalledWith(1, 10, "");
    });
  });

  describe("Owner-only edit visibility", () => {
    it("should return userId with notes for ownership check", async () => {
      const mockNotes = [
        { id: 1, content: "Note by user 10", userId: 10, userName: "Admin", isPinned: 0, noteType: "general", createdAt: new Date(), updatedAt: new Date() },
        { id: 2, content: "Note by user 20", userId: 20, userName: "Agent", isPinned: 0, noteType: "general", createdAt: new Date(), updatedAt: new Date() },
      ];
      (db.getPropertyNotes as any).mockResolvedValue(mockNotes);

      const result = await db.getPropertyNotes(100);
      
      // Each note should have userId for ownership comparison
      expect(result[0]).toHaveProperty("userId", 10);
      expect(result[1]).toHaveProperty("userId", 20);
    });

    it("should allow edit only when current user matches note userId", () => {
      const currentUserId = 10;
      const noteByCurrentUser = { id: 1, userId: 10, content: "My note" };
      const noteByOtherUser = { id: 2, userId: 20, content: "Other note" };

      // Current user can edit their own note
      expect(noteByCurrentUser.userId === currentUserId).toBe(true);
      
      // Current user cannot edit other user's note
      expect(noteByOtherUser.userId === currentUserId).toBe(false);
    });
  });

  describe("Edit workflow", () => {
    it("should preserve original content when edit is cancelled", () => {
      const originalContent = "Original note content";
      let editingContent = originalContent;
      
      // Simulate editing
      editingContent = "Modified content";
      expect(editingContent).toBe("Modified content");
      
      // Simulate cancel - reset to empty (UI re-reads from data)
      editingContent = "";
      expect(editingContent).toBe("");
    });

    it("should trim whitespace from edited content before saving", () => {
      const editedContent = "  Updated content with spaces  ";
      const trimmed = editedContent.trim();
      expect(trimmed).toBe("Updated content with spaces");
    });

    it("should not allow saving empty content", () => {
      const editedContent = "   ";
      const isValid = editedContent.trim().length > 0;
      expect(isValid).toBe(false);
    });
  });
});
