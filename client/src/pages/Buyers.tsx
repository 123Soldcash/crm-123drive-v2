import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, User, Mail, Phone, Building, Tag, MoreHorizontal, Trash2, Edit, ExternalLink } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Buyers() {
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBuyer, setNewBuyer] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "Active" as "Active" | "Inactive" | "Verified" | "Blacklisted",
  });

  const utils = trpc.useUtils();

  // Fetch buyers
  const { data: buyers, isLoading } = trpc.buyers.list.useQuery({ search });

  // Create buyer mutation
  const createBuyer = trpc.buyers.create.useMutation({
    onSuccess: () => {
      utils.buyers.list.invalidate();
      toast.success("Buyer added successfully");
      setIsAddDialogOpen(false);
      setNewBuyer({ name: "", email: "", phone: "", company: "", status: "Active" });
    },
    onError: (error) => {
      toast.error("Failed to add buyer: " + error.message);
    },
  });

  // Delete buyer mutation
  const deleteBuyer = trpc.buyers.delete.useMutation({
    onSuccess: () => {
      utils.buyers.list.invalidate();
      toast.success("Buyer deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete buyer: " + error.message);
    },
  });

  const handleAddBuyer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyer.name || !newBuyer.email) {
      toast.error("Name and Email are required");
      return;
    }
    createBuyer.mutate(newBuyer);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Verified":
        return <Badge className="bg-green-500">Verified</Badge>;
      case "Active":
        return <Badge className="bg-blue-500">Active</Badge>;
      case "Inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "Blacklisted":
        return <Badge variant="destructive">Blacklisted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash Buyers</h1>
          <p className="text-muted-foreground">Manage your list of potential buyers and their preferences.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="mr-2 h-4 w-4" /> Add Buyer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddBuyer}>
              <DialogHeader>
                <DialogTitle>Add New Cash Buyer</DialogTitle>
                <DialogDescription>
                  Enter the basic information for the new buyer. You can add detailed preferences later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={newBuyer.name}
                    onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newBuyer.email}
                    onChange={(e) => setNewBuyer({ ...newBuyer, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={newBuyer.phone}
                    onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })}
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={newBuyer.company}
                    onChange={(e) => setNewBuyer({ ...newBuyer, company: e.target.value })}
                    placeholder="ABC Investments"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newBuyer.status}
                    onValueChange={(value: any) => setNewBuyer({ ...newBuyer, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Verified">Verified</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Blacklisted">Blacklisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createBuyer.isPending} className="bg-purple-600 hover:bg-purple-700">
                  {createBuyer.isPending ? "Adding..." : "Add Buyer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buyers by name, email, company..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading buyers...
                    </TableCell>
                  </TableRow>
                ) : buyers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No buyers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  buyers?.map((buyer) => (
                    <TableRow key={buyer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                            <User className="h-4 w-4" />
                          </div>
                          {buyer.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Mail className="mr-1 h-3 w-3" /> {buyer.email}
                          </div>
                          {buyer.phone && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Phone className="mr-1 h-3 w-3" /> {buyer.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {buyer.company ? (
                          <div className="flex items-center text-sm">
                            <Building className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            {buyer.company}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(buyer.status || "Active")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => window.location.href = `/buyers/${buyer.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" /> Edit Info
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this buyer?")) {
                                  deleteBuyer.mutate({ id: buyer.id });
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Buyer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
