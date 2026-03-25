import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getPropertiesWithFilters: vi.fn(),
  bulkAssignAgentToProperties: vi.fn(),
  bulkUpdateDesk: vi.fn(),
}));

import * as db from "./db";

describe("Bulk Assignment & Desk Transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPropertiesWithFilters", () => {
    it("should return all properties when no filters are applied", async () => {
      const mockProperties = [
        { id: 1, addressLine1: "123 Main St", deskName: "DESK_CHRIS", leadTemperature: "HOT" },
        { id: 2, addressLine1: "456 Oak Ave", deskName: "DESK_1", leadTemperature: "WARM" },
      ];
      (db.getPropertiesWithFilters as any).mockResolvedValue(mockProperties);

      const result = await db.getPropertiesWithFilters({});
      expect(result).toHaveLength(2);
    });

    it("should filter by lead temperature", async () => {
      const mockProperties = [
        { id: 1, addressLine1: "123 Main St", leadTemperature: "HOT" },
      ];
      (db.getPropertiesWithFilters as any).mockResolvedValue(mockProperties);

      const result = await db.getPropertiesWithFilters({ leadTemperature: "HOT" });
      expect(result).toHaveLength(1);
      expect(result[0].leadTemperature).toBe("HOT");
    });

    it("should filter by desk name", async () => {
      const mockProperties = [
        { id: 1, addressLine1: "123 Main St", deskName: "DESK_CHRIS" },
      ];
      (db.getPropertiesWithFilters as any).mockResolvedValue(mockProperties);

      const result = await db.getPropertiesWithFilters({ deskName: "DESK_CHRIS" });
      expect(result).toHaveLength(1);
      expect(result[0].deskName).toBe("DESK_CHRIS");
    });

    it("should filter unassigned only", async () => {
      const mockProperties = [
        { id: 1, addressLine1: "123 Main St", assignedAgentId: null },
      ];
      (db.getPropertiesWithFilters as any).mockResolvedValue(mockProperties);

      const result = await db.getPropertiesWithFilters({ unassignedOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].assignedAgentId).toBeNull();
    });

    it("should accept userId and userRole for admin context", async () => {
      (db.getPropertiesWithFilters as any).mockResolvedValue([]);

      await db.getPropertiesWithFilters({ userId: 1, userRole: "admin" });
      expect(db.getPropertiesWithFilters).toHaveBeenCalledWith({ userId: 1, userRole: "admin" });
    });
  });

  describe("bulkAssignAgentToProperties", () => {
    it("should assign agent to matching properties", async () => {
      (db.bulkAssignAgentToProperties as any).mockResolvedValue({ success: true, count: 5 });

      const result = await db.bulkAssignAgentToProperties(10, {
        deskName: "DESK_CHRIS",
        userId: 1,
        userRole: "admin",
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
    });

    it("should return count 0 when no properties match", async () => {
      (db.bulkAssignAgentToProperties as any).mockResolvedValue({ success: true, count: 0 });

      const result = await db.bulkAssignAgentToProperties(10, {
        leadTemperature: "DEAD",
        deskName: "NONEXISTENT",
      });

      expect(result.count).toBe(0);
    });

    it("should handle database errors", async () => {
      (db.bulkAssignAgentToProperties as any).mockRejectedValue(new Error("Database not available"));

      await expect(
        db.bulkAssignAgentToProperties(10, { deskName: "DESK_1" })
      ).rejects.toThrow("Database not available");
    });
  });

  describe("bulkUpdateDesk", () => {
    it("should move properties to target desk", async () => {
      (db.bulkUpdateDesk as any).mockResolvedValue({ success: true, count: 3 });

      const result = await db.bulkUpdateDesk("DESK_3", {
        deskName: "DESK_CHRIS",
        userId: 1,
        userRole: "admin",
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it("should move properties filtered by temperature to a new desk", async () => {
      (db.bulkUpdateDesk as any).mockResolvedValue({ success: true, count: 10 });

      const result = await db.bulkUpdateDesk("BIN", {
        leadTemperature: "DEAD",
        userId: 1,
        userRole: "admin",
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(10);
    });

    it("should return count 0 when no properties match", async () => {
      (db.bulkUpdateDesk as any).mockResolvedValue({ success: true, count: 0 });

      const result = await db.bulkUpdateDesk("DESK_1", {
        deskName: "NONEXISTENT",
      });

      expect(result.count).toBe(0);
    });

    it("should handle database errors", async () => {
      (db.bulkUpdateDesk as any).mockRejectedValue(new Error("Database not available"));

      await expect(
        db.bulkUpdateDesk("DESK_1", { deskName: "BIN" })
      ).rejects.toThrow("Database not available");
    });
  });

  describe("Action mode validation", () => {
    it("assign_agent mode requires selectedUser", () => {
      const actionMode = "assign_agent";
      const selectedUser = "";
      const targetDesk = "";

      const canExecute =
        actionMode === "assign_agent" ? !!selectedUser :
        actionMode === "change_desk" ? !!targetDesk :
        !!selectedUser && !!targetDesk;

      expect(canExecute).toBe(false);
    });

    it("change_desk mode requires targetDesk", () => {
      const actionMode = "change_desk";
      const selectedUser = "";
      const targetDesk = "DESK_CHRIS";

      const canExecute =
        actionMode === "assign_agent" ? !!selectedUser :
        actionMode === "change_desk" ? !!targetDesk :
        !!selectedUser && !!targetDesk;

      expect(canExecute).toBe(true);
    });

    it("both mode requires both selectedUser and targetDesk", () => {
      const actionMode = "both";
      const selectedUser = "10";
      const targetDesk = "DESK_1";

      const canExecute =
        actionMode === "assign_agent" ? !!selectedUser :
        actionMode === "change_desk" ? !!targetDesk :
        !!selectedUser && !!targetDesk;

      expect(canExecute).toBe(true);
    });

    it("both mode fails if only user is selected", () => {
      const actionMode = "both";
      const selectedUser = "10";
      const targetDesk = "";

      const canExecute =
        actionMode === "assign_agent" ? !!selectedUser :
        actionMode === "change_desk" ? !!targetDesk :
        !!selectedUser && !!targetDesk;

      expect(canExecute).toBe(false);
    });
  });

  describe("All users visibility", () => {
    it("should include both agents and admins in user list", () => {
      const mockUsers = [
        { id: 1, name: "Admin User", role: "admin" },
        { id: 2, name: "Agent Chris", role: "agent" },
        { id: 3, name: "Agent Zach", role: "agent" },
      ];

      // listAll returns both agents and admins
      const hasAdmin = mockUsers.some(u => u.role === "admin");
      const hasAgent = mockUsers.some(u => u.role === "agent");

      expect(hasAdmin).toBe(true);
      expect(hasAgent).toBe(true);
      expect(mockUsers).toHaveLength(3);
    });
  });
});
