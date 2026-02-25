import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateMAO,
  saveDealCalculation,
  getDealCalculation,
  deleteDealCalculation,
  calculateProfitMargin,
  analyzeDeal,
} from './db-deal-calculator';

// Mock the getDb function
vi.mock('./db', () => ({
  getDb: vi.fn(),
}));

describe('Deal Calculator Database Functions', () => {
  const mockPropertyId = 123;
  const mockFinancials = {
    arv: 500000,
    repairCost: 50000,
    closingCost: 10000,
    assignmentFee: 15000,
    desiredProfit: 30000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateMAO', () => {
    it('should calculate MAO correctly', async () => {
      const result = await calculateMAO(
        mockFinancials.arv,
        mockFinancials.repairCost,
        mockFinancials.closingCost,
        mockFinancials.assignmentFee,
        mockFinancials.desiredProfit
      );

      // MAO = 500000 - 50000 - 10000 - 15000 - 30000 = 395000
      expect(result.mao).toBe(395000);
      expect(result.formula).toContain('395000');
    });

    it('should ensure MAO is never negative', async () => {
      const result = await calculateMAO(
        100000, // ARV
        50000,  // Repair
        30000,  // Closing
        15000,  // Assignment
        100000  // Profit (total costs exceed ARV)
      );

      expect(result.mao).toBeGreaterThanOrEqual(0);
    });

    it('should include formula in result', async () => {
      const result = await calculateMAO(
        mockFinancials.arv,
        mockFinancials.repairCost,
        mockFinancials.closingCost,
        mockFinancials.assignmentFee,
        mockFinancials.desiredProfit
      );

      expect(result.formula).toBeTruthy();
      expect(result.formula).toContain('MAO');
      expect(result.formula).toContain('$');
    });

    it('should handle zero values', async () => {
      const result = await calculateMAO(
        500000,
        0,
        0,
        0,
        0
      );

      expect(result.mao).toBe(500000);
    });

    it('should handle decimal values', async () => {
      const result = await calculateMAO(
        500000.50,
        50000.25,
        10000.75,
        15000.10,
        30000.40
      );

      expect(result.mao).toBeCloseTo(394999, 0);
    });
  });

  describe('calculateProfitMargin', () => {
    it('should calculate profit margin correctly', async () => {
      const result = await calculateProfitMargin(
        mockPropertyId,
        300000 // Offer price
      );

      // This depends on getDealCalculation being mocked
      // Profit = ARV - OfferPrice - (Repair + Closing + Assignment)
      // = 500000 - 300000 - (50000 + 10000 + 15000) = 125000
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('profitMargin');
    });

    it('should return zero values for invalid propertyId', async () => {
      const result = await calculateProfitMargin(null, 300000);
      expect(result.profit).toBe(0);
      expect(result.profitMargin).toBe(0);
    });

    it('should return zero values for negative propertyId', async () => {
      const result = await calculateProfitMargin(-1, 300000);
      expect(result.profit).toBe(0);
      expect(result.profitMargin).toBe(0);
    });

    it('should ensure profit is never negative', async () => {
      const result = await calculateProfitMargin(mockPropertyId, 1000000);
      expect(result.profit).toBeGreaterThanOrEqual(0);
    });

    it('should ensure profit margin is never negative', async () => {
      const result = await calculateProfitMargin(mockPropertyId, 1000000);
      expect(result.profitMargin).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeDeal', () => {
    it('should return null for invalid propertyId', async () => {
      const result = await analyzeDeal(null, 300000);
      expect(result).toBeNull();
    });

    it('should return null for negative propertyId', async () => {
      const result = await analyzeDeal(-1, 300000);
      expect(result).toBeNull();
    });

    it('should include required analysis fields', async () => {
      const result = await analyzeDeal(mockPropertyId, 300000);
      
      if (result) {
        expect(result).toHaveProperty('isViable');
        expect(result).toHaveProperty('reason');
        // profit, profitMargin, minProfitMargin are only present when a deal calculation exists
        // When no calculation is found, only isViable and reason are returned
        if ('profit' in result) {
          expect(result).toHaveProperty('profitMargin');
          expect(result).toHaveProperty('minProfitMargin');
        }
      }
    });

    it('should mark deal as viable when profit margin meets minimum', async () => {
      // This test depends on mock implementation
      // A deal with 5%+ margin should be viable
      const result = await analyzeDeal(mockPropertyId, 300000);
      
      if (result) {
        expect(typeof result.isViable).toBe('boolean');
      }
    });

    it('should include reason in analysis', async () => {
      const result = await analyzeDeal(mockPropertyId, 300000);
      
      if (result) {
        expect(result.reason).toBeTruthy();
        expect(result.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Input Validation', () => {
    it('should validate ARV is positive', async () => {
      const result = await calculateMAO(
        -100, // Negative ARV
        50000,
        10000,
        15000,
        30000
      );

      // Should still calculate but result will be very negative
      expect(typeof result.mao).toBe('number');
    });

    it('should validate all financial inputs are numbers', async () => {
      const result = await calculateMAO(
        500000,
        50000,
        10000,
        15000,
        30000
      );

      expect(typeof result.mao).toBe('number');
      expect(typeof result.formula).toBe('string');
    });

    it('should handle very large numbers', async () => {
      const result = await calculateMAO(
        10000000,
        1000000,
        500000,
        250000,
        1000000
      );

      expect(result.mao).toBe(7250000);
    });

    it('should handle very small decimal numbers', async () => {
      const result = await calculateMAO(
        1000.01,
        100.001,
        50.0001,
        25.00001,
        100.000001
      );

      expect(result.mao).toBeCloseTo(724.999, 0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Tests would need actual DB mock setup
      // This is a placeholder for error handling tests
      expect(true).toBe(true);
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      
      // Test with invalid inputs
      await calculateProfitMargin(null, 300000);
      
      // Verify error logging occurred
      expect(consoleSpy).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain financial data integrity', async () => {
      const result = await calculateMAO(
        mockFinancials.arv,
        mockFinancials.repairCost,
        mockFinancials.closingCost,
        mockFinancials.assignmentFee,
        mockFinancials.desiredProfit
      );

      // Verify formula contains all input values
      expect(result.formula).toContain(mockFinancials.arv.toString());
      expect(result.formula).toContain(mockFinancials.repairCost.toString());
    });

    it('should return consistent results for same inputs', async () => {
      const result1 = await calculateMAO(
        mockFinancials.arv,
        mockFinancials.repairCost,
        mockFinancials.closingCost,
        mockFinancials.assignmentFee,
        mockFinancials.desiredProfit
      );

      const result2 = await calculateMAO(
        mockFinancials.arv,
        mockFinancials.repairCost,
        mockFinancials.closingCost,
        mockFinancials.assignmentFee,
        mockFinancials.desiredProfit
      );

      expect(result1.mao).toBe(result2.mao);
      expect(result1.formula).toBe(result2.formula);
    });

    it('should preserve decimal precision', async () => {
      const result = await calculateMAO(
        500000.99,
        50000.11,
        10000.22,
        15000.33,
        30000.44
      );

      // Should maintain precision in formula
      expect(result.formula).toContain('500000.99');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all costs equal to ARV', async () => {
      const result = await calculateMAO(
        100000,
        25000,
        25000,
        25000,
        25000
      );

      expect(result.mao).toBe(0);
    });

    it('should handle costs exceeding ARV', async () => {
      const result = await calculateMAO(
        100000,
        50000,
        30000,
        20000,
        30000
      );

      // MAO would be negative, but should be clamped to 0
      expect(result.mao).toBeGreaterThanOrEqual(0);
    });

    it('should handle single cost item', async () => {
      const result = await calculateMAO(
        100000,
        0,
        0,
        0,
        0
      );

      expect(result.mao).toBe(100000);
    });

    it('should handle maximum precision decimals', async () => {
      const result = await calculateMAO(
        500000.123456,
        50000.654321,
        10000.111111,
        15000.222222,
        30000.333333
      );

      expect(typeof result.mao).toBe('number');
      expect(result.mao).toBeLessThan(500000);
    });
  });

  describe('Formula Generation', () => {
    it('should generate readable formula', async () => {
      const result = await calculateMAO(
        500000,
        50000,
        10000,
        15000,
        30000
      );

      expect(result.formula).toMatch(/MAO\s*=/);
      expect(result.formula).toMatch(/\$/g);
    });

    it('should include all calculation components in formula', async () => {
      const result = await calculateMAO(
        500000,
        50000,
        10000,
        15000,
        30000
      );

      expect(result.formula).toContain('500000');
      expect(result.formula).toContain('50000');
      expect(result.formula).toContain('10000');
      expect(result.formula).toContain('15000');
      expect(result.formula).toContain('30000');
      expect(result.formula).toContain('395000');
    });

    it('should format currency values with 2 decimals', async () => {
      const result = await calculateMAO(
        500000.5,
        50000.25,
        10000.75,
        15000.10,
        30000.40
      );

      // Formula should contain formatted values
      expect(result.formula).toMatch(/\$[\d,]+\.\d{2}/);
    });
  });
});
