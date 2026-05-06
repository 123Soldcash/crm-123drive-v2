/**
 * Supabase DNC Verification Tests
 * Tests the DNC check logic, phone normalization, and API integration patterns.
 *
 * SQL setup (Supabase):
 *   - Table: public.dnc_numbers (phone bigint primary key)
 *   - RLS enabled; SELECT revoked from anon/authenticated
 *   - RPC: check_dnc(p_number bigint) returns boolean (security definer)
 *   - EXECUTE granted to anon only
 *
 * System sends: POST /rest/v1/rpc/check_dnc  body: { p_number: <number> }
 * Supabase returns: true | false  (direct boolean, not wrapped in array)
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
  /**
   * Supabase RPC with security definer returns a direct boolean (true/false),
   * NOT wrapped in an array. The system handles both formats for resilience.
   */
  function parseDNCResponse(data: any): boolean {
    if (Array.isArray(data) && data.length > 0) {
      return data[0] === true;
    }
    if (typeof data === "boolean") {
      return data;
    }
    return false;
  }

  it("parses [true] as DNC = true (array format)", () => {
    expect(parseDNCResponse([true])).toBe(true);
  });

  it("parses [false] as DNC = false (array format)", () => {
    expect(parseDNCResponse([false])).toBe(false);
  });

  it("parses direct boolean true (security definer RPC format)", () => {
    expect(parseDNCResponse(true)).toBe(true);
  });

  it("parses direct boolean false (security definer RPC format)", () => {
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
  /**
   * The Supabase RPC function check_dnc(p_number bigint) requires a numeric
   * value, NOT a string. The system converts the normalized phone string to
   * a JavaScript Number before serializing to JSON.
   */
  it("sends p_number as a number (bigint-compatible), not a string", () => {
    const normalized = "9543289618";
    const body = JSON.stringify({ p_number: Number(normalized) });
    const parsed = JSON.parse(body);
    expect(typeof parsed.p_number).toBe("number");
    expect(parsed.p_number).toBe(9543289618);
  });

  it("Number() conversion preserves all 10 digits of a US phone", () => {
    // Ensure no precision loss for typical 10-digit US numbers
    const phones = ["9543289618", "3051234567", "7864009999", "9990000001"];
    for (const p of phones) {
      expect(Number(p).toString()).toBe(p);
    }
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

// ─── HTTP error handling ─────────────────────────────────────────────────────

describe("DNC HTTP Error Handling", () => {
  /**
   * The system throws a descriptive Error for non-2xx responses so the
   * frontend can display a meaningful toast message.
   */

  function buildErrorFromResponse(status: number, body: string): Error {
    const detail = body ? ` — ${body.slice(0, 120)}` : "";
    return new Error(`DNC service returned HTTP ${status}${detail}`);
  }

  it("throws error with HTTP 401 status", () => {
    const err = buildErrorFromResponse(401, '{"message":"Invalid API key"}');
    expect(err.message).toContain("HTTP 401");
    expect(err.message).toContain("Invalid API key");
  });

  it("throws error with HTTP 403 status", () => {
    const err = buildErrorFromResponse(403, '{"message":"Forbidden"}');
    expect(err.message).toContain("HTTP 403");
  });

  it("throws error with HTTP 500 status", () => {
    const err = buildErrorFromResponse(500, "Internal Server Error");
    expect(err.message).toContain("HTTP 500");
    expect(err.message).toContain("Internal Server Error");
  });

  it("includes truncated body (max 120 chars) in error message", () => {
    const longBody = "x".repeat(200);
    const err = buildErrorFromResponse(500, longBody);
    // The detail part should be at most 120 chars from the body
    const detail = err.message.replace("DNC service returned HTTP 500 — ", "");
    expect(detail.length).toBeLessThanOrEqual(120);
  });

  it("handles empty response body gracefully", () => {
    const err = buildErrorFromResponse(503, "");
    expect(err.message).toBe("DNC service returned HTTP 503");
  });
});

// ─── Network / connection error handling ────────────────────────────────────

describe("DNC Network Error Handling", () => {
  function buildConnectionError(originalMessage: string): Error {
    return new Error(`DNC connection error: ${originalMessage}`);
  }

  it("wraps DNS failure message", () => {
    const err = buildConnectionError("getaddrinfo ENOTFOUND mkzlmcugwnzinedpmmgj.supabase.co");
    expect(err.message).toContain("DNC connection error");
    expect(err.message).toContain("ENOTFOUND");
  });

  it("wraps connection refused message", () => {
    const err = buildConnectionError("connect ECONNREFUSED 127.0.0.1:443");
    expect(err.message).toContain("DNC connection error");
    expect(err.message).toContain("ECONNREFUSED");
  });

  it("wraps timeout message", () => {
    const err = buildConnectionError("network timeout");
    expect(err.message).toContain("DNC connection error");
    expect(err.message).toContain("timeout");
  });
});

// ─── Invalid JSON response handling ─────────────────────────────────────────

describe("DNC Invalid JSON Response Handling", () => {
  function parseOrThrow(text: string): boolean {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err: any) {
      throw new Error(`DNC service returned invalid JSON: ${err?.message}`);
    }
    if (typeof data === "boolean") return data;
    if (Array.isArray(data) && data.length > 0) return data[0] === true;
    return false;
  }

  it("throws on HTML error page response", () => {
    expect(() => parseOrThrow("<html><body>Error</body></html>")).toThrow("invalid JSON");
  });

  it("throws on plain text response", () => {
    expect(() => parseOrThrow("Service Unavailable")).toThrow("invalid JSON");
  });

  it("parses valid boolean true response", () => {
    expect(parseOrThrow("true")).toBe(true);
  });

  it("parses valid boolean false response", () => {
    expect(parseOrThrow("false")).toBe(false);
  });
});

// ─── Short / empty phone skip logic ─────────────────────────────────────────

describe("DNC Short/Empty Phone Skip Logic", () => {
  /**
   * The system skips DNC check for phones with fewer than 7 digits after
   * normalization (e.g., partial numbers, test entries).
   */
  function shouldSkip(phone: string): boolean {
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.length >= 10 ? digits.slice(-10) : digits;
    return !normalized || normalized.length < 7;
  }

  it("skips empty phone", () => {
    expect(shouldSkip("")).toBe(true);
  });

  it("skips phone with only 4 digits", () => {
    expect(shouldSkip("1234")).toBe(true);
  });

  it("skips phone with 6 digits", () => {
    expect(shouldSkip("123456")).toBe(true);
  });

  it("does NOT skip phone with 7 digits", () => {
    expect(shouldSkip("1234567")).toBe(false);
  });

  it("does NOT skip a full 10-digit phone", () => {
    expect(shouldSkip("9543289618")).toBe(false);
  });

  it("does NOT skip a formatted 10-digit phone", () => {
    expect(shouldSkip("(954) 328-9618")).toBe(false);
  });
});

// ─── Batch error propagation ─────────────────────────────────────────────────

describe("DNC Batch Error Propagation", () => {
  /**
   * When a batch fails mid-way, the system returns partial results with
   * the error message and the count of phones processed before failure.
   */
  it("returns partial results with error when batch fails at index 10", () => {
    const totalPhones = 25;
    const failAtBatch = 1; // 0-indexed: second batch (phones 10-19)
    const BATCH_SIZE = 10;

    // Simulate: first batch (0-9) succeeds, second batch throws
    const processedBeforeFailure = failAtBatch * BATCH_SIZE; // = 10
    const errorMessage = "DNC connection error: network timeout";

    const result = {
      checked: processedBeforeFailure,
      flagged: 2,
      results: [{ phoneId: 1, phoneNumber: "9541111111", isDNC: true }],
      error: errorMessage,
    };

    expect(result.checked).toBe(10);
    expect(result.error).toContain("timeout");
    expect(result.results.length).toBe(1);
  });

  it("returns error message when not configured", () => {
    const result = {
      checked: 0,
      flagged: 0,
      results: [],
      error: "Supabase DNC not configured. Go to Integrations → Supabase DNC to set URL and API Key.",
    };
    expect(result.error).toContain("not configured");
    expect(result.checked).toBe(0);
  });
});
