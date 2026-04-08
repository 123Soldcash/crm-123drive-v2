import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  Edit,
  FolderPlus,
  Layers,
  Lock,
  Plus,
  Save,
  Trash2,
  X,
  ArrowRightLeft,
  Palette,
  Smile,
  Briefcase,
  Building,
  Building2,
  CircleDollarSign,
  FileText,
  Flame,
  FolderOpen,
  Globe,
  Heart,
  Home,
  Inbox,
  Landmark,
  LayoutGrid,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Rocket,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

// ─── Icon Registry ───
const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "folder", icon: FolderOpen },
  { name: "briefcase", icon: Briefcase },
  { name: "building", icon: Building },
  { name: "building2", icon: Building2 },
  { name: "home", icon: Home },
  { name: "users", icon: Users },
  { name: "user-check", icon: UserCheck },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
  { name: "flame", icon: Flame },
  { name: "rocket", icon: Rocket },
  { name: "target", icon: Target },
  { name: "trophy", icon: Trophy },
  { name: "zap", icon: Zap },
  { name: "trending-up", icon: TrendingUp },
  { name: "dollar", icon: CircleDollarSign },
  { name: "shopping-cart", icon: ShoppingCart },
  { name: "phone", icon: Phone },
  { name: "mail", icon: Mail },
  { name: "megaphone", icon: Megaphone },
  { name: "globe", icon: Globe },
  { name: "map-pin", icon: MapPin },
  { name: "landmark", icon: Landmark },
  { name: "shield", icon: Shield },
  { name: "search", icon: Search },
  { name: "file-text", icon: FileText },
  { name: "list-checks", icon: ListChecks },
  { name: "inbox", icon: Inbox },
  { name: "layout-grid", icon: LayoutGrid },
  { name: "settings", icon: Settings },
  { name: "layers", icon: Layers },
  { name: "smile", icon: Smile },
];

function getIconComponent(iconName: string | null): LucideIcon {
  if (!iconName) return FolderOpen;
  const found = ICON_OPTIONS.find((i) => i.name === iconName);
  return found ? found.icon : FolderOpen;
}

// ─── Color Palette ───
const COLOR_OPTIONS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Slate", value: "#64748b" },
  { name: "Gray", value: "#6b7280" },
  { name: "Zinc", value: "#71717a" },
];

