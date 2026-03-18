import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Phone, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

export default function TwilioNumbers() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    phoneNumber: "",
    label: "",
    description: "",
    sortOrder: 0,
  });

  const numbersQuery = trpc.twilio.listNumbers.useQuery();
  const utils = trpc.useUtils();

  const addMutation = trpc.twilio.addNumber.useMutation({
    onSuccess: () => {
      toast.success("Twilio number added successfully");
      utils.twilio.listNumbers.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.twilio.updateNumber.useMutation({
    onSuccess: () => {
      toast.success("Twilio number updated");
      utils.twilio.listNumbers.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.twilio.deleteNumber.useMutation({
    onSuccess: () => {
      toast.success("Twilio number deleted");
      utils.twilio.listNumbers.invalidate();
      setDeleteDialogOpen(false);
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.twilio.updateNumber.useMutation({
    onSuccess: () => {
      utils.twilio.listNumbers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ phoneNumber: "", label: "", description: "", sortOrder: 0 });
  }

  function openAdd() {
    setEditingId(null);
    setForm({ phoneNumber: "", label: "", description: "", sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(num: any) {
    setEditingId(num.id);
    setForm({
      phoneNumber: num.phoneNumber,
      label: num.label,
      description: num.description || "",
      sortOrder: num.sortOrder || 0,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.phoneNumber || !form.label) {
      toast.error("Phone number and label are required");
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        phoneNumber: form.phoneNumber,
        label: form.label,
        description: form.description || undefined,
        sortOrder: form.sortOrder,
      });
    } else {
      addMutation.mutate({
        phoneNumber: form.phoneNumber,
        label: form.label,
        description: form.description || undefined,
        sortOrder: form.sortOrder,
      });
    }
  }

  function handleToggle(num: any) {
    toggleMutation.mutate({
      id: num.id,
      isActive: num.isActive ? 0 : 1,
    });
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  const numbers = numbersQuery.data || [];
  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-green-600" />
            Twilio Numbers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your Twilio phone numbers. Agents select which number to use when making calls or sending SMS.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Number
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registered Numbers</CardTitle>
          <CardDescription>
            {numbers.length} number{numbers.length !== 1 ? "s" : ""} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {numbersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No Twilio numbers registered yet.</p>
              <p className="text-sm mt-1">Click "Add Number" to register your first number.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Label / Campaign</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((num: any) => (
                  <TableRow key={num.id} className={!num.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-medium">{num.phoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {num.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {num.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleToggle(num)}
                        className="inline-flex items-center gap-1 cursor-pointer"
                        title={num.isActive ? "Click to disable" : "Click to enable"}
                      >
                        {num.isActive ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                            <ToggleRight className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-gray-500">
                            <ToggleLeft className="h-3 w-3 mr-1" /> Disabled
                          </Badge>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {num.sortOrder}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(num)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { setDeleteId(num.id); setDeleteDialogOpen(true); }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Twilio Number" : "Add Twilio Number"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the phone number details." : "Register a new Twilio phone number for agents to use."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+15551234567"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">E.164 format (e.g., +15551234567). Must be a verified Twilio number.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label / Campaign *</Label>
              <Input
                id="label"
                placeholder="e.g., TV Campaign, WhatsApp, Main Line"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of this number's purpose..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first in the selection dropdown.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Save Changes" : "Add Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Twilio Number?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this number from the system. Agents will no longer be able to use it for calls or SMS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setDeleteId(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteId) deleteMutation.mutate({ id: deleteId }); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
