import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Edit, Link as LinkIcon, Copy, Check, Trash2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [reassignToAgentId, setReassignToAgentId] = useState<string>("");
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  // Fetch all agents
  const { data: agents = [], isLoading } = trpc.users.listAgents.useQuery();
  const utils = trpc.useUtils();

  // Update agent mutation
  const updateAgent = trpc.users.updateAgent.useMutation({
    onSuccess: () => {
      utils.users.listAgents.invalidate();
      toast.success("Agent updated successfully");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update agent");
    },
  });

  // Delete agent mutation
  const deleteAgent = trpc.users.deleteAgent.useMutation({
    onSuccess: (result) => {
      utils.users.listAgents.invalidate();
      toast.success(`Agent deleted successfully. ${result.deletedPropertyAgents} property assignments removed.`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete agent");
    },
  });

  // Reassign properties mutation
  const reassignAgentProperties = trpc.users.reassignAgentProperties.useMutation({
    onSuccess: (result) => {
      utils.users.listAgents.invalidate();
      toast.success(`${result.reassignedCount} properties reassigned successfully.`);
      setReassignDialogOpen(false);
      setSelectedUser(null);
      setReassignToAgentId("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reassign properties");
    },
  });

  const handleEditClick = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleReassignClick = (user: any) => {
    setSelectedUser(user);
    setReassignToAgentId("");
    setReassignDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    deleteAgent.mutate({ userId: userToDelete.id });
  };

  const handleConfirmReassign = () => {
    if (!selectedUser || !reassignToAgentId) return;
    reassignAgentProperties.mutate({
      fromAgentId: selectedUser.id,
      toAgentId: parseInt(reassignToAgentId),
    });
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;

    updateAgent.mutate({
      userId: selectedUser.id,
      name: editForm.name || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
    });
  };

  const handleInviteClick = () => {
    setInviteDialogOpen(true);
    setInviteLinkCopied(false);
  };

  const handleCopyInviteLink = () => {
    const inviteLink = window.location.origin;
    navigator.clipboard.writeText(inviteLink);
    setInviteLinkCopied(true);
    toast.success("Invite link copied to clipboard!");
    
    setTimeout(() => {
      setInviteLinkCopied(false);
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage birddog agents and their access to the CRM
          </p>
        </div>
        <Button onClick={handleInviteClick}>
          <LinkIcon className="mr-2 h-4 w-4" />
          Invite Agent
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Agents ({agents.length})
          </CardTitle>
          <CardDescription>
            View and manage all birddog agents in your CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No agents found. Invite agents to get started.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name || "—"}</TableCell>
                    <TableCell>{agent.email || "—"}</TableCell>
                    <TableCell>{agent.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={agent.role === "admin" ? "default" : "secondary"}>
                        {agent.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(agent)}
                          title="Edit agent details"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReassignClick(agent)}
                          title="Transfer properties to another agent"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(agent)}
                          title="Delete agent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Agent Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent Details</DialogTitle>
            <DialogDescription>
              Update the agent's name, email, and phone number
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Agent name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@example.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateAgent.isPending}>
              {updateAgent.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name || userToDelete?.email || "this agent"}</strong>?
              This will remove all their property assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending ? "Deleting..." : "Delete Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign Properties Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Properties</DialogTitle>
            <DialogDescription>
              Transfer all properties from <strong>{selectedUser?.name || selectedUser?.email}</strong> to another agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="toAgent">Transfer to Agent</Label>
              <Select value={reassignToAgentId} onValueChange={setReassignToAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a) => a.id !== selectedUser?.id)
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name || agent.email || `Agent ${agent.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReassign} 
              disabled={!reassignToAgentId || reassignAgentProperties.isPending}
            >
              {reassignAgentProperties.isPending ? "Transferring..." : "Transfer Properties"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Agent Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Agent to CRM</DialogTitle>
            <DialogDescription>
              Share this link with your birddog agents (Gonzalo, Rolando, etc.). When they
              visit the link and sign in, they'll automatically get access to the CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={window.location.origin}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyInviteLink}
              >
                {inviteLinkCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">How it works:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copy the invite link above</li>
                <li>Send it to your agent via WhatsApp, email, or SMS</li>
                <li>Agent clicks the link and signs in with their account</li>
                <li>They automatically get access to the CRM</li>
                <li>You can then assign properties to them</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
