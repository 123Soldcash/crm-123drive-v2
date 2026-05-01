import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  SkipForward,
  Droplets,
  ChevronDown,
  ChevronUp,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { CollapsibleSection } from "./CollapsibleSection";

interface DripCampaignSectionProps {
  propertyId: number;
}

export function DripCampaignSection({ propertyId }: DripCampaignSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Load available campaign templates
  const { data: templates = [] } = trpc.dripCampaigns.listTemplates.useQuery();

  // Load active/completed campaigns for this property
  const { data: propertyCampaigns = [], isLoading } =
    trpc.dripCampaigns.getByProperty.useQuery({ propertyId });

  // Launch mutation
  const launchMutation = trpc.dripCampaigns.launch.useMutation({
    onSuccess: () => {
      toast.success("Drip Campaign launched successfully!");
      setIsLaunchDialogOpen(false);
      setSelectedCampaignId("");
      utils.dripCampaigns.getByProperty.invalidate({ propertyId });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to launch campaign");
    },
  });

  // Cancel mutation
  const cancelMutation = trpc.dripCampaigns.cancel.useMutation({
    onSuccess: () => {
      toast.success("Drip Campaign cancelled");
      utils.dripCampaigns.getByProperty.invalidate({ propertyId });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel campaign");
    },
  });

  const handleLaunch = () => {
    if (!selectedCampaignId) {
      toast.error("Please select a campaign");
      return;
    }
    launchMutation.mutate({
      propertyId,
      templateId: Number(selectedCampaignId),
    });
  };

  const handleCancel = (campaignInstanceId: number) => {
    if (!confirm("Are you sure you want to cancel this Drip Campaign? All pending steps will be cancelled.")) return;
    cancelMutation.mutate({ campaignId: campaignInstanceId });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "executed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "pending":
        return <Clock className="h-3.5 w-3.5 text-blue-500" />;
      case "cancelled":
        return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case "skipped":
        return <SkipForward className="h-3.5 w-3.5 text-gray-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
            ● Active
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
            ✓ Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
            ✕ Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">
        Loading drip campaigns...
      </div>
    );
  }

  const activeCampaigns = propertyCampaigns.filter((c: any) => c.status === "active");
  const pastCampaigns = propertyCampaigns.filter((c: any) => c.status !== "active");

  return (
    <CollapsibleSection
      title="Drip Campaigns"
      icon={Droplets}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      accentColor="purple"
      badge={
        activeCampaigns.length > 0 ? (
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-700 border-purple-200 ml-1"
          >
            {activeCampaigns.length} active
          </Badge>
        ) : null
      }
      action={
        <Dialog open={isLaunchDialogOpen} onOpenChange={setIsLaunchDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 min-w-0"
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Launch Campaign</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Launch Drip Campaign</DialogTitle>
              <DialogDescription>
                Select a campaign to start automated multi-step outreach for this property.
                The campaign will send messages automatically over time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Campaign Template
                </label>
                <Select
                  value={selectedCampaignId}
                  onValueChange={setSelectedCampaignId}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-slate-400">
                            ({t.totalSteps} steps)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campaign preview */}
              {selectedCampaignId && (() => {
                const selected = templates.find(
                  (t: any) => t.id === Number(selectedCampaignId)
                );
                if (!selected) return null;
                return (
                  <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3 space-y-2">
                    <div className="text-xs font-semibold text-purple-700">
                      Campaign Overview
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="font-medium">Steps:</span>{" "}
                        {selected.totalSteps}
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span>{" "}
                        {selected.description || "Multi-day sequence"}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Messages will be sent automatically. Campaign auto-cancels if the lead responds.
                    </p>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsLaunchDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLaunch}
                disabled={launchMutation.isPending || !selectedCampaignId}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {launchMutation.isPending ? "Launching..." : "Launch Campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {propertyCampaigns.length === 0 ? (
        <div className="py-6 text-center">
          <Droplets className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            No drip campaigns active for this property.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Launch a campaign to start automated multi-step outreach.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active campaigns */}
          {activeCampaigns.map((campaign: any) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isExpanded={expandedCampaignId === campaign.id}
              onToggleExpand={() =>
                setExpandedCampaignId(
                  expandedCampaignId === campaign.id ? null : campaign.id
                )
              }
              onCancel={() => handleCancel(campaign.id)}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              propertyId={propertyId}
            />
          ))}

          {/* Past campaigns */}
          {pastCampaigns.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                Past Campaigns
              </p>
              {pastCampaigns.map((campaign: any) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  isExpanded={expandedCampaignId === campaign.id}
                  onToggleExpand={() =>
                    setExpandedCampaignId(
                      expandedCampaignId === campaign.id ? null : campaign.id
                    )
                  }
                  onCancel={() => {}}
                  getStatusIcon={getStatusIcon}
                  getStatusBadge={getStatusBadge}
                  propertyId={propertyId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ─── Campaign Card Sub-component ────────────────────────────────────────────

interface CampaignCardProps {
  campaign: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCancel: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
  propertyId: number;
}

function CampaignCard({
  campaign,
  isExpanded,
  onToggleExpand,
  onCancel,
  getStatusIcon,
  getStatusBadge,
}: CampaignCardProps) {
  // Load steps when expanded
  const { data: steps = [] } = trpc.dripCampaigns.getCampaignSteps.useQuery(
    { campaignId: campaign.id },
    { enabled: isExpanded }
  );

  const executedCount = steps.filter((s: any) => s.status === "executed").length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        campaign.status === "active"
          ? "border-purple-200 bg-purple-50/30"
          : campaign.status === "cancelled"
          ? "border-red-100 bg-red-50/10"
          : "border-slate-200 bg-slate-50/30"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Droplets
            className={`h-4 w-4 shrink-0 ${
              campaign.status === "active"
                ? "text-purple-500"
                : "text-slate-400"
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-900 truncate">
                {campaign.campaignName || "Drip Campaign"}
              </span>
              {getStatusBadge(campaign.status)}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-slate-500">
                Started: {format(new Date(campaign.startedAt), "MMM d, yyyy")}
              </span>
              {campaign.status === "active" && (
                <span className="text-[11px] text-purple-600 font-medium">
                  Step {campaign.currentStepOrder || 0}/{totalCount || "..."} ({progress}%)
                </span>
              )}
              {campaign.cancelReason === "inbound_contact" && (
                <span className="text-[11px] text-emerald-600 font-medium">
                  Lead responded
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {campaign.status === "active" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              <Ban className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Steps */}
      {isExpanded && steps.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2 max-h-64 overflow-y-auto">
          <div className="space-y-1">
            {steps.map((step: any, idx: number) => (
              <div
                key={step.id}
                className={`flex items-start gap-2 py-1.5 px-2 rounded text-xs ${
                  step.status === "executed"
                    ? "bg-emerald-50/50"
                    : step.status === "pending"
                    ? "bg-white"
                    : step.status === "cancelled"
                    ? "bg-red-50/30 opacity-60"
                    : "bg-slate-50 opacity-60"
                }`}
              >
                <div className="mt-0.5 shrink-0">{getStatusIcon(step.status)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">
                      Step {idx + 1}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1 border-slate-200"
                    >
                      Day {step.dayOffset}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 px-1 ${
                        step.channel === "SMS Only"
                          ? "border-blue-200 text-blue-600"
                          : "border-amber-200 text-amber-600"
                      }`}
                    >
                      {step.channel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    {step.messageBody || step.emailSubject || "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400">
                      Scheduled:{" "}
                      {format(new Date(step.scheduledFor), "MMM d, yyyy")}
                    </span>
                    {step.executedAt && (
                      <span className="text-[10px] text-emerald-600">
                        Executed:{" "}
                        {format(new Date(step.executedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {campaign.status === "active" && (
        <div className="px-3 pb-2">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
