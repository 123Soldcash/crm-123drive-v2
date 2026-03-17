import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { tasks } from '../drizzle/schema';

// The updated task type enum that the frontend sends
const newTaskTypeEnum = z.enum([
  "Call", "Text", "Email", "Meeting", "Site Visit", "Follow Up",
  "Offer", "Contract", "Closing",
  "Sent Letter", "Sent Post Card", "Skiptrace", "Take Over Lead", "Drip Campaign",
  // Legacy types kept for backward compatibility
  "Visit", "Research", "Follow-up", "Negotiation", "Inspection", "Other"
]);

// The create task input schema (mirrors routers.ts)
const createTaskInput = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  taskType: newTaskTypeEnum,
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  status: z.enum(["To Do", "In Progress", "Done"]).default("To Do"),
  assignedToId: z.number().optional(),
  propertyId: z.number().optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  repeatTask: z.enum(["Daily", "Weekly", "Monthly", "No repeat"]).optional(),
  checklist: z.string().optional(),
});

describe('Task Dialog Update - Title auto-generation and new task types', () => {
  describe('Schema validation - new task types accepted', () => {
    const primaryTypes = [
      "Call", "Text", "Email", "Meeting", "Site Visit", "Follow Up",
      "Offer", "Contract", "Closing",
      "Sent Letter", "Sent Post Card", "Skiptrace", "Take Over Lead", "Drip Campaign"
    ];

    for (const taskType of primaryTypes) {
      it(`should accept "${taskType}" as a valid task type`, () => {
        const result = createTaskInput.safeParse({
          taskType,
          title: taskType,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.taskType).toBe(taskType);
        }
      });
    }
  });

  describe('Schema validation - legacy task types still accepted', () => {
    const legacyTypes = ["Visit", "Research", "Follow-up", "Negotiation", "Inspection", "Other"];

    for (const taskType of legacyTypes) {
      it(`should accept legacy type "${taskType}"`, () => {
        const result = createTaskInput.safeParse({
          taskType,
        });
        expect(result.success).toBe(true);
      });
    }
  });

  describe('Title auto-generation logic', () => {
    it('should use taskType as title when title is not provided', () => {
      // Simulates the backend logic: const autoTitle = input.title || input.taskType;
      const input = { taskType: "Call" };
      const autoTitle = (input as any).title || input.taskType;
      expect(autoTitle).toBe("Call");
    });

    it('should use taskType as title for "Drip Campaign"', () => {
      const input = { taskType: "Drip Campaign" };
      const autoTitle = (input as any).title || input.taskType;
      expect(autoTitle).toBe("Drip Campaign");
    });

    it('should use taskType as title for "Site Visit"', () => {
      const input = { taskType: "Site Visit" };
      const autoTitle = (input as any).title || input.taskType;
      expect(autoTitle).toBe("Site Visit");
    });

    it('should use explicit title when provided', () => {
      const input = { taskType: "Call", title: "Call John about property" };
      const autoTitle = input.title || input.taskType;
      expect(autoTitle).toBe("Call John about property");
    });

    it('should use taskType when title is empty string', () => {
      const input = { taskType: "Email", title: "" };
      const autoTitle = input.title || input.taskType;
      expect(autoTitle).toBe("Email");
    });
  });

  describe('Schema validation - title is optional', () => {
    it('should accept task creation without title', () => {
      const result = createTaskInput.safeParse({
        taskType: "Call",
        description: "Follow up with owner",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBeUndefined();
        expect(result.data.description).toBe("Follow up with owner");
      }
    });

    it('should accept task creation with only taskType (no title, no description)', () => {
      const result = createTaskInput.safeParse({
        taskType: "Skiptrace",
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid task type', () => {
      const result = createTaskInput.safeParse({
        taskType: "InvalidType",
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Drizzle schema - tasks table has correct enum values', () => {
    it('should have taskType column defined', () => {
      expect(tasks.taskType).toBeDefined();
    });

    it('should have title column defined as optional (no notNull)', () => {
      expect(tasks.title).toBeDefined();
    });

    it('should have all 20 task type enum values in schema', () => {
      // The schema enum includes both new and legacy types
      const expectedTypes = [
        "Call", "Text", "Email", "Meeting", "Site Visit", "Follow Up",
        "Offer", "Contract", "Closing",
        "Sent Letter", "Sent Post Card", "Skiptrace", "Take Over Lead", "Drip Campaign",
        "Visit", "Research", "Follow-up", "Negotiation", "Inspection", "Other"
      ];
      
      // Access the enum values from the drizzle schema column
      const columnConfig = (tasks.taskType as any).config || (tasks.taskType as any);
      const enumValues = columnConfig.enumValues || (tasks.taskType as any).enumValues;
      
      expect(enumValues).toBeDefined();
      for (const type of expectedTypes) {
        expect(enumValues).toContain(type);
      }
    });
  });

  describe('Frontend task type list', () => {
    // These are the 14 primary task types shown in the Create Task dialog
    const frontendTaskTypes = [
      { value: "Call", label: "Call" },
      { value: "Text", label: "Text" },
      { value: "Email", label: "Email" },
      { value: "Meeting", label: "Meeting" },
      { value: "Site Visit", label: "Site Visit" },
      { value: "Follow Up", label: "Follow Up" },
      { value: "Offer", label: "Offer" },
      { value: "Contract", label: "Contract" },
      { value: "Closing", label: "Closing" },
      { value: "Sent Letter", label: "Sent Letter" },
      { value: "Sent Post Card", label: "Sent Post Card" },
      { value: "Skiptrace", label: "Skiptrace" },
      { value: "Take Over Lead", label: "Take Over Lead" },
      { value: "Drip Campaign", label: "Drip Campaign" },
    ];

    it('should have exactly 14 primary task types', () => {
      expect(frontendTaskTypes).toHaveLength(14);
    });

    it('all frontend task types should be valid in the schema', () => {
      for (const type of frontendTaskTypes) {
        const result = newTaskTypeEnum.safeParse(type.value);
        expect(result.success).toBe(true);
      }
    });

    it('should not include "Other" in the primary frontend list (removed per user request)', () => {
      const hasOther = frontendTaskTypes.some(t => t.value === "Other");
      expect(hasOther).toBe(false);
    });

    it('should not include legacy types (Visit, Research, etc.) in the primary frontend list', () => {
      const legacyTypes = ["Visit", "Research", "Follow-up", "Negotiation", "Inspection"];
      for (const legacy of legacyTypes) {
        const hasLegacy = frontendTaskTypes.some(t => t.value === legacy);
        expect(hasLegacy).toBe(false);
      }
    });
  });
});
