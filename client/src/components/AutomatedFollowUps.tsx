import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { followUpNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pause, Play, Trash2, Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { format } from "date-fns";
import { CollapsibleSection } from "./CollapsibleSection";

interface AutomatedFollowUpsProps {
  propertyId: number;
}

type FollowUpType = "Cold Lead" | "No Contact" | "Stage Change" | "Custom";
type FollowUpAction = "Create Task" | "Send Email" | "Send SMS" | "Change Stage";

export function AutomatedFollowUps({ propertyId }: AutomatedFollowUpsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FollowUpType>("Cold Lead");
  const [selectedAction, setSelectedAction] = useState<FollowUpAction>("Create Task");
  const [trigger, setTrigger] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = trpc.useUtils();
  const { data: followUps = [], isLoading } = trpc.followups.getByProperty.useQuery({ propertyId });
  const createMutation = trpc.followups.create.useMutation();
  const pauseMutation = trpc.followups.pause.useMutation();
  const resumeMutation = trpc.followups.resume.useMutation();
  const deleteMutation = trpc.followups.delete.useMutation();
  const executeMutation = trpc.followups.execute.useMutation();

  const handleCreateFollowUp = async () => {
    if (!trigger.trim()) {
      toast.error("Please describe the follow-up trigger");
      return;
    }

    setIsSubmitting(true);
    try {
      let actionDetailsObj: any = {};

      if (selectedAction === "Create Task") {
        actionDetailsObj = {
          title: `Follow-up: ${trigger}`,
          description: `Automated follow-up task: ${trigger}`,
          priority: "Medium",
        };
      } else if (selectedAction === "Send Email") {
        actionDetailsObj = {
          subject: `Follow-up: ${trigger}`,
          template: "default_followup",
        };
      } else if (selectedAction === "Send SMS") {
        actionDetailsObj = {
          message: actionDetails || `Hi! Following up about the property. ${trigger}`,
        };
      } else if (selectedAction === "Change Stage") {
        actionDetailsObj = {
          newStage: actionDetails || "FOLLOW_UP_ON_CONTRACT",
        };
      }

      let nextRunAt = new Date();
      if (trigger.toLowerCase().includes("30 days")) {
        nextRunAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (trigger.toLowerCase().includes("7 days")) {
        nextRunAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else if (trigger.toLowerCase().includes("1 day")) {
        nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else {
        nextRunAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }

      await createMutation.mutateAsync({
        propertyId,
        type: selectedType,
        trigger,
        action: selectedAction,
        actionDetails: actionDetailsObj,
        nextRunAt,
      });

      followUpNotifications.followUpCreated(trigger);
      setIsDialogOpen(false);
      setTrigger("");
      setActionDetails("");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Error creating follow-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async (followUpId: number) => {
    try {
      const followUp = followUps.find(fu => fu.id === followUpId);
      await pauseMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpPaused(followUp?.trigger || "Follow-up");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Error pausing follow-up");
    }
  };

  const handleResume = async (followUpId: number) => {
    try {
      const followUp = followUps.find(fu => fu.id === followUpId);
      await resumeMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpResumed(followUp?.trigger || "Follow-up");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Error resuming follow-up");
    }
  };

  const handleDelete = async (followUpId: number) => {
    if (!confirm("Are you sure you want to delete this follow-up?")) return;
    try {
      const followUp = followUps.find(fu => fu.id === followUpId);
      await deleteMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpDeleted(followUp?.trigger || "Follow-up");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Error deleting follow-up");
    }
  };

  const handleExecute = async (followUpId: number) => {
    try {
      const followUp = followUps.find(fu => fu.id === followUpId);
      await executeMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpExecuted(followUp?.action || "Follow-up", "Property");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Error executing follow-up");
    }
  };

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading follow-ups...</div>;
  }

  return (
    <CollapsibleSection
      title="Automated Follow-ups"
      icon={Zap}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      accentColor="blue"
      badge={followUps.length > 0 ? (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 ml-1">
          {followUps.length}
        </Badge>
      ) : null}
      action={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Automated Follow-up</DialogTitle>
              <DialogDescription>Configure an automated follow-up for this lead</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Follow-up Type</label>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as FollowUpType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cold Lead">Cold Lead</SelectItem>
                    <SelectItem value="No Contact">No Contact</SelectItem>
                    <SelectItem value="Stage Change">Stage Change</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Trigger (when to execute?)</label>
                <Textarea
                  placeholder="Ex: No contact for 30 days, Lead became COLD..."
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="min-h-20 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Action to Execute</label>
                <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value as FollowUpAction)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Create Task">Create Task</SelectItem>
                    <SelectItem value="Send Email">Send Email</SelectItem>
                    <SelectItem value="Send SMS">Send SMS</SelectItem>
                    <SelectItem value="Change Stage">Change Stage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFollowUp} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Follow-up"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {followUps.length === 0 ? (
        <div className="py-6 text-center">
          <Zap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No follow-ups configured for this lead.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {followUps.map((fu) => (
            <div key={fu.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white border border-slate-100 shadow-sm">
                  {fu.status === "Active" ? <Clock className="h-3.5 w-3.5 text-blue-500" /> : 
                   fu.status === "Paused" ? <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> : 
                   <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{fu.trigger}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold">
                      {fu.action}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Next run: {fu.nextRunAt ? format(new Date(fu.nextRunAt), "MMM d, yyyy") : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {fu.status === "Active" ? (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600" onClick={() => handlePause(fu.id)}>
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                ) : fu.status === "Paused" ? (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-emerald-600" onClick={() => handleResume(fu.id)}>
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-rose-600" onClick={() => handleDelete(fu.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
