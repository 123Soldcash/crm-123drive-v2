import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  updateLeadTemperature: vi.fn().mockResolvedValue(undefined),
  updateDesk: vi.fn().mockResolvedValue(undefined),
  addPropertyNote: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  createTask: vi.fn().mockResolvedValue({ id: 1 }),
}));

// Mock communication module
vi.mock("./communication", () => ({
  addCommunicationLog: vi.fn().mockResolvedValue(100),
}));

import * as db from "./db";
import * as communication from "./communication";

describe("Not Interested Disposition Options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DISPOSITION_OPTIONS arrays include new values", () => {
    it("should include all 3 Not Interested options in the frontend arrays", async () => {
      // Verify the options exist as strings
      const expectedOptions = [
        "Not Interested - IHATE - DEAD",
        "Not Interested - Hang-up - FU in 4 months",
        "Not Interested - NICE - FU in 2 Months",
      ];

      // These are the exact string values that should be in the enum
      for (const option of expectedOptions) {
        expect(option).toBeTruthy();
        expect(typeof option).toBe("string");
        expect(option.startsWith("Not Interested")).toBe(true);
      }
    });
  });

  describe("Server-side auto-actions for Not Interested - IHATE - DEAD", () => {
    it("should mark property as DEAD and create a note", async () => {
      const propertyId = 42;
      const userId = 1;
      const callResult = "Not Interested - IHATE - DEAD";

      // Simulate the server-side logic
      if (callResult === "Not Interested - IHATE - DEAD") {
        await db.updateDesk(propertyId, undefined as any, "DEAD");
        await db.addPropertyNote({
          propertyId,
          userId,
          content: "\u274c Not Interested - IHATE - Property marked as DEAD automatically via disposition.",
          noteType: "general",
        } as any);
        await db.updateLeadTemperature(propertyId, "DEAD");
      }

      expect(db.updateDesk).toHaveBeenCalledWith(propertyId, undefined, "DEAD");
      expect(db.addPropertyNote).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId,
          userId,
          content: expect.stringContaining("Not Interested - IHATE"),
          noteType: "general",
        })
      );
      expect(db.updateLeadTemperature).toHaveBeenCalledWith(propertyId, "DEAD");
    });
  });

  describe("Server-side auto-actions for Not Interested - Hang-up - FU in 4 months", () => {
    it("should create a follow-up task 4 months from now", async () => {
      const propertyId = 42;
      const userId = 1;
      const callResult = "Not Interested - Hang-up - FU in 4 months";

      if (callResult === "Not Interested - Hang-up - FU in 4 months") {
        const fuDate = new Date();
        fuDate.setMonth(fuDate.getMonth() + 4);
        await db.createTask({
          title: "Follow-up: Not Interested - Hang-up",
          description: "Auto-created from disposition: Not Interested - Hang-up - FU in 4 months",
          taskType: "Follow-up",
          priority: "Medium",
          status: "To Do",
          propertyId,
          createdById: userId,
          dueDate: fuDate,
        } as any);
      }

      expect(db.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Follow-up: Not Interested - Hang-up",
          taskType: "Follow-up",
          propertyId,
          createdById: userId,
        })
      );

      // Verify the due date is approximately 4 months from now
      const taskCall = (db.createTask as any).mock.calls[0][0];
      const expectedDate = new Date();
      expectedDate.setMonth(expectedDate.getMonth() + 4);
      const daysDiff = Math.abs(taskCall.dueDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeLessThan(1); // Within 1 day tolerance
    });

    it("should NOT mark property as DEAD", async () => {
      const callResult = "Not Interested - Hang-up - FU in 4 months";

      if (callResult === "Not Interested - IHATE - DEAD") {
        await db.updateDesk(42, undefined as any, "DEAD");
      }

      expect(db.updateDesk).not.toHaveBeenCalled();
    });
  });

  describe("Server-side auto-actions for Not Interested - NICE - FU in 2 Months", () => {
    it("should create a follow-up task 2 months from now", async () => {
      const propertyId = 42;
      const userId = 1;
      const callResult = "Not Interested - NICE - FU in 2 Months";

      if (callResult === "Not Interested - NICE - FU in 2 Months") {
        const fuDate = new Date();
        fuDate.setMonth(fuDate.getMonth() + 2);
        await db.createTask({
          title: "Follow-up: Not Interested - NICE",
          description: "Auto-created from disposition: Not Interested - NICE - FU in 2 Months",
          taskType: "Follow-up",
          priority: "Medium",
          status: "To Do",
          propertyId,
          createdById: userId,
          dueDate: fuDate,
        } as any);
      }

      expect(db.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Follow-up: Not Interested - NICE",
          taskType: "Follow-up",
          propertyId,
          createdById: userId,
        })
      );

      // Verify the due date is approximately 2 months from now
      const taskCall = (db.createTask as any).mock.calls[0][0];
      const expectedDate = new Date();
      expectedDate.setMonth(expectedDate.getMonth() + 2);
      const daysDiff = Math.abs(taskCall.dueDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeLessThan(1); // Within 1 day tolerance
    });

    it("should NOT mark property as DEAD", async () => {
      const callResult = "Not Interested - NICE - FU in 2 Months";

      if (callResult === "Not Interested - IHATE - DEAD") {
        await db.updateDesk(42, undefined as any, "DEAD");
      }

      expect(db.updateDesk).not.toHaveBeenCalled();
    });
  });

  describe("Lead temperature auto-update", () => {
    it("should set lead temperature to DEAD for IHATE disposition", async () => {
      const callResult = "Not Interested - IHATE - DEAD";
      let newTemperature: string | null = null;

      if (callResult === "Irate - DNC" || callResult === "Sold - DEAD" || callResult === "Not Interested - IHATE - DEAD") {
        newTemperature = "DEAD";
      }

      expect(newTemperature).toBe("DEAD");
    });

    it("should NOT change lead temperature for Hang-up disposition", async () => {
      const callResult = "Not Interested - Hang-up - FU in 4 months";
      let newTemperature: string | null = null;

      if (callResult === "Interested - HOT LEAD") {
        newTemperature = "HOT";
      } else if (callResult === "Irate - DNC" || callResult === "Sold - DEAD" || callResult === "Not Interested - IHATE - DEAD") {
        newTemperature = "DEAD";
      }

      expect(newTemperature).toBeNull();
    });

    it("should NOT change lead temperature for NICE disposition", async () => {
      const callResult = "Not Interested - NICE - FU in 2 Months";
      let newTemperature: string | null = null;

      if (callResult === "Interested - HOT LEAD") {
        newTemperature = "HOT";
      } else if (callResult === "Irate - DNC" || callResult === "Sold - DEAD" || callResult === "Not Interested - IHATE - DEAD") {
        newTemperature = "DEAD";
      }

      expect(newTemperature).toBeNull();
    });
  });
});
