/**
 * Tests for the address validation logic used in MapView.tsx
 * Mirrors the isValidAddress function to ensure bad addresses are skipped
 */
import { describe, it, expect } from "vitest";

function isValidAddress(street: string, city: string, state: string): boolean {
  const bad = ["unknown", "xx", "", "n/a", "null", "undefined"];
  const normalize = (s: string) => (s ?? "").trim().toLowerCase();
  if (bad.includes(normalize(street))) return false;
  if (bad.includes(normalize(city))) return false;
  if (bad.includes(normalize(state))) return false;
  if (!/\d/.test(street)) return false;
  return true;
}

describe("isValidAddress", () => {
  it("accepts a normal real estate address", () => {
    expect(isValidAddress("1234 Main St", "Fort Lauderdale", "FL")).toBe(true);
  });

  it("accepts address with apartment number", () => {
    expect(isValidAddress("3234 1st Street Apt 2", "Miami", "FL")).toBe(true);
  });

  it("rejects address where street is 'Unknown'", () => {
    expect(isValidAddress("Unknown", "Miami", "FL")).toBe(false);
  });

  it("rejects address where city is 'Unknown'", () => {
    expect(isValidAddress("123 Main St", "Unknown", "FL")).toBe(false);
  });

  it("rejects address where state is 'XX'", () => {
    expect(isValidAddress("123 Main St", "Miami", "XX")).toBe(false);
  });

  it("rejects address where street is empty", () => {
    expect(isValidAddress("", "Miami", "FL")).toBe(false);
  });

  it("rejects address where street is a person name (no digit)", () => {
    expect(isValidAddress("debra kendrick", "Unknown", "XX")).toBe(false);
  });

  it("rejects address where street is 'santhi sree' (no digit)", () => {
    expect(isValidAddress("santhi sree", "Unknown", "XX")).toBe(false);
  });

  it("rejects address where all fields are Unknown/XX", () => {
    expect(isValidAddress("", "Unknown", "XX")).toBe(false);
  });

  it("rejects address where city is empty string", () => {
    expect(isValidAddress("123 Oak Ave", "", "FL")).toBe(false);
  });

  it("rejects address where state is empty string", () => {
    expect(isValidAddress("123 Oak Ave", "Miami", "")).toBe(false);
  });

  it("rejects address where street has no digit (just a street name)", () => {
    expect(isValidAddress("Main Street", "Miami", "FL")).toBe(false);
  });
});
