import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, Phone, Mail, Home, Search, FileText, MessageSquare, Handshake, FileCheck, ClipboardCheck, MoreHorizontal, Send, Image, UserSearch, UserPlus, Repeat, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from "date-fns";
import { Link } from "wouter";

interface Task {
  id: number;
  title?: string | null;
  description?: string | null;
  taskType: string;
  priority: string;
  status: string;
  dueDate?: Date | null;
  dueTime?: string | null;
  repeatTask?: string | null;
  assignedToName?: string | null;
  propertyId?: number | null;
  propertyAddress?: string | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  completedDate?: Date | null;
}

interface TaskCardProps {
  task: Task;
}

const taskTypeIcons: Record<string, any> = {
  Call: Phone,
  Text: MessageSquare,
  Email: Mail,
  Meeting: Handshake,
  "Site Visit": Home,
  "Follow Up": MessageSquare,
  Offer: Handshake,
  Contract: FileCheck,
  Closing: FileCheck,
  "Sent Letter": Send,
  "Sent Post Card": Image,
  Skiptrace: UserSearch,
  "Take Over Lead": UserPlus,
  "Drip Campaign": Repeat,
  Visit: Home,
  Research: Search,
  "Follow-up": MessageSquare,
  Negotiation: Handshake,
  Inspection: ClipboardCheck,
  Other: FileText,
};

const priorityColors: Record<string, string> = {
  High: "bg-red-500",
  Medium: "bg-yellow-500",
  Low: "bg-green-500",
};

export function TaskCard({ task }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const isDone = task.status === "Done";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isDone ? 0.65 : 1,
  };

  const Icon = taskTypeIcons[task.taskType] || FileText;

  // Calculate due date status
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj) && !isDone;
  const isDueToday = dueDateObj && isToday(dueDateObj) && !isDone;
  const isDueTomorrow = dueDateObj && isTomorrow(dueDateObj) && !isDone;

  // Format the due date label
  const formatDueDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg p-4 cursor-grab active:cursor-grabbing transition-all ${
        isDone
          ? "bg-emerald-50/50 border-2 border-emerald-200 hover:border-emerald-300"
          : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Priority Indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
          )}
          <Icon className={`w-4 h-4 ${isDone ? "text-emerald-300" : "text-gray-400"}`} />
        </div>
        <div className="flex items-center gap-1.5">
          {isDone && (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-600 border-emerald-200">
              Done
            </Badge>
          )}
          <Badge variant="outline" className={`text-xs ${isDone ? "border-emerald-200 text-emerald-400" : "border-gray-300 text-gray-600"}`}>
            {task.taskType}
          </Badge>
        </div>
      </div>

      {/* Due Date Badge — shown prominently below the header */}
      {dueDateObj && !isDone && (
        <div className="mb-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isOverdue
                ? "bg-red-100 text-red-700 border border-red-300"
                : isDueToday
                ? "bg-amber-100 text-amber-700 border border-amber-300"
                : isDueTomorrow
                ? "bg-orange-50 text-orange-600 border border-orange-200"
                : "bg-gray-100 text-gray-600 border border-gray-200"
            }`}
          >
            {isOverdue ? (
              <AlertCircle className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {isOverdue ? `Overdue · ${formatDueDate(dueDateObj)}` : formatDueDate(dueDateObj)}
          </span>
        </div>
      )}

      {/* Task Title */}
      <h3 className={`font-semibold mb-2 line-clamp-2 ${
        isDone
          ? "text-gray-400 line-through decoration-emerald-400 decoration-2"
          : "text-gray-900"
      }`}>
        {task.title || task.taskType}
      </h3>

      {/* Task Description */}
      {task.description && (
        <p className={`text-sm mb-3 line-clamp-2 ${isDone ? "text-gray-300 line-through" : "text-gray-500"}`}>
          {task.description}
        </p>
      )}

      {/* Property Info */}
      {task.propertyAddress && task.propertyId && (
        <Link href={`/properties/${task.propertyId}`}>
          <div className={`flex items-center gap-2 text-xs mb-3 cursor-pointer transition-colors ${
            isDone ? "text-emerald-300" : "text-blue-600 hover:text-blue-700"
          }`}>
            <MapPin className="w-3 h-3" />
            <span className="truncate">
              {task.propertyAddress}, {task.propertyCity}
            </span>
          </div>
        </Link>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Due Date — footer shows relative time */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span
              className={
                isDone
                  ? "text-emerald-400"
                  : isOverdue
                  ? "text-red-500"
                  : isDueToday
                  ? "text-amber-600"
                  : "text-gray-400"
              }
            >
              {isDone
                ? "Completed"
                : formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Completed Date for done tasks */}
        {isDone && task.completedDate && !task.dueDate && (
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </div>
        )}

        {/* Assigned To */}
        {task.assignedToName && (
          <div className={`flex items-center gap-1 text-xs ${isDone ? "text-gray-300" : "text-gray-500"}`}>
            <User className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{task.assignedToName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
