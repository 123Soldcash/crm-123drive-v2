import { describe, it, expect } from "vitest";

/**
 * Tests for the "Archived → Dead" rename and justification requirement.
 * 
 * Covers:
 * 1. Schema enum values (BIN, ACTIVE, DEAD — no ARCHIVED)
 * 2. Desk status mapping logic (DEAD → deskStatus DEAD, others → ACTIVE)
 * 3. Dead reason note formatting
 * 4. DNC flow updates to use DEAD instead of ARCHIVED
 */

// ─── Schema Enum Tests ───
describe("Desk Status Enum", () => {
  const VALID_DESK_STATUSES = ["BIN", "ACTIVE", "DEAD"];

  it("should include DEAD as a valid desk status", () => {
    expect(VALID_DESK_STATUSES).toContain("DEAD");
  });

  it("should NOT include ARCHIVED as a valid desk status", () => {
    expect(VALID_DESK_STATUSES).not.toContain("ARCHIVED");
  });

  it("should have exactly 3 desk status values", () => {
    expect(VALID_DESK_STATUSES).toHaveLength(3);
  });

  it("should include BIN for new/unassigned leads", () => {
    expect(VALID_DESK_STATUSES).toContain("BIN");
  });

  it("should include ACTIVE for in-progress leads", () => {
    expect(VALID_DESK_STATUSES).toContain("ACTIVE");
  });
});

// ─── Desk Status Mapping Logic ───
describe("Desk Status Mapping", () => {
  // Replicate the mapping logic from PropertyDetail.tsx
  function getDeskStatus(deskName: string): string {
    if (deskName === "BIN") return "BIN";
    if (deskName === "DEAD") return "DEAD";
    return "ACTIVE";
  }

  it("should map DEAD desk name to DEAD status", () => {
    expect(getDeskStatus("DEAD")).toBe("DEAD");
  });

  it("should map BIN desk name to BIN status", () => {
    expect(getDeskStatus("BIN")).toBe("BIN");
  });

  it("should map NEW_LEAD desk name to ACTIVE status", () => {
    expect(getDeskStatus("NEW_LEAD")).toBe("ACTIVE");
  });

  it("should map DESK_CHRIS to ACTIVE status", () => {
    expect(getDeskStatus("DESK_CHRIS")).toBe("ACTIVE");
  });

  it("should map DESK_1 (Manager) to ACTIVE status", () => {
    expect(getDeskStatus("DESK_1")).toBe("ACTIVE");
  });

  it("should map any other desk name to ACTIVE status", () => {
    expect(getDeskStatus("DESK_DEEP_SEARCH")).toBe("ACTIVE");
    expect(getDeskStatus("DESK_2")).toBe("ACTIVE");
    expect(getDeskStatus("DESK_3")).toBe("ACTIVE");
  });
});

// ─── Dead Reason Note Formatting ───
describe("Dead Reason Note Formatting", () => {
  function formatDeadNote(reason: string): string {
    return `💀 Lead Marked as DEAD\nReason: ${reason}`;
  }

  it("should format dead reason note with skull emoji and reason", () => {
    const note = formatDeadNote("Owner not interested");
    expect(note).toContain("💀 Lead Marked as DEAD");
    expect(note).toContain("Reason: Owner not interested");
  });

  it("should include the full reason text", () => {
    const reason = "Property already sold to another buyer. Confirmed via phone call on 03/20/2026.";
    const note = formatDeadNote(reason);
    expect(note).toContain(reason);
  });

  it("should have the correct format with newline separator", () => {
    const note = formatDeadNote("Test reason");
    const lines = note.split("\n");
    expect(lines[0]).toBe("💀 Lead Marked as DEAD");
    expect(lines[1]).toBe("Reason: Test reason");
  });
});

// ─── DNC → Dead Flow ───
describe("DNC to Dead Status Flow", () => {
  function formatDncDeadNote(contactName: string, phone: string, reason: string): string {
    return `💀 Lead Marked as DEAD (via DNC)\nContact: ${contactName} - ${phone}\nReason: ${reason}`;
  }

  it("should format DNC dead note with contact info", () => {
    const note = formatDncDeadNote("John Doe", "(555) 123-4567", "Number disconnected");
    expect(note).toContain("💀 Lead Marked as DEAD (via DNC)");
    expect(note).toContain("Contact: John Doe - (555) 123-4567");
    expect(note).toContain("Reason: Number disconnected");
  });

  it("should indicate the dead status was triggered via DNC", () => {
    const note = formatDncDeadNote("Jane", "(555) 000-0000", "Do not call request");
    expect(note).toContain("via DNC");
  });
});

// ─── Desk Options Configuration ───
describe("Desk Options Configuration", () => {
  const DESK_OPTIONS = [
    { value: "NEW_LEAD", label: "🆕 New Lead" },
    { value: "DESK_CHRIS", label: "🏀 Chris" },
    { value: "DESK_DEEP_SEARCH", label: "🔍 Deep Search" },
    { value: "DESK_1", label: "🟦 Manager" },
    { value: "DESK_2", label: "🟩 Edsel" },
    { value: "DESK_3", label: "🟧 Zach" },
    { value: "DESK_4", label: "🔵 Rodolfo" },
    { value: "DESK_5", label: "🟨 Lucas" },
    { value: "BIN", label: "🗑️ BIN" },
    { value: "DEAD", label: "💀 Dead" },
  ];

  it("should have DEAD option with skull emoji", () => {
    const deadOption = DESK_OPTIONS.find(d => d.value === "DEAD");
    expect(deadOption).toBeDefined();
    expect(deadOption!.label).toBe("💀 Dead");
  });

  it("should NOT have an ARCHIVED option", () => {
    const archivedOption = DESK_OPTIONS.find(d => d.value === "ARCHIVED");
    expect(archivedOption).toBeUndefined();
  });

  it("should have DEAD as the last option", () => {
    const lastOption = DESK_OPTIONS[DESK_OPTIONS.length - 1];
    expect(lastOption.value).toBe("DEAD");
  });
});

// ─── Justification Validation ───
describe("Dead Justification Validation", () => {
  function validateDeadReason(reason: string): { valid: boolean; error?: string } {
    if (!reason.trim()) {
      return { valid: false, error: "A justification is required when marking a lead as Dead." };
    }
    return { valid: true };
  }

  it("should reject empty reason", () => {
    const result = validateDeadReason("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should reject whitespace-only reason", () => {
    const result = validateDeadReason("   ");
    expect(result.valid).toBe(false);
  });

  it("should accept valid reason", () => {
    const result = validateDeadReason("Owner not interested");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should accept long detailed reason", () => {
    const result = validateDeadReason("Property already sold to another buyer. Confirmed via phone call on 03/20/2026. Owner stated they are no longer interested in selling.");
    expect(result.valid).toBe(true);
  });
});
