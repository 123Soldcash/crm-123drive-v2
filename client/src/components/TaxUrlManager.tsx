/**
 * TaxUrlManager
 *
 * Global URL list + per-property selector for Delinquent Taxes.
 *
 * HOW IT WORKS (like Lead Source):
 * - There is ONE shared list of tax lookup URLs (e.g. "Broward County", "Miami-Dade BCPA")
 * - Each property picks which URL it uses from that list
 * - Admins can add/edit/remove URLs from the global list
 * - Clicking "Open" opens the selected URL in a new tab
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface TaxUrlManagerProps {
  propertyId: number;
}

export function TaxUrlManager({ propertyId }: TaxUrlManagerProps) {
  const [showManage, setShowManage] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const utils = trpc.useUtils();

  // All global URLs
  const { data: allUrls = [], isLoading: loadingAll } = trpc.taxUrls.listAll.useQuery();

  // Currently selected URL for this property
  const { data: selectedUrl, isLoading: loadingSelected } =
    trpc.taxUrls.getSelected.useQuery({ propertyId }, { enabled: !!propertyId });

  const addMutation = trpc.taxUrls.add.useMutation({
    onSuccess: () => {
      utils.taxUrls.listAll.invalidate();
      setNewLabel("");
      setNewUrl("");
      setShowAddForm(false);
      toast.success("URL added to global list");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.taxUrls.remove.useMutation({
    onSuccess: () => {
      utils.taxUrls.listAll.invalidate();
      utils.taxUrls.getSelected.invalidate({ propertyId });
      toast.success("URL removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLabelMutation = trpc.taxUrls.updateLabel.useMutation({
    onSuccess: () => {
      utils.taxUrls.listAll.invalidate();
      utils.taxUrls.getSelected.invalidate({ propertyId });
      setEditingId(null);
      toast.success("Label updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateUrlMutation = trpc.taxUrls.updateUrl.useMutation({
    onSuccess: () => {
      utils.taxUrls.listAll.invalidate();
      utils.taxUrls.getSelected.invalidate({ propertyId });
      setEditingId(null);
      toast.success("URL updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const setSelectedMutation = trpc.taxUrls.setSelected.useMutation({
    onSuccess: () => {
      utils.taxUrls.getSelected.invalidate({ propertyId });
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
    addMutation.mutate({ label: newLabel.trim(), url });
  };

  const handleSelectChange = (value: string) => {
    const id = value === "none" ? null : Number(value);
    setSelectedMutation.mutate({ propertyId, taxUrlId: id });
  };

  const handleOpen = () => {
    if (!selectedUrl) return;
    const url = selectedUrl.url.startsWith("http") ? selectedUrl.url : `https://${selectedUrl.url}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const startEdit = (item: { id: number; label: string; url: string }) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditUrl(item.url);
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (editLabel.trim()) {
      updateLabelMutation.mutate({ id: editingId, label: editLabel.trim() });
    }
    if (editUrl.trim()) {
      let url = editUrl.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
      updateUrlMutation.mutate({ id: editingId, url });
    }
  };

  const isLoading = loadingAll || loadingSelected;

  return (
    <div className="space-y-3">
      {/* ── Selector row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedUrl ? String(selectedUrl.id) : "none"}
            onValueChange={handleSelectChange}
            disabled={isLoading || setSelectedMutation.isPending}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={isLoading ? "Loading..." : "Select a tax lookup site…"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None selected —</SelectItem>
              {allUrls.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Open button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedUrl}
          onClick={handleOpen}
          className="h-9 px-3 shrink-0 gap-1.5"
          title="Open selected URL in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </Button>
      </div>

      {/* Show the actual URL as a hint */}
      {selectedUrl && (
        <p className="text-xs text-muted-foreground truncate pl-1">
          🔗 {selectedUrl.url}
        </p>
      )}

      {/* ── Manage global list toggle ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowManage((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Manage URL list
        {showManage ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showManage && (
        <div className="space-y-2 p-3 rounded-md border border-border bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Global Tax Lookup URLs — available for all properties
          </p>

          {/* List */}
          {allUrls.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No URLs yet. Add one below.</p>
          ) : (
            <div className="space-y-1.5">
              {allUrls.map((item) => (
                <div key={item.id} className="flex items-start gap-2 p-2 rounded border border-border bg-background">
                  {editingId === item.id ? (
                    <div className="flex-1 space-y-1.5">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="URL"
                        className="h-7 text-xs"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={saveEdit}
                          className="text-green-600 hover:text-green-700"
                          title="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeMutation.mutate({ id: item.id })}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {showAddForm ? (
            <div className="space-y-1.5 pt-1">
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
              className="h-7 text-xs w-full border-dashed mt-1"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add New URL to Global List
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
