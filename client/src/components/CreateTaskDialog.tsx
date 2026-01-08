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
import { Phone, Mail, Home, Search, MessageSquare, Handshake, FileCheck, ClipboardCheck, FileText } from "lucide-react";
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
  { value: "Email", label: "Email", icon: Mail },
  { value: "Visit", label: "Visit", icon: Home },
  { value: "Research", label: "Research", icon: Search },
  { value: "Follow-up", label: "Follow-up", icon: MessageSquare },
  { value: "Offer", label: "Offer", icon: Handshake },
  { value: "Negotiation", label: "Negotiation", icon: Handshake },
  { value: "Contract", label: "Contract", icon: FileCheck },
  { value: "Inspection", label: "Inspection", icon: ClipboardCheck },
  { value: "Closing", label: "Closing", icon: FileCheck },
  { value: "Other", label: "Other", icon: FileText },
];

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultStatus = "To Do",
  defaultPropertyId,
  editingTask,
  onSuccess,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
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
        setTitle(editingTask.title || "");
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
    setTitle("");
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

    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || "",
        taskType,
        priority,
        status,
        dueDate: dueDate || "",
        repeat,
        assignedTo: assignedTo || "",
        propertyId: defaultPropertyId,
      };

      if (editingTask) {
        await updateTaskMutation.mutateAsync({
          id: editingTask.id,
          ...taskData,
        });
        toast.success("Task updated successfully!");
      } else {
        await createTaskMutation.mutateAsync(taskData);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {editingTask ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 pr-4">
            {/* Title */}
            <div>
              <Label htmlFor="title" className="text-slate-200">
                Task Title *
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="Enter task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-slate-200">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Add task details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 resize-none h-24"
              />
            </div>

            {/* Task Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taskType" className="text-slate-200">
                  Task Type *
                </Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {taskTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-white">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority" className="text-slate-200">
                  Priority *
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="High" className="text-white">
                      High Priority
                    </SelectItem>
                    <SelectItem value="Medium" className="text-white">
                      Medium Priority
                    </SelectItem>
                    <SelectItem value="Low" className="text-white">
                      Low Priority
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status" className="text-slate-200">
                  Status *
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="To Do" className="text-white">
                      To Do
                    </SelectItem>
                    <SelectItem value="In Progress" className="text-white">
                      In Progress
                    </SelectItem>
                    <SelectItem value="Done" className="text-white">
                      Done
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dueDate" className="text-slate-200">
                  Due Date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Quick Date Presets */}
            <div>
              <Label className="text-slate-200">Quick Date Presets</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Tomorrow", days: 1 },
                  { label: "1 Week", days: 7 },
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
                    className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Time & Repeat */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueTime" className="text-slate-200">
                  Time (Optional)
                </Label>
                <Input
                  id="dueTime"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="repeat" className="text-slate-200">
                  Repeat
                </Label>
                <Select value={repeat} onValueChange={setRepeat}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="No repeat" className="text-white">
                      No repeat
                    </SelectItem>
                    <SelectItem value="Daily" className="text-white">
                      Daily
                    </SelectItem>
                    <SelectItem value="Weekly" className="text-white">
                      Weekly
                    </SelectItem>
                    <SelectItem value="Monthly" className="text-white">
                      Monthly
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assign To */}
            <div>
              <Label htmlFor="assignedTo" className="text-slate-200">
                Assign To
              </Label>
              {agentsLoading ? (
                <div className="text-slate-400 text-sm">Loading agents...</div>
              ) : agents.length === 0 ? (
                <div className="text-slate-400 text-sm">No agents available</div>
              ) : (
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select agent..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id.toString()} className="text-white">
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </form>

        {/* Footer with buttons - Always visible */}
        <div className="flex gap-2 justify-end pt-4 border-t border-slate-700 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
