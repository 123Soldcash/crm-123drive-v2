import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for Desk Management logic
 * Tests the validation, transfer, and business rules without hitting the real DB
 */

// ─── Mock desk data ───
interface MockDesk {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isSystem: number;
  propertyCount: number;
}

const createMockDesks = (): MockDesk[] => [
  { id: 1, name: "BIN", description: "Default bin", color: null, sortOrder: 1, isSystem: 1, propertyCount: 10 },
  { id: 2, name: "NEW_LEAD", description: "New leads", color: null, sortOrder: 2, isSystem: 1, propertyCount: 4 },
  { id: 3, name: "DEAD", description: "Dead leads", color: null, sortOrder: 3, isSystem: 1, propertyCount: 19 },
  { id: 4, name: "DESK_CHRIS", description: "Desk Chris", color: null, sortOrder: 10, isSystem: 0, propertyCount: 31 },
  { id: 5, name: "DESK_3", description: "Desk 3", color: null, sortOrder: 11, isSystem: 0, propertyCount: 133 },
];

// ─── Business logic functions (extracted for testability) ───

function validateDeskName(name: string, existingDesks: MockDesk[]): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Desk name is required" };
  }
  if (name.trim().length > 100) {
    return { valid: false, error: "Desk name must be 100 characters or less" };
  }
  const duplicate = existingDesks.find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
  if (duplicate) {
    return { valid: false, error: `A desk named "${duplicate.name}" already exists` };
  }
  return { valid: true };
}

function canDeleteDesk(desk: MockDesk): { canDelete: boolean; reason?: string } {
  if (desk.isSystem === 1) {
    return { canDelete: false, reason: "Cannot delete a system desk" };
  }
  return { canDelete: true };
}

function getDeskStatusForTransfer(targetDeskName: string): "BIN" | "ACTIVE" | "DEAD" {
  if (targetDeskName === "BIN" || targetDeskName === "NEW_LEAD") return "BIN";
  if (targetDeskName === "DEAD") return "DEAD";
  return "ACTIVE";
}

function simulateTransferAndDelete(
  desks: MockDesk[],
  deleteId: number,
  transferToId: number
): { success: boolean; transferredCount: number; error?: string } {
  const deskToDelete = desks.find((d) => d.id === deleteId);
  if (!deskToDelete) return { success: false, transferredCount: 0, error: "Desk not found" };

  if (deskToDelete.isSystem === 1) {
    return { success: false, transferredCount: 0, error: "Cannot delete a system desk" };
  }

  const targetDesk = desks.find((d) => d.id === transferToId);
  if (!targetDesk) return { success: false, transferredCount: 0, error: "Target desk not found" };

  if (deleteId === transferToId) {
    return { success: false, transferredCount: 0, error: "Cannot transfer to the same desk" };
  }

  const transferredCount = deskToDelete.propertyCount;
  targetDesk.propertyCount += transferredCount;
  deskToDelete.propertyCount = 0;

  return { success: true, transferredCount };
}

function validateRename(
  deskId: number,
  newName: string,
  desks: MockDesk[]
): { valid: boolean; error?: string } {
  const desk = desks.find((d) => d.id === deskId);
  if (!desk) return { valid: false, error: "Desk not found" };
  
  if (!newName || newName.trim().length === 0) {
    return { valid: false, error: "New name is required" };
  }

  const duplicate = desks.find(
    (d) => d.id !== deskId && d.name.toLowerCase() === newName.trim().toLowerCase()
  );
  if (duplicate) {
    return { valid: false, error: `A desk named "${duplicate.name}" already exists` };
  }

  return { valid: true };
}

// ─── Tests ───

