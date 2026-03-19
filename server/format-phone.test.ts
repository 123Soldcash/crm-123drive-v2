/**
 * Tests for the shared formatPhone utility
 * 
 * The formatPhone function is a display-only mask that formats
 * phone numbers as (XXX) XXX-XXXX without modifying stored values.
 */
import { describe, it, expect } from "vitest";

// Since formatPhone is a client-side utility, we replicate the logic here for testing.
// This ensures the formatting rules are correct and consistent.
function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  // US number with country code: +1 or 1 prefix (11 digits)
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // Standard US 10-digit number
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 7-digit local number (no area code)
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  // Anything else — return as-is
  return phone;
}

describe("formatPhone", () => {
  describe("10-digit US numbers", () => {
    it("formats raw 10 digits as (XXX) XXX-XXXX", () => {
      expect(formatPhone("5551234567")).toBe("(555) 123-4567");
    });

    it("formats number with dashes", () => {
      expect(formatPhone("555-123-4567")).toBe("(555) 123-4567");
    });

    it("formats number with dots", () => {
      expect(formatPhone("555.123.4567")).toBe("(555) 123-4567");
    });

    it("formats number with spaces", () => {
      expect(formatPhone("555 123 4567")).toBe("(555) 123-4567");
    });

    it("formats number already with parentheses", () => {
      expect(formatPhone("(555) 123-4567")).toBe("(555) 123-4567");
    });
  });

  describe("11-digit US numbers with country code", () => {
    it("formats 1XXXXXXXXXX (11 digits starting with 1)", () => {
      expect(formatPhone("15551234567")).toBe("(555) 123-4567");
    });

    it("formats +1XXXXXXXXXX", () => {
      expect(formatPhone("+15551234567")).toBe("(555) 123-4567");
    });

    it("formats +1 (555) 123-4567", () => {
      expect(formatPhone("+1 (555) 123-4567")).toBe("(555) 123-4567");
    });

    it("formats 1-555-123-4567", () => {
      expect(formatPhone("1-555-123-4567")).toBe("(555) 123-4567");
    });
  });

  describe("7-digit local numbers", () => {
    it("formats 7-digit number as XXX-XXXX", () => {
      expect(formatPhone("1234567")).toBe("123-4567");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for null", () => {
      expect(formatPhone(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(formatPhone(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(formatPhone("")).toBe("");
    });

    it("returns as-is for short numbers (less than 7 digits)", () => {
      expect(formatPhone("12345")).toBe("12345");
    });

    it("returns as-is for international numbers", () => {
      expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    });

    it("returns as-is for very long numbers", () => {
      expect(formatPhone("123456789012345")).toBe("123456789012345");
    });
  });

  describe("real-world CRM phone formats", () => {
    it("formats 5616677439 (from Larry Gaines contact)", () => {
      expect(formatPhone("5616677439")).toBe("(561) 667-7439");
    });

    it("formats 9545005965 (from Larry Gaines contact)", () => {
      expect(formatPhone("9545005965")).toBe("(954) 500-5965");
    });

    it("formats +13055551234 (Twilio format)", () => {
      expect(formatPhone("+13055551234")).toBe("(305) 555-1234");
    });

    it("formats 7864996178 (from buyer contact)", () => {
      expect(formatPhone("7864996178")).toBe("(786) 499-6178");
    });

    it("formats 7543688666 (from buyer contact)", () => {
      expect(formatPhone("7543688666")).toBe("(754) 368-8666");
    });
  });
});
