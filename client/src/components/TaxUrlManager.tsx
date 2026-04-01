import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus, Trash2, CheckCircle2, Circle, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface TaxUrlManagerProps {
  propertyId: number;
}

export function TaxUrlManager({ propertyId }: TaxUrlManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const utils = trpc.useUtils();

  const { data: urls = [], isLoading } = trpc.taxUrls.list.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const addMutation = trpc.taxUrls.add.useMutation({
    onSuccess: () => {
      utils.taxUrls.list.invalidate({ propertyId });
      setNewLabel("");
      setNewUrl("");
      setShowAddForm(false);
      toast.success("URL added successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.taxUrls.remove.useMutation({
    onSuccess: () => {
      utils.taxUrls.list.invalidate({ propertyId });
      toast.success("URL removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const setSelectedMutation = trpc.taxUrls.setSelected.useMutation({
    onSuccess: () => {
      utils.taxUrls.list.invalidate({ propertyId });
    },
    onError: (e) => toast.error(e.message),
  });

  const clearSelectedMutation = trpc.taxUrls.clearSelected.useMutation({
    onSuccess: () => {
      utils.taxUrls.list.invalidate({ propertyId });
    },
  });

  const updateLabelMutation = trpc.taxUrls.updateLabel.useMutation({
    onSuccess: () => {
      utils.taxUrls.list.invalidate({ propertyId });
      setEditingId(null);
      toast.success("Label updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newLabel.trim()) { toast.error("Please enter a label"); return; }
    if (!newUrl.trim()) { toast.error("Please enter a URL"); return; }
    let url = newUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    addMutation.mutate({ propertyId, label: newLabel.trim(), url });
  };

  const handleSelect = (id: number, isSelected: number) => {
    if (isSelected) {
      clearSelectedMutation.mutate({ propertyId });
    } else {
      setSelectedMutation.mutate({ id, propertyId });
    }
  };

  const handleOpen = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const selectedUrl = urls.find((u) => u.isSelected === 1);

  return (
    <div className="space-y-3">
      {/* Selected URL quick-access bar */}
      {selectedUrl && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate flex-1">
            {selectedUrl.label}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            onClick={() => handleOpen(selectedUrl.url)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Open
          </Button>
        </div>
      )}

      {/* URL List */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading URLs...</p>
      ) : urls.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No URLs saved yet. Add one below.</p>
      ) : (
        <div className="space-y-1.5">
          {urls.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                item.isSelected === 1
                  ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700"
                  : "border-border bg-muted/30 hover:bg-muted/50"
              }`}
            >
              {/* Select toggle */}
              <button
                onClick={() => handleSelect(item.id, item.isSelected)}
                className="shrink-0 text-muted-foreground hover:text-blue-600 transition-colors"
                title={item.isSelected ? "Deselect" : "Select as active"}
              >
                {item.isSelected === 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>

              {/* Label (editable) */}
              {editingId === item.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-6 text-xs py-0 px-1 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateLabelMutation.mutate({ id: item.id, label: editLabel });
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => updateLabelMutation.mutate({ id: item.id, label: editLabel })}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  {item.isSelected === 1 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Active
                    </Badge>
                  )}
                </div>
              )}

              {/* Actions */}
              {editingId !== item.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingId(item.id); setEditLabel(item.label); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit label"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpen(item.url)}
                    className="text-muted-foreground hover:text-blue-600 transition-colors"
                    title="Open URL"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeMutation.mutate({ id: item.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove URL"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new URL form */}
      {showAddForm ? (
        <div className="space-y-2 p-3 rounded-md border border-dashed border-border bg-muted/20">
          <Input
            placeholder="Label (e.g. Broward County Taxes)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="URL (e.g. https://web.bcpa.net/...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Adding..." : "Add URL"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setShowAddForm(false); setNewLabel(""); setNewUrl(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full border-dashed"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Tax Lookup URL
        </Button>
      )}
    </div>
  );
}
