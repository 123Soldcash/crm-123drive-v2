import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SkiptracingTableProps {
  propertyId: number;
}

export function SkiptracingTable({ propertyId }: SkiptracingTableProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form state
  const [method, setMethod] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: logs = [], refetch } = trpc.skiptracing.list.useQuery({ propertyId });
  
  // Mutations
  const createMutation = trpc.skiptracing.create.useMutation({
    onSuccess: () => {
      toast.success("Skiptracing entry added");
      refetch();
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.skiptracing.update.useMutation({
    onSuccess: () => {
      toast.success("Skiptracing entry updated");
      refetch();
      resetForm();
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.skiptracing.delete.useMutation({
    onSuccess: () => {
      toast.success("Skiptracing entry deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setMethod("");
    setSource("");
    setNotes("");
  };

  const handleAdd = () => {
    if (!method.trim()) {
      toast.error("Method is required");
      return;
    }

    createMutation.mutate({
      propertyId,
      method: method.trim(),
      source: source.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setMethod(log.method);
    setSource(log.source || "");
    setNotes(log.notes || "");
  };

  const handleUpdate = () => {
    if (!editingId) return;

    updateMutation.mutate({
      id: editingId,
      method: method.trim() || undefined,
      source: source.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this skiptracing entry?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Skiptracing Entry</DialogTitle>
              <DialogDescription>
                Record a new skiptracing activity for this property.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="method">Method *</Label>
                <Input
                  id="method"
                  placeholder="e.g., BeenVerified, RESimpli, Deal_Machine"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  placeholder="Additional source information"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No skiptracing entries yet. Click "Add Entry" to record your first skiptracing activity.
        </p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.method}</TableCell>
                  <TableCell>{log.source || "-"}</TableCell>
                  <TableCell>{new Date(log.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{log.agentName}</TableCell>
                  <TableCell className="max-w-xs truncate">{log.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editingId === log.id} onOpenChange={(open) => !open && setEditingId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(log)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Skiptracing Entry</DialogTitle>
                            <DialogDescription>
                              Update the skiptracing activity details.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-method">Method</Label>
                              <Input
                                id="edit-method"
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-source">Source</Label>
                              <Input
                                id="edit-source"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-notes">Notes</Label>
                              <Textarea
                                id="edit-notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? "Updating..." : "Update"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(log.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
