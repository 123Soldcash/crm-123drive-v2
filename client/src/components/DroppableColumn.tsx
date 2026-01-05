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
    header: "bg-slate-700 border-slate-600",
    badge: "bg-slate-600 text-slate-200",
  },
  blue: {
    header: "bg-blue-900 border-blue-700",
    badge: "bg-blue-700 text-blue-100",
  },
  green: {
    header: "bg-green-900 border-green-700",
    badge: "bg-green-700 text-green-100",
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
          <h2 className="font-bold text-white">{title}</h2>
          <span className={`${colors.badge} px-2 py-1 rounded-full text-xs font-semibold`}>
            {count}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddTask}
          className="h-7 w-7 p-0 hover:bg-white/10"
        >
          <Plus className="w-4 h-4 text-white" />
        </Button>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-slate-800 border-x border-b border-slate-700 rounded-b-lg p-4 min-h-[600px] transition-colors ${
          isOver ? "bg-slate-700/50 border-blue-500" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