export default function DeskManagement() {
  const utils = trpc.useUtils();
  const { data: deskList, isLoading } = trpc.desks.list.useQuery();

  // Add desk state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDeskName, setNewDeskName] = useState("");
  const [newDeskDescription, setNewDeskDescription] = useState("");
  const [newDeskColor, setNewDeskColor] = useState("#3b82f6");
  const [newDeskIcon, setNewDeskIcon] = useState("folder");

  // Edit desk state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");

  // Delete desk state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    desk: { id: number; name: string; propertyCount: number } | null;
  }>({ open: false, desk: null });
  const [transferToDeskId, setTransferToDeskId] = useState<string>("");

  // Mutations
  const createDesk = trpc.desks.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Desk "${data.name}" created successfully`);
      utils.desks.list.invalidate();
      setShowAddDialog(false);
      setNewDeskName("");
      setNewDeskDescription("");
      setNewDeskColor("#3b82f6");
      setNewDeskIcon("folder");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateDesk = trpc.desks.update.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.oldName !== data.newName
          ? `Desk renamed from "${data.oldName}" to "${data.newName}" — all properties updated`
          : "Desk updated successfully"
      );
      utils.desks.list.invalidate();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDesk = trpc.desks.delete.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Desk "${data.deletedDesk}" deleted. ${data.transferredCount} properties transferred to "${data.transferredTo}".`
      );
      utils.desks.list.invalidate();
      setDeleteDialog({ open: false, desk: null });
      setTransferToDeskId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = (desk: any) => {
    setEditingId(desk.id);
    setEditName(desk.name);
    setEditDescription(desk.description || "");
    setEditColor(desk.color || "#3b82f6");
    setEditIcon(desk.icon || "folder");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditColor("");
    setEditIcon("");
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateDesk.mutate({
      id: editingId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      color: editColor || undefined,
      icon: editIcon || undefined,
    });
  };

  const openDeleteDialog = (desk: any) => {
    setDeleteDialog({ open: true, desk });
    setTransferToDeskId("");
  };

  const confirmDelete = () => {
    if (!deleteDialog.desk || !transferToDeskId) return;
    deleteDesk.mutate({
      id: deleteDialog.desk.id,
      transferToDeskId: parseInt(transferToDeskId),
    });
  };

  const totalProperties = deskList?.reduce((sum, d) => sum + d.propertyCount, 0) || 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600" />
            Desk Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create, rename, customize icons/colors, and remove desks. Properties are automatically transferred when deleting.
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Desk
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Desks</p>
            <p className="text-2xl font-bold">{deskList?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Properties</p>
            <p className="text-2xl font-bold">{totalProperties}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">System Desks</p>
            <p className="text-2xl font-bold">
              {deskList?.filter((d) => d.isSystem === 1).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custom Desks</p>
            <p className="text-2xl font-bold">
              {deskList?.filter((d) => d.isSystem === 0).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Desks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Desks</CardTitle>
          <CardDescription>
            System desks (BIN, NEW_LEAD, DEAD) cannot be deleted. Custom desks can be renamed, recolored, or removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading desks...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Icon</TableHead>
                  <TableHead className="w-[60px]">Color</TableHead>
                  <TableHead className="w-[220px]">Desk Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center w-[100px]">Properties</TableHead>
                  <TableHead className="text-center w-[80px]">Type</TableHead>
                  <TableHead className="text-right w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deskList?.map((desk) => {
                  const IconComp = getIconComponent(desk.icon);
                  const deskColor = desk.color || "#3b82f6";

                  return (
                    <TableRow key={desk.id}>
                      {/* Icon Cell */}
                      <TableCell>
                        {editingId === desk.id ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                                {(() => {
                                  const EditIcon = getIconComponent(editIcon);
                                  return <EditIcon className="h-4 w-4" style={{ color: editColor || deskColor }} />;
                                })()}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-3" align="start">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Choose Icon</p>
                              <div className="grid grid-cols-8 gap-1">
                                {ICON_OPTIONS.map((opt) => {
                                  const Ic = opt.icon;
                                  return (
                                    <button
                                      key={opt.name}
                                      onClick={() => setEditIcon(opt.name)}
                                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                                        editIcon === opt.name
                                          ? "bg-blue-100 ring-2 ring-blue-500"
                                          : "hover:bg-muted"
                                      }`}
                                      title={opt.name}
                                    >
                                      <Ic className="h-4 w-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${deskColor}20` }}
                          >
                            <IconComp className="h-4 w-4" style={{ color: deskColor }} />
                          </div>
                        )}
                      </TableCell>

                      {/* Color Cell */}
                      <TableCell>
                        {editingId === desk.id ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                                <div
                                  className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                                  style={{ backgroundColor: editColor || deskColor }}
                                />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[240px] p-3" align="start">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Choose Color</p>
                              <div className="grid grid-cols-6 gap-2">
                                {COLOR_OPTIONS.map((c) => (
                                  <button
                                    key={c.value}
                                    onClick={() => setEditColor(c.value)}
                                    className={`h-7 w-7 rounded-full transition-transform ${
                                      editColor === c.value
                                        ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                                        : "hover:scale-110"
                                    }`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                  />
                                ))}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <Label className="text-xs">Custom:</Label>
                                <Input
                                  type="color"
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="h-7 w-10 p-0.5 cursor-pointer"
                                />
                                <Input
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="h-7 text-xs flex-1"
                                  placeholder="#hex"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div
                            className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: deskColor }}
                            title={deskColor}
                          />
                        )}
                      </TableCell>

                      {/* Name Cell */}
                      <TableCell>
                        {editingId === desk.id ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <span className="font-medium">{desk.name}</span>
                        )}
                      </TableCell>

                      {/* Description Cell */}
                      <TableCell>
                        {editingId === desk.id ? (
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Optional description..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {desk.description || "—"}
                          </span>
                        )}
                      </TableCell>

                      {/* Properties Count */}
                      <TableCell className="text-center">
                        <Badge
                          variant={desk.propertyCount > 0 ? "default" : "secondary"}
                          className={
                            desk.propertyCount > 0
                              ? "text-white"
                              : ""
                          }
                          style={desk.propertyCount > 0 ? { backgroundColor: deskColor } : {}}
                        >
                          {desk.propertyCount}
                        </Badge>
                      </TableCell>

                      {/* Type */}
                      <TableCell className="text-center">
                        {desk.isSystem === 1 ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="h-3 w-3" /> System
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Custom
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        {editingId === desk.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-green-700 border-green-200 hover:bg-green-50"
                              onClick={saveEdit}
                              disabled={updateDesk.isPending}
                            >
                              <Save className="h-3.5 w-3.5" />
                              {updateDesk.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                              onClick={() => startEdit(desk)}
                            >
                              <Edit className="h-3.5 w-3.5" /> Edit
                            </Button>
                            {desk.isSystem === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => openDeleteDialog(desk)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!deskList || deskList.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No desks found. Create your first desk to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Add Desk Dialog ─── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              Create New Desk
            </DialogTitle>
            <DialogDescription>
              Add a new desk to organize your properties. Choose a name, icon, and color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="desk-name">Desk Name *</Label>
              <Input
                id="desk-name"
                placeholder="e.g. Referral, Marketing, VIP"
                value={newDeskName}
                onChange={(e) => setNewDeskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDeskName.trim()) {
                    createDesk.mutate({
                      name: newDeskName.trim(),
                      description: newDeskDescription.trim() || undefined,
                      color: newDeskColor,
                      icon: newDeskIcon,
                    });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desk-desc">Description (optional)</Label>
              <Input
                id="desk-desc"
                placeholder="Brief description of this desk's purpose"
                value={newDeskDescription}
                onChange={(e) => setNewDeskDescription(e.target.value)}
              />
            </div>

            {/* Icon Picker */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-1.5 p-2 border rounded-lg">
                {ICON_OPTIONS.map((opt) => {
                  const Ic = opt.icon;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setNewDeskIcon(opt.name)}
                      className={`h-9 w-9 flex items-center justify-center rounded-md transition-colors ${
                        newDeskIcon === opt.name
                          ? "bg-blue-100 ring-2 ring-blue-500"
                          : "hover:bg-muted"
                      }`}
                      title={opt.name}
                    >
                      <Ic className="h-4 w-4" style={{ color: newDeskIcon === opt.name ? newDeskColor : undefined }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-lg">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewDeskColor(c.value)}
                    className={`h-7 w-7 rounded-full transition-transform ${
                      newDeskColor === c.value
                        ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
                <div className="flex items-center gap-1 ml-2">
                  <Input
                    type="color"
                    value={newDeskColor}
                    onChange={(e) => setNewDeskColor(e.target.value)}
                    className="h-7 w-8 p-0.5 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${newDeskColor}20` }}
              >
                {(() => {
                  const PreviewIcon = getIconComponent(newDeskIcon);
                  return <PreviewIcon className="h-5 w-5" style={{ color: newDeskColor }} />;
                })()}
              </div>
              <div>
                <p className="font-medium text-sm">{newDeskName || "Desk Name"}</p>
                <p className="text-xs text-muted-foreground">{newDeskDescription || "No description"}</p>
              </div>
              <Badge className="ml-auto text-white" style={{ backgroundColor: newDeskColor }}>
                Preview
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createDesk.mutate({
                  name: newDeskName.trim(),
                  description: newDeskDescription.trim() || undefined,
                  color: newDeskColor,
                  icon: newDeskIcon,
                })
              }
              disabled={!newDeskName.trim() || createDesk.isPending}
              className="text-white"
              style={{ backgroundColor: newDeskColor }}
            >
              {createDesk.isPending ? "Creating..." : "Create Desk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Desk Dialog (with Transfer) ─── */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({ open: false, desk: null });
            setTransferToDeskId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Desk: {deleteDialog.desk?.name}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All properties in this desk will be transferred to the
              desk you select below.
            </DialogDescription>
          </DialogHeader>

          {deleteDialog.desk && (
            <div className="space-y-4 py-2">
              {deleteDialog.desk.propertyCount > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <ArrowRightLeft className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {deleteDialog.desk.propertyCount} properties need to be transferred
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Select a destination desk below. All properties currently in "
                      {deleteDialog.desk.name}" will be moved there before deletion.
                    </p>
                  </div>
                </div>
              )}

              {deleteDialog.desk.propertyCount === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                  <ArrowRightLeft className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      No properties to transfer
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      This desk is empty. You still need to select a fallback desk in case any
                      properties are assigned to it between now and deletion.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Transfer properties to *</Label>
                <Select value={transferToDeskId} onValueChange={setTransferToDeskId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination desk..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deskList
                      ?.filter((d) => d.id !== deleteDialog.desk?.id)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id.toString()}>
                          {d.name} ({d.propertyCount} properties)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialog({ open: false, desk: null });
                setTransferToDeskId("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!transferToDeskId || deleteDesk.isPending}
            >
              {deleteDesk.isPending
                ? "Deleting..."
                : `Delete & Transfer ${deleteDialog.desk?.propertyCount || 0} Properties`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
