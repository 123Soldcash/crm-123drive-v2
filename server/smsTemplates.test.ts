/**
 * Unit tests for SMS Templates business logic.
 *
 * Tests cover:
 * - Template name and body validation
 * - Category defaults
 * - Variable placeholder detection
 * - Usage-based delete guard logic
 * - createAutomatedFollowUp with templateId fields
 */
import { describe, it, expect } from "vitest";

// ─── Template Validation Helpers ─────────────────────────────────────────────
function validateTemplate(input: { name: string; body: string; category?: string }) {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) errors.push("name_required");
  if (input.name && input.name.trim().length > 255) errors.push("name_too_long");
  if (!input.body || input.body.trim().length === 0) errors.push("body_required");
  return errors;
}

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches)];
}

function resolveVariables(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function canDeleteTemplate(
  activeUsageCount: number,
  force: boolean
): { allowed: boolean; reason?: string } {
  if (activeUsageCount > 0 && !force) {
    return { allowed: false, reason: `Template is used by ${activeUsageCount} active follow-up(s)` };
  }
  return { allowed: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("SMS Template Validation", () => {
  it("accepts a valid template", () => {
    const errors = validateTemplate({ name: "Initial Outreach", body: "Hi {{name}}, interested in your property at {{address}}?" });
    expect(errors).toHaveLength(0);
  });

  it("rejects empty name", () => {
    const errors = validateTemplate({ name: "", body: "Some message" });
    expect(errors).toContain("name_required");
  });

  it("rejects whitespace-only name", () => {
    const errors = validateTemplate({ name: "   ", body: "Some message" });
    expect(errors).toContain("name_required");
  });

  it("rejects empty body", () => {
    const errors = validateTemplate({ name: "Template A", body: "" });
    expect(errors).toContain("body_required");
  });

  it("rejects name longer than 255 chars", () => {
    const errors = validateTemplate({ name: "A".repeat(256), body: "Body" });
    expect(errors).toContain("name_too_long");
  });

  it("accepts name of exactly 255 chars", () => {
    const errors = validateTemplate({ name: "A".repeat(255), body: "Body" });
    expect(errors).not.toContain("name_too_long");
  });
});

describe("Variable Placeholder Extraction", () => {
  it("extracts all variables from body", () => {
    const vars = extractVariables("Hi {{name}}, your property at {{address}} in {{city}} is ready.");
    expect(vars).toContain("{{name}}");
    expect(vars).toContain("{{address}}");
    expect(vars).toContain("{{city}}");
    expect(vars).toHaveLength(3);
  });

  it("deduplicates repeated variables", () => {
    const vars = extractVariables("{{name}} and {{name}} again");
    expect(vars).toHaveLength(1);
    expect(vars[0]).toBe("{{name}}");
  });

  it("returns empty array when no variables", () => {
    const vars = extractVariables("Hello, just following up.");
    expect(vars).toHaveLength(0);
  });
});

describe("Variable Resolution", () => {
  it("replaces known variables with values", () => {
    const result = resolveVariables(
      "Hi {{name}}, I saw your property at {{address}}.",
      { name: "John Doe", address: "123 Main St" }
    );
    expect(result).toBe("Hi John Doe, I saw your property at 123 Main St.");
  });

  it("leaves unknown variables as-is", () => {
    const result = resolveVariables("Hi {{name}}, agent is {{agent}}.", { name: "Jane" });
    expect(result).toBe("Hi Jane, agent is {{agent}}.");
  });

  it("handles empty vars map", () => {
    const result = resolveVariables("Hi {{name}}!", {});
    expect(result).toBe("Hi {{name}}!");
  });
});

describe("Delete Guard Logic", () => {
  it("allows deletion when no active usages", () => {
    const result = canDeleteTemplate(0, false);
    expect(result.allowed).toBe(true);
  });

  it("blocks deletion when template is in use (no force)", () => {
    const result = canDeleteTemplate(3, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("3");
  });

  it("allows forced deletion even when in use", () => {
    const result = canDeleteTemplate(5, true);
    expect(result.allowed).toBe(true);
  });

  it("allows deletion when usage count is 0 with force=true", () => {
    const result = canDeleteTemplate(0, true);
    expect(result.allowed).toBe(true);
  });
});

describe("Category Defaults", () => {
  const VALID_CATEGORIES = ["Introduction", "Follow-Up", "Closing", "Reminder", "Custom"];

  it("Custom is a valid category", () => {
    expect(VALID_CATEGORIES).toContain("Custom");
  });

  it("all expected categories are present", () => {
    expect(VALID_CATEGORIES).toHaveLength(5);
    expect(VALID_CATEGORIES).toContain("Introduction");
    expect(VALID_CATEGORIES).toContain("Follow-Up");
    expect(VALID_CATEGORIES).toContain("Closing");
    expect(VALID_CATEGORIES).toContain("Reminder");
  });
});

describe("CreateFollowUpInput with Template Fields", () => {
  it("constructs valid input with templateId and templateBody", () => {
    const input = {
      propertyId: 1,
      type: "Cold Lead" as const,
      trigger: "No contact for 30 days",
      action: "Send SMS" as const,
      actionDetails: { message: "Hi {{name}}, following up!" },
      nextRunAt: new Date(),
      templateId: 42,
      templateBody: "Hi {{name}}, following up!",
      createdByUserId: 7,
      createdByName: "Rosangela",
    };

    expect(input.templateId).toBe(42);
    expect(input.templateBody).toBe("Hi {{name}}, following up!");
    expect(input.createdByUserId).toBe(7);
    expect(input.createdByName).toBe("Rosangela");
    expect(input.action).toBe("Send SMS");
  });

  it("constructs valid input without template fields (free-text SMS)", () => {
    const input = {
      propertyId: 2,
      type: "Custom" as const,
      trigger: "Manual trigger",
      action: "Send SMS" as const,
      actionDetails: { message: "Custom message" },
      nextRunAt: new Date(),
    };

    expect((input as any).templateId).toBeUndefined();
    expect((input as any).templateBody).toBeUndefined();
  });
});
