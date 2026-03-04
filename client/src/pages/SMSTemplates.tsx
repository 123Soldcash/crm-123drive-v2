/**
 * Message Templates Management Page
 *
 * Universal templates used for both SMS and Email in Automated Follow-Ups.
 * Users can create, view, edit, delete templates and assign them to a channel
 * (SMS only, Email only, or Both). Shows which properties/follow-ups are
 * currently using each template before allowing deletion.
 *
 * Route: /message-templates
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
  Mail,
  Eye,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  FileText,
  MessagesSquare,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────
type MessageTemplate = {
  id: number;
  name: string;
  category: string;
  channel: string;
  body: string;
  emailSubject: string | null;
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
const CHANNELS = [
  { value: "both", label: "SMS & Email", icon: MessagesSquare, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "sms", label: "SMS Only", icon: MessageSquare, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "email", label: "Email Only", icon: Mail, color: "bg-amber-100 text-amber-700 border-amber-200" },
];

const CHANNEL_FILTERS = [
  { value: "all", label: "All Channels" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "both", label: "Both" },
];

// ─── Variable Hint ────────────────────────────────────────────────────────────
const VARIABLE_HINTS = [
  { label: "{{name}}", desc: "Contact's full name" },
  { label: "{{address}}", desc: "Property address" },
  { label: "{{agent}}", desc: "Your name" },
  { label: "{{city}}", desc: "Property city" },
];

// ─── Channel Badge ───────────────────────────────────────────────────────────
function ChannelBadge({ channel }: { channel: string }) {
  const ch = CHANNELS.find(c => c.value === channel) ?? CHANNELS[0];
  const Icon = ch.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ch.color}`}>
      <Icon className="w-3 h-3" />
      {ch.label}
    </span>
  );
}

// ─── Template Form Dialog ─────────────────────────────────────────────────────
function TemplateFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: MessageTemplate | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Custom");
  const [channel, setChannel] = useState(initial?.channel ?? "both");
  const [body, setBody] = useState(initial?.body ?? "");
  const [emailSubject, setEmailSubject] = useState(initial?.emailSubject ?? "");
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
      setChannel(initial?.channel ?? "both");
      setBody(initial?.body ?? "");
      setEmailSubject(initial?.emailSubject ?? "");
      setSortOrder(initial?.sortOrder ?? 0);
    }
    onOpenChange(v);
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    if (!body.trim()) { toast.error("Message body is required"); return; }
    if ((channel === "email" || channel === "both") && !emailSubject.trim()) {
      toast.error("Email subject is required for email-compatible templates");
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      channel: channel as "sms" | "email" | "both",
      body: body.trim(),
      emailSubject: (channel === "email" || channel === "both") ? emailSubject.trim() : undefined,
      sortOrder,
    };

    if (initial) {
      updateMutation.mutate({ id: initial.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const showEmailSubject = channel === "email" || channel === "both";

  const insertVariable = (target: "body" | "subject", v: string) => {
    if (target === "body") setBody((prev) => prev + v);
    else setEmailSubject((prev) => prev + v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Template" : "New Message Template"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Update this reusable message template."
              : "Create a reusable template for SMS and/or Email follow-ups."}
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

          {/* Channel */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Channel *</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const isSelected = channel === ch.value;
                return (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setChannel(ch.value)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? `${ch.color} ring-2 ring-offset-1 ring-current`
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {ch.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              {channel === "both"
                ? "This template will appear in both SMS and Email follow-up pickers."
                : channel === "sms"
                ? "This template will only appear when creating SMS follow-ups."
                : "This template will only appear when creating Email follow-ups."}
            </p>
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

          {/* Email Subject — shown when channel includes email */}
          {showEmailSubject && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-500" />
                Email Subject *
              </label>
              <Input
                placeholder="e.g. Following up about {{address}}"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {VARIABLE_HINTS.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    title={v.desc}
                    onClick={() => insertVariable("subject", v.label)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors font-mono"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  onClick={() => insertVariable("body", v.label)}
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
  template: MessageTemplate | null;
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
                    Next run: {format(new Date(u.nextRunAt as unknown as string), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={`text-[10px] ${statusColor(u.status as string)}`}>{u.status}</Badge>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────────────────
function DeleteConfirmDialog({
  template,
  open,
  onOpenChange,
  onDeleted,
}: {
  template: MessageTemplate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: usages = [] } = trpc.smsTemplates.getUsage.useQuery(
    { templateId: template?.id ?? 0 },
    { enabled: open && !!template }
  );

  const activeUsages = usages.filter((u: any) => u.status === "Active");

  const deleteMutation = trpc.smsTemplates.delete.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Template deleted");
        utils.smsTemplates.list.invalidate();
        onDeleted();
        onOpenChange(false);
      } else {
        toast.error(`Cannot delete — ${result.usageCount} active follow-up(s) are using this template.`);
      }
    },
    onError: (e) => toast.error("Failed to delete template", { description: e.message }),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {activeUsages.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <Trash2 className="w-5 h-5 text-red-500" />
            )}
            Delete "{template?.name}"?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {activeUsages.length > 0 ? (
              <>
                This template is used by <strong>{activeUsages.length}</strong> active follow-up(s).
                Deleting it will remove the template link from those follow-ups (they keep a snapshot of the message body).
              </>
            ) : (
              "This action cannot be undone. The template will be permanently removed."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={() => template && deleteMutation.mutate({ id: template.id, force: activeUsages.length > 0 })}
          >
            {activeUsages.length > 0 ? "Delete Anyway" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Template Card ───────────────────────────────────────────────────────────
function TemplateCard({
  template,
  onEdit,
  onDelete,
  onViewUsage,
}: {
  template: MessageTemplate;
  onEdit: (t: MessageTemplate) => void;
  onDelete: (t: MessageTemplate) => void;
  onViewUsage: (t: MessageTemplate) => void;
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow border-slate-200">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-slate-800 truncate">{template.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500">{template.category}</Badge>
              <ChannelBadge channel={template.channel} />
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onViewUsage(template)} title="View usage" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onEdit(template)} title="Edit" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(template)} title="Delete" className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        {/* Email subject preview */}
        {template.emailSubject && (template.channel === "email" || template.channel === "both") && (
          <div className="text-[11px] text-amber-600 font-medium mb-1.5 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            Subject: {template.emailSubject}
          </div>
        )}
        {/* Body preview */}
        <div className="text-xs text-slate-600 font-mono leading-relaxed bg-slate-50 rounded-md p-2.5 border border-slate-100 max-h-20 overflow-y-auto">
          {template.body}
        </div>
        {/* Meta */}
        <div className="flex items-center justify-between mt-2.5 text-[10px] text-slate-400">
          <span>{template.createdByName ? `By ${template.createdByName}` : ""}</span>
          <span>{format(new Date(template.updatedAt as string), "MMM d, yyyy")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SMSTemplates() {
  const { data: templates = [], isLoading } = trpc.smsTemplates.list.useQuery();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [usageTarget, setUsageTarget] = useState<MessageTemplate | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterChannel, setFilterChannel] = useState("all");

  const handleEdit = (t: MessageTemplate) => { setEditTarget(t); setFormOpen(true); };
  const handleDelete = (t: MessageTemplate) => { setDeleteTarget(t); setDeleteOpen(true); };
  const handleViewUsage = (t: MessageTemplate) => { setUsageTarget(t); setUsageOpen(true); };
  const handleNew = () => { setEditTarget(null); setFormOpen(true); };

  // Filter
  const filtered = templates.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "All" || t.category === filterCategory;
    const matchChannel = filterChannel === "all" || t.channel === filterChannel || t.channel === "both";
    return matchSearch && matchCat && matchChannel;
  });

  // Group by category
  const grouped = CATEGORIES.reduce<Record<string, MessageTemplate[]>>((acc, cat) => {
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

  // Stats
  const smsCount = templates.filter(t => t.channel === "sms" || t.channel === "both").length;
  const emailCount = templates.filter(t => t.channel === "email" || t.channel === "both").length;
  const bothCount = templates.filter(t => t.channel === "both").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Message Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reusable templates for SMS and Email follow-ups. Supports{" "}
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-lg font-bold text-blue-700">{smsCount}</p>
            <p className="text-[10px] text-blue-500 font-medium">SMS Compatible</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
          <Mail className="w-4 h-4 text-amber-500" />
          <div>
            <p className="text-lg font-bold text-amber-700">{emailCount}</p>
            <p className="text-[10px] text-amber-500 font-medium">Email Compatible</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-100">
          <MessagesSquare className="w-4 h-4 text-purple-500" />
          <div>
            <p className="text-lg font-bold text-purple-700">{bothCount}</p>
            <p className="text-[10px] text-purple-500 font-medium">Both Channels</p>
          </div>
        </div>
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
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNEL_FILTERS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No templates yet</p>
          <p className="text-sm text-slate-400 mt-1">Create your first message template to use in SMS and Email follow-ups.</p>
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
