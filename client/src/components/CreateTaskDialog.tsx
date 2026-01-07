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
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [status, setStatus] = useState<"To Do" | "In Progress" | "Done">(defaultStatus);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [repeatTask, setRepeatTask] = useState<string | undefined>();
  const [assignedToId, setAssignedToId] = useState<number | undefined>();
  const [propertyId, setPropertyId] = useState<number | undefined>(defaultPropertyId);
  const [propertySearch, setPropertySearch] = useState("");

  // Helper function to calculate due date from preset
  const setDatePreset = (preset: string) => {
    const today = new Date();
    let date = new Date(today);
    
    switch(preset) {
      case 'tomorrow':
        date.setDate(date.getDate() + 1);
        break;
      case '1week':
        date.setDate(date.getDate() + 7);
        break;
      case '1month':
        date.setMonth(date.getMonth() + 1);
        break;
      case '3months':
        date.setMonth(date.getMonth() + 3);
        break;
      case '6months':
        date.setMonth(date.getMonth() + 6);
        break;
    }
    setDueDate(date.toISOString().split('T')[0]);
  };

  // Populate form when editing
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || "");
      setDescription(editingTask.description || "");
      setTaskType(editingTask.taskType || "Call");
      setPriority(editingTask.priority || "Medium");
      setStatus(editingTask.status || "To Do");
      setDueDate(editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : "");
      setAssignedToId(editingTask.assignedToId);
      setPropertyId(editingTask.propertyId);
    }
  }, [editingTask]);

  const { data: agents = [] } = trpc.users.listAgents.useQuery();
  const { data: properties = [] } = trpc.properties.list.useQuery(
    { search: propertySearch },
    { enabled: propertySearch.length > 2 }
  );

  const utils = trpc.useUtils();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      resetForm();
      onOpenChange(false);
      onSuccess?.();
      toast.success('Task created successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create task');
    },
  });

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      resetForm();
      onOpenChange(false);
      onSuccess?.();
      toast.success('Task updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update task');
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTaskType("Call");
    setPriority("Medium");
    setStatus(defaultStatus);
    setDueDate("");
    setDueTime("");
    setRepeatTask(undefined);
    setAssignedToId(undefined);
    if (!defaultPropertyId) {
      setPropertyId(undefined);
      setPropertySearch("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const taskData = {
      title: title || undefined,
      description: description || undefined,
      taskType: taskType as any,
      priority,
      status,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      repeatTask: (repeatTask as "Daily" | "Weekly" | "Monthly" | "None" | undefined) || undefined,
      assignedToId,
      propertyId: propertyId,
    };

    // Title is now optional

    if (editingTask) {
      updateTask.mutate({
        taskId: editingTask.id,
        ...taskData,
      });
    } else {
      createTask.mutate(taskData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
            <div>
              <Label htmlFor="title" className="text-slate-200">
                Task Title
              </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-slate-200">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add task details..."
              rows={3}
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
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
                  {taskTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        className="text-white hover:bg-slate-600"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority" className="text-slate-200">
                Priority *
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="High" className="text-white hover:bg-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      High Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="Medium" className="text-white hover:bg-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Medium Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="Low" className="text-white hover:bg-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Low Priority
                    </div>
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
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
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

          {/* Date Presets */}
          <div>
            <Label className="text-slate-200 mb-2 block">Quick Date Presets</Label>
            <div className="grid grid-cols-5 gap-2">
              <Button
                type="button"
                onClick={() => setDatePreset('tomorrow')}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700 text-sm"
              >
                Tomorrow
              </Button>
              <Button
                type="button"
                onClick={() => setDatePreset('1week')}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700 text-sm"
              >
                1 Week
              </Button>
              <Button
                type="button"
                onClick={() => setDatePreset('1month')}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700 text-sm"
              >
                1 Month
              </Button>
              <Button
                type="button"
                onClick={() => setDatePreset('3months')}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700 text-sm"
              >
                3 Months
              </Button>
              <Button
                type="button"
                onClick={() => setDatePreset('6months')}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700 text-sm"
              >
                6 Months
              </Button>
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
              <Select value={repeatTask || "none"} onValueChange={setRepeatTask}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="No repeat" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="none" className="text-white hover:bg-slate-600">No repeat</SelectItem>
                  <SelectItem value="daily" className="text-white hover:bg-slate-600">Daily</SelectItem>
                  <SelectItem value="weekly" className="text-white hover:bg-slate-600">Weekly</SelectItem>
                  <SelectItem value="monthly" className="text-white hover:bg-slate-600">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Property Selection */}
          {!defaultPropertyId && (
            <div>
              <Label htmlFor="property" className="text-slate-200">
                Link to Property (Optional)
              </Label>
              <div className="space-y-2">
                <Input
                  id="propertySearch"
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder="Search property by address..."
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                {properties.length > 0 && propertySearch.length > 2 && (
                  <Select value={propertyId?.toString()} onValueChange={(v) => setPropertyId(Number(v))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Select property..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                      {properties.slice(0, 10).map((property: any) => (
                        <SelectItem
                          key={property.id}
                          value={property.id.toString()}
                          className="text-white hover:bg-slate-600"
                        >
                          {property.addressLine1}, {property.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Assign To */}
          <div>
            <Label htmlFor="assignedTo" className="text-slate-200">
              Assign To
            </Label>
            <Select value={assignedToId?.toString()} onValueChange={(v) => setAssignedToId(Number(v))}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {agents.map((agent) => (
                  <SelectItem
                    key={agent.id}
                    value={agent.id.toString()}
                    className="text-white hover:bg-slate-600"
                  >
                    {agent.name || agent.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTask.isPending || updateTask.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createTask.isPending || updateTask.isPending ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
