import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
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
import { Search, MapPin, X, Save, FolderOpen, Users, CheckSquare, Plus, Workflow, Phone, Mail } from "lucide-react";
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
import { ColumnSelector, ColumnVisibility, SortOption } from "@/components/ColumnSelector";
import { DeskDialog } from "@/components/DeskDialog";
import { AddressAutocompleteWithCRM, type AddressDetails } from "@/components/AddressAutocompleteWithCRM";
import { DuplicateDetectionAlert } from "@/components/DuplicateDetectionAlert";
import { STAGE_CONFIGS, type DealStage } from "@/lib/stageConfig";

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
  dealStage: string;
  tag: string;
  leadSource: string;
  campaignName: string;
}

// Hardcoded fallback desk labels & colors (used before DB loads)
const FALLBACK_DESK_LABELS: Record<string, string> = {
  NEW_LEAD: "🆕 New Lead",
  NOT_ASSIGNED: "⚪ Not Assigned",
  DESK_CHRIS: "🏀 Chris",
  DESK_DEEP_SEARCH: "🔍 Deep Search",
  DESK_1: "🟦 Manager",
  DESK_2: "🟩 Edsel",
  DESK_3: "🟧 Zach",
  DESK_4: "🔵 Rodolfo",
  DESK_5: "🟨 Lucas",
  BIN: "🗑️ BIN",
  ARCHIVED: "⬛ Archived",
};
const FALLBACK_DESK_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-green-200 text-green-800",
  NOT_ASSIGNED: "bg-gray-100 text-gray-500",
  DESK_CHRIS: "bg-orange-200 text-orange-800",
  DESK_DEEP_SEARCH: "bg-purple-200 text-purple-800",
  DESK_1: "bg-sky-200 text-sky-800",
  DESK_2: "bg-emerald-200 text-emerald-800",
  DESK_3: "bg-pink-200 text-pink-800",
  DESK_4: "bg-blue-600 text-white",
  DESK_5: "bg-amber-200 text-amber-800",
  BIN: "bg-gray-200 text-gray-700",
  ARCHIVED: "bg-gray-800 text-white",
};
const getDeskLabel = (desk: string) => FALLBACK_DESK_LABELS[desk] || desk;
const getDeskColor = (desk: string | null | undefined) => FALLBACK_DESK_COLORS[desk || ""] || "bg-gray-200 text-gray-700";

