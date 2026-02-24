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
import { Textarea } from "@/components/ui/textarea";
import { Users, Edit, Link as LinkIcon, Copy, Check, Trash2, ArrowRightLeft, Shield, UserCheck, Search, Filter } from "lucide-react";
import { toast } from "sonner";

type UserRow = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  notes: string | null;
  twilioPhone: string | null;
  loginMethod?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  lastSignedIn: Date;
};

export default function UserManagement() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "agent" as "agent" | "admin",
    status: "Active" as "Active" | "Inactive" | "Suspended",
    notes: "",
    twilioPhone: "",
  });
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  // Fetch all users (agents + admins) using the unified endpoint
  const { data: allUsers = [], isLoading } = trpc.agents.listAllUsers.useQuery();
  const utils = trpc.useUtils();

  // Update user mutation
  const updateUser = trpc.agents.update.useMutation({
    onSuccess: () => {
      utils.agents.listAllUsers.invalidate();
      utils.agents.list.invalidate();
      utils.agents.listAll.invalidate();
      utils.users.listAgents.invalidate();
      toast.success("User updated successfully");
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  // Delete user mutation
  const deleteUser = trpc.agents.delete.useMutation({
    onSuccess: () => {
      utils.agents.listAllUsers.invalidate();
      utils.agents.list.invalidate();
      utils.agents.listAll.invalidate();
      utils.users.listAgents.invalidate();
      toast.success("User deleted successfully. All property assignments removed.");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  // Reassign properties mutation
  const reassignProperties = trpc.agents.reassignProperties.useMutation({
    onSuccess: () => {
      utils.agents.listAllUsers.invalidate();
      utils.agents.list.invalidate();
      utils.agents.listAll.invalidate();
      utils.users.listAgents.invalidate();
      toast.success("Properties reassigned successfully.");
      setReassignDialogOpen(false);
      setSelectedUser(null);
      setReassignToUserId("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reassign properties");
    },
  });

  // Filter users
  const filteredUsers = allUsers.filter((user: UserRow) => {
    const matchesSearch =
      !searchQuery ||
      (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.phone && user.phone.includes(searchQuery));
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const adminCount = allUsers.filter((u: UserRow) => u.role === "admin").length;
  const agentCount = allUsers.filter((u: UserRow) => u.role === "agent").length;
  const activeCount = allUsers.filter((u: UserRow) => u.status === "Active").length;

  const handleEditClick = (user: UserRow) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role as "agent" | "admin",
      status: (user.status || "Active") as "Active" | "Inactive" | "Suspended",
      notes: user.notes || "",
      twilioPhone: user.twilioPhone || "",
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (user: UserRow) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleReassignClick = (user: UserRow) => {
    setSelectedUser(user);
    setReassignToUserId("");
    setReassignDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    deleteUser.mutate({ id: userToDelete.id });
  };

  const handleConfirmReassign = () => {
    if (!selectedUser || !reassignToUserId) return;
    reassignProperties.mutate({
      fromUserId: selectedUser.id,
      toUserId: parseInt(reassignToUserId),
    });
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    updateUser.mutate({
      id: selectedUser.id,
      name: editForm.name || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      role: editForm.role,
      status: editForm.status,
      notes: editForm.notes || undefined,
      twilioPhone: editForm.twilioPhone || undefined,
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
    setTimeout(() => setInviteLinkCopied(false), 3000);
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <Badge className="bg-blue-600 text-white hover:bg-blue-700">
          <Shield className="h-3 w-3 mr-1" /> Admin
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <UserCheck className="h-3 w-3 mr-1" /> Agent
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-green-600 text-white hover:bg-green-700">Active</Badge>;
      case "Inactive":
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Inactive</Badge>;
      case "Suspended":
        return <Badge className="bg-red-600 text-white hover:bg-red-700">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage all users and their access levels
          </p>
        </div>
        <Button onClick={handleInviteClick}>
          <LinkIcon className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{allUsers.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-blue-600">{adminCount}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold text-slate-600">{agentCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            Manage all users — admins and agents — in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Twilio #</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {searchQuery || roleFilter !== "all" || statusFilter !== "all"
                      ? "No users match the current filters."
                      : "No users found. Invite users to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user: UserRow) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || "—"}
                      {user.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={user.notes}>
                          {user.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{user.email || "—"}</TableCell>
                    <TableCell className="text-sm">{user.phone || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {user.twilioPhone ? (
                        <span className="text-green-600" title="Twilio Caller ID">{user.twilioPhone}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.lastSignedIn).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(user)}
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReassignClick(user)}
                          title="Transfer properties to another user"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(user)}
                          title="Delete user"
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

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details, role, and status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="User name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm({ ...editForm, role: v as "agent" | "admin" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, status: v as "Active" | "Inactive" | "Suspended" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="twilioPhone">Twilio Phone Number</Label>
              <Input
                id="twilioPhone"
                type="tel"
                placeholder="+1XXXXXXXXXX (Twilio Caller ID)"
                value={editForm.twilioPhone}
                onChange={(e) => setEditForm({ ...editForm, twilioPhone: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The Twilio number used as Caller ID when this user makes calls. Must be a verified Twilio number.
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Internal notes about this user..."
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name || userToDelete?.email || "this user"}</strong>?
              This will remove all their property assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete User"}
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
              Transfer all properties from <strong>{selectedUser?.name || selectedUser?.email}</strong> to another user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="toUser">Transfer to</Label>
              <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u: UserRow) => u.id !== selectedUser?.id)
                    .map((user: UserRow) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name || user.email || `User ${user.id}`}
                        {" "}
                        <span className="text-muted-foreground">({user.role})</span>
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
              disabled={!reassignToUserId || reassignProperties.isPending}
            >
              {reassignProperties.isPending ? "Transferring..." : "Transfer Properties"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User to CRM</DialogTitle>
            <DialogDescription>
              Share this link with new users. When they visit the link and sign in,
              they'll automatically get access as an Agent. You can then change their role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={window.location.origin}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyInviteLink}>
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
                <li>Send it to the new user via WhatsApp, email, or SMS</li>
                <li>User clicks the link and signs in</li>
                <li>They automatically get access as <strong>Agent</strong></li>
                <li>You can change their role to <strong>Admin</strong> here</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
