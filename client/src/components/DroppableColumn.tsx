import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DroppableColumnProps {
  id: string;
  title: string;
  count: number;
  color: "slate" | "blue" | "green";
  children: React.ReactNode;
  onAddTask: () => void;
}

const colorClasses = {
  slate: {
    header: "bg-gray-100 border-gray-300",
    headerText: "text-gray-800",
    badge: "bg-gray-200 text-gray-700",
    body: "bg-gray-50 border-gray-200",
    bodyOver: "bg-blue-50/50 border-blue-400",
  },
  blue: {
    header: "bg-blue-50 border-blue-200",
    headerText: "text-blue-800",
    badge: "bg-blue-100 text-blue-700",
    body: "bg-blue-50/30 border-blue-100",
    bodyOver: "bg-blue-100/50 border-blue-400",
  },
  green: {
    header: "bg-green-50 border-green-200",
    headerText: "text-green-800",
    badge: "bg-green-100 text-green-700",
    body: "bg-green-50/30 border-green-100",
    bodyOver: "bg-green-100/50 border-green-400",
  },
};

export function DroppableColumn({ id, title, count, color, children, onAddTask }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const colors = colorClasses[color];

  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <div className={`${colors.header} border rounded-t-lg px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <h2 className={`font-bold ${colors.headerText}`}>{title}</h2>
          <span className={`${colors.badge} px-2 py-1 rounded-full text-xs font-semibold`}>
            {count}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddTask}
          className="h-7 w-7 p-0 hover:bg-black/5"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </Button>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 ${isOver ? colors.bodyOver : colors.body} border-x border-b rounded-b-lg p-4 min-h-[600px] transition-colors`}
      >
        {children}
      </div>
    </div>
  );
}
