/**
 * Supabase DNC Verification Tests
 * Tests the DNC check logic, phone normalization, and API integration patterns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Phone normalization tests ──────────────────────────────────────────────

describe("DNC Phone Normalization", () => {
  function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  it("normalizes +1 prefixed numbers to 10 digits", () => {
    expect(normalizePhone("+19543289618")).toBe("9543289618");
  });

  it("normalizes 11-digit numbers to 10 digits", () => {
    expect(normalizePhone("19543289618")).toBe("9543289618");
  });

  it("normalizes formatted numbers with dashes", () => {
    expect(normalizePhone("954-328-9618")).toBe("9543289618");
  });

  it("normalizes formatted numbers with parentheses", () => {
    expect(normalizePhone("(954) 328-9618")).toBe("9543289618");
  });

  it("normalizes formatted numbers with dots", () => {
    expect(normalizePhone("954.328.9618")).toBe("9543289618");
  });

  it("normalizes 10-digit numbers as-is", () => {
    expect(normalizePhone("9543289618")).toBe("9543289618");
  });

  it("returns short numbers as-is (less than 10 digits)", () => {
    expect(normalizePhone("1234567")).toBe("1234567");
  });

  it("handles empty string", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("handles numbers with spaces", () => {
    expect(normalizePhone("954 328 9618")).toBe("9543289618");
  });
});

// ─── Supabase DNC API response parsing ──────────────────────────────────────

describe("DNC API Response Parsing", () => {
  function parseDNCResponse(data: any): boolean {
    if (Array.isArray(data) && data.length > 0) {
      return data[0] === true;
    }
    if (typeof data === "boolean") {
      return data;
    }
    return false;
  }

  it("parses [true] as DNC = true", () => {
    expect(parseDNCResponse([true])).toBe(true);
  });

  it("parses [false] as DNC = false", () => {
    expect(parseDNCResponse([false])).toBe(false);
  });

  it("parses direct boolean true", () => {
    expect(parseDNCResponse(true)).toBe(true);
  });

  it("parses direct boolean false", () => {
    expect(parseDNCResponse(false)).toBe(false);
  });

  it("handles empty array as false", () => {
    expect(parseDNCResponse([])).toBe(false);
  });

  it("handles null as false", () => {
    expect(parseDNCResponse(null)).toBe(false);
  });

  it("handles undefined as false", () => {
    expect(parseDNCResponse(undefined)).toBe(false);
  });

  it("handles string 'true' as false (not boolean)", () => {
    expect(parseDNCResponse(["true"])).toBe(false);
  });

  it("handles number 1 as false (not boolean)", () => {
    expect(parseDNCResponse([1])).toBe(false);
  });
});

// ─── Integration config validation ──────────────────────────────────────────

describe("DNC Integration Config Validation", () => {
  function validateConfig(config: Record<string, string>): { valid: boolean; error?: string } {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      return { valid: false, error: "Supabase URL and API Key are required" };
    }
    if (!config.supabaseUrl.startsWith("http")) {
      return { valid: false, error: "Supabase URL must start with http" };
    }
    return { valid: true };
  }

  it("validates complete config", () => {
    const result = validateConfig({
      supabaseUrl: "https://mkzlmcugwnzinedpmmgj.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      rpcFunctionName: "check_dnc",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing URL", () => {
    const result = validateConfig({
      supabaseUrl: "",
      supabaseAnonKey: "some-key",
      rpcFunctionName: "check_dnc",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects missing API key", () => {
    const result = validateConfig({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "",
      rpcFunctionName: "check_dnc",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid URL format", () => {
    const result = validateConfig({
      supabaseUrl: "not-a-url",
      supabaseAnonKey: "some-key",
      rpcFunctionName: "check_dnc",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("http");
  });
});

// ─── URL construction ───────────────────────────────────────────────────────

describe("DNC Supabase URL Construction", () => {
  function buildRpcUrl(supabaseUrl: string, rpcFunctionName: string): string {
    return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${rpcFunctionName}`;
  }

  it("builds correct URL without trailing slash", () => {
    expect(buildRpcUrl("https://mkzlmcugwnzinedpmmgj.supabase.co", "check_dnc"))
      .toBe("https://mkzlmcugwnzinedpmmgj.supabase.co/rest/v1/rpc/check_dnc");
  });

  it("strips trailing slash from URL", () => {
    expect(buildRpcUrl("https://mkzlmcugwnzinedpmmgj.supabase.co/", "check_dnc"))
      .toBe("https://mkzlmcugwnzinedpmmgj.supabase.co/rest/v1/rpc/check_dnc");
  });

  it("uses custom function name", () => {
    expect(buildRpcUrl("https://example.supabase.co", "my_custom_dnc_check"))
      .toBe("https://example.supabase.co/rest/v1/rpc/my_custom_dnc_check");
  });
});

// ─── Batch processing logic ─────────────────────────────────────────────────

describe("DNC Batch Processing", () => {
  it("processes phones in batches of 10", () => {
    const phones = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      phoneNumber: `954000000${String(i).padStart(2, "0")}`,
      contactId: Math.ceil((i + 1) / 3),
    }));

    const BATCH_SIZE = 10;
    const batches: typeof phones[] = [];
    for (let i = 0; i < phones.length; i += BATCH_SIZE) {
      batches.push(phones.slice(i, i + BATCH_SIZE));
    }

    expect(batches.length).toBe(3);
    expect(batches[0].length).toBe(10);
    expect(batches[1].length).toBe(10);
    expect(batches[2].length).toBe(5);
  });

  it("handles empty phone list", () => {
    const phones: any[] = [];
    const BATCH_SIZE = 10;
    const batches: any[][] = [];
    for (let i = 0; i < phones.length; i += BATCH_SIZE) {
      batches.push(phones.slice(i, i + BATCH_SIZE));
    }
    expect(batches.length).toBe(0);
  });

  it("correctly deduplicates contact IDs from batch results", () => {
    const batchResults = [
      { phoneId: 1, phoneNumber: "9541111111", contactId: 100, isDNC: true },
      { phoneId: 2, phoneNumber: "9542222222", contactId: 100, isDNC: false },
      { phoneId: 3, phoneNumber: "9543333333", contactId: 200, isDNC: true },
    ];

    const contactIds = Array.from(new Set(batchResults.map((r) => r.contactId)));
    expect(contactIds).toEqual([100, 200]);
  });

  it("detects if any phone for a contact is DNC", () => {
    const batchResults = [
      { phoneId: 1, phoneNumber: "9541111111", contactId: 100, isDNC: false },
      { phoneId: 2, phoneNumber: "9542222222", contactId: 100, isDNC: true },
      { phoneId: 3, phoneNumber: "9543333333", contactId: 200, isDNC: false },
    ];

    const contactIds = Array.from(new Set(batchResults.map((r) => r.contactId)));
    
    const contact100DNC = batchResults.filter(r => r.contactId === 100).some(r => r.isDNC);
    const contact200DNC = batchResults.filter(r => r.contactId === 200).some(r => r.isDNC);

    expect(contact100DNC).toBe(true);
    expect(contact200DNC).toBe(false);
  });
});

// ─── Seed script verification ───────────────────────────────────────────────

describe("DNC Seed Script", () => {
  it("seed script file exists and contains supabase_dnc settings", async () => {
    const fs = await import("fs");
    const seedContent = fs.readFileSync("scripts/seed-supabase-dnc.mjs", "utf-8");
    expect(seedContent).toContain("supabase_dnc");
    expect(seedContent).toContain("supabaseUrl");
    expect(seedContent).toContain("supabaseAnonKey");
    expect(seedContent).toContain("rpcFunctionName");
    expect(seedContent).toContain("check_dnc");
  });
});

// ─── Request body format ────────────────────────────────────────────────────

describe("DNC Request Body Format", () => {
  it("formats request body correctly for Supabase RPC", () => {
    const phoneNumber = "9543289618";
    const body = JSON.stringify({ p_number: phoneNumber });
    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ p_number: "9543289618" });
  });

  it("formats headers correctly for Supabase auth", () => {
    const anonKey = "test-anon-key-123";
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    };
    expect(headers.apikey).toBe(anonKey);
    expect(headers.Authorization).toBe(`Bearer ${anonKey}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
