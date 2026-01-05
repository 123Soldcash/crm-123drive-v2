import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface OutreachTableProps {
  propertyId: number;
}

const OUTREACH_METHODS = [
  "Email",
  "Post Card",
  "Door Knock",
  "Text Message",
  "Letter",
  "Social Media",
  "Other",
] as const;

export function OutreachTable({ propertyId }: OutreachTableProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form state
  const [method, setMethod] = useState<typeof OUTREACH_METHODS[number]>("Email");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: logs = [], refetch } = trpc.outreach.list.useQuery({ propertyId });
  
  // Mutations
  const createMutation = trpc.outreach.create.useMutation({
    onSuccess: () => {
      toast.success("Outreach entry added");
      refetch();
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.outreach.update.useMutation({
    onSuccess: () => {
      toast.success("Outreach entry updated");
      refetch();
      resetForm();
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.outreach.delete.useMutation({
    onSuccess: () => {
      toast.success("Outreach entry deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setMethod("Email");
    setNotes("");
  };

  const handleAdd = () => {
    createMutation.mutate({
      propertyId,
      method,
      notes: notes.trim() || undefined,
    });
  };

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setMethod(log.method);
    setNotes(log.notes || "");
  };

  const handleUpdate = () => {
    if (!editingId) return;

    updateMutation.mutate({
      id: editingId,
      method,
      notes: notes.trim() || undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this outreach entry?")) {
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
              <DialogTitle>Add Outreach Entry</DialogTitle>
              <DialogDescription>
                Record a new outreach activity for this property.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="method">Method *</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTREACH_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          No outreach entries yet. Click "Add Entry" to record your first outreach activity.
        </p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
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
                            <DialogTitle>Edit Outreach Entry</DialogTitle>
                            <DialogDescription>
                              Update the outreach activity details.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-method">Method</Label>
                              <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTREACH_METHODS.map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
