import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Phone, Mail, User, Calendar, Trash2, Navigation, ExternalLink, Flame, Snowflake, ThermometerSun, Check, X, Plus, Users, ArrowRightLeft, History, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PropertyCheckIn } from "@/components/PropertyCheckIn";
import { VisitHistory, PhotoGallery } from "@/components/VisitHistory";
import { ContactManagement } from "@/components/ContactManagement";
import { CallTrackingTable } from "@/components/CallTrackingTable";
import { NotesSection } from "@/components/NotesSection";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DeepSearchTabs } from "@/components/DeepSearchTabs";
import { LeadSummary } from "@/components/LeadSummary";
import { PropertyTasks } from "@/components/PropertyTasks";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PropertyDetail() {
  const [, params] = useRoute("/properties/:id");
  const propertyId = Number(params?.id);
  const [noteContent, setNoteContent] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedTransferAgent, setSelectedTransferAgent] = useState<string>("");
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [transferReason, setTransferReason] = useState("");
  const [deskDialogOpen, setDeskDialogOpen] = useState(false);
  const [selectedDeskName, setSelectedDeskName] = useState<string>("");
  const [selectedDeskStatus, setSelectedDeskStatus] = useState<string>("");
  const { user } = useAuth();
  const [, navigate] = useRoute("/properties/:id");

  // Get navigation IDs from localStorage
  const [navigationIds, setNavigationIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const storedIds = localStorage.getItem('propertyNavigationIds');
    if (storedIds) {
      try {
        const ids = JSON.parse(storedIds) as number[];
        setNavigationIds(ids);
        const index = ids.indexOf(propertyId);
        setCurrentIndex(index);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [propertyId]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevId = navigationIds[currentIndex - 1];
      window.location.href = `/properties/${prevId}`;
    }
  };

  const handleNext = () => {
    if (currentIndex < navigationIds.length - 1) {
      const nextId = navigationIds[currentIndex + 1];
      window.location.href = `/properties/${nextId}`;
    }
  };

  const { data: property, isLoading } = trpc.properties.getById.useQuery({ id: propertyId });
  const { data: oldContacts } = trpc.contacts.byProperty.useQuery({ propertyId });
  const { data: verifiedContacts } = trpc.communication.getContactsByProperty.useQuery({ propertyId });
  const { data: notes } = trpc.notes.byProperty.useQuery({ propertyId });
  const { data: tags } = trpc.properties.getTags.useQuery({ propertyId });
  const { data: allTags = [] } = trpc.properties.getAllTags.useQuery();
  const { data: userAgents } = trpc.users.listAgents.useQuery();
  const { data: agentsList } = trpc.agents.list.useQuery();
  const { data: transferHistory } = trpc.properties.getTransferHistory.useQuery({ propertyId });

  // Get adjacent properties for navigation
  // TODO: Fix TypeScript type generation issue
  // const { data: adjacentProperties } = trpc.properties.getAdjacentProperties.useQuery({
  //   currentPropertyId: propertyId,
  //   filters: {}, // TODO: Pass current filters from Properties page
  // });

  // Zillow URL
  const zillowUrl = property
    ? `https://www.zillow.com/homes/${property.addressLine1.replace(/[^a-zA-Z0-9]/g, "-")}-${property.city.replace(/[^a-zA-Z0-9]/g, "-")}-${property.state}-${property.zipcode}_rb/`
    : "";

  const utils = trpc.useUtils();
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      setNoteContent("");
      toast.success("Note added successfully");
    },
  });

  const updateLeadTemperature = trpc.properties.updateLeadTemperature.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Lead temperature updated");
    },
  });

  const toggleOwnerVerified = trpc.properties.toggleOwnerVerified.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Owner verification updated");
    },
  });

  const reassignProperty = trpc.properties.reassignProperty.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Property reassigned successfully");
    },
  });

  const transferLead = trpc.properties.transferLead.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      utils.properties.getTransferHistory.invalidate({ propertyId });
      setTransferDialogOpen(false);
      setSelectedTransferAgent("");
      setTransferReason("");
      toast.success("Lead transferred successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to transfer lead");
    },
  });

  const handleTransferLead = () => {
    if (selectedAgents.length === 0) {
      toast.error("Please select at least one agent to assign");
      return;
    }
    // Assign each selected agent
    selectedAgents.forEach((agentId) => {
      transferLead.mutate({
        propertyId,
        toAgentId: agentId,
        reason: transferReason || undefined,
      });
    });
    setSelectedAgents([]);
    setTransferReason("");
    setTransferDialogOpen(false);
  };

  const toggleAgentSelection = (agentId: number) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const addTag = trpc.properties.addTag.useMutation({
    onSuccess: () => {
      utils.properties.getTags.invalidate({ propertyId });
      setNewTag("");
      toast.success("Tag added");
    },
  });

  const removeTag = trpc.properties.removeTag.useMutation({
    onSuccess: () => {
      utils.properties.getTags.invalidate({ propertyId });
      toast.success("Tag removed");
    },
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      toast.success("Note deleted");
    },
  });

  const updateDesk = trpc.properties.updateDesk.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Desk updated");
    },
  });

  const formatCurrency = (value?: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast.error("Please enter a note");
      return;
    }
    createNote.mutate({ propertyId, content: noteContent });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading property details...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-muted-foreground">Property not found</div>
        <Link href="/properties">
          <Button variant="outline">Back to Properties</Button>
        </Link>
      </div>
    );
  }

  // Background color based on Lead Temperature
  const getBackgroundColor = () => {
    switch (property.leadTemperature) {
      case "SUPER HOT":
        return "bg-blue-50";
      case "HOT":
        return "bg-green-50";
      case "WARM":
        return "bg-yellow-50";
      case "COLD":
        return "bg-gray-50";
      case "DEAD":
        return "bg-gray-50";
      case "TBD":
      default:
        return "bg-white";
    }
  };

  return (
    <div className={`space-y-6 p-6 rounded-lg ${getBackgroundColor()}`}>
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Link href="/properties">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Properties
            </Button>
          </Link>
          {navigationIds.length > 0 && (
            <div className="flex items-center gap-1 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex <= 0}
                title="Previous Lead"
              >
                <ChevronLeft className="h-4 w-4" />
                LEAD BEFORE
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentIndex + 1} / {navigationIds.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex >= navigationIds.length - 1}
                title="Next Lead"
              >
                NEXT LEAD
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-start gap-6">
              <div>
                <h1 className="text-3xl font-bold">{property.addressLine1}</h1>
                <p className="text-muted-foreground mt-2">
                  {property.city}, {property.state} {property.zipcode}
                </p>
              </div>

            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Users className="mr-2 h-4 w-4" />
                  Assign Agent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Agent to Lead</DialogTitle>
                  <DialogDescription>
                    Assign this property to one or more agents. Multiple agents can work on the same lead.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Agents (Multiple)</label>
                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                      {agentsList?.map((agent: any) => (
                        <div key={agent.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`agent-${agent.id}`}
                            checked={selectedAgents.includes(agent.id)}
                            onCheckedChange={() => toggleAgentSelection(agent.id)}
                          />
                          <label
                            htmlFor={`agent-${agent.id}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {agent.name} <Badge variant="outline" className="ml-2">{agent.agentType}</Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedAgents.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {selectedAgents.length} agent(s) selected
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <Textarea
                      placeholder="Add any notes about this assignment (e.g., specific responsibilities, follow-up instructions, etc.)"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleTransferLead} disabled={transferLead.isPending || selectedAgents.length === 0}>
                    {transferLead.isPending ? "Assigning..." : `Assign ${selectedAgents.length} Agent(s)`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(zillowUrl, "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Zillow
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Lead Temperature:</span>
              <Select
                value={property.leadTemperature || "COLD"}
                onValueChange={(value) =>
                  updateLeadTemperature.mutate({
                    propertyId,
                    temperature: value as "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD" | "TBD",
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER HOT">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-red-600 animate-pulse" />
                      <Flame className="h-4 w-4 text-orange-600 -ml-3" />
                      <span className="font-bold">SUPER HOT</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="HOT">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-red-500" />
                      <span>HOT</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="WARM">
                    <div className="flex items-center gap-2">
                      <ThermometerSun className="h-4 w-4 text-orange-500" />
                      <span>WARM</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="COLD">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      <span>COLD</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="TBD">
                    <div className="flex items-center gap-2">
                      <span>TBD</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="DEAD">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">☠️</span>
                      <span>DEAD</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white border-0 font-semibold px-3 py-1"
              >
                {property.leadTemperature || "COLD"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 bg-green-50 border-2 border-green-500 rounded-lg px-4 py-2">
              <Checkbox
                id="owner-verified"
                checked={property.ownerVerified === 1}
                onCheckedChange={(checked) =>
                  toggleOwnerVerified.mutate({
                    propertyId,
                    verified: checked as boolean,
                  })
                }
              />
              <label
                htmlFor="owner-verified"
                className="text-sm font-bold cursor-pointer flex items-center gap-2 text-green-700"
              >
                {property.ownerVerified === 1 && <Check className="h-5 w-5 text-green-600" />}
                Owner Verified
              </label>
            </div>
            {/* Desk Status Block */}
            <Select
              value={property.deskName || 'BIN'}
              onValueChange={(value) => {
                const deskStatus = value === 'ARCHIVED' ? 'ARCHIVED' : value === 'BIN' ? 'BIN' : 'ACTIVE';
                updateDesk.mutate({
                  propertyId,
                  deskName: value,
                  deskStatus,
                });
              }}
            >
              <SelectTrigger className={`w-auto border-2 ${
                property.deskName === 'BIN'
                  ? 'bg-gray-100 border-gray-400'
                  : property.deskName === 'DESK_CHRIS'
                  ? 'bg-red-50 border-red-500'
                  : property.deskName === 'DESK_1'
                  ? 'bg-yellow-50 border-yellow-500'
                  : property.deskName === 'DESK_2'
                  ? 'bg-green-50 border-green-500'
                  : property.deskName === 'DESK_3'
                  ? 'bg-blue-50 border-blue-500'
                  : property.deskName === 'DESK_4'
                  ? 'bg-pink-50 border-pink-500'
                  : property.deskName === 'DESK_5'
                  ? 'bg-orange-50 border-orange-500'
                  : 'bg-gray-100 border-gray-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {property.deskName === 'BIN'
                      ? '🗑️'
                      : property.deskName === 'DESK_CHRIS'
                      ? '🏀'
                      : property.deskName === 'DESK_1'
                      ? '🟡'
                      : property.deskName === 'DESK_2'
                      ? '🟢'
                      : property.deskName === 'DESK_3'
                      ? '🔵'
                      : property.deskName === 'DESK_4'
                      ? '🩷'
                      : property.deskName === 'DESK_5'
                      ? '🟠'
                      : '🗑️'}
                  </span>
                  <span className="font-semibold">{property.deskName || 'BIN'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BIN">
                  <div className="flex items-center gap-2">
                    <span>🗑️</span>
                    <span>BIN</span>
                  </div>
                </SelectItem>
                <SelectItem value="DESK_CHRIS">
                  <div className="flex items-center gap-2">
                    <span>🏀</span>
                    <span>DESK_CHRIS</span>
                  </div>
                </SelectItem>
                <SelectItem value="DESK_1">
                  <div className="flex items-center gap-2">
                    <span>🟡</span>
                    <span>DESK_1</span>
                  </div>
                </SelectItem>
                <SelectItem value="DESK_2">
                  <div className="flex items-center gap-2">
                    <span>🟢</span>
                    <span>DESK_2</span>
                  </div>
                </SelectItem>
                <SelectItem value="DESK_3">
                  <div className="flex items-center gap-2">
                    <span>🔵</span>
                    <span>DESK_3</span>
                  </div>
                </SelectItem>
                <SelectItem value="DESK_4">
                  <div className="flex items-center gap-2">
                    <span>🩷</span>
                    <span>DESK_4</span>
                  </div>
                </SelectItem>
                <SelectItem value="DESK_5">
                  <div className="flex items-center gap-2">
                    <span>🟠</span>
                    <span>DESK_5</span>
                  </div>
                </SelectItem>
                <SelectItem value="ARCHIVED">
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span>ARCHIVED</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Assigned Agent:
              </span>
              <Select
                value={property.assignedAgentId?.toString() || "unassigned"}
                onValueChange={(value) =>
                  reassignProperty.mutate({
                    propertyId,
                    assignedAgentId: value === "unassigned" ? null : Number(value),
                  })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <span className="text-muted-foreground">Unassigned</span>
                  </SelectItem>
                  {userAgents?.map((agent: { id: number; name: string | null; openId: string }) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name || agent.openId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Custom Tags:</span>
            {tags?.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                {tag.tag}
                <button
                  onClick={() => removeTag.mutate({ tagId: tag.id })}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <div className="relative flex items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => {
                    setNewTag(e.target.value);
                    setShowTagSuggestions(e.target.value.length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTag.trim()) {
                      addTag.mutate({ propertyId, tag: newTag.trim() });
                      setShowTagSuggestions(false);
                    } else if (e.key === "Escape") {
                      setShowTagSuggestions(false);
                    }
                  }}
                  onFocus={() => newTag.length > 0 && setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                  className="w-40 h-8"
                />
                {showTagSuggestions && allTags.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {allTags
                      .filter(tag => 
                        tag.toLowerCase().includes(newTag.toLowerCase()) &&
                        !tags?.some(t => t.tag === tag)
                      )
                      .slice(0, 10)
                      .map((tag) => (
                        <div
                          key={tag}
                          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                          onClick={() => {
                            addTag.mutate({ propertyId, tag });
                            setNewTag("");
                            setShowTagSuggestions(false);
                          }}
                        >
                          {tag}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (newTag.trim()) {
                    addTag.mutate({ propertyId, tag: newTag.trim() });
                    setShowTagSuggestions(false);
                  }
                }}
                disabled={!newTag.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Property Details, Financial Info, Owner Info */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Property Type</p>
                <p className="font-medium">{property.propertyType || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Year Built</p>
                <p className="font-medium">{property.yearBuilt || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bedrooms</p>
                <p className="font-medium">{property.totalBedrooms || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bathrooms</p>
                <p className="font-medium">{property.totalBaths || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Square Feet</p>
                <p className="font-medium">
                  {property.buildingSquareFeet?.toLocaleString() || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Construction</p>
                <p className="font-medium">{property.constructionType || "-"}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {property.status?.split(",").map((status, idx) => (
                  <Badge key={idx} variant="secondary">
                    {status.trim()}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Value</p>
                <p className="font-medium text-lg">
                  {formatCurrency(property.estimatedValue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Equity Amount</p>
                <p className="font-medium text-lg">
                  {formatCurrency(property.equityAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Equity Percent</p>
                <p className="font-medium text-lg">
                  {property.equityPercent ? `${property.equityPercent}%` : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mortgage</p>
                <p className="font-medium text-lg">
                  {formatCurrency(property.mortgageAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Sale Price</p>
                <p className="font-medium">{formatCurrency(property.salePrice)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax Amount</p>
                <p className="font-medium">{formatCurrency(property.taxAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Primary Owner</p>
              <p className="font-medium">{property.owner1Name || "-"}</p>
            </div>
            {property.owner2Name && (
              <div>
                <p className="text-sm text-muted-foreground">Secondary Owner</p>
                <p className="font-medium">{property.owner2Name}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Owner Location</p>
              <p className="font-medium">{property.ownerLocation || "-"}</p>
            </div>
            {property.subdivisionName && (
              <div>
                <p className="text-sm text-muted-foreground">Subdivision</p>
                <p className="font-medium">{property.subdivisionName}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Contacts (Full Width) */}
      <Card>
        <CardContent className="pt-6">
          <ContactManagement propertyId={propertyId} />
        </CardContent>
      </Card>

      {/* Call Tracking Sheet - Right after Contacts */}
      <Card>
        <CardContent className="pt-6">
          <CallTrackingTable propertyId={propertyId} />
        </CardContent>
      </Card>

      <PropertyTasks propertyId={propertyId} />

      {/* Transfer History */}
      {transferHistory && transferHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transfer History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transferHistory.map((transfer: {
                id: number;
                fromAgentName: string;
                toAgentName: string;
                reason: string | null;
                createdAt: Date;
              }) => (
                <div key={transfer.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <ArrowRightLeft className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{transfer.fromAgentName}</span>
                      {" → "}
                      <span className="font-medium">{transfer.toAgentName}</span>
                    </p>
                    {transfer.reason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Reason: {transfer.reason}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(transfer.createdAt).toLocaleDateString()} at{" "}
                      {new Date(transfer.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DeepSearchTabs propertyId={propertyId} />

      {/* Field Visit Check-In - moved to bottom as less frequently used */}
      <div className="grid gap-6 md:grid-cols-2">
        <PropertyCheckIn propertyId={propertyId} />
        <VisitHistory propertyId={propertyId} />
      </div>

      <ActivityTimeline propertyId={propertyId} />

      {/* Photos and Notes moved to bottom for better workflow */}
      <PhotoGallery propertyId={propertyId} />

      <NotesSection propertyId={propertyId} />
    </div>
  );
}
