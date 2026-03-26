import { useState } from "react";
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
} from "lucide-react";

export default function DeskManagement() {
  const utils = trpc.useUtils();
  const { data: deskList, isLoading } = trpc.desks.list.useQuery();

  // Add desk state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDeskName, setNewDeskName] = useState("");
  const [newDeskDescription, setNewDeskDescription] = useState("");

  // Edit desk state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateDesk.mutate({
      id: editingId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
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
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600" />
            Desk Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create, rename, and remove desks. Properties are automatically transferred when deleting.
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
            System desks (BIN, NEW_LEAD, DEAD) cannot be deleted. Custom desks can be renamed or removed.
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
                  <TableHead className="w-[250px]">Desk Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center w-[120px]">Properties</TableHead>
                  <TableHead className="text-center w-[100px]">Type</TableHead>
                  <TableHead className="text-right w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deskList?.map((desk) => (
                  <TableRow key={desk.id}>
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
                    <TableCell className="text-center">
                      <Badge
                        variant={desk.propertyCount > 0 ? "default" : "secondary"}
                        className={
                          desk.propertyCount > 0
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                            : ""
                        }
                      >
                        {desk.propertyCount}
                      </Badge>
                    </TableCell>
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
                ))}
                {(!deskList || deskList.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              Create New Desk
            </DialogTitle>
            <DialogDescription>
              Add a new desk to organize your properties. The desk name must be unique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="desk-name">Desk Name *</Label>
              <Input
                id="desk-name"
                placeholder="e.g. DESK_MARKETING"
                value={newDeskName}
                onChange={(e) => setNewDeskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDeskName.trim()) {
                    createDesk.mutate({
                      name: newDeskName.trim(),
                      description: newDeskDescription.trim() || undefined,
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
                })
              }
              disabled={!newDeskName.trim() || createDesk.isPending}
              className="bg-blue-600 hover:bg-blue-700"
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
              {/* Property count warning */}
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

              {/* Transfer destination */}
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
