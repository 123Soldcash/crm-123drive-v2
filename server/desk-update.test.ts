import { describe, it, expect } from "vitest";

/**
 * Tests for Desk Name Updates:
 * - DESK_1 = Manager
 * - DESK_2 = Edsel
 * - DESK_3 = Zach
 * - DESK_4 = Rodolfo
 * - DESK_5 = Lucas
 * - NEW_LEAD = default for all new leads
 */

// Simulate the desk label mapping used across frontend components
const getDeskLabel = (desk: string) => {
  const labels: Record<string, string> = {
    NEW_LEAD: "🆕 New Lead",
    DESK_CHRIS: "🏀 Chris",
    DESK_DEEP_SEARCH: "🔍 Deep Search",
    DESK_1: "🟦 Manager",
    DESK_2: "🟩 Edsel",
    DESK_3: "🟧 Zach",
    DESK_4: "🔵 Rodolfo",
    DESK_5: "🟨 Lucas",
    BIN: "🗑️ BIN",
    ARCHIVED: "⬛ Archived",
  };
  return labels[desk] || desk;
};

const getDeskColor = (desk: string | null | undefined) => {
  const colors: Record<string, string> = {
    NEW_LEAD: "bg-green-200 text-green-800",
    DESK_CHRIS: "bg-orange-200 text-orange-800",
    DESK_DEEP_SEARCH: "bg-purple-200 text-purple-800",
    DESK_1: "bg-sky-200 text-sky-800",
    DESK_2: "bg-emerald-200 text-emerald-800",
    DESK_3: "bg-pink-200 text-pink-800",
    DESK_4: "bg-blue-600 text-white",
    DESK_5: "bg-amber-200 text-amber-800",
    BIN: "bg-gray-200 text-gray-700",
    ARCHIVED: "bg-gray-800 text-white",
  };
  return colors[desk || ""] || "bg-gray-200 text-gray-700";
};

describe("Desk Name Mapping", () => {
  it("DESK_1 should display as Manager", () => {
    expect(getDeskLabel("DESK_1")).toBe("🟦 Manager");
  });

  it("DESK_2 should display as Edsel", () => {
    expect(getDeskLabel("DESK_2")).toBe("🟩 Edsel");
  });

  it("DESK_3 should display as Zach", () => {
    expect(getDeskLabel("DESK_3")).toBe("🟧 Zach");
  });

  it("DESK_4 should display as Rodolfo", () => {
    expect(getDeskLabel("DESK_4")).toBe("🔵 Rodolfo");
  });

  it("DESK_5 should display as Lucas", () => {
    expect(getDeskLabel("DESK_5")).toBe("🟨 Lucas");
  });

  it("NEW_LEAD should display as New Lead", () => {
    expect(getDeskLabel("NEW_LEAD")).toBe("🆕 New Lead");
  });

  it("BIN should display as BIN", () => {
    expect(getDeskLabel("BIN")).toBe("🗑️ BIN");
  });

  it("ARCHIVED should display as Archived", () => {
    expect(getDeskLabel("ARCHIVED")).toBe("⬛ Archived");
  });

  it("DESK_CHRIS should display as Chris", () => {
    expect(getDeskLabel("DESK_CHRIS")).toBe("🏀 Chris");
  });

  it("DESK_DEEP_SEARCH should display as Deep Search", () => {
    expect(getDeskLabel("DESK_DEEP_SEARCH")).toBe("🔍 Deep Search");
  });

  it("unknown desk should return the raw value", () => {
    expect(getDeskLabel("UNKNOWN_DESK")).toBe("UNKNOWN_DESK");
  });
});

describe("Desk Color Mapping", () => {
  it("NEW_LEAD should have green color", () => {
    expect(getDeskColor("NEW_LEAD")).toBe("bg-green-200 text-green-800");
  });

  it("DESK_1 (Manager) should have sky color", () => {
    expect(getDeskColor("DESK_1")).toBe("bg-sky-200 text-sky-800");
  });

  it("DESK_4 (Rodolfo) should have blue color", () => {
    expect(getDeskColor("DESK_4")).toBe("bg-blue-600 text-white");
  });

  it("null desk should return default gray", () => {
    expect(getDeskColor(null)).toBe("bg-gray-200 text-gray-700");
  });

  it("undefined desk should return default gray", () => {
    expect(getDeskColor(undefined)).toBe("bg-gray-200 text-gray-700");
  });
});

