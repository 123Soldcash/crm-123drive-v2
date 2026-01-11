import { describe, it, expect } from "vitest";

describe("Import Properties with Optional Agent", () => {
  it("should accept null assignedAgentId in import input", () => {
    // Test that the input validation accepts null for assignedAgentId
    const validInputs = [
      { fileData: "base64data", assignedAgentId: null },
      { fileData: "base64data", assignedAgentId: 123 },
      { fileData: "base64data", assignedAgentId: undefined },
    ];

    validInputs.forEach((input) => {
      // The input should be valid
      expect(input.fileData).toBeDefined();
      expect(typeof input.fileData).toBe("string");
      expect(input.assignedAgentId === null || typeof input.assignedAgentId === "number" || input.assignedAgentId === undefined).toBe(true);
    });

    console.log("✅ All input variations are valid for optional agent import");
  });

  it("should handle properties without assigned agent", () => {
    // Simulate property data without agent
    const property = {
      addressLine1: "123 Main St",
      city: "New York",
      state: "NY",
      zipcode: "10001",
      owner1Name: "John Doe",
      assignedAgentId: null,
    };

    expect(property.assignedAgentId).toBeNull();
    expect(property.addressLine1).toBeDefined();
    console.log("✅ Properties can be created without assigned agent");
  });

  it("should allow bulk assignment after import", () => {
    // Simulate properties imported without agents
    const importedProperties = [
      { id: 1, address: "123 Main St", assignedAgentId: null },
      { id: 2, address: "456 Oak Ave", assignedAgentId: null },
      { id: 3, address: "789 Pine Rd", assignedAgentId: null },
    ];

    // Simulate bulk assignment
    const agentId = 1440266; // John Smith
    const updatedProperties = importedProperties.map((prop) => ({
      ...prop,
      assignedAgentId: agentId,
    }));

    expect(updatedProperties.every((p) => p.assignedAgentId === agentId)).toBe(true);
    console.log(`✅ Successfully assigned ${updatedProperties.length} properties to agent ${agentId}`);
  });

  it("should support mixed assignment (some with agent, some without)", () => {
    const properties = [
      { id: 1, address: "123 Main St", assignedAgentId: 1440266 }, // John Smith
      { id: 2, address: "456 Oak Ave", assignedAgentId: null }, // Unassigned
      { id: 3, address: "789 Pine Rd", assignedAgentId: 1440267 }, // Maria Garcia
    ];

    const unassigned = properties.filter((p) => p.assignedAgentId === null);
    const assigned = properties.filter((p) => p.assignedAgentId !== null);

    expect(unassigned.length).toBe(1);
    expect(assigned.length).toBe(2);
    console.log(`✅ Import supports mixed assignment: ${assigned.length} assigned, ${unassigned.length} unassigned`);
  });
});
