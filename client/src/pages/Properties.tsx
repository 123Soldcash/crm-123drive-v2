import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MapPin, X, Save, FolderOpen, Users, CheckSquare, Plus } from "lucide-react";
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
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/_core/hooks/useAuth";
import { ColumnSelector, ColumnVisibility } from "@/components/ColumnSelector";
import { DeskDialog } from "@/components/DeskDialog";
import { AddressAutocomplete, type AddressDetails } from "@/components/AddressAutocomplete";

// Common status tags found in the data
const STATUS_TAGS = [
  "Off Market",
  "Cash Buyer",
  "Free And Clear",
  "High Equity",
  "Senior Owner",
  "Tired Landlord",
  "Absentee Owner",
  "Corporate Owner",
  "Empty Nester",
  "MLS Active",
  "Expired Listing",
  "Recently Sold",
  "Adjustable Loan",
  "Vacant Home",
  "Hoa Lien",
  "Likely To Move",
  "Out Of State Owner",
  "Tax Delinquent",
];

const MARKET_STATUS_OPTIONS = ["Off Market", "New Prospect", "Active", "Sold", "Fail", "With Marketing", "Marketing Complete", "Warm Lead"];

interface FilterState {
  search: string;
  ownerLocation: string;
  minEquity: number;
  marketStatus: string;
  statusTags: string[];
  leadTemperature: string;
  ownerVerified: boolean;
  visited: boolean;
  assignedAgentId: number | null;
  deskName: string;
}

const DESK_OPTIONS = ["BIN", "DESK_CHRIS", "DESK_1", "DESK_2", "DESK_3", "DESK_4", "DESK_5", "ARCHIVED"];

