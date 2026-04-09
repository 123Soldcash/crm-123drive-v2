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
import { Plus, Pause, Play, Trash2, Clock, CheckCircle, AlertCircle, Zap, FileText, ExternalLink, Mail, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();

  // Load all message templates (used for both SMS and Email pickers)
  const { data: allTemplates = [] } = trpc.smsTemplates.list.useQuery();

  // Filter templates by channel based on selected action
  const filteredTemplates = allTemplates.filter(t => {
    if (selectedAction === "Send SMS") return t.channel === "sms" || t.channel === "both";
    if (selectedAction === "Send Email") return t.channel === "email" || t.channel === "both";
    return false;
  });

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
        const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId);
        actionDetailsObj = {
          subject: selectedTemplate?.emailSubject || actionDetails || `Follow-up: ${trigger}`,
          body: selectedTemplate?.body || actionDetails || `Hi! Following up about the property. ${trigger}`,
          template: selectedTemplateId ? undefined : "default_followup",
          templateId: selectedTemplateId,
          templateName: selectedTemplate?.name,
        };
      } else if (selectedAction === "Send SMS") {
        const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId);
        actionDetailsObj = {
          message: selectedTemplate?.body || actionDetails || `Hi! Following up about the property. ${trigger}`,
          templateId: selectedTemplateId,
          templateName: selectedTemplate?.name,
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

      const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId);
      await createMutation.mutateAsync({
        propertyId,
        type: selectedType,
        trigger,
        action: selectedAction,
        actionDetails: actionDetailsObj,
        nextRunAt,
        ...((selectedAction === "Send SMS" || selectedAction === "Send Email") && selectedTemplateId ? {
          templateId: selectedTemplateId,
          templateBody: selectedTemplate?.body,
        } : {}),
      });

      followUpNotifications.followUpCreated(trigger);
      setIsDialogOpen(false);
      setTrigger("");
      setActionDetails("");
      setSelectedTemplateId(null);
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
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 min-w-0">
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">New Follow-up</span>
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
                <Select value={selectedAction} onValueChange={(value) => { setSelectedAction(value as FollowUpAction); setSelectedTemplateId(null); setActionDetails(""); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Create Task">Create Task</SelectItem>
                    <SelectItem value="Send Email">Send Email</SelectItem>
                    <SelectItem value="Send SMS">Send SMS</SelectItem>
                    <SelectItem value="Change Stage">Change Stage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Picker — shown for Send SMS and Send Email */}
              {(selectedAction === "Send SMS" || selectedAction === "Send Email") && (
                <div className={`space-y-2 rounded-lg border p-3 ${
                  selectedAction === "Send SMS" 
                    ? "border-blue-100 bg-blue-50/50" 
                    : "border-amber-100 bg-amber-50/50"
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      {selectedAction === "Send SMS" 
                        ? <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                        : <Mail className="w-3.5 h-3.5 text-amber-500" />
                      }
                      Message Template
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate("/message-templates")}
                      className={`text-[10px] hover:underline flex items-center gap-0.5 ${
                        selectedAction === "Send SMS" ? "text-blue-500" : "text-amber-600"
                      }`}
                    >
                      Manage Templates <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {filteredTemplates.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-2">
                      No {selectedAction === "Send SMS" ? "SMS" : "Email"} templates yet.{" "}
                      <button type="button" onClick={() => navigate("/message-templates")} className="text-blue-500 hover:underline">Create one</button>
                    </div>
                  ) : (
                    <Select
                      value={selectedTemplateId ? String(selectedTemplateId) : "__free__"}
                      onValueChange={(v) => setSelectedTemplateId(v === "__free__" ? null : Number(v))}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue placeholder="Select a template or write free text" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__free__">-- Write custom message --</SelectItem>
                        {filteredTemplates.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            <span className="font-medium">{t.name}</span>
                            <span className="ml-2 text-xs text-slate-400">[{t.category}]</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Preview selected template */}
                  {selectedTemplateId && (() => {
                    const t = allTemplates.find(x => x.id === selectedTemplateId);
                    if (!t) return null;
                    return (
                      <div className="space-y-1">
                        {/* Email subject preview */}
                        {selectedAction === "Send Email" && t.emailSubject && (
                          <div className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Subject: {t.emailSubject}
                          </div>
                        )}
                        <div className="text-xs font-mono text-slate-600 bg-white rounded border border-slate-200 p-2 leading-relaxed max-h-20 overflow-y-auto">
                          {t.body}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Free-text fallback when no template selected */}
                  {!selectedTemplateId && (
                    <Textarea
                      placeholder={selectedAction === "Send SMS" ? "Write your SMS message here..." : "Write your email body here..."}
                      value={actionDetails}
                      onChange={(e) => setActionDetails(e.target.value)}
                      className="min-h-16 text-sm bg-white"
                    />
                  )}
                </div>
              )}
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
          {followUps.map((fu) => {
            const actionColor = fu.action === "Send SMS" ? "blue" : fu.action === "Send Email" ? "amber" : fu.action === "Change Stage" ? "purple" : "slate";
            const ActionIcon = fu.action === "Send SMS" ? MessageSquare : fu.action === "Send Email" ? Mail : fu.action === "Change Stage" ? Zap : FileText;
            return (
              <div key={fu.id} className={`p-2.5 sm:p-3 rounded-lg border transition-colors gap-2 ${
                fu.status === "Active" ? "border-blue-100 bg-blue-50/20 hover:bg-blue-50/40" :
                fu.status === "Paused" ? "border-amber-100 bg-amber-50/20" :
                "border-green-100 bg-green-50/20"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`p-2 rounded-full bg-white border shadow-sm border-${actionColor}-100`}>
                      <ActionIcon className={`h-3.5 w-3.5 text-${actionColor}-500`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 truncate">{fu.trigger}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold shrink-0 border-${actionColor}-200 text-${actionColor}-700 bg-${actionColor}-50`}>
                          {fu.action}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 shrink-0 ${
                          fu.status === "Active" ? "border-green-200 text-green-700 bg-green-50" :
                          fu.status === "Paused" ? "border-amber-200 text-amber-700 bg-amber-50" :
                          "border-slate-200 text-slate-600 bg-slate-50"
                        }`}>
                          {fu.status === "Active" ? "● Active" : fu.status === "Paused" ? "⏸ Paused" : "✓ Done"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-[11px] text-slate-500">
                          Next: {fu.nextRunAt ? format(new Date(fu.nextRunAt), "MMM d, yyyy 'at' h:mm a") : "N/A"}
                        </p>
                        {fu.lastTriggeredAt && (
                          <p className="text-[11px] text-emerald-600">
                            Last run: {format(new Date(fu.lastTriggeredAt), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {fu.status === "Active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        onClick={() => handleExecute(fu.id)}
                        disabled={executeMutation.isPending}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        Run Now
                      </Button>
                    )}
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
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
