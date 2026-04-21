import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "@/components/TaskCard";
import { DroppableColumn } from "@/components/DroppableColumn";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Calendar, List } from "lucide-react";
import { parseDueDate, todayLocal } from "@/lib/dateUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Link } from "wouter";

export function TasksKanban() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<"To Do" | "In Progress" | "Done">("To Do");
  const [deskFilter, setDeskFilter] = useState<string>("all");

  const { data: allTasks = [], refetch } = trpc.tasks.list.useQuery();
  const { data: desksList = [] } = trpc.desks.list.useQuery();

  // Filter tasks by desk
  const tasks = allTasks.filter((task) => {
    if (deskFilter === "all") return true;
    const deskId = parseInt(deskFilter);
    return (task as any).deskId === deskId;
  });
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => refetch(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Sort by urgency: overdue first, then today, then by due date asc, then no due date last
  const sortByUrgency = (taskList: typeof tasks) => {
    const today = todayLocal();
    return [...taskList].sort((a, b) => {
      const getScore = (t: typeof tasks[0]) => {
        const d = parseDueDate(t.dueDate);
        if (!d) return 3; // no due date → last
        if (d.getTime() === today.getTime()) return 1; // today → second
        if (d < today) return 0; // overdue → first
        return 2; // future → third
      };
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      // same urgency group → sort by date ascending
      const dA = parseDueDate(a.dueDate);
      const dB = parseDueDate(b.dueDate);
      if (dA && dB) return dA.getTime() - dB.getTime();
      return 0;
    });
  };

  const todoTasks = sortByUrgency(tasks.filter((t) => t.status === "To Do"));
  const inProgressTasks = sortByUrgency(tasks.filter((t) => t.status === "In Progress"));
  const doneTasks = tasks.filter((t) => t.status === "Done");

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const taskId = active.id as number;
    const newStatus = over.id as "To Do" | "In Progress" | "Done";

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      updateTask.mutate({
        taskId,
        status: newStatus,
        completedDate: newStatus === "Done" ? new Date().toISOString() : undefined,
      });
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeTask = tasks.find((t) => t.id === activeId);

  const handleAddTask = (status: "To Do" | "In Progress" | "Done") => {
    setDefaultStatus(status);
    setCreateDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
              <div className="flex gap-2">
                <Link href="/tasks/kanban">
                  <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Filter className="w-4 h-4 mr-2" />
                    Kanban
                  </Button>
                </Link>
                <Link href="/tasks/list">
                  <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
                    <List className="w-4 h-4 mr-2" />
                    List
                  </Button>
                </Link>
                <Link href="/tasks/calendar">
                  <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
                    <Calendar className="w-4 h-4 mr-2" />
                    Calendar
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={deskFilter} onValueChange={setDeskFilter}>
                <SelectTrigger className="w-[180px] bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Filter by Desk" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 max-h-[300px]">
                  <SelectItem value="all">All Desks</SelectItem>
                  {(desksList as any[]).map((desk: any) => (
                    <SelectItem key={desk.id} value={String(desk.id)}>
                      <div className="flex items-center gap-2">
                        {desk.color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: desk.color }} />}
                        {desk.description || desk.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleAddTask("To Do")}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="container mx-auto px-6 py-6">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-3 gap-6">
            {/* To Do Column */}
            <DroppableColumn
              id="To Do"
              title="To Do"
              count={todoTasks.length}
              color="slate"
              onAddTask={() => handleAddTask("To Do")}
            >
              <SortableContext items={todoTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {todoTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>

            {/* In Progress Column */}
            <DroppableColumn
              id="In Progress"
              title="In Progress"
              count={inProgressTasks.length}
              color="blue"
              onAddTask={() => handleAddTask("In Progress")}
            >
              <SortableContext items={inProgressTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {inProgressTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>

            {/* Done Column */}
            <DroppableColumn
              id="Done"
              title="Done"
              count={doneTasks.length}
              color="green"
              onAddTask={() => handleAddTask("Done")}
            >
              <SortableContext items={doneTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {doneTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rotate-3 opacity-80">
                <TaskCard task={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultStatus={defaultStatus}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