export default function Properties() {
  const { user } = useAuth();
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);
  const [filters, setFilters] = useState<FilterState>(() => {
    // Check URL parameters first
    const params = new URLSearchParams(window.location.search);
    return {
      search: "",
      ownerLocation: "",
      minEquity: 0,
      marketStatus: "",
      statusTags: [],
      leadTemperature: params.get('leadTemperature') || "",
      ownerVerified: params.get('ownerVerified') === 'true',
      visited: params.get('visited') === 'true',
      assignedAgentId: null,
      deskName: "",
    };
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  // Default columns that are always visible
  const DEFAULT_COLUMNS: ColumnVisibility = {
    leadId: true,
    address: true,
    ownerName: true,
    deskName: true,
    statusTags: false,
    market: false,
    ownerLocation: false,
    agents: false,
    value: false,
    equity: false,
  };

  // Load columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnVisibility>(() => {
    try {
      const saved = localStorage.getItem('propertyTableColumns');
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  // Save columns to localStorage whenever they change
  const handleColumnChange = (newColumns: ColumnVisibility) => {
    setColumns(newColumns);
    try {
      localStorage.setItem('propertyTableColumns', JSON.stringify(newColumns));
    } catch (e) {
      console.error('Failed to save column preferences:', e);
    }
  };
  const [deskDialogOpen, setDeskDialogOpen] = useState(false);
  const [selectedPropertyForDesk, setSelectedPropertyForDesk] = useState<any>(null);

  // Load filters from sessionStorage if navigated from dashboard widget
  useEffect(() => {
    const loadedFilters = sessionStorage.getItem('loadedSearchFilters');
    if (loadedFilters) {
      try {
        const parsed = JSON.parse(loadedFilters);
        setFilters(parsed);
        sessionStorage.removeItem('loadedSearchFilters');
        toast.success('Search loaded from dashboard');
      } catch (error) {
        console.error('Failed to load filters:', error);
      }
    }
  }, []);

  // Show toast when filters are loaded from URL
  useEffect(() => {
    if (filters.leadTemperature || filters.ownerVerified || filters.visited) {
      const filterNames = [];
      if (filters.leadTemperature) filterNames.push(filters.leadTemperature);
      if (filters.ownerVerified) filterNames.push('Owner Verified');
      if (filters.visited) filterNames.push('Property Visited');
      toast.success(`Filtered by: ${filterNames.join(', ')}`);
    }
  }, []);

  // Fetch properties with filters
  const { data: properties, isLoading } = trpc.properties.list.useQuery({
    search: filters.search || undefined,
    ownerLocation: (filters.ownerLocation && filters.ownerLocation !== "all" ? filters.ownerLocation : undefined),
    minEquity: filters.minEquity > 0 ? filters.minEquity : undefined,
    trackingStatus: filters.marketStatus || undefined,
    leadTemperature: (filters.leadTemperature && filters.leadTemperature !== "all" ? filters.leadTemperature as "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD" : undefined),
    ownerVerified: filters.ownerVerified || undefined,
    visited: filters.visited || undefined,
  });

  // Fetch status counts
  const { data: statusCounts = {} } = trpc.properties.statusCounts.useQuery();

  // Fetch saved searches
  const { data: savedSearches = [] } = trpc.savedSearches.list.useQuery();

  // Fetch agents for bulk reassignment
  const { data: agents = [] } = trpc.agents.listAll.useQuery();

  const utils = trpc.useUtils();

  // Bulk reassignment mutation
  const updateDesk = trpc.properties.updateDesk.useMutation({
    onSuccess: () => {
      utils.properties.list.invalidate();
      toast.success('Desk assignment updated');
      setDeskDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to update desk: ' + error.message);
    },
  });

  const bulkReassign = trpc.properties.bulkReassignProperties.useMutation({
    onSuccess: () => {
      utils.properties.list.invalidate();
      setSelectedProperties([]);
      toast.success(`Successfully reassigned ${selectedProperties.length} properties`);
    },
  });

  // Bulk delete mutation
  const bulkDelete = trpc.properties.bulkDeleteProperties.useMutation({
    onSuccess: (data) => {
      utils.properties.list.invalidate();
      setSelectedProperties([]);
      toast.success(`Successfully deleted ${data.count} properties`);
    },
    onError: (error) => {
      toast.error(`Failed to delete properties: ${error.message}`);
    },
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Mutations for saved searches
  const createSearch = trpc.savedSearches.create.useMutation({
    onSuccess: () => {
      utils.savedSearches.list.invalidate();
      toast.success("Search saved successfully");
      setSaveDialogOpen(false);
      setSearchName("");
    },
  });

  const deleteSearch = trpc.savedSearches.delete.useMutation({
    onSuccess: () => {
      utils.savedSearches.list.invalidate();
      toast.success("Search deleted");
    },
  });

  // Filter properties by status tags and agent on the client side
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    let filtered = properties;

    // Filter by agent (admin only)
    if (filters.assignedAgentId !== null) {
      if (filters.assignedAgentId === 0) {
        // Show unassigned properties
        filtered = filtered.filter((p) => !p.assignedAgentId);
      } else {
        // Show properties assigned to specific agent
        filtered = filtered.filter((p) => p.assignedAgentId === filters.assignedAgentId);
      }
    }

    // Filter by desk
    if (filters.deskName) {
      filtered = filtered.filter((p) => p.deskName === filters.deskName);
    }

    // Filter by status tags
    if (filters.statusTags.length > 0) {
      filtered = filtered.filter((property) => {
        if (!property.status) return false;
        const propertyTags = property.status.split(",").map((t) => t.trim());
        // Property must have ALL selected tags
        return filters.statusTags.every((tag) => propertyTags.includes(tag));
      });
    }

    return filtered;
  }, [properties, filters.statusTags, filters.assignedAgentId, filters.deskName]);

  // Store property IDs in localStorage for next/previous navigation
  useEffect(() => {
    if (filteredProperties && filteredProperties.length > 0) {
      const propertyIds = filteredProperties.map(p => p.id);
      localStorage.setItem('propertyNavigationIds', JSON.stringify(propertyIds));
    }
  }, [filteredProperties]);

  const toggleStatusTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      statusTags: prev.statusTags.includes(tag)
        ? prev.statusTags.filter((t) => t !== tag)
        : [...prev.statusTags, tag],
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      search: "",
      ownerLocation: "",
      minEquity: 0,
      marketStatus: "",
      statusTags: [],
      leadTemperature: "",
      ownerVerified: false,
      visited: false,
      assignedAgentId: null,
      deskName: "",
    });
  };

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.ownerLocation ? 1 : 0) +
    (filters.minEquity > 0 ? 1 : 0) +
    (filters.marketStatus ? 1 : 0) +
    (filters.deskName ? 1 : 0) +
    filters.statusTags.length;

  const handleSaveSearch = () => {
    if (!searchName.trim()) {
      toast.error("Please enter a name for this search");
      return;
    }

    createSearch.mutate({
      name: searchName,
      filters: JSON.stringify(filters),
    });
  };

  const handleLoadSearch = (filtersJson: string) => {
    try {
      const loadedFilters = JSON.parse(filtersJson);
      setFilters(loadedFilters);
      setLoadDialogOpen(false);
      toast.success("Search loaded");
    } catch (error) {
      toast.error("Failed to load search");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Properties</h1>
          <p className="text-muted-foreground">
            Browse and filter your property leads ({filteredProperties?.length || 0} properties)
          </p>
        </div>
        <div className="flex gap-2">
          <AddPropertyDialog />
          <Link href="/map">
            <Button variant="outline">
              <MapPin className="mr-2 h-4 w-4" />
              Map View
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Filters</CardTitle>
            <div className="flex gap-2">
              {/* Save Search Button */}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Save Search
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Current Search</DialogTitle>
                    <DialogDescription>
                      Give this filter combination a name so you can quickly load it later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="search-name">Search Name</Label>
                      <Input
                        id="search-name"
                        placeholder="e.g., High Equity Absentee Owners"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSearch} disabled={createSearch.isPending}>
                      {createSearch.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Column Selector */}
              <ColumnSelector columns={columns} onColumnChange={handleColumnChange} />

              {/* Load Saved Search Button */}
              <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Load Search
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Load Saved Search</DialogTitle>
                    <DialogDescription>
                      Select a previously saved search to load its filters.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {savedSearches.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No saved searches yet. Save your current filters to get started.
                      </p>
                    ) : (
                      savedSearches.map((search) => (
                        <div
                          key={search.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{search.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(search.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLoadSearch(search.filters)}
                            >
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteSearch.mutate({ id: search.id })}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear All ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search address, city, state, owner, phone, email..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.ownerLocation}
              onValueChange={(value) => setFilters({ ...filters, ownerLocation: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Owner Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="Owner Occupied">Owner Occupied</SelectItem>
                <SelectItem value="Absentee Owner">Absentee Owner</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.minEquity.toString()}
              onValueChange={(value) => setFilters({ ...filters, minEquity: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Min Equity %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any Equity</SelectItem>
                <SelectItem value="50">50%+</SelectItem>
                <SelectItem value="75">75%+</SelectItem>
                <SelectItem value="90">90%+</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.marketStatus}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, marketStatus: value }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Market Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {MARKET_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.deskName}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, deskName: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Desk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Desks</SelectItem>
                {DESK_OPTIONS.map((desk) => {
                  const deskEmoji = 
                    desk === "BIN" ? "🗑️" :
                    desk === "DESK_CHRIS" ? "🏀" :
                    desk === "DESK_1" ? "🟡" :
                    desk === "DESK_2" ? "🟢" :
                    desk === "DESK_3" ? "🔵" :
                    desk === "DESK_4" ? "🩷" :
                    desk === "DESK_5" ? "🟠" :
                    desk === "ARCHIVED" ? "✅" : "";
                  return (
                    <SelectItem key={desk} value={desk}>
                      {deskEmoji} {desk}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select
              value={filters.leadTemperature}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, leadTemperature: value }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Lead Temperature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Temperatures</SelectItem>
                <SelectItem value="SUPER HOT">🔥🔥 SUPER HOT</SelectItem>
                <SelectItem value="HOT">🔥 HOT</SelectItem>
                <SelectItem value="DEEP_SEARCH">🔍 DEEP SEARCH</SelectItem>
                <SelectItem value="WARM">🌡️ WARM</SelectItem>
                <SelectItem value="COLD">❄️ COLD</SelectItem>
                <SelectItem value="DEAD">☠️ DEAD</SelectItem>
              </SelectContent>
            </Select>

            {/* Agent Filter (Admin Only) */}
            {user?.role === 'admin' && (
              <Select
                value={filters.assignedAgentId?.toString() || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    assignedAgentId: value === "all" ? null : parseInt(value),
                  }))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Filter by Property Status Tags</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_TAGS.map((tag) => {
                const count = statusCounts[tag] || 0;
                const isActive = filters.statusTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isActive ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80"
                    onClick={() => toggleStatusTag(tag)}
                  >
                    {tag} ({count})
                    {isActive && <X className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>
            {filters.statusTags.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Showing properties with: {filters.statusTags.join(", ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {user?.role === 'admin' && selectedProperties.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">
                    {selectedProperties.length} {selectedProperties.length === 1 ? 'property' : 'properties'} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Reassign to:</span>
                  <Select
                    onValueChange={(value) => {
                      bulkReassign.mutate({
                        propertyIds: selectedProperties,
                        assignedAgentId: value === "unassigned" ? null : Number(value),
                      });
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        <span className="text-muted-foreground">Unassigned</span>
                      </SelectItem>
                      {agents.map((agent: { id: number; name: string | null; agentType?: string }) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name || agent.openId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Delete Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProperties([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property List */}
      <Card>
        <CardHeader>
          <CardTitle>Property List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading properties...</div>
          ) : (filteredProperties?.length || 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No properties match your filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {user?.role === 'admin' && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProperties.length === (filteredProperties?.length || 0) && (filteredProperties?.length || 0) > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProperties(filteredProperties?.map(p => p.id) || []);
                          } else {
                            setSelectedProperties([]);
                          }
                        }}
                      />
                    </TableHead>
                  )}
                  {columns.leadId && <TableHead className="w-16">Lead ID</TableHead>}
                  {columns.address && <TableHead>Address</TableHead>}
                  {columns.ownerName && <TableHead>Owner Name</TableHead>}
                  {columns.deskName && <TableHead>Desk</TableHead>}
                  {columns.statusTags && <TableHead>Status Tags</TableHead>}
                  {columns.market && <TableHead>Market</TableHead>}
                  {columns.ownerLocation && <TableHead>Owner Location</TableHead>}
                  {columns.agents && <TableHead>Agents</TableHead>}
                  {columns.value && <TableHead className="text-right">Value</TableHead>}
                  {columns.equity && <TableHead className="text-right">Equity %</TableHead>}
                  <TableHead className="w-32">Entry Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties?.map((property) => (
                  <TableRow 
                    key={property.id}
                    className={property.ownerVerified === 1 ? "bg-blue-50 hover:bg-blue-100" : ""}
                  >
                  {user?.role === 'admin' && (
                    <TableCell>
                      <Checkbox
                        checked={selectedProperties.includes(property.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProperties([...selectedProperties, property.id]);
                          } else {
                            setSelectedProperties(selectedProperties.filter(id => id !== property.id));
                          }
                        }}
                      />
                    </TableCell>
                  )}
                  {columns.leadId && (
                    <TableCell className="font-mono text-xs">
                      #{property.id}
                    </TableCell>
                  )}
                  {columns.address && (
                    <TableCell>
                    <Link href={`/properties/${property.id}`}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium hover:underline cursor-pointer">
                          {property.addressLine1}
                        </div>
                        <Badge
                          className="bg-blue-600 hover:bg-blue-700 text-white border-0 font-bold px-3 py-1 text-sm"
                        >
                          {property.leadTemperature === "SUPER HOT"
                            ? "🔥🔥"
                            : property.leadTemperature === "HOT"
                            ? "🔥"
                            : property.leadTemperature === "WARM"
                            ? "🌡️"
                            : property.leadTemperature === "DEAD"
                            ? "☠️"
                            : "❄️"}
                          {property.leadTemperature || "COLD"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {property.city}, {property.state}
                      </div>
                    </Link>
                    </TableCell>
                  )}
                  {columns.ownerName && (
                    <TableCell>
                      {property.owner1Name || property.owner2Name || "Unknown"}
                    </TableCell>
                  )}
                  {columns.deskName && (
                    <TableCell>
                      <button
                        onClick={() => {
                          setSelectedPropertyForDesk(property);
                          setDeskDialogOpen(true);
                        }}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 cursor-pointer transition"
                      >
                        {property.deskName || "🗑️ BIN"}
                      </button>
                    </TableCell>
                  )}
                  {columns.statusTags && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {property.status?.split(", ").slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {property.status && property.status.split(",").length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{property.status.split(",").length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {columns.market && (
                    <TableCell>
                      <Badge
                        variant={
                          property.marketStatus === "Off Market"
                            ? "default"
                            : property.marketStatus === "Active"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {property.marketStatus}
                      </Badge>
                    </TableCell>
                  )}
                  {columns.ownerLocation && (
                    <TableCell>{property.ownerLocation || "Unknown"}</TableCell>
                  )}
                  {columns.agents && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {property.agents && property.agents.length > 0 ? (
                          property.agents.map((agent: { agentId: number; agentName: string | null }, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {agent.agentName || `Agent ${agent.agentId}`}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {columns.value && (
                    <TableCell className="text-right">
                      ${property.estimatedValue?.toLocaleString() || "N/A"}
                    </TableCell>
                  )}
                  {columns.equity && (
                    <TableCell className="text-right">
                      {property.equityPercent ? `${property.equityPercent.toFixed(2)}%` : "N/A"}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {property.createdAt ? new Date(property.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'N/A'}
                  </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Property Dialog is rendered from the AddPropertyDialog component */}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Properties</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedProperties.length} {selectedProperties.length === 1 ? 'property' : 'properties'}?
              This action cannot be undone. All related data (visits, photos, notes, contacts) will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                bulkDelete.mutate({ propertyIds: selectedProperties });
                setDeleteConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desk Dialog */}
      {selectedPropertyForDesk && (
        <DeskDialog
          open={deskDialogOpen}
          onOpenChange={setDeskDialogOpen}
          propertyId={selectedPropertyForDesk.id}
          currentDeskName={selectedPropertyForDesk.deskName}
          currentDeskStatus={selectedPropertyForDesk.deskStatus}
          onSave={(deskName, deskStatus) => {
            updateDesk.mutate({
              propertyId: selectedPropertyForDesk.id,
              deskName,
              deskStatus,
            });
            setDeskDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Add Property Dialog Component
function AddPropertyDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    addressLine1: "",
    city: "",
    state: "",
    zipcode: "",
    owner1Name: "",
    leadTemperature: "TBD" as "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD" | "TBD",
  });

  const utils = trpc.useUtils();
  const createProperty = trpc.properties.create.useMutation({
    onSuccess: (data) => {
      toast.success("Property created successfully!");
      utils.properties.list.invalidate();
      utils.properties.stats.invalidate();
      setOpen(false);
      setFormData({
        addressLine1: "",
        city: "",
        state: "",
        zipcode: "",
        owner1Name: "",
        leadTemperature: "TBD",
      });
    },
    onError: (error) => {
      toast.error("Failed to create property: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.addressLine1.trim()) {
      toast.error("Address is required");
      return;
    }
    createProperty.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Enter the property details to add a new lead to your CRM.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <AddressAutocomplete
              value={formData.addressLine1}
              onChange={(address: string) => {
                setFormData({
                  ...formData,
                  addressLine1: address,
                });
              }}
              onAddressSelect={(details: AddressDetails) => {
                setFormData({
                  ...formData,
                  addressLine1: details.address,
                  city: details.city,
                  state: details.state,
                  zipcode: details.zipCode,
                });
              }}
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Miami"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="FL"
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zipcode">Zipcode</Label>
              <Input
                id="zipcode"
                placeholder="33101"
                value={formData.zipcode}
                onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadTemperature">Lead Temperature</Label>
              <Select
                value={formData.leadTemperature}
                onValueChange={(value) => setFormData({ ...formData, leadTemperature: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER HOT">🔥 Super Hot</SelectItem>
                  <SelectItem value="HOT">🔴 Hot</SelectItem>
                  <SelectItem value="DEEP_SEARCH">🔍 Deep Search</SelectItem>
                  <SelectItem value="WARM">🟠 Warm</SelectItem>
                  <SelectItem value="COLD">🔵 Cold</SelectItem>
                  <SelectItem value="DEAD">⚫ Dead</SelectItem>
                  <SelectItem value="TBD">⚪ TBD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner1Name">Owner Name</Label>
            <Input
              id="owner1Name"
              placeholder="John Doe"
              value={formData.owner1Name}
              onChange={(e) => setFormData({ ...formData, owner1Name: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProperty.isPending}>
              {createProperty.isPending ? "Creating..." : "Add Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
