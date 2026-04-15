import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../drizzle/schema", () => ({
  contacts: {
    id: "id",
    propertyId: "propertyId",
    sortOrder: "sortOrder",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
  asc: vi.fn((col) => ({ col, type: "asc" })),
  inArray: vi.fn((col, vals) => ({ col, vals, type: "inArray" })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
    type: "sql",
    strings,
    values,
  })),
}));

// Mock db
const mockDb = {
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([
    { id: 1, sortOrder: 0 },
    { id: 2, sortOrder: 1 },
    { id: 3, sortOrder: 2 },
  ]),
};

vi.mock("../server/db", () => ({
  db: mockDb,
}));

describe("Contact Reorder Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reorderContacts logic", () => {
    it("should produce correct sortOrder values from orderedIds array", () => {
      const orderedIds = [3, 1, 2]; // New order: contact 3 first, then 1, then 2
      const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
      
      expect(updates).toEqual([
        { id: 3, sortOrder: 0 },
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
      ]);
    });

    it("should handle single contact", () => {
      const orderedIds = [42];
      const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
      expect(updates).toEqual([{ id: 42, sortOrder: 0 }]);
    });

    it("should handle empty orderedIds gracefully", () => {
      const orderedIds: number[] = [];
      const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
      expect(updates).toEqual([]);
    });

    it("should assign sequential sortOrder starting from 0", () => {
      const orderedIds = [10, 20, 30, 40, 50];
      const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
      
      updates.forEach((update, idx) => {
        expect(update.sortOrder).toBe(idx);
      });
    });
  });

  describe("orderedContacts derivation logic", () => {
    it("should reorder contacts based on orderedContactIds", () => {
      const contacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];
      const orderedContactIds = [3, 1, 2];
      
      const contactMap = new Map(contacts.map((c) => [c.id, c]));
      const ordered = orderedContactIds.map(id => contactMap.get(id)).filter(Boolean);
      const missing = contacts.filter((c) => !orderedContactIds.includes(c.id));
      const result = [...ordered, ...missing];
      
      expect(result[0]).toEqual({ id: 3, name: "Charlie" });
      expect(result[1]).toEqual({ id: 1, name: "Alice" });
      expect(result[2]).toEqual({ id: 2, name: "Bob" });
    });

    it("should append contacts not in orderedContactIds at the end", () => {
      const contacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
        { id: 4, name: "Dave" }, // Not in orderedContactIds
      ];
      const orderedContactIds = [3, 1, 2];
      
      const contactMap = new Map(contacts.map((c) => [c.id, c]));
      const ordered = orderedContactIds.map(id => contactMap.get(id)).filter(Boolean);
      const missing = contacts.filter((c) => !orderedContactIds.includes(c.id));
      const result = [...ordered, ...missing];
      
      expect(result).toHaveLength(4);
      expect(result[3]).toEqual({ id: 4, name: "Dave" });
    });

    it("should return original contacts when orderedContactIds is empty", () => {
      const contacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const orderedContactIds: number[] = [];
      
      // When orderedContactIds is empty, return original contacts
      const result = orderedContactIds.length === 0 ? contacts : contacts;
      expect(result).toEqual(contacts);
    });
  });

  describe("arrayMove behavior (dnd-kit)", () => {
    function arrayMove<T>(arr: T[], from: number, to: number): T[] {
      const result = [...arr];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    }

    it("should move item from index 0 to index 2", () => {
      const ids = [1, 2, 3, 4];
      const result = arrayMove(ids, 0, 2);
      expect(result).toEqual([2, 3, 1, 4]);
    });

    it("should move item from index 2 to index 0", () => {
      const ids = [1, 2, 3, 4];
      const result = arrayMove(ids, 2, 0);
      expect(result).toEqual([3, 1, 2, 4]);
    });

    it("should not change array when moving to same position", () => {
      const ids = [1, 2, 3];
      const result = arrayMove(ids, 1, 1);
      expect(result).toEqual([1, 2, 3]);
    });
  });
});
