import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, User, Phone, Mail, Users } from "lucide-react";

type AgentRole = "Birddog" | "Acquisition Manager" | "Disposition Manager" | "Admin" | "Other";
type AgentStatus = "Active" | "Inactive";
type AgentType = "Internal" | "External" | "Birddog" | "Corretor";

interface AgentFormData {
  name: string;
  email: string;
  phone: string;
  role: AgentRole;
  status: AgentStatus;
  agentType: AgentType;
  notes: string;
}

const initialFormData: AgentFormData = {
  name: "",
  email: "",
  phone: "",
  role: "Birddog",
  status: "Active",
  agentType: "Internal",
  notes: "",
};

export default function AgentManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [filterType, setFilterType] = useState<"all" | "internal" | "external">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const utils = trpc.useUtils();
  const { data: agents, isLoading } = trpc.agents.list.useQuery();

  const createAgent = trpc.agents.create.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      setIsAddDialogOpen(false);
      setFormData(initialFormData);
      toast.success("Agent added successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to add agent: ${error.message}`);
    },
  });

  const updateAgent = trpc.agents.update.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      setIsEditDialogOpen(false);
      setFormData(initialFormData);
      setSelectedAgentId(null);
      toast.success("Agent updated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to update agent: ${error.message}`);
    },
  });

  const deleteAgent = trpc.agents.delete.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      setIsDeleteDialogOpen(false);
      setSelectedAgentId(null);
      toast.success("Agent deleted successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to delete agent: ${error.message}`);
    },
  });

  const handleAddAgent = () => {
    if (!formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    createAgent.mutate({
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      role: formData.role,
      status: formData.status,
      agentType: formData.agentType,
      notes: formData.notes || null,
    });
  };

  const handleEditAgent = () => {
    if (!selectedAgentId || !formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    updateAgent.mutate({
      id: selectedAgentId,
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      role: formData.role,
      status: formData.status,
      agentType: formData.agentType,
      notes: formData.notes || undefined,
    });
  };

  const handleDeleteAgent = () => {
    if (!selectedAgentId) return;
    deleteAgent.mutate({ id: selectedAgentId });
  };

  const openEditDialog = (agent: any) => {
    setSelectedAgentId(agent.id);
    setFormData({
      name: agent.name || "",
      email: agent.email || "",
      phone: agent.phone || "",
      role: agent.role || "Birddog",
      status: agent.status || "Active",
      agentType: agent.agentType || "Internal",
      notes: agent.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (agentId: number) => {
    setSelectedAgentId(agentId);
    setIsDeleteDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-purple-100 text-purple-800";
      case "Acquisition Manager":
        return "bg-blue-100 text-blue-800";
      case "Disposition Manager":
        return "bg-green-100 text-green-800";
      case "Birddog":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === "Active"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";
  };

  const getAgentTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Internal":
        return "bg-blue-100 text-blue-800";
      case "External":
        return "bg-amber-100 text-amber-800";
      case "Birddog":
        return "bg-orange-100 text-orange-800";
      case "Corretor":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredAgents = agents?.filter((agent: any) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === "all" ||
      (filterType === "internal" && agent.agentType === "Internal") ||
      (filterType === "external" && ["External", "Birddog", "Corretor"].includes(agent.agentType));

    return matchesSearch && matchesType;
  }) || [];

  const AgentForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter agent name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="agent@example.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="agentType">Agent Type</Label>
          <Select
            value={formData.agentType}
            onValueChange={(value: AgentType) => setFormData({ ...formData, agentType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Internal">Internal</SelectItem>
              <SelectItem value="External">External</SelectItem>
              <SelectItem value="Birddog">Birddog</SelectItem>
              <SelectItem value="Corretor">Corretor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role">Role</Label>
          <Select
            value={formData.role}
            onValueChange={(value: AgentRole) => setFormData({ ...formData, role: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Birddog">Birddog</SelectItem>
              <SelectItem value="Acquisition Manager">Acquisition Manager</SelectItem>
              <SelectItem value="Disposition Manager">Disposition Manager</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value: AgentStatus) => setFormData({ ...formData, status: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about this agent..."
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Agent Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your team of birddogs and agents
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(initialFormData)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Agent</DialogTitle>
                <DialogDescription>
                  Add a new agent or birddog to your team.
                </DialogDescription>
              </DialogHeader>
              <AgentForm onSubmit={handleAddAgent} submitLabel="Add Agent" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAgent} disabled={createAgent.isPending}>
                  {createAgent.isPending ? "Adding..." : "Add Agent"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <Input
            placeholder='Search agents... (use "@" to mention)'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.startsWith("@") ? e.target.value.slice(1) : e.target.value)}
            className="flex-1"
          />
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="internal">Internal Only</SelectItem>
              <SelectItem value="external">External Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold">{agents?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {agents?.filter((a: any) => a.status === "Active").length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <User className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Birddogs</p>
                <p className="text-2xl font-bold">
                  {agents?.filter((a: any) => a.role === "Birddog").length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Managers</p>
                <p className="text-2xl font-bold">
                  {agents?.filter((a: any) => 
                    a.role === "Acquisition Manager" || a.role === "Disposition Manager"
                  ).length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Agents Table */}
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading agents...
                  </TableCell>
                </TableRow>
              ) : filteredAgents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No agents yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(initialFormData);
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add your first agent
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents?.map((agent: any) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{agent.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {agent.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {agent.email}
                          </div>
                        )}
                        {agent.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {agent.phone}
                          </div>
                        )}
                        {!agent.email && !agent.phone && (
                          <span className="text-sm text-muted-foreground">No contact info</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(agent.role)}>
                        {agent.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getAgentTypeBadgeColor(agent.agentType)}>
                        {agent.agentType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(agent.status)}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {agent.notes || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(agent)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(agent.id)}
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
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Update agent information.
              </DialogDescription>
            </DialogHeader>
            <AgentForm onSubmit={handleEditAgent} submitLabel="Save Changes" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditAgent} disabled={updateAgent.isPending}>
                {updateAgent.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete Agent</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this agent? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAgent}
                disabled={deleteAgent.isPending}
              >
                {deleteAgent.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
