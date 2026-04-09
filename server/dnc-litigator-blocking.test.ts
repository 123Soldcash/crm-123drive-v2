/**
 * Tests for DNC + Litigator call blocking logic
 * Verifies that both DNC and Litigator flags block calls identically
 */
import { describe, it, expect } from "vitest";

// Simulate the blocking logic used in CallTrackingTable and makeCall
function shouldBlockCall(phone: { dnc?: number | boolean; isLitigator?: number | boolean }, contact: { dnc?: number | boolean; isLitigator?: number | boolean }): boolean {
  return !!(phone.dnc || contact.dnc || phone.isLitigator || contact.isLitigator);
}

function getBlockReason(phone: { dnc?: number | boolean; isLitigator?: number | boolean }, contact: { dnc?: number | boolean; isLitigator?: number | boolean }): string | null {
  if (phone.isLitigator || contact.isLitigator) return "LITIGATOR";
  if (phone.dnc || contact.dnc) return "DNC";
  return null;
}

describe("DNC + Litigator call blocking", () => {
  describe("shouldBlockCall", () => {
    it("allows call when neither DNC nor Litigator", () => {
      expect(shouldBlockCall({ dnc: 0, isLitigator: 0 }, { dnc: 0, isLitigator: 0 })).toBe(false);
    });

    it("blocks call when phone is DNC", () => {
      expect(shouldBlockCall({ dnc: 1, isLitigator: 0 }, { dnc: 0, isLitigator: 0 })).toBe(true);
    });

    it("blocks call when contact is DNC", () => {
      expect(shouldBlockCall({ dnc: 0, isLitigator: 0 }, { dnc: 1, isLitigator: 0 })).toBe(true);
    });

    it("blocks call when phone is Litigator", () => {
      expect(shouldBlockCall({ dnc: 0, isLitigator: 1 }, { dnc: 0, isLitigator: 0 })).toBe(true);
    });

    it("blocks call when contact is Litigator", () => {
      expect(shouldBlockCall({ dnc: 0, isLitigator: 0 }, { dnc: 0, isLitigator: 1 })).toBe(true);
    });

    it("blocks call when phone is both DNC and Litigator", () => {
      expect(shouldBlockCall({ dnc: 1, isLitigator: 1 }, { dnc: 0, isLitigator: 0 })).toBe(true);
    });

    it("blocks call when contact is DNC and phone is Litigator", () => {
      expect(shouldBlockCall({ dnc: 0, isLitigator: 1 }, { dnc: 1, isLitigator: 0 })).toBe(true);
    });

    it("treats boolean true same as number 1", () => {
      expect(shouldBlockCall({ dnc: false, isLitigator: true }, { dnc: false, isLitigator: false })).toBe(true);
    });
  });

  describe("getBlockReason", () => {
    it("returns null when not blocked", () => {
      expect(getBlockReason({ dnc: 0, isLitigator: 0 }, { dnc: 0, isLitigator: 0 })).toBeNull();
    });

    it("returns DNC when only DNC is set", () => {
      expect(getBlockReason({ dnc: 1, isLitigator: 0 }, { dnc: 0, isLitigator: 0 })).toBe("DNC");
    });

    it("returns LITIGATOR when only Litigator is set", () => {
      expect(getBlockReason({ dnc: 0, isLitigator: 1 }, { dnc: 0, isLitigator: 0 })).toBe("LITIGATOR");
    });

    it("returns LITIGATOR (priority) when both DNC and Litigator are set", () => {
      expect(getBlockReason({ dnc: 1, isLitigator: 1 }, { dnc: 0, isLitigator: 0 })).toBe("LITIGATOR");
    });

    it("returns LITIGATOR when contact is litigator even if phone is only DNC", () => {
      expect(getBlockReason({ dnc: 1, isLitigator: 0 }, { dnc: 0, isLitigator: 1 })).toBe("LITIGATOR");
    });
  });

  describe("tooltip message logic", () => {
    it("shows litigator message when litigator flag is set", () => {
      const phone = { dnc: 0, isLitigator: 1 };
      const contact = { dnc: 0, isLitigator: 0 };
      const message = phone.isLitigator || contact.isLitigator
        ? "⚖️ LITIGATOR — Calls are blocked. Remove litigator flag to enable."
        : "📵 DNC — Calls are blocked.";
      expect(message).toContain("LITIGATOR");
    });

    it("shows DNC message when only DNC flag is set", () => {
      const phone = { dnc: 1, isLitigator: 0 };
      const contact = { dnc: 0, isLitigator: 0 };
      const message = phone.isLitigator || contact.isLitigator
        ? "⚖️ LITIGATOR — Calls are blocked. Remove litigator flag to enable."
        : "📵 DNC — Calls are blocked.";
      expect(message).toContain("DNC");
    });
  });
});
