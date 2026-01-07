import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { tasks } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Task Creation and Persistence', () => {
  let db: any;
  let createdTaskId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error('Database not available');
  });

  it('should create a task with valid data', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'This is a test task',
      taskType: 'Call',
      priority: 'High',
      status: 'To Do',
      createdById: 1,
      propertyId: 1,
      dueDate: new Date('2026-02-07'),
      repeatTask: 'No repeat',
    };

    const result = await db.insert(tasks).values(taskData).$returningId();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id');
    createdTaskId = result[0].id;
  });

  it('should persist task to database', async () => {
    const result = await db.select().from(tasks).where(eq(tasks.id, createdTaskId));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Task');
    expect(result[0].status).toBe('To Do');
  });

  it('should accept "No repeat" as valid repeatTask value', async () => {
    const taskData = {
      title: 'Repeat Test',
      taskType: 'Email',
      priority: 'Medium',
      status: 'To Do',
      createdById: 1,
      repeatTask: 'No repeat',
    };

    const result = await db.insert(tasks).values(taskData).$returningId();
    expect(result).toHaveLength(1);
    
    // Verify it was saved
    const saved = await db.select().from(tasks).where(eq(tasks.id, result[0].id));
    expect(saved[0].repeatTask).toBe('No repeat');
  });

  it('should accept "Daily" as valid repeatTask value', async () => {
    const taskData = {
      title: 'Daily Task',
      taskType: 'Call',
      priority: 'Medium',
      status: 'To Do',
      createdById: 1,
      repeatTask: 'Daily',
    };

    const result = await db.insert(tasks).values(taskData).$returningId();
    expect(result).toHaveLength(1);
    
    // Verify it was saved
    const saved = await db.select().from(tasks).where(eq(tasks.id, result[0].id));
    expect(saved[0].repeatTask).toBe('Daily');
  });

  it('should save task with dueTime field', async () => {
    const taskData = {
      title: 'Task with Time',
      taskType: 'Call',
      priority: 'Medium',
      status: 'To Do',
      createdById: 1,
      dueDate: new Date('2026-02-07'),
      dueTime: '14:30',
      repeatTask: 'No repeat',
    };

    const result = await db.insert(tasks).values(taskData).$returningId();
    expect(result).toHaveLength(1);
    
    // Verify it was saved with time
    const saved = await db.select().from(tasks).where(eq(tasks.id, result[0].id));
    expect(saved[0].dueTime).toBe('14:30');
  });

  afterAll(async () => {
    // Cleanup: delete test tasks
    if (db) {
      await db.delete(tasks).where(eq(tasks.title, 'Test Task'));
      await db.delete(tasks).where(eq(tasks.title, 'Repeat Test'));
      await db.delete(tasks).where(eq(tasks.title, 'Daily Task'));
      await db.delete(tasks).where(eq(tasks.title, 'Task with Time'));
    }
  });
});
