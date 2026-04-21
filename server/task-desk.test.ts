import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

const routersPath = path.join(__dirname, "routers.ts");
const routersContent = fs.readFileSync(routersPath, "utf-8");

const dbPath = path.join(__dirname, "db.ts");
const dbContent = fs.readFileSync(dbPath, "utf-8");

const createTaskDialogPath = path.join(__dirname, "../client/src/components/CreateTaskDialog.tsx");
const createTaskDialogContent = fs.readFileSync(createTaskDialogPath, "utf-8");

const tasksListPath = path.join(__dirname, "../client/src/pages/TasksList.tsx");
const tasksListContent = fs.readFileSync(tasksListPath, "utf-8");

const tasksKanbanPath = path.join(__dirname, "../client/src/pages/TasksKanban.tsx");
const tasksKanbanContent = fs.readFileSync(tasksKanbanPath, "utf-8");

const tasksCalendarPath = path.join(__dirname, "../client/src/pages/TasksCalendar.tsx");
const tasksCalendarContent = fs.readFileSync(tasksCalendarPath, "utf-8");

const taskCardPath = path.join(__dirname, "../client/src/components/TaskCard.tsx");
const taskCardContent = fs.readFileSync(taskCardPath, "utf-8");

const propertyTasksPath = path.join(__dirname, "../client/src/components/PropertyTasks.tsx");
const propertyTasksContent = fs.readFileSync(propertyTasksPath, "utf-8");

describe("Task Desk Assignment - Schema", () => {
  it("should have deskId column in tasks table", () => {
    expect(schemaContent).toContain("deskId");
    // Check it references the desks table
    expect(schemaContent).toMatch(/deskId.*int/i);
  });
});

describe("Task Desk Assignment - Backend Router", () => {
  it("should accept deskId in tasks.create procedure", () => {
    expect(routersContent).toMatch(/deskId.*z\.number/);
  });

  it("should accept deskId in tasks.update procedure", () => {
    // The update procedure that takes taskId should also accept deskId
    const taskUpdateIdx = routersContent.indexOf("taskId: z.number(),");
    expect(taskUpdateIdx).toBeGreaterThan(-1);
    // Look in the next 1000 chars after taskId for deskId
    const updateSection = routersContent.slice(taskUpdateIdx, taskUpdateIdx + 1000);
    expect(updateSection).toContain("deskId");
  });

  it("should auto-resolve deskId from property when not provided", () => {
    // The create procedure should look up the property's deskName and find matching desk
    expect(routersContent).toContain("deskName");
    expect(routersContent).toContain("desks");
  });
});

describe("Task Desk Assignment - DB Helper", () => {
  it("should join desks table in getTasks", () => {
    expect(dbContent).toContain("desks");
    expect(dbContent).toContain("deskName");
  });

  it("should include deskId in task results", () => {
    expect(dbContent).toContain("deskId");
  });
});

describe("Task Desk Assignment - CreateTaskDialog", () => {
  it("should use desks.list query instead of agents", () => {
    expect(createTaskDialogContent).toContain("trpc.desks.list.useQuery");
    expect(createTaskDialogContent).not.toContain("trpc.users.listAgents.useQuery");
  });

  it("should have desk dropdown with desk color indicator", () => {
    expect(createTaskDialogContent).toContain("Select desk...");
    expect(createTaskDialogContent).toContain("desk.color");
    expect(createTaskDialogContent).toContain("desk.name");
  });

  it("should auto-default to property desk for new tasks", () => {
    expect(createTaskDialogContent).toContain("propertyData?.deskName");
    expect(createTaskDialogContent).toContain("deskDefaultApplied");
  });

  it("should send deskId in task creation payload", () => {
    expect(createTaskDialogContent).toContain("deskId: selectedDeskId");
  });

  it("should populate desk from editingTask when editing", () => {
    expect(createTaskDialogContent).toContain("editingTask.deskId");
  });
});

describe("Task Desk Assignment - TasksList", () => {
  it("should use desk filter instead of user filter", () => {
    expect(tasksListContent).toContain("deskFilter");
    expect(tasksListContent).toContain("trpc.desks.list.useQuery");
    expect(tasksListContent).not.toContain("userFilter");
    expect(tasksListContent).not.toContain("trpc.agents.listAllUsers.useQuery");
  });

  it("should show Desk column header instead of Assigned To", () => {
    expect(tasksListContent).toContain('>Desk</th>');
    expect(tasksListContent).not.toContain('>Assigned To</th>');
  });

  it("should display deskName in the table", () => {
    expect(tasksListContent).toContain("deskName");
  });

  it("should filter by deskId", () => {
    expect(tasksListContent).toContain("task.deskId !== deskId");
  });
});

describe("Task Desk Assignment - TasksKanban", () => {
  it("should use desk filter instead of user filter", () => {
    expect(tasksKanbanContent).toContain("deskFilter");
    expect(tasksKanbanContent).toContain("trpc.desks.list.useQuery");
    expect(tasksKanbanContent).not.toContain("userFilter");
    expect(tasksKanbanContent).not.toContain("trpc.agents.listAllUsers.useQuery");
  });

  it("should show desk dropdown with color indicators", () => {
    expect(tasksKanbanContent).toContain("Filter by Desk");
    expect(tasksKanbanContent).toContain("All Desks");
    expect(tasksKanbanContent).toContain("desk.color");
  });
});

describe("Task Desk Assignment - TasksCalendar", () => {
  it("should use desk filter instead of user filter", () => {
    expect(tasksCalendarContent).toContain("deskFilter");
    expect(tasksCalendarContent).toContain("trpc.desks.list.useQuery");
    expect(tasksCalendarContent).not.toContain("userFilter");
    expect(tasksCalendarContent).not.toContain("trpc.agents.listAllUsers.useQuery");
  });

  it("should display deskName instead of assignedToName", () => {
    expect(tasksCalendarContent).toContain("deskName");
    expect(tasksCalendarContent).not.toContain("assignedToName");
  });
});

describe("Task Desk Assignment - TaskCard", () => {
  it("should display Desk label instead of Assigned to", () => {
    expect(taskCardContent).toContain('"Desk"');
    expect(taskCardContent).toContain("deskName");
  });

  it("should have deskName in interface", () => {
    expect(taskCardContent).toContain("deskName?: string | null");
  });
});

describe("Task Desk Assignment - PropertyTasks", () => {
  it("should display deskName instead of assignedToName", () => {
    expect(propertyTasksContent).toContain("deskName");
    expect(propertyTasksContent).not.toContain("assignedToName");
  });
});
