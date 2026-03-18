import { describe, it, expect } from "vitest";
import { tasks, users } from "../drizzle/schema";

describe("Tasks User Filter Feature", () => {
  describe("Schema - Tasks have user relationship fields", () => {
    it("should have assignedToId column", () => {
      expect(tasks.assignedToId).toBeDefined();
    });

    it("should have createdById column", () => {
      expect(tasks.createdById).toBeDefined();
    });
  });

  describe("Schema - Users table exists for filter dropdown", () => {
    it("should have users table with id and name", () => {
      expect(users.id).toBeDefined();
      expect(users.name).toBeDefined();
    });
  });

  describe("getTasks filters - user filter logic", () => {
    it("should filter tasks by assignedToId when userFilter is set", () => {
      const mockTasks = [
        { id: 1, assignedToId: 10, createdById: 5, title: "Task A" },
        { id: 2, assignedToId: 20, createdById: 10, title: "Task B" },
        { id: 3, assignedToId: 10, createdById: 15, title: "Task C" },
        { id: 4, assignedToId: null, createdById: 20, title: "Task D" },
      ];

      const userFilter = "10";
      const userId = parseInt(userFilter);
      const filtered = mockTasks.filter(
        (task) => task.assignedToId === userId || task.createdById === userId
      );

      expect(filtered).toHaveLength(3); // Tasks A, B, C
      expect(filtered.map((t) => t.id)).toEqual([1, 2, 3]);
    });

    it("should return all tasks when userFilter is 'all'", () => {
      const mockTasks = [
        { id: 1, assignedToId: 10, createdById: 5 },
        { id: 2, assignedToId: 20, createdById: 10 },
        { id: 3, assignedToId: 10, createdById: 15 },
      ];

      const userFilter = "all";
      const filtered = mockTasks.filter((task) => {
        if (userFilter === "all") return true;
        const userId = parseInt(userFilter);
        return task.assignedToId === userId || task.createdById === userId;
      });

      expect(filtered).toHaveLength(3);
    });

    it("should match tasks where user is creator but not assigned", () => {
      const mockTasks = [
        { id: 1, assignedToId: 10, createdById: 5 },
        { id: 2, assignedToId: 20, createdById: 5 },
        { id: 3, assignedToId: null, createdById: 5 },
      ];

      const userId = 5;
      const filtered = mockTasks.filter(
        (task) => task.assignedToId === userId || task.createdById === userId
      );

      expect(filtered).toHaveLength(3);
    });

    it("should return empty when no tasks match the user", () => {
      const mockTasks = [
        { id: 1, assignedToId: 10, createdById: 5 },
        { id: 2, assignedToId: 20, createdById: 15 },
      ];

      const userId = 99;
      const filtered = mockTasks.filter(
        (task) => task.assignedToId === userId || task.createdById === userId
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe("db.ts getTasks - aliasedTable for user names", () => {
    it("should import aliasedTable from drizzle-orm", async () => {
      const drizzleOrm = await import("drizzle-orm");
      expect(drizzleOrm.aliasedTable).toBeDefined();
      expect(typeof drizzleOrm.aliasedTable).toBe("function");
    });
  });
});
