/**
 * Tests for phone number identification and normalization
 * Covers:
 * 1. buildPhoneVariants — generates all lookup variants from a raw number
 * 2. Property search normalization — digits-only search matches formatted stored numbers
 */

import { describe, it, expect } from "vitest";
import { buildPhoneVariants } from "./utils/phoneToPropertyLookup";

describe("buildPhoneVariants", () => {
  it("generates E.164 variant from a 10-digit number", () => {
    const variants = buildPhoneVariants("9044133291");
    expect(variants).toContain("+19044133291");
    expect(variants).toContain("9044133291");
    expect(variants).toContain("19044133291");
  });

  it("generates 10-digit variant from E.164 number", () => {
    const variants = buildPhoneVariants("+19044133291");
    expect(variants).toContain("9044133291");
    expect(variants).toContain("+19044133291");
    expect(variants).toContain("19044133291");
  });

  it("generates formatted variant (xxx) xxx-xxxx for 10-digit number", () => {
    const variants = buildPhoneVariants("9044133291");
    expect(variants).toContain("(904) 413-3291");
  });

  it("generates formatted variant (xxx) xxx-xxxx for E.164 number", () => {
    const variants = buildPhoneVariants("+19044133291");
    expect(variants).toContain("(904) 413-3291");
  });

  it("handles already-formatted number (xxx) xxx-xxxx", () => {
    const variants = buildPhoneVariants("(904) 413-3291");
    expect(variants).toContain("9044133291");
    expect(variants).toContain("+19044133291");
    expect(variants).toContain("(904) 413-3291");
  });

  it("deduplicates variants", () => {
    const variants = buildPhoneVariants("+19044133291");
    const unique = new Set(variants);
    expect(unique.size).toBe(variants.length);
  });

  it("handles 11-digit number starting with 1", () => {
    const variants = buildPhoneVariants("19044133291");
    expect(variants).toContain("9044133291");
    expect(variants).toContain("+19044133291");
  });
});

describe("Phone search normalization logic", () => {
  /**
   * Simulates the MySQL REPLACE() normalization that strips formatting
   * from stored phone numbers before comparing with digits-only search input.
   */
  function normalizePhone(phone: string): string {
    return phone
      .replace(/\(/g, "")
      .replace(/\)/g, "")
      .replace(/-/g, "")
      .replace(/ /g, "")
      .replace(/\+/g, "");
  }

  it("normalizes (904) 413-3291 to 9044133291", () => {
    expect(normalizePhone("(904) 413-3291")).toBe("9044133291");
  });

  it("normalizes +19044133291 to 19044133291", () => {
    expect(normalizePhone("+19044133291")).toBe("19044133291");
  });

  it("digits-only search 9044133291 matches formatted (904) 413-3291", () => {
    const storedPhone = "(904) 413-3291";
    const searchDigits = "9044133291";
    expect(normalizePhone(storedPhone)).toContain(searchDigits);
  });

  it("digits-only search 9044133291 matches E.164 +19044133291", () => {
    const storedPhone = "+19044133291";
    const searchDigits = "9044133291";
    expect(normalizePhone(storedPhone)).toContain(searchDigits);
  });

  it("partial search 904413 matches formatted (904) 413-3291", () => {
    const storedPhone = "(904) 413-3291";
    const searchDigits = "904413";
    expect(normalizePhone(storedPhone)).toContain(searchDigits);
  });
});
