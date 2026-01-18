import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { followUpNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pause, Play, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

interface AutomatedFollowUpsProps {
  propertyId: number;
}

type FollowUpType = "Cold Lead" | "No Contact" | "Stage Change" | "Custom";
type FollowUpAction = "Create Task" | "Send Email" | "Send SMS" | "Change Stage";

export function AutomatedFollowUps({ propertyId }: AutomatedFollowUpsProps) {
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

      // Parse action details based on action type
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

      // Calculate next run date based on trigger
      let nextRunAt = new Date();
      if (trigger.toLowerCase().includes("30 days")) {
        nextRunAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (trigger.toLowerCase().includes("7 days")) {
        nextRunAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else if (trigger.toLowerCase().includes("1 day")) {
        nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else {
        nextRunAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Default: 3 days
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
      console.error(error);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "Paused":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "Completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Active":
        return "default";
      case "Paused":
        return "secondary";
      case "Completed":
        return "outline";
      default:
        return "default";
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "Create Task":
        return "bg-green-100 text-green-800";
      case "Send Email":
        return "bg-purple-100 text-purple-800";
      case "Send SMS":
        return "bg-orange-100 text-orange-800";
      case "Change Stage":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Cold Lead":
        return "bg-red-100 text-red-800";
      case "No Contact":
        return "bg-yellow-100 text-yellow-800";
      case "Stage Change":
        return "bg-indigo-100 text-indigo-800";
      case "Custom":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading follow-ups...</div>;
  }

  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-blue-900">Automated Follow-ups</CardTitle>
          <CardDescription className="text-blue-700/70">Manage reminders and automations for this lead</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Automated Follow-up</DialogTitle>
              <DialogDescription>
                Configure an automated follow-up for this lead
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Follow-up Type */}
              <div>
                <label className="text-sm font-medium">Follow-up Type</label>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as FollowUpType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cold Lead">Cold Lead</SelectItem>
                    <SelectItem value="No Contact">No Contact</SelectItem>
                    <SelectItem value="Stage Change">Stage Change</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Trigger */}
              <div>
                <label className="text-sm font-medium">Trigger (when to execute?)</label>
                <Textarea
                  placeholder="Ex: No contact for 30 days, Lead became COLD, 7 days without response..."
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="min-h-20"
                />
              </div>

              {/* Action */}
              <div>
                <label className="text-sm font-medium">Action to Execute</label>
                <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value as FollowUpAction)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Create Task">Create Task</SelectItem>
                    <SelectItem value="Send Email">Send Email</SelectItem>
                    <SelectItem value="Send SMS">Send SMS</SelectItem>
                    <SelectItem value="Change Stage">Change Stage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Details */}
              {selectedAction === "Send SMS" && (
                <div>
                  <label className="text-sm font-medium">SMS Message</label>
                  <Textarea
                    placeholder="Type the message to be sent..."
                    value={actionDetails}
                    onChange={(e) => setActionDetails(e.target.value)}
                    className="min-h-20"
                  />
                </div>
              )}

              {selectedAction === "Change Stage" && (
                <div>
                  <label className="text-sm font-medium">New Stage ID</label>
                  <Input
                    placeholder="Ex: FOLLOW_UP_ON_CONTRACT"
                    value={actionDetails}
                    onChange={(e) => setActionDetails(e.target.value)}
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleCreateFollowUp}
                disabled={isSubmitting || !trigger.trim()}
              >
                {isSubmitting ? "Creating..." : "Create Follow-up"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No follow-ups configured for this lead
          </p>
        ) : (
          <div className="space-y-3">
            {followUps.map((followUp: any) => (
              <div
                key={followUp.id}
                className={`flex items-start justify-between p-3 border-l-4 rounded-lg hover:shadow-md transition-all ${
                  followUp.status === "Active" ? "border-l-green-500 bg-green-50/30" :
                  followUp.status === "Paused" ? "border-l-yellow-500 bg-yellow-50/30" :
                  "border-l-gray-500 bg-gray-50/30"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {getStatusIcon(followUp.status)}
                    <Badge variant={getStatusBadgeVariant(followUp.status)}>
                      {followUp.status}
                    </Badge>
                    <Badge className={getTypeColor(followUp.type)}>{followUp.type}</Badge>
                    <Badge className={getActionBadgeColor(followUp.action)}>{followUp.action}</Badge>
                  </div>
                  <p className="text-sm font-medium">{followUp.trigger}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Next run: {format(new Date(followUp.nextRunAt), "MM/dd/yyyy HH:mm", { locale: enUS })}
                  </p>
                  {followUp.lastTriggeredAt && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {format(new Date(followUp.lastTriggeredAt), "MM/dd/yyyy HH:mm", { locale: enUS })}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {followUp.status === "Active" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExecute(followUp.id)}
                        disabled={executeMutation.isPending}
                      >
                        Execute Now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePause(followUp.id)}
                        disabled={pauseMutation.isPending}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {followUp.status === "Paused" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResume(followUp.id)}
                      disabled={resumeMutation.isPending}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(followUp.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
