import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { tasks } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as db from './db';

describe('Task Creation via tRPC', () => {
  let database: any;
  let createdTaskIds: number[] = [];

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error('Database not available');
  });

  it('should create a task with title and type', async () => {
    const taskData = {
      title: 'Call Owner',
      taskType: 'Call' as const,
      priority: 'High' as const,
      status: 'To Do' as const,
      createdById: 1,
      propertyId: 1,
      dueDate: new Date('2026-02-15'),
      repeatTask: 'No repeat' as const,
    };

    const result = await db.createTask(taskData);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    createdTaskIds.push(result.id);
  });

  it('should create a task with optional title (description only)', async () => {
    const taskData = {
      description: 'Follow up with seller',
      taskType: 'Follow-up' as const,
      priority: 'Medium' as const,
      status: 'To Do' as const,
      createdById: 1,
      repeatTask: 'Weekly' as const,
    };

    const result = await db.createTask(taskData);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    createdTaskIds.push(result.id);
  });

  it('should create a task with dueTime', async () => {
    const taskData = {
      title: 'Team Meeting',
      taskType: 'Call' as const,
      priority: 'High' as const,
      status: 'To Do' as const,
      createdById: 1,
      dueDate: new Date('2026-02-20'),
      dueTime: '14:30',
      repeatTask: 'No repeat' as const,
    };

    const result = await db.createTask(taskData);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    
    // Verify dueTime was saved
    const saved = await database.select().from(tasks).where(eq(tasks.id, result.id));
    expect(saved[0].dueTime).toBe('14:30');
    createdTaskIds.push(result.id);
  });

  it('should create a task with repeat settings', async () => {
    const taskData = {
      title: 'Daily Check-in',
      taskType: 'Call' as const,
      priority: 'Medium' as const,
      status: 'To Do' as const,
      createdById: 1,
      repeatTask: 'Daily' as const,
    };

    const result = await db.createTask(taskData);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    
    // Verify repeatTask was saved
    const saved = await database.select().from(tasks).where(eq(tasks.id, result.id));
    expect(saved[0].repeatTask).toBe('Daily');
    createdTaskIds.push(result.id);
  });

  it('should retrieve all created tasks', async () => {
    const allTasks = await db.getTasks();
    expect(allTasks).toBeDefined();
    expect(Array.isArray(allTasks)).toBe(true);
  });

  afterAll(async () => {
    // Cleanup: delete test tasks
    if (database && createdTaskIds.length > 0) {
      for (const taskId of createdTaskIds) {
        await database.delete(tasks).where(eq(tasks.id, taskId));
      }
    }
  });
});
