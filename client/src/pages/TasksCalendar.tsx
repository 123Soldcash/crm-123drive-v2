import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight } from "lucide-react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function TasksCalendar() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: tasks = [], refetch } = trpc.tasks.list.useQuery();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get first day of the week for the month (0 = Sunday)
  const firstDayOfWeek = monthStart.getDay();

  // Add empty cells for days before the month starts
  const calendarDays = [
    ...Array(firstDayOfWeek).fill(null),
    ...daysInMonth,
  ];

  const getTasksForDate = (date: Date | null) => {
    if (!date) return [];
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      return isSameDay(new Date(task.dueDate), date);
    });
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  const getOverdueTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      if (!task.dueDate || task.status === "Done") return false;
      return new Date(task.dueDate) < today;
    });
  };

  const overdueTasks = getOverdueTasks();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
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
                  <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
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
                  <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <CalendarIcon className="w-4 h-4 mr-2" />
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

      {/* Overdue Tasks Banner */}
      {overdueTasks.length > 0 && (
        <div className="border-b border-red-200 bg-red-50">
          <div className="container mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-red-800 font-semibold">
                ⚠️ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
              </span>
              <Link href="/tasks/list">
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                  View Overdue Tasks
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Calendar Header */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="border-gray-300 hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                    className="border-gray-300 hover:bg-gray-100"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="border-gray-300 hover:bg-gray-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 border-b border-gray-200">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-sm font-semibold text-gray-500 bg-gray-50/50">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="border-r border-b border-gray-100 h-24 bg-gray-50/30" />;
                  }

                  const dayTasks = getTasksForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isCurrentDay = isToday(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`border-r border-b border-gray-100 h-24 p-2 cursor-pointer transition-colors ${
                        !isCurrentMonth ? "bg-gray-50/50" : ""
                      } ${isSelected ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
                    >
                      <div
                        className={`text-sm font-semibold mb-1 ${
                          isCurrentDay
                            ? "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                            : isCurrentMonth
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        {format(day, "d")}
                      </div>

                      {/* Task Dots */}
                      <div className="flex flex-wrap gap-1">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}
                            title={task.title || task.description || "Task"}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-gray-400">+{dayTasks.length - 3}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Date Tasks */}
          <div className="col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-900">
                  {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
                </h3>
              </div>

              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {selectedDateTasks.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    {selectedDate ? "No tasks for this date" : "Click a date to view tasks"}
                  </p>
                ) : (
                  selectedDateTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${getPriorityColor(task.priority)}`} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                          {task.taskType}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                          {task.status}
                        </Badge>
                        {task.assignedToName && (
                          <span className="text-xs text-gray-500">{task.assignedToName}</span>
                        )}
                      </div>

                      {task.propertyAddress && (
                        <div className="text-xs text-gray-500 mt-2">
                          📍 {task.propertyAddress}, {task.propertyCity}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Tasks:</span>
                  <span className="text-gray-900 font-semibold">{tasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Overdue:</span>
                  <span className="text-red-600 font-semibold">{overdueTasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">In Progress:</span>
                  <span className="text-blue-600 font-semibold">
                    {tasks.filter((t) => t.status === "In Progress").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed:</span>
                  <span className="text-green-600 font-semibold">
                    {tasks.filter((t) => t.status === "Done").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
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
