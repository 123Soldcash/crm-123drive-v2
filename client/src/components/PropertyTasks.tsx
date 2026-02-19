import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, CheckCircle2, Circle, Clock, Edit, Trash2, Eye, EyeOff, ClipboardList } from "lucide-react";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { Link } from "wouter";
import { CollapsibleSection } from "./CollapsibleSection";

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-50 text-red-600 border-red-100";
      case "Medium": return "bg-amber-50 text-amber-600 border-amber-100";
      case "Low": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Done": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "In Progress": return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Circle className="h-4 w-4 text-slate-300" />;
    }
  };

  const toggleTaskStatus = (taskId: number, currentStatus: string) => {
    const newStatus = currentStatus === "Done" ? "To Do" : currentStatus === "In Progress" ? "Done" : "In Progress";
    updateTask.mutate({
      taskId,
      status: newStatus,
      ...(newStatus === "Done" && { completedDate: new Date().toISOString() }),
    });
  };

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading tasks...</div>;
  }

  const filteredTasks = tasks?.filter(t => showHidden || t.hidden !== 1) || [];

  return (
    <>
      <CollapsibleSection
        title="Tasks"
        icon={ClipboardList}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        accentColor="pink"
        badge={filteredTasks.length > 0 ? (
          <Badge variant="secondary" className="bg-pink-100 text-pink-700 border-pink-200 ml-1">
            {filteredTasks.length}
          </Badge>
        ) : null}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[11px] text-slate-500 hover:text-slate-900"
              onClick={() => setShowHidden(!showHidden)}
            >
              {showHidden ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
              {showHidden ? "Hide" : "Show Hidden"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-pink-200 text-pink-700 hover:bg-pink-50"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Task
            </Button>
          </div>
        }
      >
        {filteredTasks.length === 0 ? (
          <div className="py-6 text-center">
            <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No tasks yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors"
              >
                <button
                  onClick={() => toggleTaskStatus(task.id, task.status)}
                  className="mt-0.5 hover:scale-110 transition-transform"
                >
                  {getStatusIcon(task.status)}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Link href={`/tasks/kanban`}>
                      <h4 className="font-medium text-sm text-slate-900 hover:text-blue-600 cursor-pointer truncate">
                        {task.title}
                      </h4>
                    </Link>
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </div>
                  
                  {task.description && (
                    <p className="text-[11px] text-slate-500 mb-2 line-clamp-1">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-slate-100 text-slate-500 border-none">
                        {task.taskType}
                      </Badge>
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.assignedToName && (
                      <span className="flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {task.assignedToName}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600" onClick={() => { setEditingTask(task); setCreateDialogOpen(true); }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-rose-600" onClick={() => { if (confirm('Delete this task?')) deleteTask.mutate({ taskId: task.id }); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
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
      />
    </>
  );
}
