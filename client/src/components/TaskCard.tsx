import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, Phone, Mail, Home, Search, FileText, MessageSquare, Handshake, FileCheck, ClipboardCheck, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
}

interface TaskCardProps {
  task: Task;
}

const taskTypeIcons: Record<string, any> = {
  Call: Phone,
  Email: Mail,
  Visit: Home,
  Research: Search,
  "Follow-up": MessageSquare,
  Offer: Handshake,
  Negotiation: Handshake,
  Contract: FileCheck,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = taskTypeIcons[task.taskType] || FileText;

  // Calculate if task is overdue
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done";
  const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-gray-200 rounded-lg p-4 cursor-grab active:cursor-grabbing hover:border-gray-300 hover:shadow-sm transition-all"
    >
      {/* Priority Indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
          {task.taskType}
        </Badge>
      </div>

      {/* Task Title */}
      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{task.title}</h3>

      {/* Task Description */}
      {task.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Property Info */}
      {task.propertyAddress && task.propertyId && (
        <Link href={`/properties/${task.propertyId}`}>
          <div className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 mb-3 cursor-pointer transition-colors">
            <MapPin className="w-3 h-3" />
            <span className="truncate">
              {task.propertyAddress}, {task.propertyCity}
            </span>
          </div>
        </Link>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Due Date */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3" />
            <span
              className={
                isOverdue
                  ? "text-red-600 font-semibold"
                  : isDueToday
                  ? "text-yellow-600 font-semibold"
                  : "text-gray-500"
              }
            >
              {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Assigned To */}
        {task.assignedToName && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <User className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{task.assignedToName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
