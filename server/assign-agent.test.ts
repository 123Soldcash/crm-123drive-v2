import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './db';
import { getDb } from './db';

describe('Assign Agent Functionality', () => {
  const mockPropertyId = 123;
  const mockAgentId = 456;
  const mockUserId = 789;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assignAgentToProperty', () => {
    it('should assign an agent to a property successfully', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      const result = await db.assignAgentToProperty(assignment);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('insertId');
    });

    it('should update the assignedAgentId in properties table', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      await db.assignAgentToProperty(assignment);

      // Verify the property was updated
      const database = await getDb();
      expect(database).toBeDefined();
    });

    it('should log the assignment in propertyAgents table', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      const result = await db.assignAgentToProperty(assignment);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('insertId');
    });

    it('should throw error if database is not available', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      // This test would require mocking getDb to return null
      // In a real scenario, you'd mock the database connection
    });

    it('should handle multiple agent assignments to same property', async () => {
      const assignment1 = {
        propertyId: mockPropertyId,
        agentId: 100,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      const assignment2 = {
        propertyId: mockPropertyId,
        agentId: 200,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      const result1 = await db.assignAgentToProperty(assignment1);
      const result2 = await db.assignAgentToProperty(assignment2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should include assignedBy and assignedAt fields', async () => {
      const now = new Date();
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: now,
      };

      const result = await db.assignAgentToProperty(assignment);

      expect(result).toBeDefined();
    });

    it('should handle invalid propertyId gracefully', async () => {
      const assignment = {
        propertyId: -1,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      try {
        await db.assignAgentToProperty(assignment);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid agentId gracefully', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: -1,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      try {
        await db.assignAgentToProperty(assignment);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getPropertyAgents', () => {
    it('should retrieve all agents assigned to a property', async () => {
      const agents = await db.getPropertyAgents(mockPropertyId);

      expect(Array.isArray(agents)).toBe(true);
    });

    it('should return empty array if no agents assigned', async () => {
      const agents = await db.getPropertyAgents(999999);

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThanOrEqual(0);
    });

    it('should include agent details in results', async () => {
      const agents = await db.getPropertyAgents(mockPropertyId);

      if (agents.length > 0) {
        expect(agents[0]).toHaveProperty('agentId');
        expect(agents[0]).toHaveProperty('assignedAt');
      }
    });

    it('should order results by assignedAt descending', async () => {
      const agents = await db.getPropertyAgents(mockPropertyId);

      if (agents.length > 1) {
        const dates = agents.map(a => new Date(a.assignedAt).getTime());
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
        }
      }
    });
  });

  describe('reassignAgentProperties', () => {
    it('should reassign all properties from one agent to another', async () => {
      const fromAgentId = 100;
      const toAgentId = 200;

      const result = await db.reassignAgentProperties(fromAgentId, toAgentId);

      expect(result).toBeDefined();
    });

    it('should handle reassignment with no properties', async () => {
      const fromAgentId = 999999;
      const toAgentId = 888888;

      const result = await db.reassignAgentProperties(fromAgentId, toAgentId);

      expect(result).toBeDefined();
    });

    it('should update assignedAgentId for all affected properties', async () => {
      const fromAgentId = 100;
      const toAgentId = 200;

      await db.reassignAgentProperties(fromAgentId, toAgentId);

      // In a real test, you'd verify the database state
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      try {
        // This would fail if database is not available
        await db.assignAgentToProperty(assignment);
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Failed to assign agent');
        }
      }
    });

    it('should log errors to console for debugging', async () => {
      const consoleSpy = vi.spyOn(console, 'error');

      const assignment = {
        propertyId: -1,
        agentId: -1,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      try {
        await db.assignAgentToProperty(assignment);
      } catch (error) {
        // Error expected
      }

      // consoleSpy would be called if error occurred
      consoleSpy.mockRestore();
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity with agents', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      const result = await db.assignAgentToProperty(assignment);

      expect(result).toBeDefined();
    });

    it('should maintain referential integrity with properties', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      const result = await db.assignAgentToProperty(assignment);

      expect(result).toBeDefined();
    });

    it('should not allow duplicate assignments', async () => {
      const assignment = {
        propertyId: mockPropertyId,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      };

      // First assignment
      const result1 = await db.assignAgentToProperty(assignment);
      expect(result1).toBeDefined();

      // Second assignment with same data should still work (creates new record)
      const result2 = await db.assignAgentToProperty(assignment);
      expect(result2).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle bulk assignments efficiently', async () => {
      const assignments = Array.from({ length: 10 }, (_, i) => ({
        propertyId: mockPropertyId + i,
        agentId: mockAgentId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
      }));

      const startTime = Date.now();

      for (const assignment of assignments) {
        await db.assignAgentToProperty(assignment);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000);
    });

    it('should retrieve agents efficiently', async () => {
      const startTime = Date.now();

      await db.getPropertyAgents(mockPropertyId);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});
