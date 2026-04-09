/**
 * Tests for the SMS template picker logic in SMSChatButton.tsx
 * Covers variable substitution and template filtering
 */
import { describe, it, expect } from "vitest";

/** Mirror of applyTemplate logic from SMSChatButton */
function applyTemplate(body: string, contactName?: string): string {
  let text = body;
  if (contactName) text = text.replace(/\{\{ownerName\}\}/gi, contactName);
  return text;
}

/** Mirror of filteredTemplates logic */
function filterTemplates(templates: any[], search: string) {
  if (!search) return templates;
  const q = search.toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.body.toLowerCase().includes(q)
  );
}

/** Mirror of templatesByCategory grouping */
function groupByCategory(templates: any[]): Record<string, any[]> {
  return templates.reduce((acc: Record<string, any[]>, t: any) => {
    const cat = t.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});
}

describe("applyTemplate", () => {
  it("substitutes {{ownerName}} with contact name", () => {
    expect(applyTemplate("Hi {{ownerName}}, we have an offer!", "John Smith")).toBe(
      "Hi John Smith, we have an offer!"
    );
  });

  it("substitutes {{ownerName}} case-insensitively", () => {
    expect(applyTemplate("Hello {{OWNERNAME}}", "Maria")).toBe("Hello Maria");
  });

  it("substitutes multiple occurrences of {{ownerName}}", () => {
    expect(applyTemplate("Hi {{ownerName}}, {{ownerName}} here!", "Bob")).toBe(
      "Hi Bob, Bob here!"
    );
  });

  it("leaves template unchanged when no contactName provided", () => {
    const body = "Hi {{ownerName}}, interested in selling?";
    expect(applyTemplate(body, undefined)).toBe(body);
  });

  it("returns plain text unchanged when no variables present", () => {
    expect(applyTemplate("Hello, are you interested?", "Jane")).toBe(
      "Hello, are you interested?"
    );
  });
});

describe("filterTemplates", () => {
  const templates = [
    { id: 1, name: "Initial Offer", body: "We'd like to make an offer on your property", category: "Offers" },
    { id: 2, name: "Follow Up", body: "Just following up on our previous conversation", category: "Follow Up" },
    { id: 3, name: "Cash Offer", body: "We can make a cash offer today", category: "Offers" },
  ];

  it("returns all templates when search is empty", () => {
    expect(filterTemplates(templates, "")).toHaveLength(3);
  });

  it("filters by template name", () => {
    const result = filterTemplates(templates, "cash");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it("filters by template body content", () => {
    const result = filterTemplates(templates, "following up");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("is case-insensitive", () => {
    expect(filterTemplates(templates, "OFFER")).toHaveLength(2);
  });

  it("returns empty array when nothing matches", () => {
    expect(filterTemplates(templates, "xyz123notfound")).toHaveLength(0);
  });
});

describe("groupByCategory", () => {
  const templates = [
    { id: 1, name: "T1", body: "b1", category: "Offers" },
    { id: 2, name: "T2", body: "b2", category: "Follow Up" },
    { id: 3, name: "T3", body: "b3", category: "Offers" },
    { id: 4, name: "T4", body: "b4", category: null },
  ];

  it("groups templates by category", () => {
    const groups = groupByCategory(templates);
    expect(groups["Offers"]).toHaveLength(2);
    expect(groups["Follow Up"]).toHaveLength(1);
  });

  it("falls back to 'General' for null category", () => {
    const groups = groupByCategory(templates);
    expect(groups["General"]).toHaveLength(1);
    expect(groups["General"][0].id).toBe(4);
  });

  it("returns empty object for empty input", () => {
    expect(groupByCategory([])).toEqual({});
  });
});
