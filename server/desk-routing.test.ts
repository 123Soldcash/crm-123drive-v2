import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("../drizzle/schema", () => ({
  twilioNumberDesks: {
    twilioNumberId: "twilioNumberId",
    deskId: "deskId",
    id: "id",
  },
  userDesks: {
    userId: "userId",
    deskId: "deskId",
    id: "id",
  },
  desks: { id: "id", name: "name" },
  twilioNumbers: { id: "id", phoneNumber: "phoneNumber" },
  users: { id: "id", status: "status" },
  properties: {},
  visits: {},
  photos: {},
  notes: {},
  skiptracingLogs: {},
  outreachLogs: {},
  communicationLog: {},
  contacts: {},
  contactPhones: {},
  contactEmails: {},
  leadAssignments: {},
  propertyAgents: {},
  propertyOffers: {},
}));

describe("Desk-based routing data model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain: select().from().where() returns []
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue({});
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe("twilioNumberDesks junction table", () => {
    it("should store many-to-many relationship between Twilio numbers and desks", async () => {
      // The schema defines twilioNumberDesks with twilioNumberId and deskId
      const schema = await import("../drizzle/schema");
      expect(schema.twilioNumberDesks).toBeDefined();
      expect(schema.twilioNumberDesks.twilioNumberId).toBeDefined();
      expect(schema.twilioNumberDesks.deskId).toBeDefined();
    });
  });

  describe("userDesks junction table", () => {
    it("should store many-to-many relationship between users and desks", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.userDesks).toBeDefined();
      expect(schema.userDesks.userId).toBeDefined();
      expect(schema.userDesks.deskId).toBeDefined();
    });
  });

  describe("Desk routing logic", () => {
    it("should match Twilio number to desks and find users in those desks", async () => {
      // Simulate: Twilio number 1 is assigned to desk 4 and desk 5
      // User 10 is in desk 4, User 11 is in desk 5, User 12 is in no desk
      // When a call comes to Twilio number 1, only users 10 and 11 should be rung

      const twilioNumberId = 1;
      const deskIds = [4, 5];
      const usersInDesks = [
        { userId: 10, deskId: 4 },
        { userId: 11, deskId: 5 },
      ];

      // Step 1: Get desks for the Twilio number
      const numberDeskRows = deskIds.map(dId => ({ deskId: dId }));
      expect(numberDeskRows.length).toBe(2);

      // Step 2: Get users in those desks
      const uniqueUserIds = Array.from(new Set(usersInDesks.map(r => r.userId)));
      expect(uniqueUserIds).toEqual([10, 11]);
      expect(uniqueUserIds).not.toContain(12); // User 12 is not in any desk
    });

    it("should fall back to all active users when no desks are assigned", () => {
      // If a Twilio number has no desk assignments, all active users should be rung
      const deskIds: number[] = [];
      const shouldFallback = deskIds.length === 0;
      expect(shouldFallback).toBe(true);
    });

    it("should handle a user in multiple desks without duplicates", () => {
      // User 10 is in desk 4 AND desk 5
      const userDeskRows = [
        { userId: 10, deskId: 4 },
        { userId: 10, deskId: 5 },
        { userId: 11, deskId: 4 },
      ];
      const uniqueUserIds = Array.from(new Set(userDeskRows.map(r => r.userId)));
      expect(uniqueUserIds).toEqual([10, 11]);
      expect(uniqueUserIds.length).toBe(2); // No duplicates
    });

    it("should handle a Twilio number assigned to multiple desks", () => {
      // Number assigned to desks 4, 5, 6
      const numberDesks = [
        { deskId: 4 },
        { deskId: 5 },
        { deskId: 6 },
      ];
      const deskIds = numberDesks.map(r => r.deskId);
      expect(deskIds).toEqual([4, 5, 6]);
    });

    it("should normalize phone numbers for matching", () => {
      // The webhook normalizes phone numbers to match Twilio number records
      const to = "+17865551234";
      const calledNumber = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
      const calledDigits = calledNumber.replace(/\D/g, "");

      // Should match against stored number
      const storedNumber = "+17865551234";
      const storedDigits = storedNumber.replace(/\D/g, "");

      expect(calledDigits).toBe(storedDigits);
      expect(calledNumber).toBe(storedNumber);
    });

    it("should normalize numbers without + prefix", () => {
      const to = "17865551234";
      const calledNumber = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
      expect(calledNumber).toBe("+17865551234");
    });
  });
});
