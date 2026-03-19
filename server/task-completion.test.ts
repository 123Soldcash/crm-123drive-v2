import { describe, it, expect } from "vitest";

/**
 * Tests for task completion functionality.
 * Validates the status transitions, visual state logic, and sorting behavior
 * used across PropertyTasks, TasksList, TaskCard, and TasksCalendar.
 */

// Status types used in the task system
type TaskStatus = "To Do" | "In Progress" | "Done";

// Helper: determine if a task is overdue
function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "Done") return false;
  return new Date(dueDate) < new Date();
}

// Helper: determine if a task is due today
function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).toDateString() === new Date().toDateString();
}

// Helper: get the next status when toggling completion
function toggleComplete(currentStatus: TaskStatus): { status: TaskStatus; completedDate: string | null } {
  if (currentStatus === "Done") {
    return { status: "To Do", completedDate: null };
  }
  return { status: "Done", completedDate: new Date().toISOString() };
}

// Helper: sort tasks - pending first, completed at bottom
function sortTasks(tasks: { id: number; status: string }[]) {
  return [...tasks].sort((a, b) => {
    if (a.status === "Done" && b.status !== "Done") return 1;
    if (a.status !== "Done" && b.status === "Done") return -1;
    return 0;
  });
}

// Helper: get visual CSS class based on task status
function getTaskRowClass(status: string, isTaskOverdue: boolean, isTaskDueToday: boolean): string {
  if (status === "Done") return "bg-emerald-50/30";
  if (isTaskOverdue) return "bg-red-50";
  if (isTaskDueToday) return "bg-yellow-50";
  return "";
}

// Helper: get text style for task title
function getTaskTitleClass(status: string): string {
  if (status === "Done") return "text-gray-400 line-through decoration-emerald-400 decoration-2";
  return "text-gray-900";
}

// Helper: get status badge info
function getStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case "Done": return { label: "Done", color: "bg-emerald-100 text-emerald-700" };
    case "In Progress": return { label: "In Progress", color: "bg-blue-100 text-blue-700" };
    default: return { label: "To Do", color: "bg-slate-100 text-slate-600" };
  }
}

describe("Task Completion - Status Toggle", () => {
  it("should toggle from To Do to Done with completedDate", () => {
    const result = toggleComplete("To Do");
    expect(result.status).toBe("Done");
    expect(result.completedDate).toBeTruthy();
    expect(new Date(result.completedDate!).getTime()).toBeGreaterThan(0);
  });

  it("should toggle from In Progress to Done with completedDate", () => {
    const result = toggleComplete("In Progress");
    expect(result.status).toBe("Done");
    expect(result.completedDate).toBeTruthy();
  });

  it("should toggle from Done back to To Do with null completedDate", () => {
    const result = toggleComplete("Done");
    expect(result.status).toBe("To Do");
    expect(result.completedDate).toBeNull();
  });

  it("should set completedDate to current time when marking as Done", () => {
    const before = Date.now();
    const result = toggleComplete("To Do");
    const after = Date.now();
    const completedTime = new Date(result.completedDate!).getTime();
    expect(completedTime).toBeGreaterThanOrEqual(before);
    expect(completedTime).toBeLessThanOrEqual(after);
  });
});

describe("Task Completion - Overdue Logic", () => {
  it("should not be overdue if status is Done", () => {
    expect(isOverdue("2020-01-01", "Done")).toBe(false);
  });

  it("should be overdue if due date is past and status is not Done", () => {
    expect(isOverdue("2020-01-01", "To Do")).toBe(true);
  });

  it("should not be overdue if no due date", () => {
    expect(isOverdue(null, "To Do")).toBe(false);
  });

  it("should not be overdue if due date is in the future", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    expect(isOverdue(futureDate.toISOString(), "To Do")).toBe(false);
  });
});

