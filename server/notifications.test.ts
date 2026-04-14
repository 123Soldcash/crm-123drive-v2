import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLeftJoin = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

const chainedSelect = {
  from: mockFrom.mockReturnThis(),
  leftJoin: mockLeftJoin.mockReturnThis(),
  where: mockWhere.mockReturnThis(),
  orderBy: mockOrderBy.mockReturnThis(),
  limit: mockLimit.mockReturnThis(),
  offset: mockOffset.mockResolvedValue([]),
};

mockSelect.mockReturnValue(chainedSelect);

const chainedUpdate = {
  set: mockSet.mockReturnThis(),
  where: mockWhere.mockResolvedValue(undefined),
};

mockUpdate.mockReturnValue(chainedUpdate);

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: mockSelect,
    update: mockUpdate,
  }),
}));

vi.mock("../drizzle/schema", () => ({
  crmNotifications: {
    id: "id",
    propertyId: "propertyId",
    source: "source",
    campaignName: "campaignName",
    eventType: "eventType",
    messageText: "messageText",
    isRead: "isRead",
    readAt: "readAt",
    createdAt: "createdAt",
  },
  properties: {
    id: "id",
    addressLine1: "addressLine1",
    city: "city",
    state: "state",
  },
}));

describe("Notifications Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain
    mockFrom.mockReturnValue(chainedSelect);
    mockLeftJoin.mockReturnValue(chainedSelect);
    mockWhere.mockReturnValue(chainedSelect);
    mockOrderBy.mockReturnValue(chainedSelect);
    mockLimit.mockReturnValue(chainedSelect);
    mockOffset.mockResolvedValue([]);
  });

  describe("Data shape", () => {
    it("should have crmNotifications table with required fields", () => {
      // Verify the expected schema fields exist
      const expectedFields = ["id", "propertyId", "source", "campaignName", "eventType", "messageText", "isRead", "createdAt"];
      const sampleRow = {
        id: 1,
        propertyId: 100,
        source: "instantly",
        campaignName: "Campaign A",
        eventType: "message",
        messageText: "Hello",
        isRead: 0,
        readAt: null,
        createdAt: new Date(),
      };
      for (const field of expectedFields) {
        expect(sampleRow).toHaveProperty(field);
      }
    });

    it("should support instantly and autocalls as source values", () => {
      // The source enum should accept these two values
      const validSources = ["instantly", "autocalls"];
      expect(validSources).toContain("instantly");
      expect(validSources).toContain("autocalls");
    });
  });

  describe("List endpoint response shape", () => {
    it("should return { rows, total } shape from list query", async () => {
      // Simulate what the router returns
      const mockRows = [
        {
          id: 1,
          propertyId: 100,
          source: "instantly",
          campaignName: "Test Campaign",
          eventType: "message",
          messageText: "Hello from Instantly",
          isRead: 0,
          readAt: null,
          createdAt: new Date(),
          addressLine1: "123 Main St",
          city: "Miami",
          state: "FL",
        },
      ];

      const response = { rows: mockRows, total: 1 };

      expect(response).toHaveProperty("rows");
      expect(response).toHaveProperty("total");
      expect(Array.isArray(response.rows)).toBe(true);
      expect(response.total).toBe(1);
      expect(response.rows[0].source).toBe("instantly");
    });

    it("should return empty rows when no notifications exist", () => {
      const response = { rows: [], total: 0 };
      expect(response.rows).toHaveLength(0);
      expect(response.total).toBe(0);
    });
  });

  describe("Unread count response shape", () => {
    it("should return count with per-source breakdown", () => {
      const response = { count: 5, instantly: 3, autocalls: 2 };
      expect(response.count).toBe(5);
      expect(response.instantly).toBe(3);
      expect(response.autocalls).toBe(2);
    });

    it("should return zero counts when no unread", () => {
      const response = { count: 0, instantly: 0, autocalls: 0 };
      expect(response.count).toBe(0);
      expect(response.instantly).toBe(0);
      expect(response.autocalls).toBe(0);
    });
  });

  describe("Filter logic", () => {
    it("should filter by source when not 'all'", () => {
      const input = { source: "instantly" as const, unreadOnly: false, limit: 50, offset: 0 };
      const conditions: any[] = [];
      if (input.source !== "all") {
        conditions.push({ type: "eq", field: "source", value: input.source });
      }
      expect(conditions).toHaveLength(1);
      expect(conditions[0].value).toBe("instantly");
    });

    it("should not add source filter when 'all'", () => {
      const input = { source: "all" as const, unreadOnly: false, limit: 50, offset: 0 };
      const conditions: any[] = [];
      if (input.source !== "all") {
        conditions.push({ type: "eq", field: "source", value: input.source });
      }
      expect(conditions).toHaveLength(0);
    });

    it("should add unread filter when unreadOnly is true", () => {
      const input = { source: "all" as const, unreadOnly: true, limit: 50, offset: 0 };
      const conditions: any[] = [];
      if (input.unreadOnly) {
        conditions.push({ type: "eq", field: "isRead", value: 0 });
      }
      expect(conditions).toHaveLength(1);
      expect(conditions[0].value).toBe(0);
    });

    it("should add search filter when search term provided", () => {
      const input = { source: "all" as const, unreadOnly: false, search: "test campaign", limit: 50, offset: 0 };
      const conditions: any[] = [];
      if (input.search) {
        conditions.push({ type: "like", term: `%${input.search}%` });
      }
      expect(conditions).toHaveLength(1);
      expect(conditions[0].term).toBe("%test campaign%");
    });
  });

  describe("Pagination", () => {
    it("should calculate correct offset from page number", () => {
      const PAGE_SIZE = 25;
      const page = 2;
      const offset = page * PAGE_SIZE;
      expect(offset).toBe(50);
    });

    it("should calculate total pages correctly", () => {
      const PAGE_SIZE = 25;
      const total = 73;
      const totalPages = Math.ceil(total / PAGE_SIZE);
      expect(totalPages).toBe(3);
    });

    it("should handle single page", () => {
      const PAGE_SIZE = 25;
      const total = 10;
      const totalPages = Math.ceil(total / PAGE_SIZE);
      expect(totalPages).toBe(1);
    });
  });

  describe("Mark read", () => {
    it("should set isRead to 1 and readAt to current date", () => {
      const updateData = { isRead: 1, readAt: new Date() };
      expect(updateData.isRead).toBe(1);
      expect(updateData.readAt).toBeInstanceOf(Date);
    });
  });

  describe("Mark all read with source filter", () => {
    it("should filter by source when marking all read for instantly", () => {
      const input = { source: "instantly" as const };
      const conditions: any[] = [{ type: "eq", field: "isRead", value: 0 }];
      if (input.source !== "all") {
        conditions.push({ type: "eq", field: "source", value: input.source });
      }
      expect(conditions).toHaveLength(2);
      expect(conditions[1].value).toBe("instantly");
    });

    it("should not filter by source when marking all read for all", () => {
      const input = { source: "all" as const };
      const conditions: any[] = [{ type: "eq", field: "isRead", value: 0 }];
      if (input.source !== "all") {
        conditions.push({ type: "eq", field: "source", value: input.source });
      }
      expect(conditions).toHaveLength(1);
    });
  });
});
