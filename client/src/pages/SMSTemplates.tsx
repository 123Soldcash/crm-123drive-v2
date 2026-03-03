/**
 * SMS Templates Management Page
 *
 * Allows users to create, view, edit, and delete SMS message templates
 * used in Automated Follow-Ups. Shows which properties/follow-ups are
 * currently using each template before allowing deletion.
 *
 * Route: /sms/templates
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  Eye,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────
type SmsTemplate = {
  id: number;
  name: string;
  category: string;
  body: string;
  sortOrder: number | null;
  createdByName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type UsageRow = {
  followUpId: number;
  propertyId: number | null;
  trigger: string;
  status: string;
  nextRunAt: Date | string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

const CATEGORIES = ["Introduction", "Follow-Up", "Closing", "Reminder", "Custom"];

// ─── Variable Hint ────────────────────────────────────────────────────────────
const VARIABLE_HINTS = [
  { label: "{{name}}", desc: "Contact's full name" },
  { label: "{{address}}", desc: "Property address" },
  { label: "{{agent}}", desc: "Your name" },
  { label: "{{city}}", desc: "Property city" },
];

// ─── Template Form Dialog ─────────────────────────────────────────────────────
function TemplateFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: SmsTemplate | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Custom");
  const [body, setBody] = useState(initial?.body ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  const utils = trpc.useUtils();

  const createMutation = trpc.smsTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      utils.smsTemplates.list.invalidate();
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Failed to create template", { description: e.message }),
  });

  const updateMutation = trpc.smsTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("Template updated successfully");
      utils.smsTemplates.list.invalidate();
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Failed to update template", { description: e.message }),
  });

  // Reset form when dialog opens with new initial value
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(initial?.name ?? "");
      setCategory(initial?.category ?? "Custom");
      setBody(initial?.body ?? "");
      setSortOrder(initial?.sortOrder ?? 0);
    }
    onOpenChange(v);
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    if (!body.trim()) { toast.error("Message body is required"); return; }

    if (initial) {
      updateMutation.mutate({ id: initial.id, name: name.trim(), category, body: body.trim(), sortOrder });
    } else {
      createMutation.mutate({ name: name.trim(), category, body: body.trim(), sortOrder });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const insertVariable = (v: string) => setBody((prev) => prev + v);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Template" : "New SMS Template"}</DialogTitle>
          <DialogDescription>
            {initial ? "Update this reusable message template." : "Create a reusable SMS message for Automated Follow-Ups."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Template Name *</label>
            <Input
              placeholder="e.g. Initial Outreach, Follow-Up #1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Message Body *</label>
            <Textarea
              placeholder="Hi {{name}}, I'm following up about the property at {{address}}..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-28 text-sm font-mono"
            />
            {/* Variable hints */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {VARIABLE_HINTS.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  title={v.desc}
                  onClick={() => insertVariable(v.label)}
                  className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors font-mono"
                >
                  {v.label}
                </button>
              ))}
              <span className="text-[11px] text-slate-400 self-center ml-1">Click to insert variable</span>
            </div>
          </div>

          {/* Sort order */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Sort Order</label>
            <Input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-24"
            />
            <p className="text-[11px] text-slate-400">Lower numbers appear first in the picker.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : initial ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Usage Panel Dialog ───────────────────────────────────────────────────────
function UsageDialog({
  template,
  open,
  onOpenChange,
}: {
  template: SmsTemplate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { data: usages = [], isLoading } = trpc.smsTemplates.getUsage.useQuery(
    { templateId: template?.id ?? 0 },
    { enabled: open && !!template }
  );

  const statusColor = (s: string) =>
    s === "Active" ? "bg-emerald-100 text-emerald-700" :
    s === "Paused" ? "bg-amber-100 text-amber-700" :
    "bg-slate-100 text-slate-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            Template Usage — {template?.name}
          </DialogTitle>
          <DialogDescription>
            These Automated Follow-Ups are currently using this template.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-2 py-1">
          {isLoading && (
            <div className="text-sm text-slate-400 text-center py-6 animate-pulse">Loading usage data...</div>
          )}
          {!isLoading && usages.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No follow-ups are currently using this template.</p>
            </div>
          )}
          {usages.map((u) => (
            <div
              key={u.followUpId}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={() => { onOpenChange(false); navigate(`/properties/${u.propertyId}`); }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {u.address ? `${u.address}, ${u.city}, ${u.state}` : `Property #${u.propertyId}`}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{u.trigger}</p>
                {u.nextRunAt && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    Next run: {format(new Date(u.nextRunAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(u.status)}`}>
                  {u.status}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────
function DeleteConfirmDialog({
  template,
  open,
  onOpenChange,
  onDeleted,
}: {
  template: SmsTemplate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"check" | "warn" | "confirm">("check");
  const [usages, setUsages] = useState<UsageRow[]>([]);

  const deleteMutation = trpc.smsTemplates.delete.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        // Template is in use — show warning
        setUsages(result.usages as unknown as UsageRow[]);
        setStep("warn");
        return;
      }
      toast.success("Template deleted");
      utils.smsTemplates.list.invalidate();
      onDeleted();
      onOpenChange(false);
      setStep("check");
    },
    onError: (e) => toast.error("Failed to delete template", { description: e.message }),
  });

  const handleInitialDelete = () => {
    if (!template) return;
    deleteMutation.mutate({ id: template.id, force: false });
  };

  const handleForceDelete = () => {
    if (!template) return;
    deleteMutation.mutate({ id: template.id, force: true });
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("check");
    setUsages([]);
  };

  if (step === "warn") {
    return (
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <AlertDialogTitle>Template Is In Use</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>{template?.name}</strong> is currently used by{" "}
                <strong>{usages.length} active follow-up{usages.length !== 1 ? "s" : ""}</strong>.
              </p>
              <p className="text-slate-500 text-xs">
                If you delete it, those follow-ups will keep their saved message snapshot but lose the link to this template. You can still edit them individually.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceDelete}
              className="bg-rose-500 hover:bg-rose-600 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{template?.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleInitialDelete}
            className="bg-rose-500 hover:bg-rose-600 text-white"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Checking..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({
  template,
  onEdit,
  onDelete,
  onViewUsage,
}: {
  template: SmsTemplate;
  onEdit: (t: SmsTemplate) => void;
  onDelete: (t: SmsTemplate) => void;
  onViewUsage: (t: SmsTemplate) => void;
}) {
  const { data: usages = [] } = trpc.smsTemplates.getUsage.useQuery({ templateId: template.id });
  const activeCount = usages.filter((u) => u.status === "Active").length;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-slate-800 truncate">{template.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold">
                {template.category}
              </Badge>
              {activeCount > 0 && (
                <button
                  onClick={() => onViewUsage(template)}
                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Layers className="w-3 h-3" />
                  Used in {activeCount} follow-up{activeCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
              title="View usage"
              onClick={() => onViewUsage(template)}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600"
              title="Edit template"
              onClick={() => onEdit(template)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
              title="Delete template"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-xs text-slate-600 font-mono leading-relaxed line-clamp-3 bg-slate-50 rounded p-2 border border-slate-100">
          {template.body}
        </p>
        <p className="text-[10px] text-slate-400 mt-2">
          {template.createdByName ? `Created by ${template.createdByName}` : "System template"} ·{" "}
          {format(new Date(template.updatedAt), "MMM d, yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SMSTemplates() {
  const { data: templates = [], isLoading } = trpc.smsTemplates.list.useQuery();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SmsTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SmsTemplate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [usageTarget, setUsageTarget] = useState<SmsTemplate | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const handleEdit = (t: SmsTemplate) => { setEditTarget(t); setFormOpen(true); };
  const handleDelete = (t: SmsTemplate) => { setDeleteTarget(t); setDeleteOpen(true); };
  const handleViewUsage = (t: SmsTemplate) => { setUsageTarget(t); setUsageOpen(true); };
  const handleNew = () => { setEditTarget(null); setFormOpen(true); };

  // Filter
  const filtered = templates.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "All" || t.category === filterCategory;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = CATEGORIES.reduce<Record<string, SmsTemplate[]>>((acc, cat) => {
    const items = filtered.filter((t) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  // Add any templates with categories not in CATEGORIES list
  filtered.forEach((t) => {
    if (!CATEGORIES.includes(t.category) && !(grouped[t.category])) {
      grouped[t.category] = filtered.filter((x) => x.category === t.category);
    }
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            SMS Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reusable message templates for Automated Follow-Ups. Supports{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">{"{{name}}"}</code>,{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">{"{{address}}"}</code>,{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">{"{{agent}}"}</code> variables.
          </p>
        </div>
        <Button onClick={handleNew} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No templates yet</p>
          <p className="text-sm text-slate-400 mt-1">Create your first SMS template to use in Automated Follow-Ups.</p>
          <Button onClick={handleNew} className="mt-4">
            <Plus className="w-4 h-4 mr-1.5" />
            Create First Template
          </Button>
        </div>
      )}

      {/* Grouped cards */}
      {!isLoading && Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewUsage={handleViewUsage}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Dialogs */}
      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget}
        onSaved={() => setEditTarget(null)}
      />
      <DeleteConfirmDialog
        template={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => setDeleteTarget(null)}
      />
      <UsageDialog
        template={usageTarget}
        open={usageOpen}
        onOpenChange={setUsageOpen}
      />
    </div>
  );
}
