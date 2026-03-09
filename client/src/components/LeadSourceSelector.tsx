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
import { Plus, X, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LeadSourceSelectorProps {
  propertyId: number;
  currentLeadSource?: string | null;
}

export function LeadSourceSelector({ propertyId, currentLeadSource }: LeadSourceSelectorProps) {
  const utils = trpc.useUtils();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");

  const { data: sources = [], isLoading } = trpc.leadSource.list.useQuery();

  const setSource = trpc.leadSource.setForProperty.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Lead source updated");
    },
    onError: (err) => toast.error(`Failed to update: ${err.message}`),
  });

  const addCustom = trpc.leadSource.addCustom.useMutation({
    onSuccess: () => {
      utils.leadSource.list.invalidate();
      setNewSourceName("");
      setAddDialogOpen(false);
      toast.success("Custom lead source added");
    },
    onError: (err) => toast.error(`Failed to add: ${err.message}`),
  });

  const defaultSources = sources.filter((s) => s.isDefault === 1);
  const customSources = sources.filter((s) => s.isDefault === 0);

  const handleSelect = (value: string) => {
    const newValue = value === "__none__" ? null : value;
    setSource.mutate({ propertyId, leadSource: newValue });
  };

  const handleAddCustom = () => {
    const trimmed = newSourceName.trim();
    if (!trimmed) return;
    addCustom.mutate({ name: trimmed });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 shrink-0">
        <Tag className="h-3.5 w-3.5" />
        <span>Lead Source</span>
      </div>

      <Select
        value={currentLeadSource ?? "__none__"}
        onValueChange={handleSelect}
        disabled={isLoading || setSource.isPending}
      >
        <SelectTrigger className="h-8 text-sm w-56 bg-white border-slate-200">
          <SelectValue placeholder="Select source..." />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="__none__">
            <span className="text-slate-400 italic">— Not set —</span>
          </SelectItem>

          {defaultSources.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-slate-500 uppercase tracking-wide">Standard Sources</SelectLabel>
              {defaultSources.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {customSources.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-slate-500 uppercase tracking-wide">Custom Sources</SelectLabel>
              {customSources.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {currentLeadSource && (
        <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border border-blue-200 gap-1">
          {currentLeadSource}
          <button
            onClick={() => setSource.mutate({ propertyId, leadSource: null })}
            className="hover:text-red-500 transition-colors"
            title="Clear lead source"
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
        title="Add custom lead source"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Custom
      </Button>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Custom Lead Source</DialogTitle>
            <DialogDescription>
              Create a new lead source that will be available for all properties.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="e.g., Neighborhood Flyer, Podcast Ad..."
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
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
              disabled={!newSourceName.trim() || addCustom.isPending}
            >
              {addCustom.isPending ? "Adding..." : "Add Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
