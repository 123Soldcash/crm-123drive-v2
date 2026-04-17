/**
 * Unit tests for SMS template auto-fill logic in SMSChatButton.
 * Tests the applyTemplate function's variable substitution.
 */
import { describe, it, expect } from "vitest";

// ─── Mirror of applyTemplate logic from SMSChatButton.tsx ────────────────────

function applyTemplate(
  body: string,
  {
    contactName,
    propertyAddress,
    propertyCity,
    agentName,
  }: {
    contactName?: string;
    propertyAddress?: string;
    propertyCity?: string;
    agentName?: string;
  }
): string {
  let text = body;
  // Contact name: {{name}}, {{ownerName}}, {{contactName}}
  if (contactName) {
    text = text.replace(/\{\{name\}\}/gi, contactName);
    text = text.replace(/\{\{ownerName\}\}/gi, contactName);
    text = text.replace(/\{\{contactName\}\}/gi, contactName);
  }
  // Property address: {{address}}
  if (propertyAddress) {
    text = text.replace(/\{\{address\}\}/gi, propertyAddress);
  }
  // Property city: {{city}}
  if (propertyCity) {
    text = text.replace(/\{\{city\}\}/gi, propertyCity);
  }
  // Agent name: {{agent}}, {{agentName}}
  if (agentName) {
    text = text.replace(/\{\{agent\}\}/gi, agentName);
    text = text.replace(/\{\{agentName\}\}/gi, agentName);
  }
  return text;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SMS Template Auto-Fill - {{name}} variable", () => {
  it("replaces {{name}} with contact name", () => {
    const result = applyTemplate("Hi {{name}}, how are you?", { contactName: "John Smith" });
    expect(result).toBe("Hi John Smith, how are you?");
  });

  it("replaces {{ownerName}} with contact name (legacy variable)", () => {
    const result = applyTemplate("Hello {{ownerName}}!", { contactName: "Maria Garcia" });
    expect(result).toBe("Hello Maria Garcia!");
  });

  it("replaces {{contactName}} with contact name", () => {
    const result = applyTemplate("Dear {{contactName}},", { contactName: "Bob Jones" });
    expect(result).toBe("Dear Bob Jones,");
  });

  it("is case-insensitive for {{NAME}}", () => {
    const result = applyTemplate("Hi {{NAME}}", { contactName: "Alice" });
    expect(result).toBe("Hi Alice");
  });

  it("does NOT replace {{name}} when contactName is undefined", () => {
    const result = applyTemplate("Hi {{name}}", {});
    expect(result).toBe("Hi {{name}}");
  });

  it("replaces multiple {{name}} occurrences", () => {
    const result = applyTemplate("{{name}}, this is for {{name}}", { contactName: "Tom" });
    expect(result).toBe("Tom, this is for Tom");
  });
});

describe("SMS Template Auto-Fill - {{address}} variable", () => {
  it("replaces {{address}} with property address", () => {
    const result = applyTemplate("I'm calling about {{address}}", { propertyAddress: "123 Main St" });
    expect(result).toBe("I'm calling about 123 Main St");
  });

  it("does NOT replace {{address}} when propertyAddress is undefined", () => {
    const result = applyTemplate("Property at {{address}}", {});
    expect(result).toBe("Property at {{address}}");
  });

  it("is case-insensitive for {{ADDRESS}}", () => {
    const result = applyTemplate("{{ADDRESS}}", { propertyAddress: "456 Oak Ave" });
    expect(result).toBe("456 Oak Ave");
  });
});

describe("SMS Template Auto-Fill - {{city}} variable", () => {
  it("replaces {{city}} with property city", () => {
    const result = applyTemplate("Your property in {{city}} is great!", { propertyCity: "Fort Lauderdale" });
    expect(result).toBe("Your property in Fort Lauderdale is great!");
  });

  it("does NOT replace {{city}} when propertyCity is undefined", () => {
    const result = applyTemplate("In {{city}}", {});
    expect(result).toBe("In {{city}}");
  });
});

describe("SMS Template Auto-Fill - {{agent}} variable", () => {
  it("replaces {{agent}} with agent name", () => {
    const result = applyTemplate("This is {{agent}} calling.", { agentName: "Rosangela Russo" });
    expect(result).toBe("This is Rosangela Russo calling.");
  });

  it("replaces {{agentName}} with agent name", () => {
    const result = applyTemplate("From {{agentName}}", { agentName: "Chris" });
    expect(result).toBe("From Chris");
  });

  it("does NOT replace {{agent}} when agentName is undefined", () => {
    const result = applyTemplate("Call {{agent}}", {});
    expect(result).toBe("Call {{agent}}");
  });
});

describe("SMS Template Auto-Fill - Full template replacement", () => {
  it("replaces all variables in a complete template", () => {
    const template = "Hi {{name}}, I'm {{agent}} and I'm interested in your property at {{address}} in {{city}}. Can we talk?";
    const result = applyTemplate(template, {
      contactName: "John Smith",
      agentName: "Rosangela",
      propertyAddress: "123 Oak St",
      propertyCity: "Hollywood",
    });
    expect(result).toBe(
      "Hi John Smith, I'm Rosangela and I'm interested in your property at 123 Oak St in Hollywood. Can we talk?"
    );
  });

  it("leaves unreplaced variables as-is when data is missing", () => {
    const template = "Hi {{name}}, I'm {{agent}} about {{address}}";
    const result = applyTemplate(template, { contactName: "Maria" });
    expect(result).toBe("Hi Maria, I'm {{agent}} about {{address}}");
  });

  it("handles template with no variables (plain text)", () => {
    const template = "Hello, I wanted to follow up with you today.";
    const result = applyTemplate(template, {
      contactName: "John",
      agentName: "Rosangela",
      propertyAddress: "123 Main St",
      propertyCity: "Miami",
    });
    expect(result).toBe("Hello, I wanted to follow up with you today.");
  });

  it("handles empty template body", () => {
    const result = applyTemplate("", { contactName: "John" });
    expect(result).toBe("");
  });

  it("handles template with all variables", () => {
    const template = "{{name}} - {{address}} - {{city}} - {{agent}}";
    const result = applyTemplate(template, {
      contactName: "Alice",
      propertyAddress: "789 Pine Rd",
      propertyCity: "Miramar",
      agentName: "Bob",
    });
    expect(result).toBe("Alice - 789 Pine Rd - Miramar - Bob");
  });
});

describe("SMS Template Auto-Fill - Edge cases", () => {
  it("handles contact name with special characters", () => {
    const result = applyTemplate("Hi {{name}}", { contactName: "O'Brien & Sons" });
    expect(result).toBe("Hi O'Brien & Sons");
  });

  it("handles property address with apartment number", () => {
    const result = applyTemplate("{{address}}", { propertyAddress: "123 Main St, Apt 4B" });
    expect(result).toBe("123 Main St, Apt 4B");
  });

  it("handles mixed case variable names", () => {
    const result = applyTemplate("{{Name}} and {{NAME}} and {{name}}", { contactName: "John" });
    expect(result).toBe("John and John and John");
  });
});
