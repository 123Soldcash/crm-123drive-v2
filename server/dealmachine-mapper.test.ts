import { describe, it, expect } from "vitest";
import { mapDealMachineRow, validateProperty } from "./dealmachine-mapper";

describe("DealMachine Mapper", () => {
  describe("mapDealMachineRow", () => {
    it("should map basic DealMachine fields correctly", () => {
      const row = {
        property_id: "228023057",
        lead_id: "1267559542",
        property_address_line_1: "5226 Sw 24th St",
        property_address_city: "West Park",
        property_address_state: "FL",
        property_address_zipcode: "33023",
        owner_1_name: "George A Adams Iii",
        property_type: "Single Family",
        beds: "3",
        baths: "2",
        sqft: "1528",
        year_built: "1952",
        estimated_value: "489000",
        equity_amount: "469679",
        equity_percent: "0.97",
      };

      const { property, contacts } = mapDealMachineRow(row);

      expect(property.propertyId).toBe("228023057");
      expect(property.leadId).toBe(1267559542);
      expect(property.addressLine1).toBe("5226 Sw 24th St");
      expect(property.city).toBe("West Park");
      expect(property.state).toBe("FL");
      expect(property.zipcode).toBe("33023");
      expect(property.owner1Name).toBe("George A Adams Iii");
      expect(property.propertyType).toBe("Single Family");
      expect(property.totalBedrooms).toBe(3);
      expect(property.totalBaths).toBe(2);
      expect(property.buildingSquareFeet).toBe(1528);
      expect(property.yearBuilt).toBe(1952);
      expect(property.estimatedValue).toBe(489000);
      expect(property.equityAmount).toBe(469679);
      expect(property.equityPercent).toBe(0.97);
    });

    it("should handle both naming formats (contact_1_name and contact1_name)", () => {
      const row1 = {
        property_address_line_1: "123 Main St",
        property_address_city: "City",
        property_address_state: "ST",
        property_address_zipcode: "12345",
        contact_1_name: "John Doe",
        contact_1_phone1: "5551234567",
        contact_1_email1: "john@example.com",
      };

      const row2 = {
        property_address_line_1: "123 Main St",
        property_address_city: "City",
        property_address_state: "ST",
        property_address_zipcode: "12345",
        contact1_name: "John Doe",
        contact1_phone1: "5551234567",
        contact1_email1: "john@example.com",
      };

      const result1 = mapDealMachineRow(row1);
      const result2 = mapDealMachineRow(row2);

      expect(result1.contacts[0].name).toBe("John Doe");
      expect(result1.contacts[0].phone1).toBe("5551234567");
      expect(result1.contacts[0].email1).toBe("john@example.com");

      expect(result2.contacts[0].name).toBe("John Doe");
      expect(result2.contacts[0].phone1).toBe("5551234567");
      expect(result2.contacts[0].email1).toBe("john@example.com");
    });

    it("should extract multiple contacts (up to 14)", () => {
      const row: any = {
        property_address_line_1: "123 Main St",
        property_address_city: "City",
        property_address_state: "ST",
        property_address_zipcode: "12345",
      };

      // Add 5 contacts
      for (let i = 1; i <= 5; i++) {
        row[`contact_${i}_name`] = `Contact ${i}`;
        row[`contact_${i}_phone1`] = `555000000${i}`;
      }

      const { contacts } = mapDealMachineRow(row);

      expect(contacts).toHaveLength(5);
      expect(contacts[0].name).toBe("Contact 1");
      expect(contacts[4].name).toBe("Contact 5");
    });

    it("should store unmapped fields in dealMachineRawData", () => {
      const row = {
        property_address_line_1: "123 Main St",
        property_address_city: "City",
        property_address_state: "ST",
        property_address_zipcode: "12345",
        custom_field_1: "value1",
        custom_field_2: "value2",
        unmapped_field: "unmapped_value",
      };

      const { property } = mapDealMachineRow(row);

      expect(property.dealMachineRawData).toBeDefined();
      const rawData = JSON.parse(property.dealMachineRawData || "{}");
      expect(rawData.custom_field_1).toBe("value1");
      expect(rawData.custom_field_2).toBe("value2");
      expect(rawData.unmapped_field).toBe("unmapped_value");
    });

    it("should handle type conversions correctly", () => {
      const row = {
        property_address_line_1: "123 Main St",
        property_address_city: "City",
        property_address_state: "ST",
        property_address_zipcode: "12345",
        beds: "3",
        baths: "2.5",
        sqft: "1500",
        year_built: "2000",
        estimated_value: "500000",
        equity_amount: "250000",
        equity_percent: "50",
        tax_year: "2024",
        tax_amt: "5000",
        sale_date: "2023-01-15",
      };

      const { property } = mapDealMachineRow(row);

      expect(typeof property.totalBedrooms).toBe("number");
      expect(property.totalBedrooms).toBe(3);
      expect(typeof property.totalBaths).toBe("number");
      expect(property.totalBaths).toBe(2.5);
      expect(typeof property.buildingSquareFeet).toBe("number");
      expect(property.buildingSquareFeet).toBe(1500);
      expect(typeof property.yearBuilt).toBe("number");
      expect(property.yearBuilt).toBe(2000);
      expect(typeof property.estimatedValue).toBe("number");
      expect(property.estimatedValue).toBe(500000);
      expect(property.saleDate instanceof Date).toBe(true);
    });
  });

  describe("validateProperty", () => {
    it("should validate required fields", () => {
      const validProperty = {
        addressLine1: "123 Main St",
        city: "City",
        state: "ST",
        zipcode: "12345",
      };

      const validation = validateProperty(validProperty as any);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should fail validation when required fields are missing", () => {
      const invalidProperty = {
        addressLine1: "",
        city: "City",
        state: "ST",
        zipcode: "12345",
      };

      const validation = validateProperty(invalidProperty as any);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain("addressLine1");
    });

    it("should fail validation when all required fields are missing", () => {
      const invalidProperty = {};

      const validation = validateProperty(invalidProperty as any);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(4); // addressLine1, city, state, zipcode
    });
  });
});
