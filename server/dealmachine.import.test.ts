import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mapDealMachineRow, validateProperty, parseContactFlags, getRelationshipType } from "./lib/dealmachine-mapper";
import { importDealMachineProperty } from "./db-dealmachine-import";

describe("DealMachine Import", () => {
  describe("Field Mapping", () => {
    it("should map basic property fields correctly", () => {
      const row = {
        property_id: "PROP123",
        property_address_line_1: "123 Main St",
        property_address_line_2: "Suite 100",
        property_address_city: "Austin",
        property_address_state: "TX",
        property_address_zip_code: "78701",
        owner_1_name: "John Doe",
        owner_2_name: "Jane Doe",
        property_type: "Single Family",
        property_bedrooms: "3",
        property_bathrooms: "2",
        property_square_feet: "2000",
        property_year_built: "2010",
        property_estimated_value: "500000",
        property_equity_amount: "250000",
        property_equity_percent: "50",
        property_sale_price: "450000",
        property_sale_date: "2023-01-15",
        property_tax_amount: "5000",
      };

      const mapped = mapDealMachineRow(row);

      expect(mapped.propertyId).toBe("PROP123");
      expect(mapped.addressLine1).toBe("123 Main St");
      expect(mapped.addressLine2).toBe("Suite 100");
      expect(mapped.city).toBe("Austin");
      expect(mapped.state).toBe("TX");
      expect(mapped.zipcode).toBe("78701");
      expect(mapped.ownerName).toBe("John Doe");
      expect(mapped.propertyType).toBe("Single Family");
      expect(mapped.totalBedrooms).toBe(3);
      expect(mapped.totalBaths).toBe(2);
      expect(mapped.buildingSquareFeet).toBe(2000);
      expect(mapped.yearBuilt).toBe(2010);
      expect(mapped.estimatedValue).toBe(500000);
      expect(mapped.equityAmount).toBe(250000);
      expect(mapped.equityPercent).toBe(50);
      expect(mapped.salePrice).toBe(450000);
      expect(mapped.taxAmount).toBe(5000);
    });

    it("should handle missing optional fields", () => {
      const row = {
        property_id: "PROP456",
        property_address_line_1: "456 Oak Ave",
        property_address_city: "Dallas",
        property_address_state: "TX",
        property_address_zip_code: "75201",
      };

      const mapped = mapDealMachineRow(row);

      expect(mapped.propertyId).toBe("PROP456");
      expect(mapped.addressLine1).toBe("456 Oak Ave");
      expect(mapped.addressLine2).toBeUndefined();
      expect(mapped.ownerName).toBeUndefined();
      expect(mapped.totalBedrooms).toBeUndefined();
    });

    it("should map contact information correctly", () => {
      const row = {
        property_id: "PROP789",
        property_address_line_1: "789 Pine Rd",
        property_address_city: "Houston",
        property_address_state: "TX",
        property_address_zip_code: "77001",
        contact_1_name: "Alice Smith",
        contact_1_phone_1: "5125551234",
        contact_1_phone_2: "5125555678",
        contact_1_email_1: "alice@example.com",
        contact_1_email_2: "alice.smith@example.com",
        contact_1_flags: "DNC",
        contact_2_name: "Bob Johnson",
        contact_2_phone_1: "5125559999",
        contact_2_email_1: "bob@example.com",
        contact_2_flags: "OWNER",
      };

      const mapped = mapDealMachineRow(row);

      expect(mapped.contacts).toHaveLength(2);
      expect(mapped.contacts[0].name).toBe("Alice Smith");
      expect(mapped.contacts[0].phones).toContain("5125551234");
      expect(mapped.contacts[0].phones).toContain("5125555678");
      expect(mapped.contacts[0].emails).toContain("alice@example.com");
      expect(mapped.contacts[0].emails).toContain("alice.smith@example.com");
      expect(mapped.contacts[0].flags).toBe("DNC");

      expect(mapped.contacts[1].name).toBe("Bob Johnson");
      expect(mapped.contacts[1].phones).toContain("5125559999");
      expect(mapped.contacts[1].emails).toContain("bob@example.com");
      expect(mapped.contacts[1].flags).toBe("OWNER");
    });
  });

  describe("Validation", () => {
    it("should validate required fields", () => {
      const validProperty = {
        propertyId: "VALID123",
        addressLine1: "123 Main St",
        city: "Austin",
        state: "TX",
        zipcode: "78701",
        contacts: [],
      };

      const errors = validateProperty(validProperty);
      expect(errors).toHaveLength(0);
    });

    it("should reject property without address", () => {
      const invalidProperty = {
        propertyId: "INVALID123",
        addressLine1: "",
        city: "Austin",
        state: "TX",
        zipcode: "78701",
        contacts: [],
      };

      const errors = validateProperty(invalidProperty);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Address");
    });

    it("should reject property without city", () => {
      const invalidProperty = {
        propertyId: "INVALID456",
        addressLine1: "123 Main St",
        city: "",
        state: "TX",
        zipcode: "78701",
        contacts: [],
      };

      const errors = validateProperty(invalidProperty);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("City");
    });

    it("should reject property without state", () => {
      const invalidProperty = {
        propertyId: "INVALID789",
        addressLine1: "123 Main St",
        city: "Austin",
        state: "",
        zipcode: "78701",
        contacts: [],
      };

      const errors = validateProperty(invalidProperty);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("State");
    });

    it("should reject property without zipcode", () => {
      const invalidProperty = {
        propertyId: "INVALID999",
        addressLine1: "123 Main St",
        city: "Austin",
        state: "TX",
        zipcode: "",
        contacts: [],
      };

      const errors = validateProperty(invalidProperty);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Zipcode");
    });
  });

  describe("Contact Flags", () => {
    it("should parse DNC flag", () => {
      const flags = parseContactFlags("DNC");
      expect(flags.isDNC).toBe(true);
    });

    it("should parse multiple flags", () => {
      const flags = parseContactFlags("DNC,OWNER");
      expect(flags.isDNC).toBe(true);
    });

    it("should handle empty flags", () => {
      const flags = parseContactFlags("");
      expect(flags.isDNC).toBe(false);
    });

    it("should handle null flags", () => {
      const flags = parseContactFlags(null);
      expect(flags.isDNC).toBe(false);
    });
  });

  describe("Relationship Type", () => {
    it("should identify OWNER relationship", () => {
      const relationship = getRelationshipType("OWNER");
      expect(relationship).toBe("Owner");
    });

    it("should identify SPOUSE relationship", () => {
      const relationship = getRelationshipType("SPOUSE");
      expect(relationship).toBe("Spouse");
    });

    it("should identify TENANT relationship", () => {
      const relationship = getRelationshipType("TENANT");
      expect(relationship).toBe("Tenant");
    });

    it("should default to Contact for unknown flags", () => {
      const relationship = getRelationshipType("UNKNOWN");
      expect(relationship).toBe("Contact");
    });

    it("should handle null flags", () => {
      const relationship = getRelationshipType(null);
      expect(relationship).toBe("Contact");
    });
  });

  describe("Data Type Conversions", () => {
    it("should convert string numbers to integers", () => {
      const row = {
        property_id: "PROP123",
        property_address_line_1: "123 Main St",
        property_address_city: "Austin",
        property_address_state: "TX",
        property_address_zip_code: "78701",
        property_bedrooms: "3",
        property_bathrooms: "2.5",
        property_square_feet: "2000",
        property_year_built: "2010",
      };

      const mapped = mapDealMachineRow(row);

      expect(mapped.totalBedrooms).toBe(3);
      expect(typeof mapped.totalBedrooms).toBe("number");
      expect(mapped.totalBaths).toBe(2);
      expect(typeof mapped.totalBaths).toBe("number");
      expect(mapped.buildingSquareFeet).toBe(2000);
      expect(typeof mapped.buildingSquareFeet).toBe("number");
      expect(mapped.yearBuilt).toBe(2010);
      expect(typeof mapped.yearBuilt).toBe("number");
    });

    it("should handle invalid number strings gracefully", () => {
      const row = {
        property_id: "PROP123",
        property_address_line_1: "123 Main St",
        property_address_city: "Austin",
        property_address_state: "TX",
        property_address_zip_code: "78701",
        property_bedrooms: "invalid",
        property_estimated_value: "not_a_number",
      };

      const mapped = mapDealMachineRow(row);

      expect(mapped.totalBedrooms).toBeUndefined();
      expect(mapped.estimatedValue).toBeUndefined();
    });

    it("should parse dates correctly", () => {
      const row = {
        property_id: "PROP123",
        property_address_line_1: "123 Main St",
        property_address_city: "Austin",
        property_address_state: "TX",
        property_address_zip_code: "78701",
        property_sale_date: "2023-01-15",
      };

      const mapped = mapDealMachineRow(row);

      expect(mapped.saleDate).toBeInstanceOf(Date);
      expect(mapped.saleDate?.getFullYear()).toBe(2023);
      expect(mapped.saleDate?.getMonth()).toBe(0); // January is 0
      // Note: Date parsing may have timezone offset, so we check the date is in January
      expect(mapped.saleDate?.getDate()).toBeGreaterThanOrEqual(14);
      expect(mapped.saleDate?.getDate()).toBeLessThanOrEqual(16);
    });
  });

  describe("Batch Processing", () => {
    it("should handle multiple properties", () => {
      const rows = [
        {
          property_id: "PROP001",
          property_address_line_1: "123 Main St",
          property_address_city: "Austin",
          property_address_state: "TX",
          property_address_zip_code: "78701",
        },
        {
          property_id: "PROP002",
          property_address_line_1: "456 Oak Ave",
          property_address_city: "Dallas",
          property_address_state: "TX",
          property_address_zip_code: "75201",
        },
        {
          property_id: "PROP003",
          property_address_line_1: "789 Pine Rd",
          property_address_city: "Houston",
          property_address_state: "TX",
          property_address_zip_code: "77001",
        },
      ];

      const mapped = rows.map((row) => mapDealMachineRow(row));

      expect(mapped).toHaveLength(3);
      expect(mapped[0].propertyId).toBe("PROP001");
      expect(mapped[1].propertyId).toBe("PROP002");
      expect(mapped[2].propertyId).toBe("PROP003");
    });

    it("should filter invalid properties", () => {
      const rows = [
        {
          property_id: "VALID001",
          property_address_line_1: "123 Main St",
          property_address_city: "Austin",
          property_address_state: "TX",
          property_address_zip_code: "78701",
        },
        {
          property_id: "INVALID001",
          property_address_line_1: "",
          property_address_city: "",
          property_address_state: "",
          property_address_zip_code: "",
        },
        {
          property_id: "VALID002",
          property_address_line_1: "456 Oak Ave",
          property_address_city: "Dallas",
          property_address_state: "TX",
          property_address_zip_code: "75201",
        },
      ];

      const mapped = rows.map((row) => mapDealMachineRow(row));
      const valid = mapped.filter((prop) => validateProperty(prop).length === 0);

      expect(valid).toHaveLength(2);
      expect(valid[0].propertyId).toBe("VALID001");
      expect(valid[1].propertyId).toBe("VALID002");
    });
  });
});
