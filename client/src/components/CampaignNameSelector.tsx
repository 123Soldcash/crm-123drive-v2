import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CampaignNameSelectorProps {
  propertyId: number;
  currentCampaignName?: string | null;
}

export function CampaignNameSelector({ propertyId, currentCampaignName }: CampaignNameSelectorProps) {
  const utils = trpc.useUtils();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  const { data: campaigns = [], isLoading } = trpc.campaignName.list.useQuery();

  const setCampaign = trpc.campaignName.setForProperty.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Campaign name updated");
    },
    onError: (err) => toast.error(`Failed to update: ${err.message}`),
  });

  const addCustom = trpc.campaignName.addCustom.useMutation({
    onSuccess: () => {
      utils.campaignName.list.invalidate();
      setNewCampaignName("");
      setAddDialogOpen(false);
      toast.success("Custom campaign added");
    },
    onError: (err) => toast.error(`Failed to add: ${err.message}`),
  });

  const deleteCustom = trpc.campaignName.deleteCustom.useMutation({
    onSuccess: () => {
      utils.campaignName.list.invalidate();
      toast.success("Campaign removed");
    },
    onError: (err) => toast.error(`Failed to remove: ${err.message}`),
  });

  const defaultCampaigns = campaigns.filter((c) => c.isDefault === 1);
  const customCampaigns = campaigns.filter((c) => c.isDefault === 0);

  const handleSelect = (value: string) => {
    const newValue = value === "__none__" ? null : value;
    setCampaign.mutate({ propertyId, campaignName: newValue });
  };

  const handleAddCustom = () => {
    const trimmed = newCampaignName.trim();
    if (!trimmed) return;
    addCustom.mutate({ name: trimmed });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 shrink-0">
        <Megaphone className="h-3.5 w-3.5" />
        <span>Campaign</span>
      </div>

      <Select
        value={currentCampaignName ?? "__none__"}
        onValueChange={handleSelect}
        disabled={isLoading || setCampaign.isPending}
      >
        <SelectTrigger className="h-8 text-sm w-56 bg-white border-slate-200">
          <SelectValue placeholder="Select campaign..." />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="__none__">
            <span className="text-slate-400 italic">— Not set —</span>
          </SelectItem>

          {defaultCampaigns.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-slate-500 uppercase tracking-wide">Standard Campaigns</SelectLabel>
              {defaultCampaigns.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {customCampaigns.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-slate-500 uppercase tracking-wide">Custom Campaigns</SelectLabel>
              {customCampaigns.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {currentCampaignName && (
        <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
          {currentCampaignName}
          <button
            onClick={() => setCampaign.mutate({ propertyId, campaignName: null })}
            className="hover:text-red-500 transition-colors"
            title="Clear campaign name"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800"
        onClick={() => setAddDialogOpen(true)}
        title="Add custom campaign"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-slate-500 hover:text-red-600"
        onClick={() => setManageDialogOpen(true)}
        title="Manage campaigns (remove custom)"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        Manage
      </Button>

      {/* Add Custom Campaign Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Custom Campaign</DialogTitle>
            <DialogDescription>
              Create a new campaign name that will be available for all properties.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="e.g., 2026_Spring_Mailer..."
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCustom}
              disabled={!newCampaignName.trim() || addCustom.isPending}
            >
              {addCustom.isPending ? "Adding..." : "Add Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Campaigns Dialog (remove custom ones) */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Campaigns</DialogTitle>
            <DialogDescription>
              Remove custom campaigns. Default campaigns cannot be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-80 overflow-y-auto space-y-1">
            {customCampaigns.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-4">No custom campaigns to manage.</p>
            ) : (
              customCampaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors">
                  <span className="text-sm">{c.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteCustom.mutate({ id: c.id })}
                    disabled={deleteCustom.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