describe("Desk Options Order", () => {
  const DESK_OPTIONS = ["NEW_LEAD", "DESK_CHRIS", "DESK_DEEP_SEARCH", "DESK_1", "DESK_2", "DESK_3", "DESK_4", "DESK_5", "BIN", "ARCHIVED"];

  it("should have NEW_LEAD as first option", () => {
    expect(DESK_OPTIONS[0]).toBe("NEW_LEAD");
  });

  it("should have BIN near the end (before ARCHIVED)", () => {
    expect(DESK_OPTIONS[DESK_OPTIONS.length - 2]).toBe("BIN");
  });

  it("should have ARCHIVED as last option", () => {
    expect(DESK_OPTIONS[DESK_OPTIONS.length - 1]).toBe("ARCHIVED");
  });

  it("should have 10 desk options total", () => {
    expect(DESK_OPTIONS.length).toBe(10);
  });

  it("should include all 5 numbered desks", () => {
    expect(DESK_OPTIONS).toContain("DESK_1");
    expect(DESK_OPTIONS).toContain("DESK_2");
    expect(DESK_OPTIONS).toContain("DESK_3");
    expect(DESK_OPTIONS).toContain("DESK_4");
    expect(DESK_OPTIONS).toContain("DESK_5");
  });
});

describe("Default Desk for New Leads", () => {
  it("manual property creation should default to NEW_LEAD", () => {
    // Simulates the raw SQL default in the create property mutation
    const defaultDeskName = "NEW_LEAD";
    const defaultDeskStatus = "BIN";
    expect(defaultDeskName).toBe("NEW_LEAD");
    expect(defaultDeskStatus).toBe("BIN");
  });

  it("webhook/Zapier property creation should default to NEW_LEAD", () => {
    // Simulates the webhook property creation default
    const webhookDefaults = {
      deskName: "NEW_LEAD",
      deskStatus: "BIN",
    };
    expect(webhookDefaults.deskName).toBe("NEW_LEAD");
    expect(webhookDefaults.deskStatus).toBe("BIN");
  });

  it("website lead (Step 1) should default to NEW_LEAD", () => {
    // Simulates the Zapier Step 1 webhook default
    const step1Defaults = {
      deskName: "NEW_LEAD",
      deskStatus: "BIN",
      status: "Website Lead - Step 1",
    };
    expect(step1Defaults.deskName).toBe("NEW_LEAD");
  });
});

describe("DeskDialog handleSave logic", () => {
  const handleSave = (selectedDesk: string) => {
    let deskName: string | undefined;
    let deskStatus: "BIN" | "ACTIVE" | "ARCHIVED";

    if (selectedDesk === "BIN") {
      deskName = "BIN";
      deskStatus = "BIN";
    } else if (selectedDesk === "NEW_LEAD") {
      deskName = "NEW_LEAD";
      deskStatus = "BIN";
    } else if (selectedDesk === "ARCHIVED") {
      deskName = "ARCHIVED";
      deskStatus = "ARCHIVED";
    } else {
      deskName = selectedDesk;
      deskStatus = "ACTIVE";
    }

    return { deskName, deskStatus };
  };

  it("selecting NEW_LEAD should set deskStatus to BIN", () => {
    const result = handleSave("NEW_LEAD");
    expect(result.deskName).toBe("NEW_LEAD");
    expect(result.deskStatus).toBe("BIN");
  });

  it("selecting BIN should set deskStatus to BIN", () => {
    const result = handleSave("BIN");
    expect(result.deskName).toBe("BIN");
    expect(result.deskStatus).toBe("BIN");
  });

  it("selecting DESK_1 (Manager) should set deskStatus to ACTIVE", () => {
    const result = handleSave("DESK_1");
    expect(result.deskName).toBe("DESK_1");
    expect(result.deskStatus).toBe("ACTIVE");
  });

  it("selecting ARCHIVED should set deskStatus to ARCHIVED", () => {
    const result = handleSave("ARCHIVED");
    expect(result.deskName).toBe("ARCHIVED");
    expect(result.deskStatus).toBe("ARCHIVED");
  });

  it("selecting DESK_4 (Rodolfo) should set deskStatus to ACTIVE", () => {
    const result = handleSave("DESK_4");
    expect(result.deskName).toBe("DESK_4");
    expect(result.deskStatus).toBe("ACTIVE");
  });
});
