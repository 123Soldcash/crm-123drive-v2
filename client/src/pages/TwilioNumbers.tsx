import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Phone, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, Tag, Building2 } from "lucide-react";

export default function TwilioNumbers() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedDeskIds, setSelectedDeskIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    phoneNumber: "",
    label: "",
    description: "",
    campaignName: "",
    sortOrder: 0,
  });

  const numbersQuery = trpc.twilio.listNumbers.useQuery();
  const desksQuery = trpc.desks.list.useQuery();
  const allNumberDesksQuery = trpc.twilio.getAllNumberDesks.useQuery();
  const utils = trpc.useUtils();

  const addMutation = trpc.twilio.addNumber.useMutation({
    onSuccess: (data) => {
      // After adding, set desk assignments
      if (selectedDeskIds.length > 0 && data.id) {
        setDesksMutation.mutate({ twilioNumberId: data.id, deskIds: selectedDeskIds });
      }
      toast.success("Twilio number added successfully");
      utils.twilio.listNumbers.invalidate();
      utils.twilio.getAllNumberDesks.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.twilio.updateNumber.useMutation({
    onSuccess: () => {
      // After updating, set desk assignments
      if (editingId) {
        setDesksMutation.mutate({ twilioNumberId: editingId, deskIds: selectedDeskIds });
      }
      toast.success("Twilio number updated");
      utils.twilio.listNumbers.invalidate();
      utils.twilio.getAllNumberDesks.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.twilio.deleteNumber.useMutation({
    onSuccess: () => {
      toast.success("Twilio number deleted");
      utils.twilio.listNumbers.invalidate();
      utils.twilio.getAllNumberDesks.invalidate();
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

  const setDesksMutation = trpc.twilio.setNumberDesks.useMutation({
    onSuccess: () => {
      utils.twilio.getAllNumberDesks.invalidate();
    },
    onError: (err) => toast.error("Failed to save desk assignments: " + err.message),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setSelectedDeskIds([]);
    setForm({ phoneNumber: "", label: "", description: "", campaignName: "", sortOrder: 0 });
  }

  function openAdd() {
    setEditingId(null);
    setSelectedDeskIds([]);
    setForm({ phoneNumber: "", label: "", description: "", campaignName: "", sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(num: any) {
    setEditingId(num.id);
    setForm({
      phoneNumber: num.phoneNumber,
      label: num.label,
      description: num.description || "",
      campaignName: num.campaignName || "",
      sortOrder: num.sortOrder || 0,
    });
    // Load existing desk assignments for this number
    const deskMap = allNumberDesksQuery.data || {};
    setSelectedDeskIds(deskMap[num.id] || []);
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
        campaignName: form.campaignName || null,
        sortOrder: form.sortOrder,
      });
    } else {
      addMutation.mutate({
        phoneNumber: form.phoneNumber,
        label: form.label,
        description: form.description || undefined,
        campaignName: form.campaignName || undefined,
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

  function toggleDesk(deskId: number) {
    setSelectedDeskIds((prev) =>
      prev.includes(deskId) ? prev.filter((id) => id !== deskId) : [...prev, deskId]
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  const numbers = numbersQuery.data || [];
  const allDesks = desksQuery.data || [];
  const numberDesksMap = allNumberDesksQuery.data || {};
  const isSaving = addMutation.isPending || updateMutation.isPending;

  // Helper to get desk names for a number
  function getDeskBadges(numId: number) {
    const deskIds = numberDesksMap[numId] || [];
    if (deskIds.length === 0) return <span className="text-xs text-muted-foreground italic">No desks</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {deskIds.map((dId) => {
          const desk = allDesks.find((d: any) => d.id === dId);
          if (!desk) return null;
          return (
            <Badge
              key={dId}
              className="text-xs font-medium"
              style={{
                backgroundColor: (desk as any).color ? `${(desk as any).color}20` : "#e5e7eb",
                color: (desk as any).color || "#374151",
                borderColor: (desk as any).color || "#d1d5db",
              }}
              variant="outline"
            >
              <Building2 className="h-3 w-3 mr-1" />
              {(desk as any).description || (desk as any).name}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-green-600" />
            Twilio Numbers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your Twilio phone numbers. Assign desks so inbound calls ring only the right agents.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Number
        </Button>
      </div>

      {/* Info banners */}
      <div className="space-y-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
          <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Desk Routing:</strong> Assign desks to each number. When a lead calls, only users assigned to the same desk(s) will be rung. If no desks are assigned, all active users are rung (default behavior).
          </div>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 flex items-start gap-2">
          <Tag className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Campaign Linking:</strong> When a lead arrives with a matching <em>Campaign Name</em>, the system automatically sets that number as the Default Caller ID.
          </div>
        </div>
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
                  <TableHead>Label</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      Desks
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      Campaign
                    </span>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((num: any) => (
                  <TableRow key={num.id} className={!num.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-medium">{formatPhone(num.phoneNumber)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {num.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{getDeskBadges(num.id)}</TableCell>
                    <TableCell>
                      {num.campaignName ? (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-medium">
                          <Tag className="h-3 w-3 mr-1" />
                          {num.campaignName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
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
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Twilio Number" : "Add Twilio Number"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the phone number details and desk assignments." : "Register a new Twilio phone number and assign it to desks."}
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
              <p className="text-xs text-muted-foreground">E.164 format preferred (e.g., +15551234567). US numbers auto-formatted.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                placeholder="e.g., TV Campaign, WhatsApp, Main Line"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Short display name shown to agents when selecting a caller ID.</p>
            </div>

            {/* Desk Assignment - Multi-select with checkboxes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                Desk Assignment
                <span className="text-muted-foreground font-normal">(select one or more)</span>
              </Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/30">
                {allDesks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No desks available. Create desks in Desk Management first.</p>
                ) : (
                  allDesks.map((desk: any) => (
                    <label
                      key={desk.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedDeskIds.includes(desk.id)}
                        onCheckedChange={() => toggleDesk(desk.id)}
                      />
                      <div className="flex items-center gap-2">
                        {desk.color && (
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: desk.color }}
                          />
                        )}
                        <span className="text-sm font-medium">{desk.description || desk.name}</span>
                        <span className="text-xs text-muted-foreground">({desk.name})</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Inbound calls to this number will only ring users assigned to the selected desk(s). If no desk is selected, all active users are rung.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaignName" className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-purple-600" />
                Campaign Name
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="campaignName"
                placeholder="e.g., DealMachine-TV, Driving4Dollars"
                value={form.campaignName}
                onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                When a lead arrives with this exact campaign name, this number is automatically set as the Default Caller ID.
              </p>
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
              This will permanently remove this number and its desk assignments from the system. Agents will no longer be able to use it for calls or SMS.
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