export default function Properties() {
  const { user } = useAuth();
  // Fetch desks dynamically from DB
  const { data: desksFromDb } = trpc.desks.list.useQuery(undefined, { staleTime: 30_000 });
  const deskOptions = useMemo(() => {
    if (!desksFromDb || desksFromDb.length === 0) return Object.keys(FALLBACK_DESK_LABELS);
    return desksFromDb.map((d: any) => d.name as string);
  }, [desksFromDb]);
  const [, setLocationNav] = useLocation();
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
      deskName: params.get('desk') || "",
      dealStage: "",
      tag: params.get('tag') || "",
      leadSource: "",
      campaignName: "",
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
    entryDate: true,
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
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try {
      const saved = localStorage.getItem('propertySortBy');
      return (saved as SortOption) || "newest";
    } catch {
      return "newest";
    }
  });

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    try {
      localStorage.setItem('propertySortBy', sort);
    } catch (e) {
      console.error('Failed to save sort preference:', e);
    }
  };

  const [deskDialogOpen, setDeskDialogOpen] = useState(false);
  const [selectedPropertyForDesk, setSelectedPropertyForDesk] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

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

  // Fetch properties with filters + server-side pagination
  const { data: queryResult, isLoading } = trpc.properties.list.useQuery({
    search: filters.search || undefined,
    ownerLocation: (filters.ownerLocation && filters.ownerLocation !== "all" ? filters.ownerLocation : undefined),
    minEquity: filters.minEquity > 0 ? filters.minEquity : undefined,
    trackingStatus: filters.marketStatus || undefined,
    leadTemperature: (filters.leadTemperature && filters.leadTemperature !== "all" ? filters.leadTemperature as "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD" : undefined),
    ownerVerified: filters.ownerVerified || undefined,
    visited: filters.visited || undefined,
    tag: (filters.tag && filters.tag !== "all" ? filters.tag : undefined),
    leadSource: (filters.leadSource && filters.leadSource !== "all" ? filters.leadSource : undefined),
    campaignName: (filters.campaignName && filters.campaignName !== "all" ? filters.campaignName : undefined),
    // Server-side filters (moved from client)
    assignedAgentId: filters.assignedAgentId !== null ? filters.assignedAgentId : undefined,
    deskName: (filters.deskName && filters.deskName !== "all" ? filters.deskName : undefined),
    dealStage: (filters.dealStage && filters.dealStage !== "all" ? filters.dealStage : undefined),
    // Pagination
    page: currentPage,
    pageSize: PAGE_SIZE,
  });
  const properties = (queryResult as any)?.data as any[] | undefined;
  const totalCount = (queryResult as any)?.totalCount as number ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Fetch status counts
  const { data: statusCounts = {} } = trpc.properties.statusCounts.useQuery();

  // Fetch all unique tags for filter dropdown
  const { data: allTags = [] } = trpc.properties.getAllTags.useQuery();

  // Fetch lead sources for filter dropdown
  const { data: allLeadSources = [] } = trpc.leadSource.list.useQuery();

  // Fetch campaign names for filter dropdown
  const { data: allCampaignNames = [] } = trpc.campaignName.list.useQuery();

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

  // Bulk stage update mutation
  const bulkUpdateStagesMutation = trpc.properties.bulkUpdateStages.useMutation({
    onSuccess: () => {
      utils.properties.list.invalidate();
      utils.properties.getPropertiesByStage.invalidate();
      setSelectedProperties([]);
      toast.success(`Successfully moved ${selectedProperties.length} ${selectedProperties.length === 1 ? 'property' : 'properties'} to Pipeline stage`);
    },
    onError: (error) => {
      toast.error(`Failed to update stages: ${error.message}`);
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

  // Helper: extract property flags from dealMachineRawData
  const getPropertyFlags = (property: any): string[] => {
    if (!property.dealMachineRawData) return [];
    try {
      const rawData = JSON.parse(property.dealMachineRawData);
      if (rawData.property_flags) {
        return rawData.property_flags
          .split(',')
          .map((flag: string) => flag.trim())
          .filter((flag: string) => flag.length > 0);
      }
    } catch (e) {
      // Ignore parse errors
    }
    return [];
  };

  // Filter properties by status tags on the client side (other filters are server-side)
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    let filtered = properties;

    // Filter by property flags (parsed from dealMachineRawData) — still client-side
    if (filters.statusTags.length > 0) {
      filtered = filtered.filter((property) => {
        const flags = getPropertyFlags(property);
        if (flags.length === 0) return false;
        // Property must have ALL selected tags
        return filters.statusTags.every((tag) => flags.includes(tag));
      });
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case "oldest":
        sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case "value_desc":
        sorted.sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0));
        break;
      case "address_asc":
        sorted.sort((a, b) => (a.addressLine1 || "").localeCompare(b.addressLine1 || ""));
        break;
    }

    return sorted;
  }, [properties, filters.statusTags, sortBy]);

  // Store property IDs in localStorage for next/previous navigation
  useEffect(() => {
    if (filteredProperties && filteredProperties.length > 0) {
      const propertyIds = filteredProperties.map(p => p.id);
      localStorage.setItem('propertyNavigationIds', JSON.stringify(propertyIds));
    }
  }, [filteredProperties]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.ownerLocation, filters.minEquity, filters.marketStatus, filters.leadTemperature, filters.ownerVerified, filters.visited, filters.tag, filters.leadSource, filters.campaignName, filters.assignedAgentId, filters.deskName, filters.dealStage]);

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
      dealStage: "",
      tag: "",
      leadSource: "",
      campaignName: "",
    });
  };

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.ownerLocation ? 1 : 0) +
    (filters.minEquity > 0 ? 1 : 0) +
    (filters.marketStatus ? 1 : 0) +
    (filters.deskName ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.leadSource ? 1 : 0) +
    (filters.campaignName ? 1 : 0) +
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold">Properties</h1>
          <p className="text-muted-foreground">
            Browse and filter your property leads ({totalCount.toLocaleString()} properties)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddPropertyDialog />
          <Link href="/map">
            <Button variant="outline">
              <MapPin className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Map View</span>
              <span className="sm:hidden">Map</span>
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle>Filters</CardTitle>
            <div className="flex flex-wrap gap-2">
              {/* Save Search Button */}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Save Search</span>
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
              <ColumnSelector columns={columns} onColumnChange={handleColumnChange} sortBy={sortBy} onSortChange={handleSortChange} />

              {/* Load Saved Search Button */}
              <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Load Search</span>
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
                  <X className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Clear All ({activeFilterCount})</span>
                  <span className="sm:hidden">({activeFilterCount})</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                setFilters((prev) => ({ ...prev, marketStatus: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger className="w-full">
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
                setFilters((prev) => ({ ...prev, deskName: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Desk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Desks</SelectItem>
                {deskOptions.map((desk: string) => (
                  <SelectItem key={desk} value={desk}>
                    {getDeskLabel(desk)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.leadTemperature}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, leadTemperature: value }))
              }
            >
              <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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

            {/* Pipeline Stage Filter */}
            <Select
              value={filters.dealStage || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  dealStage: value === "all" ? "" : value,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pipeline Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {STAGE_CONFIGS.filter(s => s.isPipeline).map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <span className="flex items-center gap-2">
                      <span>{stage.icon}</span>
                      <span>{stage.shortLabel}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag Filter */}
            <Select
              value={filters.tag || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, tag: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map((t: any) => (
                  <SelectItem key={t.tag} value={t.tag}>
                    {t.tag} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Lead Source Filter */}
            <Select
              value={filters.leadSource || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, leadSource: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Lead Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lead Sources</SelectItem>
                {allLeadSources.map((s: any) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Campaign Name Filter */}
            <Select
              value={filters.campaignName || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, campaignName: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Campaign Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {allCampaignNames.map((c: any) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      {agents.map((agent: { id: number; name: string | null; role?: string }) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name || `Agent #${agent.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Move to:</span>
                  <Select
                    onValueChange={(value) => {
                      bulkUpdateStagesMutation.mutate({
                        propertyIds: selectedProperties,
                        newStage: value,
                        notes: `Bulk moved to ${STAGE_CONFIGS.find(s => s.id === value)?.label}`,
                      });
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_CONFIGS.filter(s => s.isPipeline).map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <span className="flex items-center gap-2">
                            <span>{stage.icon}</span>
                            <span>{stage.shortLabel}</span>
                          </span>
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
          <CardTitle className="text-lg md:text-xl">Property List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading properties...</div>
          ) : (filteredProperties?.length || 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No properties match your filters
            </div>
          ) : (
            <>
            {/* ── MOBILE CARDS (hidden on md+) ── */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredProperties?.map((property) => {
                const stageConfig = property.dealStage ? STAGE_CONFIGS.find((s) => s.id === property.dealStage) : null;
                const tempEmoji = property.leadTemperature === "SUPER HOT" ? "🔥🔥" : property.leadTemperature === "HOT" ? "🔥" : property.leadTemperature === "WARM" ? "🌡️" : property.leadTemperature === "DEAD" ? "☠️" : "❄️";
                return (
                  <Link key={property.id} href={`/properties/${property.id}`}>
                    <div className={`rounded-xl border p-4 cursor-pointer active:scale-[0.99] transition-all shadow-sm hover:shadow-md ${
                      property.ownerVerified === 1 ? "bg-blue-50 border-blue-200" : "bg-card border-border"
                    }`}>
                      {/* Row 1: Address + Temp badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-semibold text-base leading-tight truncate max-w-full">{property.addressLine1}</div>
                          <div className="text-sm text-muted-foreground mt-0.5 truncate">{property.city}, {property.state}</div>
                        </div>
                        <Badge className="bg-blue-600 text-white border-0 font-bold px-2 py-1 text-xs shrink-0 whitespace-nowrap">
                          {tempEmoji} {property.leadTemperature || "COLD"}
                        </Badge>
                      </div>

                      {/* Row 2: Stage + Desk */}
                      {(stageConfig || property.deskName) && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {stageConfig && (
                            <Badge className={`${stageConfig.bgColor} ${stageConfig.color} border-0 text-xs px-2 py-0.5`}>
                              {stageConfig.icon} {stageConfig.shortLabel}
                            </Badge>
                          )}
                          {property.deskName && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDeskColor(property.deskName)}`}>
                              {getDeskLabel(property.deskName)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Row 3: Key stats grid */}
                      <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                        <div className="min-w-0 overflow-hidden">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Owner</div>
                          <div className="font-medium truncate text-sm">{property.owner1Name || property.owner2Name || "Unknown"}</div>
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Value</div>
                          <div className="font-medium truncate text-sm">${property.estimatedValue?.toLocaleString() || "N/A"}</div>
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Equity</div>
                          <div className="font-medium text-sm">{property.equityPercent ? `${property.equityPercent.toFixed(0)}%` : "N/A"}</div>
                        </div>
                      </div>

                      {/* Row 4: Status tags + date */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                          {property.status?.split(", ").slice(0, 2).map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0 truncate max-w-[120px]">{tag}</Badge>
                          ))}
                          {getPropertyFlags(property).slice(0, 1).map((flag: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300 truncate max-w-[120px]">{flag}</Badge>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                          {property.createdAt ? new Date(property.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ── DESKTOP TABLE (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto">
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
                  {columns.entryDate && <TableHead className="w-32">Entry Date</TableHead>}
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
                      
                      {/* Deal Stage Badge */}
                      {property.dealStage && (() => {
                        const stageConfig = STAGE_CONFIGS.find((s) => s.id === property.dealStage);
                        if (stageConfig) {
                          return (
                            <div className="mt-2">
                              <Badge
                                className={`${stageConfig.bgColor} ${stageConfig.color} border-0 font-semibold px-2 py-1 text-xs flex items-center gap-1 w-fit`}
                              >
                                <Workflow className="w-3 h-3" />
                                <span>{stageConfig.icon}</span>
                                <span>{stageConfig.shortLabel}</span>
                              </Badge>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Property Flags from DealMachine */}
                      {(() => {
                        const flags = getPropertyFlags(property);
                        if (flags.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {flags.slice(0, 3).map((flag: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-300">
                                {flag}
                              </Badge>
                            ))}
                            {flags.length > 3 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600">
                                +{flags.length - 3}
                              </Badge>
                            )}
                          </div>
                        );
                      })()}
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
                        className={`text-xs px-2 py-1 rounded hover:opacity-80 cursor-pointer transition ${getDeskColor(property.deskName)}`}
                      >
                        {getDeskLabel(property.deskName || 'NOT_ASSIGNED')}
                      </button>
                    </TableCell>
                  )}
                  {columns.statusTags && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {property.status?.split(", ").slice(0, 3).map((tag: string, i: number) => (
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
                  {columns.entryDate && (
                  <TableCell className="text-sm text-muted-foreground">
                    {property.createdAt ? new Date(property.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'N/A'}
                  </TableCell>
                  )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}

          {/* Pagination controls */}
          {!isLoading && filteredProperties.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} properties
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </Button>
                <span className="text-sm font-medium px-2">Page {currentPage} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next →
                </Button>
              </div>
            </div>
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
  const [, setLocationDialog] = useLocation();
  const [open, setOpen] = useState(false);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
  const [formData, setFormData] = useState({
    addressLine1: "",
    city: "",
    state: "",
    zipcode: "",
    owner1Name: "",
    ownerPhone: "",
    ownerEmail: "",
    leadTemperature: "TBD" as "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD" | "TBD",
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
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
        ownerPhone: "",
        ownerEmail: "",
        leadTemperature: "TBD",
        lat: undefined,
        lng: undefined,
      });
      setIgnoreDuplicates(false);
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
            <AddressAutocompleteWithCRM
              value={formData.addressLine1}
              onChange={(address: string) => {
                setFormData({
                  ...formData,
                  addressLine1: address,
                });
                setIgnoreDuplicates(false); // Reset ignore flag when address changes
              }}
              onAddressSelect={(details: AddressDetails) => {
                setFormData({
                  ...formData,
                  addressLine1: details.street || details.address,
                  city: details.city,
                  state: details.state,
                  zipcode: details.zipCode,
                  lat: details.lat,
                  lng: details.lng,
                });
                setIgnoreDuplicates(false); // Reset ignore flag when address changes
              }}
              onExistingLeadSelect={(leadId: number) => {
                // Navigate to existing lead
                setLocationDialog(`/properties/${leadId}`);
              }}
              placeholder="Digite o endereço para buscar..."
            />
          </div>
          
          {/* Duplicate Detection Alert */}
          {!ignoreDuplicates && formData.addressLine1 && (
            <DuplicateDetectionAlert
              address={`${formData.addressLine1}, ${formData.city}, ${formData.state} ${formData.zipcode}`}
              ownerName={formData.owner1Name}
              lat={formData.lat}
              lng={formData.lng}
              onCreateAnyway={() => setIgnoreDuplicates(true)}
            />
          )}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ownerPhone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </Label>
              <Input
                id="ownerPhone"
                placeholder="(954) 555-1234"
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </Label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder="owner@email.com"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              />
            </div>
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