describe("Desk Management", () => {
  let desks: MockDesk[];

  beforeEach(() => {
    desks = createMockDesks();
  });

  describe("validateDeskName", () => {
    it("should accept a valid unique name", () => {
      const result = validateDeskName("DESK_NEW", desks);
      expect(result.valid).toBe(true);
    });

    it("should reject empty name", () => {
      const result = validateDeskName("", desks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("should reject whitespace-only name", () => {
      const result = validateDeskName("   ", desks);
      expect(result.valid).toBe(false);
    });

    it("should reject name longer than 100 chars", () => {
      const longName = "A".repeat(101);
      const result = validateDeskName(longName, desks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("100 characters");
    });

    it("should reject duplicate name (case-insensitive)", () => {
      const result = validateDeskName("desk_chris", desks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should reject exact duplicate name", () => {
      const result = validateDeskName("BIN", desks);
      expect(result.valid).toBe(false);
    });
  });

  describe("canDeleteDesk", () => {
    it("should allow deleting custom desks", () => {
      const desk = desks.find((d) => d.name === "DESK_CHRIS")!;
      const result = canDeleteDesk(desk);
      expect(result.canDelete).toBe(true);
    });

    it("should prevent deleting system desk BIN", () => {
      const desk = desks.find((d) => d.name === "BIN")!;
      const result = canDeleteDesk(desk);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain("system desk");
    });

    it("should prevent deleting system desk NEW_LEAD", () => {
      const desk = desks.find((d) => d.name === "NEW_LEAD")!;
      const result = canDeleteDesk(desk);
      expect(result.canDelete).toBe(false);
    });

    it("should prevent deleting system desk DEAD", () => {
      const desk = desks.find((d) => d.name === "DEAD")!;
      const result = canDeleteDesk(desk);
      expect(result.canDelete).toBe(false);
    });
  });

  describe("getDeskStatusForTransfer", () => {
    it("should return BIN for BIN desk", () => {
      expect(getDeskStatusForTransfer("BIN")).toBe("BIN");
    });

    it("should return BIN for NEW_LEAD desk", () => {
      expect(getDeskStatusForTransfer("NEW_LEAD")).toBe("BIN");
    });

    it("should return DEAD for DEAD desk", () => {
      expect(getDeskStatusForTransfer("DEAD")).toBe("DEAD");
    });

    it("should return ACTIVE for custom desks", () => {
      expect(getDeskStatusForTransfer("DESK_CHRIS")).toBe("ACTIVE");
      expect(getDeskStatusForTransfer("DESK_3")).toBe("ACTIVE");
      expect(getDeskStatusForTransfer("MY_CUSTOM_DESK")).toBe("ACTIVE");
    });
  });

  describe("simulateTransferAndDelete", () => {
    it("should transfer properties and delete desk", () => {
      const result = simulateTransferAndDelete(desks, 4, 5); // DESK_CHRIS → DESK_3
      expect(result.success).toBe(true);
      expect(result.transferredCount).toBe(31);
      // DESK_3 should now have 133 + 31 = 164
      expect(desks.find((d) => d.id === 5)!.propertyCount).toBe(164);
    });

    it("should handle empty desk deletion", () => {
      desks[3]!.propertyCount = 0; // DESK_CHRIS has 0 properties
      const result = simulateTransferAndDelete(desks, 4, 5);
      expect(result.success).toBe(true);
      expect(result.transferredCount).toBe(0);
    });

    it("should fail for non-existent desk", () => {
      const result = simulateTransferAndDelete(desks, 999, 5);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail for non-existent target desk", () => {
      const result = simulateTransferAndDelete(desks, 4, 999);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail when trying to delete a system desk", () => {
      const result = simulateTransferAndDelete(desks, 1, 5); // BIN → DESK_3
      expect(result.success).toBe(false);
      expect(result.error).toContain("system desk");
    });

    it("should fail when transferring to the same desk", () => {
      const result = simulateTransferAndDelete(desks, 4, 4);
      expect(result.success).toBe(false);
      expect(result.error).toContain("same desk");
    });
  });

  describe("validateRename", () => {
    it("should allow renaming to a unique name", () => {
      const result = validateRename(4, "DESK_MARKETING", desks);
      expect(result.valid).toBe(true);
    });

    it("should reject renaming to an existing name", () => {
      const result = validateRename(4, "DESK_3", desks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should allow keeping the same name (no conflict with self)", () => {
      const result = validateRename(4, "DESK_CHRIS", desks);
      expect(result.valid).toBe(true);
    });

    it("should reject empty new name", () => {
      const result = validateRename(4, "", desks);
      expect(result.valid).toBe(false);
    });

    it("should fail for non-existent desk", () => {
      const result = validateRename(999, "NEW_NAME", desks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("Property count tracking", () => {
    it("should correctly sum total properties across all desks", () => {
      const total = desks.reduce((sum, d) => sum + d.propertyCount, 0);
      expect(total).toBe(10 + 4 + 19 + 31 + 133);
    });

    it("should correctly count system vs custom desks", () => {
      const systemCount = desks.filter((d) => d.isSystem === 1).length;
      const customCount = desks.filter((d) => d.isSystem === 0).length;
      expect(systemCount).toBe(3);
      expect(customCount).toBe(2);
    });
  });
});
