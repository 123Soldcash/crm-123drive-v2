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
import { Plus, Filter, Calendar, List, Search, Trash2, CheckCircle2, Circle, Clock, RotateCcw } from "lucide-react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function TasksList() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [userFilter, setUserFilter] = useState<string>("all");

  const { data: tasks = [], refetch } = trpc.tasks.list.useQuery();
  const { data: allUsers = [] } = trpc.agents.listAllUsers.useQuery();
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
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.propertyAddress?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (typeFilter !== "all" && task.taskType !== typeFilter) return false;
    if (userFilter !== "all") {
      const userId = parseInt(userFilter);
      if (task.assignedToId !== userId && task.createdById !== userId) return false;
    }
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

  // Sort: pending first, completed at bottom
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === "Done" && b.status !== "Done") return 1;
    if (a.status !== "Done" && b.status === "Done") return -1;
    return 0;
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
    toast.success(`${selectedTasks.size} tasks marked as ${newStatus}`);
  };

  const handleToggleComplete = (taskId: number, currentStatus: string) => {
    if (currentStatus === "Done") {
      updateTask.mutate({ taskId, status: "To Do", completedDate: "" });
      toast.info("Task reopened");
    } else {
      updateTask.mutate({ taskId, status: "Done", completedDate: new Date().toISOString() });
      toast.success("Task completed!");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-500";
      case "Medium": return "bg-yellow-500";
      case "Low": return "bg-green-500";
      default: return "bg-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Done": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "In Progress": return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <Circle className="w-5 h-5 text-gray-300 hover:text-green-400 transition-colors" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Done":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-medium text-xs">Done</Badge>;
      case "In Progress":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-medium text-xs">In Progress</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium text-xs">To Do</Badge>;
    }
  };

  const isOverdue = (task: any) => {
    return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done";
  };

  const isDueToday = (task: any) => {
    return task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();
  };

  const pendingCount = filteredTasks.filter(t => t.status !== "Done").length;
  const doneCount = filteredTasks.filter(t => t.status === "Done").length;

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
                  <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
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
                  <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
                    <Calendar className="w-4 h-4 mr-2" />
                    Calendar
                  </Button>
                </Link>
              </div>
              {/* Summary badges */}
              <div className="flex items-center gap-2 ml-2">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                  {pendingCount} pending
                </Badge>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-600">
                  {doneCount} done
                </Badge>
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
      <div className="border-b border-gray-200 bg-white/80">
        <div className="container mx-auto px-6 py-4">
          <div className="grid grid-cols-7 gap-4">
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="To Do">To Do</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 max-h-[300px]">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="Text">Text</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Site Visit">Site Visit</SelectItem>
                <SelectItem value="Follow Up">Follow Up</SelectItem>
                <SelectItem value="Offer">Offer</SelectItem>
                <SelectItem value="Contract">Contract</SelectItem>
                <SelectItem value="Closing">Closing</SelectItem>
                <SelectItem value="Sent Letter">Sent Letter</SelectItem>
                <SelectItem value="Sent Post Card">Sent Post Card</SelectItem>
                <SelectItem value="Skiptrace">Skiptrace</SelectItem>
                <SelectItem value="Take Over Lead">Take Over Lead</SelectItem>
                <SelectItem value="Drip Campaign">Drip Campaign</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 max-h-[300px]">
                <SelectItem value="all">All Users</SelectItem>
                {(allUsers as any[]).map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Due Date" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Due Today</SelectItem>
                <SelectItem value="upcoming">Upcoming (7 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTasks.size > 0 && (
        <div className="border-b border-blue-200 bg-blue-50">
          <div className="container mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 font-semibold">{selectedTasks.size} tasks selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange("To Do")} className="border-gray-300 hover:bg-gray-50">
                  Mark as To Do
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange("In Progress")} className="border-gray-300 hover:bg-gray-50">
                  Mark as In Progress
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange("Done")} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Done
                </Button>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <Checkbox
                    checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left w-12">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Task</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Priority</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Assigned To</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Property</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task, index) => {
                const isDone = task.status === "Done";
                const isFirstDone = isDone && index > 0 && sortedTasks[index - 1]?.status !== "Done";
                
                return (
                  <>
                    {/* Separator row before completed tasks */}
                    {isFirstDone && (
                      <tr key={`sep-${task.id}`}>
                        <td colSpan={9} className="px-4 py-2 bg-emerald-50/50">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-emerald-200" />
                            <span className="text-[11px] text-emerald-500 font-medium uppercase tracking-wider">
                              Completed Tasks ({doneCount})
                            </span>
                            <div className="flex-1 h-px bg-emerald-200" />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      key={task.id}
                      className={`border-b border-gray-100 transition-colors ${
                        isDone
                          ? "bg-emerald-50/30 hover:bg-emerald-50/50"
                          : isOverdue(task)
                          ? "bg-red-50 hover:bg-red-50/80"
                          : isDueToday(task)
                          ? "bg-yellow-50 hover:bg-yellow-50/80"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => handleToggleTask(task.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleComplete(task.id, task.status)}
                          className="hover:scale-110 transition-transform"
                          title={isDone ? "Mark as pending" : "Mark as completed"}
                        >
                          {getStatusIcon(task.status)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className={`font-medium ${isDone ? "text-gray-400 line-through decoration-emerald-400 decoration-2" : "text-gray-900"}`}>
                            {task.title || task.taskType}
                          </div>
                          {task.description && (
                            <div className={`text-sm line-clamp-1 ${isDone ? "text-gray-300 line-through" : "text-gray-500"}`}>
                              {task.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`border-gray-300 ${isDone ? "text-gray-300 border-gray-200" : "text-gray-600"}`}>
                          {task.taskType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${isDone ? "bg-gray-300" : getPriorityColor(task.priority)}`} />
                          <span className={isDone ? "text-gray-300" : "text-gray-700"}>{task.priority}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(task.status)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={isDone ? "text-gray-300" : "text-gray-700"}>{task.assignedToName || "Unassigned"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isDone
                                ? "bg-gray-100 text-gray-400"
                                : isOverdue(task)
                                ? "bg-red-100 text-red-700 border border-red-300"
                                : isDueToday(task)
                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {format(new Date(task.dueDate), "MMM d, yyyy")}
                            {!isDone && isOverdue(task) && " · Overdue"}
                            {!isDone && isDueToday(task) && " · Today"}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No due date</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.propertyId && task.propertyAddress ? (
                          <Link href={`/properties/${task.propertyId}`} className={`hover:underline text-sm font-medium ${isDone ? "text-gray-300" : "text-blue-600 hover:text-blue-800"}`}>
                            {task.propertyAddress}{task.propertyCity ? `, ${task.propertyCity}` : ''}
                          </Link>
                        ) : task.propertyId ? (
                          <Link href={`/properties/${task.propertyId}`} className={`hover:underline text-sm ${isDone ? "text-gray-300" : "text-blue-600 hover:text-blue-800"}`}>
                            Property #{task.propertyId}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No tasks found</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredTasks.length} of {tasks.length} tasks
          {doneCount > 0 && <span className="text-emerald-500 ml-2">({doneCount} completed)</span>}
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
