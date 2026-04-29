/**
 * Task Repeat Scheduler
 * 
 * Runs every 5 minutes. Finds tasks that:
 *  - Have a repeatTask value (not "No repeat")
 *  - Have repeatActive = 1 (not cancelled)
 *  - Have status = "Done"
 *  - Do NOT already have a child task created for the next occurrence
 * 
 * For each such task, it creates a new "To Do" task with the next due date
 * calculated from the original due date + repeat interval.
 */

import { getDb } from "./db.js";
import { tasks } from "../drizzle/schema.js";
import { and, eq, isNull, ne, isNotNull, sql } from "drizzle-orm";

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Calculate the next due date based on the repeat interval.
 */
function calculateNextDueDate(currentDueDate: Date, repeatInterval: string): Date {
  const next = new Date(currentDueDate);
  switch (repeatInterval) {
    case "Daily":
      next.setDate(next.getDate() + 1);
      break;
    case "Weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "Monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "3 Months":
      next.setMonth(next.getMonth() + 3);
      break;
    case "6 Months":
      next.setMonth(next.getMonth() + 6);
      break;
    default:
      // No repeat — should not reach here
      break;
  }
  return next;
}

/**
 * Process all completed repeating tasks and create their next occurrences.
 */
export async function runTaskRepeatCycle(): Promise<{ processed: number; created: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Task Repeat] Database not available, skipping cycle");
    return { processed: 0, created: 0 };
  }

  try {
    // Find all completed tasks that:
    // 1. Have a repeat interval (not "No repeat")
    // 2. Have repeatActive = 1
    // 3. Have status = "Done"
    // 4. Do NOT already have a child task (parentTaskId pointing to them)
    const completedRepeatingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        taskType: tasks.taskType,
        priority: tasks.priority,
        propertyId: tasks.propertyId,
        deskId: tasks.deskId,
        assignedToId: tasks.assignedToId,
        dueDate: tasks.dueDate,
        dueTime: tasks.dueTime,
        repeatTask: tasks.repeatTask,
        checklist: tasks.checklist,
        createdById: tasks.createdById,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "Done"),
          ne(tasks.repeatTask, "No repeat"),
          isNotNull(tasks.repeatTask),
          eq(tasks.repeatActive, 1),
          // Only process tasks that don't already have a child task
          sql`${tasks.id} NOT IN (SELECT parentTaskId FROM tasks WHERE parentTaskId IS NOT NULL)`
        )
      );

    if (completedRepeatingTasks.length === 0) {
      return { processed: 0, created: 0 };
    }

    console.log(`[Task Repeat] Found ${completedRepeatingTasks.length} completed repeating tasks to process`);

    let created = 0;

    for (const task of completedRepeatingTasks) {
      try {
        // Calculate next due date
        const baseDueDate = task.dueDate ? new Date(task.dueDate) : new Date();
        const nextDueDate = calculateNextDueDate(baseDueDate, task.repeatTask!);

        // Create the next task occurrence
        await db.insert(tasks).values({
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          priority: task.priority,
          status: "To Do",
          propertyId: task.propertyId,
          deskId: task.deskId,
          assignedToId: task.assignedToId,
          dueDate: nextDueDate,
          dueTime: task.dueTime,
          repeatTask: task.repeatTask,
          repeatActive: 1,
          checklist: task.checklist,
          createdById: task.createdById,
          parentTaskId: task.id, // Link to parent
        });

        created++;
        console.log(`[Task Repeat] Created next occurrence for task #${task.id} (${task.repeatTask}) → due ${nextDueDate.toISOString().split('T')[0]}`);
      } catch (err: any) {
        console.error(`[Task Repeat] Error creating next occurrence for task #${task.id}:`, err.message);
      }
    }

    return { processed: completedRepeatingTasks.length, created };
  } catch (error: any) {
    console.error("[Task Repeat] Cycle error:", error.message);
    return { processed: 0, created: 0 };
  }
}

/**
 * Start the task repeat scheduler.
 */
export function startTaskRepeatScheduler() {
  if (schedulerInterval) {
    console.log("[Task Repeat] Already running");
    return;
  }

  console.log(`[Task Repeat] Starting — checking every ${SCHEDULER_INTERVAL_MS / 1000}s`);

  // Run immediately on start
  runTaskRepeatCycle().catch(console.error);

  // Then run every 5 minutes
  schedulerInterval = setInterval(() => {
    runTaskRepeatCycle().catch(console.error);
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the task repeat scheduler.
 */
export function stopTaskRepeatScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Task Repeat] Stopped");
  }
}
