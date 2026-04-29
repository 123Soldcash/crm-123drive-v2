import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, CheckCircle2, Circle, Clock, Edit, Trash2, Eye, EyeOff, ClipboardList, RotateCcw, BellOff, RefreshCw } from "lucide-react";
import { getDueDateBadgeConfig } from "@/lib/dateUtils";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { Link } from "wouter";
import { CollapsibleSection } from "./CollapsibleSection";
import { toast } from "sonner";

interface PropertyTasksProps {
  propertyId: number;
}

export function PropertyTasks({ propertyId }: PropertyTasksProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: tasks, isLoading } = trpc.tasks.byProperty.useQuery({ propertyId });
  const utils = trpc.useUtils();

  const [editingTask, setEditingTask] = useState<any>(null);
  const [showHidden, setShowHidden] = useState(false);

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.byProperty.invalidate({ propertyId });
      utils.tasks.list.invalidate();
    },
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.byProperty.invalidate({ propertyId });
      utils.tasks.list.invalidate();
    },
  });

  const toggleHidden = trpc.tasks.toggleHidden.useMutation({
    onSuccess: () => {
      utils.tasks.byProperty.invalidate({ propertyId });
      utils.tasks.list.invalidate();
    },
  });

  const cancelRepeat = trpc.tasks.cancelRepeat.useMutation({
    onSuccess: () => {
      utils.tasks.byProperty.invalidate({ propertyId });
      utils.tasks.list.invalidate();
      toast.success("Repeat cancelled — task will no longer recur");
    },
    onError: () => toast.error("Failed to cancel repeat"),
  });

  const getRepeatLabel = (repeatTask: string | null) => {
    if (!repeatTask || repeatTask === "No repeat") return null;
    const labels: Record<string, string> = {
      Daily: "Daily",
      Weekly: "Weekly",
      Monthly: "Monthly",
      "3 Months": "Every 3mo",
      "6 Months": "Every 6mo",
    };
    return labels[repeatTask] || repeatTask;
  };

  const getPriorityColor = (priority: string, isDone: boolean) => {
    if (isDone) return "bg-emerald-50 text-emerald-500 border-emerald-100 opacity-60";
    switch (priority) {
      case "High": return "bg-red-50 text-red-600 border-red-100";
      case "Medium": return "bg-amber-50 text-amber-600 border-amber-100";
      case "Low": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Done": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "In Progress": return <Clock className="h-5 w-5 text-blue-500" />;
      default: return <Circle className="h-5 w-5 text-slate-300 hover:text-emerald-400 transition-colors" />;
    }
  };

  const handleToggleComplete = (taskId: number, currentStatus: string) => {
    if (currentStatus === "Done") {
      // Undo completion — go back to "To Do"
      updateTask.mutate({ taskId, status: "To Do", completedDate: "" });
      toast.info("Task reopened");
    } else {
      // Mark as done
      updateTask.mutate({ taskId, status: "Done", completedDate: new Date().toISOString() });
      toast.success("Task completed!");
    }
  };

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading tasks...</div>;
  }

  const filteredTasks = tasks?.filter(t => showHidden || t.hidden !== 1) || [];
  
  // Sort: pending tasks first, completed at the bottom
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === "Done" && b.status !== "Done") return 1;
    if (a.status !== "Done" && b.status === "Done") return -1;
    return 0;
  });

  const pendingCount = filteredTasks.filter(t => t.status !== "Done").length;
  const doneCount = filteredTasks.filter(t => t.status === "Done").length;

  return (
    <>
      <CollapsibleSection
        title="Tasks"
        icon={ClipboardList}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        accentColor="pink"
        badge={filteredTasks.length > 0 ? (
          <div className="flex items-center gap-1 ml-1">
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-pink-100 text-pink-700 border-pink-200">
                {pendingCount}
              </Badge>
            )}
            {doneCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {doneCount} done
              </Badge>
            )}
          </div>
        ) : null}
        action={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[11px] text-slate-500 hover:text-slate-900 min-w-0"
              onClick={() => setShowHidden(!showHidden)}
            >
              {showHidden ? <EyeOff className="h-3.5 w-3.5 sm:mr-1.5" /> : <Eye className="h-3.5 w-3.5 sm:mr-1.5" />}
              <span className="hidden sm:inline">{showHidden ? "Hide" : "Show Hidden"}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs border-pink-200 text-pink-700 hover:bg-pink-50 min-w-0"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">New Task</span>
            </Button>
          </div>
        }
      >
        {sortedTasks.length === 0 ? (
          <div className="py-6 text-center">
            <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No tasks yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Separator between pending and done tasks */}
            {sortedTasks.map((task, index) => {
              const isDone = task.status === "Done";
              const isFirstDone = isDone && index > 0 && sortedTasks[index - 1]?.status !== "Done";
              
              return (
                <div key={task.id}>
                  {/* Visual separator before completed tasks */}
                  {isFirstDone && (
                    <div className="flex items-center gap-2 py-2 px-1">
                      <div className="flex-1 h-px bg-emerald-200" />
                      <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Completed</span>
                      <div className="flex-1 h-px bg-emerald-200" />
                    </div>
                  )}
                  
                  <div
                    className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-all ${
                      isDone
                        ? "border-emerald-100 bg-emerald-50/30 opacity-70"
                        : "border-slate-100 bg-slate-50/30 hover:bg-slate-50"
                    }`}
                  >
                    {/* Clickable status toggle */}
                    <button
                      onClick={() => handleToggleComplete(task.id, task.status)}
                      className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                      title={isDone ? "Mark as pending" : "Mark as completed"}
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                        <Link href={`/tasks/kanban`}>
                          <h4 className={`font-medium text-sm cursor-pointer truncate transition-all ${
                            isDone
                              ? "text-slate-400 line-through decoration-emerald-400 decoration-2"
                              : "text-slate-900 hover:text-blue-600"
                          }`}>
                            {task.title || task.taskType}
                          </h4>
                        </Link>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 font-bold uppercase tracking-wider ${getPriorityColor(task.priority, isDone)}`}>
                          {task.priority}
                        </Badge>
                        {isDone && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-600 border-emerald-200 font-medium">
                            Done
                          </Badge>
                        )}
                        {task.status === "In Progress" && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-600 border-blue-200 font-medium">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className={`text-[11px] mb-2 line-clamp-1 ${isDone ? "text-slate-300 line-through" : "text-slate-500"}`}>
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Badge variant="secondary" className={`text-[9px] h-3.5 px-1 border-none ${isDone ? "bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-500"}`}>
                            {task.taskType}
                          </Badge>
                        </span>
                        {(() => {
                          const badge = getDueDateBadgeConfig(task.dueDate, isDone);
                          if (!badge) return null;
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4 px-1.5 font-semibold flex items-center gap-0.5 ${badge.className}`}
                            >
                              <Calendar className="h-2.5 w-2.5" />
                              {badge.label}
                            </Badge>
                          );
                        })()}
                        {(task as any).deskName && (
                          <span className={`flex items-center gap-1 ${isDone ? "text-slate-300" : ""}`}>
                            <User className="h-2.5 w-2.5" />
                            {(task as any).deskName}
                          </span>
                        )}
                        {isDone && task.completedDate && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Completed {new Date(task.completedDate).toLocaleDateString()}
                          </span>
                        )}
                        {getRepeatLabel((task as any).repeatTask) && (
                          <span className="flex items-center gap-1 text-violet-500">
                            <RefreshCw className="h-2.5 w-2.5" />
                            {getRepeatLabel((task as any).repeatTask)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-0.5">
                      {isDone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-emerald-400 hover:text-blue-600"
                          onClick={() => handleToggleComplete(task.id, task.status)}
                          title="Reopen task"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      {(task as any).repeatTask && (task as any).repeatTask !== "No repeat" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-violet-400 hover:text-rose-600"
                          title="Cancel repeat — stop this task from recurring"
                          onClick={() => {
                            if (confirm(`Cancel the "${(task as any).repeatTask}" repeat for this task? It will no longer recur automatically.`)) {
                              cancelRepeat.mutate({ taskId: task.id });
                            }
                          }}
                        >
                          <BellOff className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600" onClick={() => { setEditingTask(task); setCreateDialogOpen(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-rose-600" onClick={() => { if (confirm('Delete this task?')) deleteTask.mutate({ taskId: task.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        defaultPropertyId={propertyId}
        editingTask={editingTask}
        onSuccess={() => {
          utils.tasks.byProperty.invalidate({ propertyId });
          utils.tasks.list.invalidate();
        }}
      />
    </>
  );
}
