'use client';

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, Home, Search, MessageSquare, Handshake, FileCheck, ClipboardCheck, FileText, Send, Image, UserSearch, UserPlus, Repeat } from "lucide-react";
import { toast } from "sonner";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: "To Do" | "In Progress" | "Done";
  defaultPropertyId?: number;
  editingTask?: any;
  onSuccess?: () => void;
}

const taskTypes = [
  { value: "Call", label: "Call", icon: Phone },
  { value: "Text", label: "Text", icon: MessageSquare },
  { value: "Email", label: "Email", icon: Mail },
  { value: "Meeting", label: "Meeting", icon: Handshake },
  { value: "Site Visit", label: "Site Visit", icon: Home },
  { value: "Follow Up", label: "Follow Up", icon: MessageSquare },
  { value: "Offer", label: "Offer", icon: Handshake },
  { value: "Contract", label: "Contract", icon: FileCheck },
  { value: "Closing", label: "Closing", icon: FileCheck },
  { value: "Sent Letter", label: "Sent Letter", icon: Send },
  { value: "Sent Post Card", label: "Sent Post Card", icon: Image },
  { value: "Skiptrace", label: "Skiptrace", icon: UserSearch },
  { value: "Take Over Lead", label: "Take Over Lead", icon: UserPlus },
  { value: "Drip Campaign", label: "Drip Campaign", icon: Repeat },
];

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultStatus = "To Do",
  defaultPropertyId,
  editingTask,
  onSuccess,
}: CreateTaskDialogProps) {
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<string>("Call");
  const [priority, setPriority] = useState<string>("Medium");
  const [status, setStatus] = useState<string>(defaultStatus);
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("");
  const [repeat, setRepeat] = useState<string>("No repeat");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = trpc.users.listAgents.useQuery();
  const createTaskMutation = trpc.tasks.create.useMutation();
  const updateTaskMutation = trpc.tasks.update.useMutation();

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editingTask) {
        setDescription(editingTask.description || "");
        setTaskType(editingTask.taskType || "Call");
        setPriority(editingTask.priority || "Medium");
        setStatus(editingTask.status || defaultStatus);
        setDueDate(editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : "");
        setAssignedTo(editingTask.assignedTo || "");
        setRepeat(editingTask.repeat || "No repeat");
      } else {
        resetForm();
      }
    }
  }, [open, editingTask]);

  const resetForm = () => {
    setDescription("");
    setTaskType("Call");
    setPriority("Medium");
    setStatus(defaultStatus);
    setDueDate("");
    setDueTime("");
    setRepeat("No repeat");
    setAssignedTo("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      // Auto-generate title from task type
      const autoTitle = taskType;

      const taskData = {
        title: autoTitle,
        description: description.trim() || "",
        taskType,
        priority,
        status,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        repeatTask: repeat !== "No repeat" ? repeat as any : undefined,
        propertyId: defaultPropertyId,
      };

      if (editingTask) {
        await updateTaskMutation.mutateAsync({
          taskId: editingTask.id,
          ...taskData,
        } as any);
        toast.success("Task updated successfully!");
      } else {
        await createTaskMutation.mutateAsync(taskData as any);
        toast.success("Task created successfully!");
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating/updating task:", error);
      toast.error(error.message || "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get the icon for the currently selected task type
  const selectedType = taskTypes.find(t => t.value === taskType);
  const SelectedIcon = selectedType?.icon || FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] flex flex-col w-[95vw] sm:w-auto overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl">
            {editingTask ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 pr-4">
            {/* Task Type - Primary field at the top */}
            <div>
              <Label htmlFor="taskType" className="text-gray-700 font-semibold">
                Task Type *
              </Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 h-11 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 max-h-[300px] overflow-y-auto z-[200]">
                  {taskTypes.map((type) => {
                    const TypeIcon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value} className="text-gray-900 py-2.5">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="w-4 h-4 text-gray-500" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Add task details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder-gray-400 resize-none h-20"
              />
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority" className="text-gray-700">
                  Priority *
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 z-[200]">
                    <SelectItem value="High" className="text-gray-900">
                      High Priority
                    </SelectItem>
                    <SelectItem value="Medium" className="text-gray-900">
                      Medium Priority
                    </SelectItem>
                    <SelectItem value="Low" className="text-gray-900">
                      Low Priority
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status" className="text-gray-700">
                  Status *
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 z-[200]">
                    <SelectItem value="To Do" className="text-gray-900">
                      To Do
                    </SelectItem>
                    <SelectItem value="In Progress" className="text-gray-900">
                      In Progress
                    </SelectItem>
                    <SelectItem value="Done" className="text-gray-900">
                      Done
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueDate" className="text-gray-700">
                  Due Date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>

              <div>
                <Label htmlFor="dueTime" className="text-gray-700">
                  Time (Optional)
                </Label>
                <Input
                  id="dueTime"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            {/* Quick Date Presets */}
            <div>
              <Label className="text-gray-700">Quick Date Presets</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Today", days: 0 },
                  { label: "Tomorrow", days: 1 },
                  { label: "1 Week", days: 7 },
                  { label: "2 Weeks", days: 14 },
                  { label: "1 Month", days: 30 },
                  { label: "3 Months", days: 90 },
                  { label: "6 Months", days: 180 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() + preset.days);
                      setDueDate(date.toISOString().split("T")[0]);
                    }}
                    className="bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Repeat & Assign To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="repeat" className="text-gray-700">
                  Repeat
                </Label>
                <Select value={repeat} onValueChange={setRepeat}>
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 z-[200]">
                    <SelectItem value="No repeat" className="text-gray-900">
                      No repeat
                    </SelectItem>
                    <SelectItem value="Daily" className="text-gray-900">
                      Daily
                    </SelectItem>
                    <SelectItem value="Weekly" className="text-gray-900">
                      Weekly
                    </SelectItem>
                    <SelectItem value="Monthly" className="text-gray-900">
                      Monthly
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assignedTo" className="text-gray-700">
                  Assign To
                </Label>
                {agentsLoading ? (
                  <div className="text-gray-500 text-sm py-2">Loading agents...</div>
                ) : agents.length === 0 ? (
                  <div className="text-gray-500 text-sm py-2">No agents available</div>
                ) : (
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select agent..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 z-[200]">
                      {agents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id.toString()} className="text-gray-900">
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer with buttons - Always visible */}
        <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
