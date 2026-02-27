import React, { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Phone, Mail, User, Calendar, Trash2, Navigation, ExternalLink, Flame, Snowflake, ThermometerSun, Check, X, Plus, Users, ArrowRightLeft, History, Star, TrendingUp } from "lucide-react";
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
import { VisitHistory } from "@/components/VisitHistory";
import { PhotoGallery } from "@/components/PhotoGallery";
import { FamilyTreeEnhanced } from "@/components/FamilyTreeEnhanced";

import { CallTrackingTable } from "@/components/CallTrackingTable";
import { NotesSection } from "@/components/NotesSection";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DeepSearchOverview } from "@/components/DeepSearchOverview";
import { FinancialModule } from "@/components/FinancialModule";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { STAGE_CONFIGS } from "@/lib/stageConfig";
import { LeadSummary } from "@/components/LeadSummary";
import { PropertyTasks } from "@/components/PropertyTasks";
import { EditPropertyDialog } from "@/components/EditPropertyDialog";
import { AutomatedFollowUps } from "@/components/AutomatedFollowUps";
import { PropertyTagsManager } from "@/components/PropertyTagsManager";

import BuyerMatching from "@/components/BuyerMatching";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { StickyPropertyHeader } from "@/components/StickyPropertyHeader";
import Comparables from "@/components/Comparables";