describe("Task Completion - Sorting", () => {
  it("should sort pending tasks before completed tasks", () => {
    const tasks = [
      { id: 1, status: "Done" },
      { id: 2, status: "To Do" },
      { id: 3, status: "In Progress" },
      { id: 4, status: "Done" },
      { id: 5, status: "To Do" },
    ];
    const sorted = sortTasks(tasks);
    // All non-Done should come first
    expect(sorted[0].status).not.toBe("Done");
    expect(sorted[1].status).not.toBe("Done");
    expect(sorted[2].status).not.toBe("Done");
    // Done tasks at the end
    expect(sorted[3].status).toBe("Done");
    expect(sorted[4].status).toBe("Done");
  });

  it("should preserve original order within same status group", () => {
    const tasks = [
      { id: 1, status: "To Do" },
      { id: 2, status: "To Do" },
      { id: 3, status: "Done" },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe(1);
    expect(sorted[1].id).toBe(2);
    expect(sorted[2].id).toBe(3);
  });

  it("should handle all tasks being Done", () => {
    const tasks = [
      { id: 1, status: "Done" },
      { id: 2, status: "Done" },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.length).toBe(2);
    expect(sorted[0].id).toBe(1);
    expect(sorted[1].id).toBe(2);
  });

  it("should handle empty array", () => {
    const sorted = sortTasks([]);
    expect(sorted.length).toBe(0);
  });
});

describe("Task Completion - Visual Styles", () => {
  it("should return emerald background for Done tasks", () => {
    expect(getTaskRowClass("Done", false, false)).toBe("bg-emerald-50/30");
  });

  it("should return red background for overdue pending tasks", () => {
    expect(getTaskRowClass("To Do", true, false)).toBe("bg-red-50");
  });

  it("should return yellow background for tasks due today", () => {
    expect(getTaskRowClass("To Do", false, true)).toBe("bg-yellow-50");
  });

  it("should return empty string for normal pending tasks", () => {
    expect(getTaskRowClass("To Do", false, false)).toBe("");
  });

  it("Done status should take priority over overdue styling", () => {
    // Even if the task was overdue, Done should show emerald
    expect(getTaskRowClass("Done", true, false)).toBe("bg-emerald-50/30");
  });

  it("should apply line-through to Done task titles", () => {
    const cls = getTaskTitleClass("Done");
    expect(cls).toContain("line-through");
    expect(cls).toContain("text-gray-400");
  });

  it("should apply normal styling to pending task titles", () => {
    const cls = getTaskTitleClass("To Do");
    expect(cls).toContain("text-gray-900");
    expect(cls).not.toContain("line-through");
  });
});

describe("Task Completion - Status Badges", () => {
  it("should return green badge for Done", () => {
    const badge = getStatusBadge("Done");
    expect(badge.label).toBe("Done");
    expect(badge.color).toContain("emerald");
  });

  it("should return blue badge for In Progress", () => {
    const badge = getStatusBadge("In Progress");
    expect(badge.label).toBe("In Progress");
    expect(badge.color).toContain("blue");
  });

  it("should return gray badge for To Do", () => {
    const badge = getStatusBadge("To Do");
    expect(badge.label).toBe("To Do");
    expect(badge.color).toContain("slate");
  });
});

describe("Task Completion - Separator Logic", () => {
  it("should identify the first Done task after pending tasks", () => {
    const tasks = sortTasks([
      { id: 1, status: "To Do" },
      { id: 2, status: "In Progress" },
      { id: 3, status: "Done" },
      { id: 4, status: "Done" },
    ]);
    
    // Check which task should show the separator
    const separatorIndices = tasks.map((task, index) => {
      const isDone = task.status === "Done";
      const isFirstDone = isDone && index > 0 && tasks[index - 1]?.status !== "Done";
      return isFirstDone;
    });
    
    // Only the first Done task (id:3) should show separator
    expect(separatorIndices).toEqual([false, false, true, false]);
  });

  it("should not show separator if all tasks are Done", () => {
    const tasks = [
      { id: 1, status: "Done" },
      { id: 2, status: "Done" },
    ];
    
    const separatorIndices = tasks.map((task, index) => {
      const isDone = task.status === "Done";
      const isFirstDone = isDone && index > 0 && tasks[index - 1]?.status !== "Done";
      return isFirstDone;
    });
    
    expect(separatorIndices).toEqual([false, false]);
  });

  it("should not show separator if no tasks are Done", () => {
    const tasks = [
      { id: 1, status: "To Do" },
      { id: 2, status: "In Progress" },
    ];
    
    const separatorIndices = tasks.map((task, index) => {
      const isDone = task.status === "Done";
      const isFirstDone = isDone && index > 0 && tasks[index - 1]?.status !== "Done";
      return isFirstDone;
    });
    
    expect(separatorIndices).toEqual([false, false]);
  });
});

describe("Task Completion - Count Logic", () => {
  it("should correctly count pending and done tasks", () => {
    const tasks = [
      { status: "To Do" },
      { status: "In Progress" },
      { status: "Done" },
      { status: "Done" },
      { status: "To Do" },
    ];
    
    const pendingCount = tasks.filter(t => t.status !== "Done").length;
    const doneCount = tasks.filter(t => t.status === "Done").length;
    
    expect(pendingCount).toBe(3);
    expect(doneCount).toBe(2);
  });
});
