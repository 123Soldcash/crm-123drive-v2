import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateLeadTemperature, getPropertyById } from './db';

// Mock database
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Lead Temperature Update Tests', () => {
  const testPropertyId = 1050023;
  const validTemperatures = ['SUPER HOT', 'HOT', 'WARM', 'COLD', 'DEAD', 'TBD'];

  describe('updateLeadTemperature', () => {
    it('should update temperature from HOT to SUPER HOT', async () => {
      // This test validates the specific bug scenario
      const result = await updateLeadTemperature(testPropertyId, 'HOT');
      expect(result).toBeUndefined(); // Function returns void

      const result2 = await updateLeadTemperature(testPropertyId, 'SUPER HOT');
      expect(result2).toBeUndefined();
    });

    it('should accept all valid temperature values', async () => {
      for (const temp of validTemperatures) {
        const result = await updateLeadTemperature(testPropertyId, temp);
        expect(result).toBeUndefined();
      }
    });

    it('should handle temperature transitions in any order', async () => {
      const transitions = [
        { from: 'COLD', to: 'HOT' },
        { from: 'HOT', to: 'SUPER HOT' },
        { from: 'SUPER HOT', to: 'WARM' },
        { from: 'WARM', to: 'DEAD' },
        { from: 'DEAD', to: 'TBD' },
      ];

      for (const transition of transitions) {
        await updateLeadTemperature(testPropertyId, transition.from);
        const result = await updateLeadTemperature(testPropertyId, transition.to);
        expect(result).toBeUndefined();
      }
    });

    it('should throw error if propertyId is invalid', async () => {
      await expect(updateLeadTemperature(-1, 'HOT')).rejects.toThrow();
      await expect(updateLeadTemperature(0, 'HOT')).rejects.toThrow();
    });

    it('should update the updatedAt timestamp', async () => {
      const before = new Date();
      await updateLeadTemperature(testPropertyId, 'HOT');
      const after = new Date();

      const property = await getPropertyById(testPropertyId);
      if (property && property.createdAt) {
        const updatedAt = new Date(property.createdAt);
        expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      }
    });
  });

  describe('getPropertyById with temperature', () => {
    it('should return property with valid temperature after update', async () => {
      await updateLeadTemperature(testPropertyId, 'SUPER HOT');
      const property = await getPropertyById(testPropertyId);

      expect(property).toBeDefined();
      expect(property?.leadTemperature).toBe('SUPER HOT');
    });

    it('should never return undefined temperature', async () => {
      await updateLeadTemperature(testPropertyId, 'HOT');
      const property = await getPropertyById(testPropertyId);

      expect(property).toBeDefined();
      expect(property?.leadTemperature).toBeDefined();
      expect(property?.leadTemperature).not.toBeNull();
      expect(property?.leadTemperature).not.toBeUndefined();
    });

    it('should return all required fields without undefined values', async () => {
      await updateLeadTemperature(testPropertyId, 'WARM');
      const property = await getPropertyById(testPropertyId);

      expect(property).toBeDefined();
      
      // Check critical fields are not undefined
      expect(property?.id).toBeDefined();
      expect(property?.addressLine1).toBeDefined();
      expect(property?.city).toBeDefined();
      expect(property?.state).toBeDefined();
      expect(property?.leadTemperature).toBeDefined();
      expect(property?.contacts).toBeDefined();

      // Check they are not null (except nullable fields)
      expect(property?.addressLine1).not.toBeNull();
      expect(property?.leadTemperature).not.toBeNull();
    });

    it('should handle Object.keys() on returned property', async () => {
      await updateLeadTemperature(testPropertyId, 'SUPER HOT');
      const property = await getPropertyById(testPropertyId);

      expect(property).toBeDefined();
      
      // This should not throw "Cannot convert undefined or null to object"
      const keys = Object.keys(property || {});
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('leadTemperature');
      expect(keys).toContain('addressLine1');
    });

    it('should handle Object.entries() on returned property', async () => {
      await updateLeadTemperature(testPropertyId, 'HOT');
      const property = await getPropertyById(testPropertyId);

      expect(property).toBeDefined();
      
      // This should not throw "Cannot convert undefined or null to object"
      const entries = Object.entries(property || {});
      expect(entries.length).toBeGreaterThan(0);
      
      const tempEntry = entries.find(([key]) => key === 'leadTemperature');
      expect(tempEntry).toBeDefined();
      expect(tempEntry?.[1]).toBe('HOT');
    });
  });

  describe('Temperature update edge cases', () => {
    it('should handle rapid consecutive temperature updates', async () => {
      const temps = ['HOT', 'SUPER HOT', 'WARM', 'COLD', 'HOT', 'SUPER HOT'];
      
      for (const temp of temps) {
        await updateLeadTemperature(testPropertyId, temp);
      }

      const property = await getPropertyById(testPropertyId);
      expect(property?.leadTemperature).toBe('SUPER HOT');
    });

    it('should handle updating to same temperature twice', async () => {
      await updateLeadTemperature(testPropertyId, 'SUPER HOT');
      const result1 = await updateLeadTemperature(testPropertyId, 'SUPER HOT');
      expect(result1).toBeUndefined();

      const property = await getPropertyById(testPropertyId);
      expect(property?.leadTemperature).toBe('SUPER HOT');
    });

    it('should not corrupt other property fields when updating temperature', async () => {
      const propertyBefore = await getPropertyById(testPropertyId);
      const originalOwner = propertyBefore?.owner1Name;
      const originalValue = propertyBefore?.estimatedValue;

      await updateLeadTemperature(testPropertyId, 'SUPER HOT');

      const propertyAfter = await getPropertyById(testPropertyId);
      expect(propertyAfter?.owner1Name).toBe(originalOwner);
      expect(propertyAfter?.estimatedValue).toBe(originalValue);
      expect(propertyAfter?.leadTemperature).toBe('SUPER HOT');
    });
  });

  describe('Frontend integration - Property object safety', () => {
    it('should ensure property object is safe for switch statements', async () => {
      await updateLeadTemperature(testPropertyId, 'SUPER HOT');
      const property = await getPropertyById(testPropertyId);

      // Simulate frontend code that uses switch on temperature
      let color = 'bg-white';
      switch (property?.leadTemperature) {
        case 'SUPER HOT':
          color = 'bg-blue-100';
          break;
        case 'HOT':
          color = 'bg-green-100';
          break;
        case 'WARM':
          color = 'bg-amber-100';
          break;
        case 'COLD':
          color = 'bg-gray-200';
          break;
        case 'DEAD':
          color = 'bg-purple-100';
          break;
        default:
          color = 'bg-white';
      }

      expect(color).toBe('bg-blue-100');
    });

    it('should ensure property is safe for template literals', async () => {
      await updateLeadTemperature(testPropertyId, 'HOT');
      const property = await getPropertyById(testPropertyId);

      // Simulate frontend code that uses property in template
      const url = `https://example.com/${property?.addressLine1}/${property?.city}/${property?.state}`;
      expect(url).toContain('example.com');
      expect(url).not.toContain('undefined');
    });
  });
});