export default function PropertyDetail() {
  const [, params] = useRoute("/properties/:id");
  const [, setLocation] = useLocation();
  const propertyId = Number(params?.id);
  const [noteContent, setNoteContent] = useState("");

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [transferReason, setTransferReason] = useState("");
  
  // localStorage persistence for ADHD-friendly collapsed state
  const [showDeepSearch, setShowDeepSearch] = useState(() => {
    const saved = localStorage.getItem('showDeepSearch');
    return saved ? JSON.parse(saved) : false;
  });
  const [showFamilyTree, setShowFamilyTree] = useState(() => {
    const saved = localStorage.getItem('showFamilyTree');
    return saved ? JSON.parse(saved) : false;
  });
  const [showComparables, setShowComparables] = useState(() => {
    const saved = localStorage.getItem('showComparables');
    return saved ? JSON.parse(saved) : false;
  });
  const [showFieldVisit, setShowFieldVisit] = useState(() => {
    const saved = localStorage.getItem('showFieldVisit');
    return saved ? JSON.parse(saved) : false;
  });
  
  useEffect(() => {
    localStorage.setItem('showDeepSearch', JSON.stringify(showDeepSearch));
  }, [showDeepSearch]);
  
  useEffect(() => {
    localStorage.setItem('showFamilyTree', JSON.stringify(showFamilyTree));
  }, [showFamilyTree]);
  
  useEffect(() => {
    localStorage.setItem('showFieldVisit', JSON.stringify(showFieldVisit));
  }, [showFieldVisit]);
  useEffect(() => {
    localStorage.setItem('showComparables', JSON.stringify(showComparables));
  }, [showComparables]);

  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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
      } catch (e) {}
    }
  }, [propertyId]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevId = navigationIds[currentIndex - 1];
      setLocation(`/properties/${prevId}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < navigationIds.length - 1) {
      const nextId = navigationIds[currentIndex + 1];
      setLocation(`/properties/${nextId}`);
    }
  };

  const { data: property, isLoading, error } = trpc.properties.getById.useQuery({ id: propertyId });
  const { data: notes } = trpc.notes.byProperty.useQuery({ propertyId });
  const { data: tags } = trpc.properties.getTags.useQuery({ propertyId });
  const { data: agentsList } = trpc.agents.listAll.useQuery();
  const { data: assignedAgents } = trpc.properties.getAssignedAgents.useQuery({ propertyId });
  const { data: transferHistory } = trpc.properties.getTransferHistory.useQuery({ propertyId });

  const zillowUrl = property
    ? `https://www.zillow.com/homes/${property.addressLine1.replace(/[^a-zA-Z0-9]/g, "-")}-${property.city.replace(/[^a-zA-Z0-9]/g, "-")}-${property.state}-${property.zipcode}_rb/`
    : "";

  const utils = trpc.useUtils();
  
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

  const updateDesk = trpc.properties.updateDesk.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Desk updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update desk: " + error.message);
    },
  });

  const isInPipeline = property?.dealStage ? STAGE_CONFIGS.some(s => s.id === property.dealStage && s.isPipeline) : false;

  const updateDealStage = trpc.properties.updateDealStage.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      utils.properties.getPropertiesByStage.invalidate();
      setPipelineDialogOpen(false);
      setSelectedPipelineStage("");
      toast.success(isInPipeline ? "Pipeline stage updated!" : "Property added to Pipeline!");
    },
  });

  const assignAgent = trpc.properties.assignAgent.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      utils.properties.getAssignedAgents.invalidate({ propertyId });
      toast.success("Agent assigned successfully!");
    },
  });

  const removeAgentMutation = trpc.properties.removeAgent.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      utils.properties.getAssignedAgents.invalidate({ propertyId });
      toast.success("Agent removed successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to remove agent: ${error.message}`);
    },
  });

  // Pre-select already assigned agents when dialog opens
  const handleOpenAssignDialog = () => {
    const currentlyAssigned = assignedAgents?.map((a: any) => a.agent?.id).filter(Boolean) || [];
    setSelectedAgents(currentlyAssigned);
    setTransferDialogOpen(true);
  };

  const handleSaveAgentAssignments = () => {
    const currentlyAssigned = assignedAgents?.map((a: any) => a.agent?.id).filter(Boolean) || [];
    
    // Find agents to add (selected but not currently assigned)
    const toAdd = selectedAgents.filter((id) => !currentlyAssigned.includes(id));
    // Find agents to remove (currently assigned but not selected)
    const toRemove = currentlyAssigned.filter((id: number) => !selectedAgents.includes(id));

    toAdd.forEach((agentId) => {
      assignAgent.mutate({ propertyId, agentId });
    });
    toRemove.forEach((agentId: number) => {
      removeAgentMutation.mutate({ propertyId, agentId });
    });

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast.info("No changes to save");
    }
    setTransferDialogOpen(false);
  };

  const toggleAgentSelection = (agentId: number) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };



  const handleAddToPipeline = () => {
    if (!selectedPipelineStage) return;
    updateDealStage.mutate({ propertyId, newStage: selectedPipelineStage });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !property) {
    console.error('PropertyDetail error:', error);
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-rose-500 font-bold">Error loading property data</div>
        <div className="text-sm text-gray-500 max-w-md text-center">{error?.message || 'Property not found'}</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const getBackgroundColor = () => {
    switch (property.leadTemperature) {
      case "SUPER HOT": return "bg-blue-100";
      case "HOT": return "bg-green-100";
      case "WARM": return "bg-amber-100";
      case "COLD": return "bg-gray-200";
      case "DEAD": return "bg-purple-100";
      case "DEEP SEARCH": return "bg-purple-100";
      case "TBD": return "bg-white";
      default: return "bg-white";
    }
  };

  return (
    <div className={`space-y-4 md:space-y-6 p-3 md:p-6 rounded-lg ${getBackgroundColor()}`}>
      <StickyPropertyHeader
        property={property as any}
        tags={tags || []}
        onEdit={() => setEditDialogOpen(true)} 
        onAddToPipeline={() => {
          // Pre-select current stage when opening dialog for update
          if (property.dealStage) {
            const stageConfig = STAGE_CONFIGS.find(s => s.id === property.dealStage && s.isPipeline);
            if (stageConfig) {
              setSelectedPipelineStage(property.dealStage);
            }
          }
          setPipelineDialogOpen(true);
        }}
        currentDealStage={property.dealStage}
        onAssignAgent={handleOpenAssignDialog}
        onUpdateLeadTemperature={(temp) => 
          updateLeadTemperature.mutate({ propertyId, temperature: temp as any })
        }
        onToggleOwnerVerified={() => toggleOwnerVerified.mutate({ propertyId, verified: !(property as any)?.ownerVerified })}
        onUpdateDesk={(deskName) => {
          const deskStatus = deskName === "BIN" ? "BIN" : deskName === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
          updateDesk.mutate({ propertyId, deskName: deskName === "BIN" ? undefined : deskName, deskStatus });
        }}
        onPrevious={handlePrevious}
        onNext={handleNext}
        currentIndex={currentIndex}
        totalCount={navigationIds.length}
        zillowUrl={zillowUrl}
      />

      {/* Pipeline Dialog */}
      <Dialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isInPipeline ? "Update Pipeline Stage" : "Add to Deal Pipeline"}</DialogTitle>
            <DialogDescription>
              {isInPipeline 
                ? `Currently in: ${STAGE_CONFIGS.find(s => s.id === property?.dealStage)?.label || property?.dealStage}. Select a new stage below.`
                : "Select the Pipeline stage to add this property to."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isInPipeline && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                <span className="font-medium text-emerald-700">Current Stage:</span>
                <span className="text-emerald-900 font-bold">
                  {STAGE_CONFIGS.find(s => s.id === property?.dealStage)?.icon} {STAGE_CONFIGS.find(s => s.id === property?.dealStage)?.label}
                </span>
              </div>
            )}
            <Select value={selectedPipelineStage} onValueChange={setSelectedPipelineStage}>
              <SelectTrigger><SelectValue placeholder="Choose a stage..." /></SelectTrigger>
              <SelectContent>
                {STAGE_CONFIGS.filter(s => s.isPipeline).map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <span>{stage.icon}</span>
                      <span>{stage.label}</span>
                      {stage.id === property?.dealStage && (
                        <span className="text-xs text-emerald-600 font-bold ml-1">(current)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddToPipeline} 
              disabled={!selectedPipelineStage || selectedPipelineStage === property?.dealStage}
            >
              {isInPipeline ? "Update Stage" : "Add to Pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Agents</DialogTitle>
            <DialogDescription>Select or deselect agents for this property. Changes are saved when you click Save.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto p-1">
              {agentsList?.map((agent: any) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgentSelection(agent.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <Checkbox checked={isSelected} />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-bold">{agent.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{agent.role}</span>
                    </div>
                    {isSelected && (
                      <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">Selected</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAgentAssignments} disabled={assignAgent.isPending || removeAgentMutation.isPending}>
              {(assignAgent.isPending || removeAgentMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditPropertyDialog
        property={property as any}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {assignedAgents && assignedAgents.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Assigned Agents ({assignedAgents.length})</h3>
          <div className="flex flex-wrap gap-2">
            {assignedAgents.map((assignment: any) => (
              <Badge key={assignment.id} variant="secondary" className="flex items-center gap-2 pr-1">
                <Users className="h-3 w-3" /> {assignment.agent?.name} ({assignment.agent?.role})
                <button
                  onClick={() => removeAgentMutation.mutate({ propertyId, agentId: assignment.agent?.id })}
                  className="ml-1 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                  title="Remove agent"
                >
                  <X className="h-3 w-3 text-red-500" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags Manager */}
      <PropertyTagsManager propertyId={propertyId} />

      {/* Call Tracking */}
      <CallTrackingTable propertyId={propertyId} />
      
      {/* Middle Sections: Tasks and Follow-ups */}
      <PropertyTasks propertyId={propertyId} />
      <AutomatedFollowUps propertyId={propertyId} />
      
      {/* Collapsible Sections */}
      <CollapsibleSection title="Comparables & Renovation Calculator" icon="📊" isOpen={showComparables} onToggle={() => setShowComparables(!showComparables)} accentColor="blue">
        <Comparables
          propertyId={propertyId}
          buildingSF={property?.buildingSquareFeet ? parseInt(String(property.buildingSquareFeet)) : undefined}
          totalBaths={property?.totalBaths ? parseInt(String(property.totalBaths)) : undefined}
          estimatedValue={property?.estimatedValue ? parseInt(String(property.estimatedValue)) : undefined}
        />
      </CollapsibleSection>

      {isAdmin && (
        <CollapsibleSection title="Deep Search Overview" icon="🔍" isOpen={showDeepSearch} onToggle={() => setShowDeepSearch(!showDeepSearch)} accentColor="orange">
          <div className="space-y-6">
            <DeepSearchOverview propertyId={propertyId} />
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">💰 Financial Module</h3>
              <FinancialModule propertyId={propertyId} />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Family Tree is now inside Deep Search > Probate section */}

      <CollapsibleSection title="Field Visit Check-In (Birddog)" icon="📍" isOpen={showFieldVisit} onToggle={() => setShowFieldVisit(!showFieldVisit)} accentColor="pink">
        <div className="grid gap-6 md:grid-cols-2">
          <PropertyCheckIn propertyId={propertyId} />
          <VisitHistory propertyId={propertyId} />
        </div>
      </CollapsibleSection>

      <PhotoGallery propertyId={propertyId} />
      <NotesSection propertyId={propertyId} />
      {isAdmin && <ActivityTimeline propertyId={propertyId} />}
      {isAdmin && <BuyerMatching propertyId={propertyId} />}
    </div>
  );
}
