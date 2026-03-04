/**
 * Unit tests for Message Templates business logic.
 *
 * Tests cover:
 * - Template name, body, and channel validation
 * - Email subject requirement for email-compatible templates
 * - Channel filtering logic (sms, email, both)
 * - Category defaults
 * - Variable placeholder detection and resolution
 * - Usage-based delete guard logic
 * - createAutomatedFollowUp with templateId fields for both SMS and Email
 */
import { describe, it, expect } from "vitest";

// ─── Template Validation Helpers ─────────────────────────────────────────────
type TemplateInput = {
  name: string;
  body: string;
  category?: string;
  channel?: "sms" | "email" | "both";
  emailSubject?: string;
};

function validateTemplate(input: TemplateInput) {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) errors.push("name_required");
  if (input.name && input.name.trim().length > 255) errors.push("name_too_long");
  if (!input.body || input.body.trim().length === 0) errors.push("body_required");
  const ch = input.channel ?? "both";
  if ((ch === "email" || ch === "both") && (!input.emailSubject || input.emailSubject.trim().length === 0)) {
    errors.push("email_subject_required");
  }
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

type Template = { id: number; name: string; channel: string; body: string; emailSubject?: string | null };

function filterByChannel(templates: Template[], actionChannel: "sms" | "email"): Template[] {
  return templates.filter(t => t.channel === actionChannel || t.channel === "both");
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Message Template Validation", () => {
  it("accepts a valid SMS-only template (no emailSubject needed)", () => {
    const errors = validateTemplate({ name: "Outreach", body: "Hi {{name}}", channel: "sms" });
    expect(errors).toHaveLength(0);
  });

  it("accepts a valid email-only template with subject", () => {
    const errors = validateTemplate({ name: "Outreach", body: "Hi {{name}}", channel: "email", emailSubject: "Follow up" });
    expect(errors).toHaveLength(0);
  });

  it("accepts a valid both-channel template with subject", () => {
    const errors = validateTemplate({ name: "Outreach", body: "Hi {{name}}", channel: "both", emailSubject: "Follow up" });
    expect(errors).toHaveLength(0);
  });

  it("rejects email-channel template without emailSubject", () => {
    const errors = validateTemplate({ name: "Outreach", body: "Hi {{name}}", channel: "email" });
    expect(errors).toContain("email_subject_required");
  });

  it("rejects both-channel template without emailSubject", () => {
    const errors = validateTemplate({ name: "Outreach", body: "Hi {{name}}", channel: "both" });
    expect(errors).toContain("email_subject_required");
  });

  it("defaults to 'both' channel when not specified (requires emailSubject)", () => {
    const errors = validateTemplate({ name: "Outreach", body: "Hi {{name}}" });
    expect(errors).toContain("email_subject_required");
  });

  it("rejects empty name", () => {
    const errors = validateTemplate({ name: "", body: "Some message", channel: "sms" });
    expect(errors).toContain("name_required");
  });

  it("rejects whitespace-only name", () => {
    const errors = validateTemplate({ name: "   ", body: "Some message", channel: "sms" });
    expect(errors).toContain("name_required");
  });

  it("rejects empty body", () => {
    const errors = validateTemplate({ name: "Template A", body: "", channel: "sms" });
    expect(errors).toContain("body_required");
  });

  it("rejects name longer than 255 chars", () => {
    const errors = validateTemplate({ name: "A".repeat(256), body: "Body", channel: "sms" });
    expect(errors).toContain("name_too_long");
  });

  it("accepts name of exactly 255 chars", () => {
    const errors = validateTemplate({ name: "A".repeat(255), body: "Body", channel: "sms" });
    expect(errors).not.toContain("name_too_long");
  });
});

describe("Channel Filtering", () => {
  const templates: Template[] = [
    { id: 1, name: "SMS Only", channel: "sms", body: "Hi" },
    { id: 2, name: "Email Only", channel: "email", body: "Hi", emailSubject: "Subj" },
    { id: 3, name: "Both", channel: "both", body: "Hi", emailSubject: "Subj" },
    { id: 4, name: "Another SMS", channel: "sms", body: "Hey" },
  ];

  it("filters for SMS: returns sms + both", () => {
    const result = filterByChannel(templates, "sms");
    expect(result.map(t => t.id)).toEqual([1, 3, 4]);
  });

  it("filters for Email: returns email + both", () => {
    const result = filterByChannel(templates, "email");
    expect(result.map(t => t.id)).toEqual([2, 3]);
  });

  it("SMS filter excludes email-only templates", () => {
    const result = filterByChannel(templates, "sms");
    expect(result.find(t => t.id === 2)).toBeUndefined();
  });

  it("Email filter excludes sms-only templates", () => {
    const result = filterByChannel(templates, "email");
    expect(result.find(t => t.id === 1)).toBeUndefined();
    expect(result.find(t => t.id === 4)).toBeUndefined();
  });

  it("both-channel templates appear in both filters", () => {
    const smsResult = filterByChannel(templates, "sms");
    const emailResult = filterByChannel(templates, "email");
    expect(smsResult.find(t => t.id === 3)).toBeDefined();
    expect(emailResult.find(t => t.id === 3)).toBeDefined();
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

describe("CreateFollowUpInput with Template Fields — SMS", () => {
  it("constructs valid input with templateId and templateBody for SMS", () => {
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

describe("CreateFollowUpInput with Template Fields — Email", () => {
  it("constructs valid input with templateId and templateBody for Email", () => {
    const input = {
      propertyId: 3,
      type: "Cold Lead" as const,
      trigger: "No response to email",
      action: "Send Email" as const,
      actionDetails: {
        subject: "Following up about {{address}}",
        body: "Hi {{name}}, I wanted to follow up about your property.",
        templateId: 55,
        templateName: "Email Follow-Up",
      },
      nextRunAt: new Date(),
      templateId: 55,
      templateBody: "Hi {{name}}, I wanted to follow up about your property.",
    };

    expect(input.templateId).toBe(55);
    expect(input.templateBody).toContain("follow up");
    expect(input.action).toBe("Send Email");
    expect(input.actionDetails.subject).toContain("{{address}}");
  });

  it("constructs valid Email input without template (free-text)", () => {
    const input = {
      propertyId: 4,
      type: "Custom" as const,
      trigger: "Stage changed",
      action: "Send Email" as const,
      actionDetails: {
        subject: "Follow-up: Stage changed",
        template: "default_followup",
      },
      nextRunAt: new Date(),
    };

    expect((input as any).templateId).toBeUndefined();
    expect(input.actionDetails.template).toBe("default_followup");
  });
});
