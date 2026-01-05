import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, CheckCircle2, Circle, Clock, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { Link } from "wouter";

interface PropertyTasksProps {
  propertyId: number;
}

export function PropertyTasks({ propertyId }: PropertyTasksProps) {
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
      case "High":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "Low":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getPriorityBgColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-50 border-red-200";
      case "Medium":
        return "bg-yellow-50 border-yellow-200";
      case "Low":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Done":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "In Progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
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
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tasks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>Tasks ({tasks?.length || 0})</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
              >
                {showHidden ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showHidden ? "Hide Hidden" : "Show Hidden"}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No tasks yet. Create your first task for this property.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.filter(t => showHidden || t.hidden !== 1).map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg hover:opacity-90 transition-all ${getPriorityBgColor(task.priority)}`}
                >
                  <button
                    onClick={() => toggleTaskStatus(task.id, task.status)}
                    className="mt-0.5 hover:scale-110 transition-transform"
                  >
                    {getStatusIcon(task.status)}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <Link href={`/tasks/kanban`}>
                        <h4 className="font-medium text-sm hover:text-primary cursor-pointer">
                          {task.title}
                        </h4>
                      </Link>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getPriorityColor(task.priority)}`}
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {task.taskType}
                        </Badge>
                      </span>
                      
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      
                      {task.assignedToName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        task.status === "Done"
                          ? "default"
                          : task.status === "In Progress"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs whitespace-nowrap"
                    >
                      {task.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleHidden.mutate({ taskId: task.id, hidden: task.hidden === 1 ? 0 : 1 })}
                      title={task.hidden === 1 ? "Show task" : "Hide task"}
                    >
                      {task.hidden === 1 ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingTask(task);
                        setCreateDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Delete this task?')) {
                          deleteTask.mutate({ taskId: task.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
