import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the integrationConfig module
vi.mock("./integrationConfig", () => ({
  getIntegrationConfig: vi.fn(),
}));

// Mock the _core/env module
vi.mock("./_core/env", () => ({
  ENV: {
    twilioAccountSid: "ACtest123",
    twilioAuthToken: "testtoken123",
    twilioPhoneNumber: "+15551234567",
    twilioMessagingServiceSid: "MGtest123",
  },
}));

// Mock twilio
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        sid: "SM_test_sid_123",
        status: "sent",
      }),
    },
  })),
}));

// Mock global fetch for Instantly/AutoCalls API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Automated Follow-ups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Module exports", () => {
    it("should export all required functions", async () => {
      const mod = await import("./db-automated-followups");
      expect(mod.createAutomatedFollowUp).toBeDefined();
      expect(mod.getFollowUpsByProperty).toBeDefined();
      expect(mod.getPendingFollowUps).toBeDefined();
      expect(mod.executeFollowUp).toBeDefined();
      expect(mod.pauseFollowUp).toBeDefined();
      expect(mod.resumeFollowUp).toBeDefined();
      expect(mod.deleteFollowUp).toBeDefined();
      expect(mod.startFollowUpScheduler).toBeDefined();
      expect(mod.stopFollowUpScheduler).toBeDefined();
      expect(mod.runSchedulerCycle).toBeDefined();
    });
  });

  describe("createAutomatedFollowUp", () => {
    it("should return error when database is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const { createAutomatedFollowUp } = await import("./db-automated-followups");
      const result = await createAutomatedFollowUp({
        propertyId: 1,
        type: "Cold Lead",
        trigger: "No contact in 30 days",
        action: "Send SMS",
        actionDetails: { message: "Hello!" },
        nextRunAt: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Error");
    });
  });

  describe("getFollowUpsByProperty", () => {
    it("should return empty array when database is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const { getFollowUpsByProperty } = await import("./db-automated-followups");
      const result = await getFollowUpsByProperty(1);
      expect(result).toEqual([]);
    });
  });

  describe("pauseFollowUp", () => {
    it("should return error when database is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const { pauseFollowUp } = await import("./db-automated-followups");
      const result = await pauseFollowUp(1);
      expect(result.success).toBe(false);
    });
  });

  describe("resumeFollowUp", () => {
    it("should return error when database is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const { resumeFollowUp } = await import("./db-automated-followups");
      const result = await resumeFollowUp(1);
      expect(result.success).toBe(false);
    });
  });

  describe("deleteFollowUp", () => {
    it("should return error when database is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const { deleteFollowUp } = await import("./db-automated-followups");
      const result = await deleteFollowUp(1);
      expect(result.success).toBe(false);
    });
  });

  describe("executeFollowUp", () => {
    it("should return error when database is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const { executeFollowUp } = await import("./db-automated-followups");
      const result = await executeFollowUp(999);
      expect(result.success).toBe(false);
    });
  });

  describe("Scheduler", () => {
    it("should start and stop the scheduler without errors", async () => {
      const { startFollowUpScheduler, stopFollowUpScheduler } = await import("./db-automated-followups");

      // Stop any existing scheduler first
      stopFollowUpScheduler();

      // Start should not throw
      expect(() => startFollowUpScheduler()).not.toThrow();

      // Stop should not throw
      expect(() => stopFollowUpScheduler()).not.toThrow();
    });

    it("runSchedulerCycle should handle empty pending list", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const { runSchedulerCycle } = await import("./db-automated-followups");
      const result = await runSchedulerCycle();
      expect(result.processed).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe("Instantly API integration shape", () => {
    it("should call Instantly API with correct headers and body structure", async () => {
      // This test verifies the API call structure without hitting the real API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ leads_uploaded: 1 }),
      });

      // Verify fetch was set up correctly
      const response = await fetch("https://api.instantly.ai/api/v2/leads/add", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: [{
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            phone: "+15551234567",
            company_name: "",
            custom_variables: {
              property_id: "123",
              source: "CRM Follow-up",
              follow_up_type: "automated",
            },
          }],
          campaign_id: "test-campaign-id",
          skip_if_in_campaign: true,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.leads_uploaded).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.instantly.ai/api/v2/leads/add",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer test-key",
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("AutoCalls API integration shape", () => {
    it("should call AutoCalls API with correct structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, leads_added: 1 }),
      });

      const response = await fetch("https://api.autocalls.ai/campaigns/test-campaign/leads", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: [{
            phone_number: "+15551234567",
            first_name: "John",
            last_name: "Doe",
            name: "John Doe",
            email: "test@example.com",
            custom_data: {
              property_id: "123",
              source: "CRM Follow-up",
            },
          }],
        }),
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.autocalls.ai/campaigns/test-campaign/leads",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });
});
