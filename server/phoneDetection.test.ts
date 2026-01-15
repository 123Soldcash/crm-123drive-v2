import { describe, it, expect } from "vitest";
import { normalizePhoneNumber, phoneNumbersMatch, formatPhoneNumber } from "./utils/phoneNormalization";

describe("Phone Number Normalization", () => {
  describe("normalizePhoneNumber", () => {
    it("should remove all formatting characters", () => {
      expect(normalizePhoneNumber("(305) 555-1234")).toBe("3055551234");
      expect(normalizePhoneNumber("305-555-1234")).toBe("3055551234");
      expect(normalizePhoneNumber("305.555.1234")).toBe("3055551234");
      expect(normalizePhoneNumber("305 555 1234")).toBe("3055551234");
    });

    it("should handle country codes", () => {
      expect(normalizePhoneNumber("+1 305 555 1234")).toBe("13055551234");
      expect(normalizePhoneNumber("+1-305-555-1234")).toBe("13055551234");
      expect(normalizePhoneNumber("1 (305) 555-1234")).toBe("13055551234");
    });

    it("should handle already normalized numbers", () => {
      expect(normalizePhoneNumber("3055551234")).toBe("3055551234");
      expect(normalizePhoneNumber("13055551234")).toBe("13055551234");
    });
  });

  describe("phoneNumbersMatch", () => {
    it("should match identical normalized numbers", () => {
      expect(phoneNumbersMatch("3055551234", "3055551234")).toBe(true);
      expect(phoneNumbersMatch("(305) 555-1234", "305-555-1234")).toBe(true);
    });

    it("should match numbers with and without country code", () => {
      expect(phoneNumbersMatch("3055551234", "13055551234")).toBe(true);
      expect(phoneNumbersMatch("13055551234", "3055551234")).toBe(true);
      expect(phoneNumbersMatch("+1 305 555 1234", "(305) 555-1234")).toBe(true);
    });

    it("should not match different numbers", () => {
      expect(phoneNumbersMatch("3055551234", "3055551235")).toBe(false);
      expect(phoneNumbersMatch("3055551234", "3065551234")).toBe(false);
    });
  });

  describe("formatPhoneNumber", () => {
    it("should format 10-digit US numbers", () => {
      expect(formatPhoneNumber("3055551234")).toBe("(305) 555-1234");
      expect(formatPhoneNumber("305-555-1234")).toBe("(305) 555-1234");
    });

    it("should format 11-digit US numbers with country code", () => {
      expect(formatPhoneNumber("13055551234")).toBe("+1 (305) 555-1234");
      expect(formatPhoneNumber("+1 305 555 1234")).toBe("+1 (305) 555-1234");
    });

    it("should return original for non-standard formats", () => {
      expect(formatPhoneNumber("123")).toBe("123");
      expect(formatPhoneNumber("12345678901234")).toBe("12345678901234");
    });
  });
});
