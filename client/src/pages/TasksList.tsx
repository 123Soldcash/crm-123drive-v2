import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Calendar, List, Search, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export function TasksList() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  const { data: tasks = [], refetch } = trpc.tasks.list.useQuery();
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedTasks(new Set());
    },
  });

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.propertyAddress?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "all" && task.status !== statusFilter) return false;

    // Priority filter
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;

    // Type filter
    if (typeFilter !== "all" && task.taskType !== typeFilter) return false;

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      if (dateFilter === "overdue") {
        if (!task.dueDate || new Date(task.dueDate) >= todayStart || task.status === "Done") return false;
      } else if (dateFilter === "today") {
        if (!task.dueDate || new Date(task.dueDate) < todayStart || new Date(task.dueDate) > todayEnd) return false;
      } else if (dateFilter === "upcoming") {
        const weekFromNow = new Date(now);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        if (!task.dueDate || new Date(task.dueDate) <= todayEnd || new Date(task.dueDate) > weekFromNow) return false;
      }
    }

    return true;
  });

  const handleToggleTask = (taskId: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedTasks.size} selected tasks?`)) {
      selectedTasks.forEach((taskId) => {
        deleteTask.mutate({ taskId });
      });
    }
  };

  const handleBulkStatusChange = (newStatus: "To Do" | "In Progress" | "Done") => {
    selectedTasks.forEach((taskId) => {
      updateTask.mutate({
        taskId,
        status: newStatus,
        completedDate: newStatus === "Done" ? new Date().toISOString() : undefined,
      });
    });
    setSelectedTasks(new Set());
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-green-500";
      default:
        return "bg-slate-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Done":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "In Progress":
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Circle className="w-4 h-4 text-slate-500" />;
    }
  };

  const isOverdue = (task: any) => {
    return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done";
  };

  const isDueToday = (task: any) => {
    return task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Task Management</h1>
              <div className="flex gap-2">
                <Link href="/tasks/kanban">
                  <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700">
                    <Filter className="w-4 h-4 mr-2" />
                    Kanban
                  </Button>
                </Link>
                <Link href="/tasks/list">
                  <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <List className="w-4 h-4 mr-2" />
                    List
                  </Button>
                </Link>
                <Link href="/tasks/calendar">
                  <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700">
                    <Calendar className="w-4 h-4 mr-2" />
                    Calendar
                  </Button>
                </Link>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-slate-700 bg-slate-800/50">
        <div className="container mx-auto px-6 py-4">
          <div className="grid grid-cols-6 gap-4">
            {/* Search */}
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all" className="text-white hover:bg-slate-600">
                  All Status
                </SelectItem>
                <SelectItem value="To Do" className="text-white hover:bg-slate-600">
                  To Do
                </SelectItem>
                <SelectItem value="In Progress" className="text-white hover:bg-slate-600">
                  In Progress
                </SelectItem>
                <SelectItem value="Done" className="text-white hover:bg-slate-600">
                  Done
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all" className="text-white hover:bg-slate-600">
                  All Priority
                </SelectItem>
                <SelectItem value="High" className="text-white hover:bg-slate-600">
                  High
                </SelectItem>
                <SelectItem value="Medium" className="text-white hover:bg-slate-600">
                  Medium
                </SelectItem>
                <SelectItem value="Low" className="text-white hover:bg-slate-600">
                  Low
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all" className="text-white hover:bg-slate-600">
                  All Types
                </SelectItem>
                <SelectItem value="Call" className="text-white hover:bg-slate-600">
                  Call
                </SelectItem>
                <SelectItem value="Email" className="text-white hover:bg-slate-600">
                  Email
                </SelectItem>
                <SelectItem value="Visit" className="text-white hover:bg-slate-600">
                  Visit
                </SelectItem>
                <SelectItem value="Research" className="text-white hover:bg-slate-600">
                  Research
                </SelectItem>
                <SelectItem value="Follow-up" className="text-white hover:bg-slate-600">
                  Follow-up
                </SelectItem>
                <SelectItem value="Offer" className="text-white hover:bg-slate-600">
                  Offer
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Due Date" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all" className="text-white hover:bg-slate-600">
                  All Dates
                </SelectItem>
                <SelectItem value="overdue" className="text-white hover:bg-slate-600">
                  Overdue
                </SelectItem>
                <SelectItem value="today" className="text-white hover:bg-slate-600">
                  Due Today
                </SelectItem>
                <SelectItem value="upcoming" className="text-white hover:bg-slate-600">
                  Upcoming (7 days)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTasks.size > 0 && (
        <div className="border-b border-slate-700 bg-blue-900/50">
          <div className="container mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">{selectedTasks.size} tasks selected</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange("To Do")}
                  className="border-slate-600 hover:bg-slate-700"
                >
                  Mark as To Do
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange("In Progress")}
                  className="border-slate-600 hover:bg-slate-700"
                >
                  Mark as In Progress
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange("Done")}
                  className="border-slate-600 hover:bg-slate-700"
                >
                  Mark as Done
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task List Table */}
      <div className="container mx-auto px-6 py-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <Checkbox
                    checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left w-12"></th>
                <th className="px-4 py-3 text-left font-semibold text-white">Task</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Priority</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Assigned To</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Due Date</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Property</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-b border-slate-700 hover:bg-slate-700/50 transition-colors ${
                    isOverdue(task) ? "bg-red-900/20" : isDueToday(task) ? "bg-yellow-900/20" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedTasks.has(task.id)}
                      onCheckedChange={() => handleToggleTask(task.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-slate-400 line-clamp-1">{task.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {task.taskType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{task.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <span className="text-slate-300">{task.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{task.assignedToName || "Unassigned"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span
                        className={
                          isOverdue(task)
                            ? "text-red-400 font-semibold"
                            : isDueToday(task)
                            ? "text-yellow-400 font-semibold"
                            : "text-slate-300"
                        }
                      >
                        {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-slate-500">No due date</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.propertyAddress ? (
                      <span className="text-slate-300 text-sm">
                        {task.propertyAddress}, {task.propertyCity}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No tasks found</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-slate-400">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
      </div>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
