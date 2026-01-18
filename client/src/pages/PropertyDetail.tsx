import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
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
import { ContactManagement } from "@/components/ContactManagement";
import { DeskChrisNotes } from "@/components/DeskChrisNotes";
import { CallTrackingTable } from "@/components/CallTrackingTable";
import { NotesSection } from "@/components/NotesSection";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DeepSearchTabs } from "@/components/DeepSearchTabs";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { STAGE_CONFIGS } from "@/lib/stageConfig";
import { LeadSummary } from "@/components/LeadSummary";
import { PropertyTasks } from "@/components/PropertyTasks";
import { EditPropertyDialog } from "@/components/EditPropertyDialog";
import { AutomatedFollowUps } from "@/components/AutomatedFollowUps";
import { DealCalculator } from "@/components/DealCalculator";
import BuyerMatching from "@/components/BuyerMatching";
import { useAuth } from "@/_core/hooks/useAuth";
import { StickyPropertyHeader } from "@/components/StickyPropertyHeader";

export default function PropertyDetail() {
  const [, params] = useRoute("/properties/:id");
  const propertyId = Number(params?.id);
  const [noteContent, setNoteContent] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showDealCalculator, setShowDealCalculator] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
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

  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<string>("");
  const { user } = useAuth();

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
  const { data: notes } = trpc.notes.byProperty.useQuery({ propertyId });
  const { data: tags } = trpc.properties.getTags.useQuery({ propertyId });
  const { data: allTags = [] } = trpc.properties.getAllTags.useQuery();
  const { data: agentsList, isLoading: agentsLoading, error: agentsError } = trpc.agents.listAll.useQuery();
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

  const updateDealStage = trpc.properties.updateDealStage.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      setPipelineDialogOpen(false);
      setSelectedPipelineStage("");
      toast.success("Property added to Pipeline successfully!");
    },
  });

  const assignAgent = trpc.properties.assignAgent.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      utils.properties.getAssignedAgents.invalidate({ propertyId });
      setTransferDialogOpen(false);
      setTransferReason("");
      setSelectedAgents([]);
      toast.success("Agent assigned successfully!");
    },
  });

  const handleTransferLead = () => {
    if (selectedAgents.length === 0) {
      toast.error("Please select at least one agent to assign");
      return;
    }
    selectedAgents.forEach((agentId) => {
      assignAgent.mutate({ propertyId, agentId });
    });
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

  const updateDesk = trpc.properties.updateDesk.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Desk updated");
    },
  });

  const handleAddToPipeline = () => {
    if (!selectedPipelineStage) return;
    updateDealStage.mutate({ propertyId, stageId: selectedPipelineStage });
  };

  if (isLoading || !property) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getBackgroundColor = () => {
    switch (property.leadTemperature) {
      case "SUPER HOT": return "bg-blue-50/30";
      case "HOT": return "bg-green-50/30";
      case "WARM": return "bg-yellow-50/30";
      case "COLD": case "DEAD": return "bg-gray-50/30";
      default: return "bg-white";
    }
  };

  return (
    <div className={`space-y-6 p-6 rounded-lg ${getBackgroundColor()}`}>
      <StickyPropertyHeader
        property={property}
        tags={tags || []}
        onEdit={() => {}} 
        onAddToPipeline={() => setPipelineDialogOpen(true)}
        onAssignAgent={() => setTransferDialogOpen(true)}
        onUpdateLeadTemperature={(temp) => 
          updateLeadTemperature.mutate({ propertyId, temperature: temp as any })
        }
        onToggleOwnerVerified={() => toggleOwnerVerified.mutate({ propertyId })}
        onPrevious={handlePrevious}
        onNext={handleNext}
        currentIndex={currentIndex}
        totalCount={navigationIds.length}
        zillowUrl={zillowUrl}
      />

      {/* Dialogs */}
      <Dialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Deal Pipeline</DialogTitle>
            <DialogDescription>Select the Pipeline stage to add this property to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedPipelineStage} onValueChange={setSelectedPipelineStage}>
              <SelectTrigger><SelectValue placeholder="Choose a stage..." /></SelectTrigger>
              <SelectContent>
                {STAGE_CONFIGS.filter(s => s.isPipeline).map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2"><span>{stage.icon}</span><span>{stage.label}</span></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddToPipeline} disabled={!selectedPipelineStage}>Add to Pipeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Agent to Lead</DialogTitle>
            <DialogDescription>Assign this property to one or more agents.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {agentsList?.map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`agent-${agent.id}`}
                    checked={selectedAgents.includes(agent.id)}
                    onCheckedChange={() => toggleAgentSelection(agent.id)}
                  />
                  <label htmlFor={`agent-${agent.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {agent.name} ({agent.agentType || 'Agent'})
                  </label>
                </div>
              ))}
            </div>
            <Textarea placeholder="Notes (optional)" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleTransferLead} disabled={assignAgent.isPending || selectedAgents.length === 0}>
              {assignAgent.isPending ? "Assigning..." : `Assign ${selectedAgents.length} Agent(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {assignedAgents && assignedAgents.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Assigned Agents ({assignedAgents.length})</h3>
          <div className="flex flex-wrap gap-2">
            {assignedAgents.map((assignment: any) => (
              <Badge key={assignment.id} variant="secondary" className="flex items-center gap-2">
                <Users className="h-3 w-3" /> {assignment.agent?.name} ({assignment.agent?.agentType})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <div className="relative flex items-center gap-1">
          <Input
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => { setNewTag(e.target.value); setShowTagSuggestions(true); }}
            onFocus={() => setShowTagSuggestions(true)}
            className="h-8 w-32 text-xs"
          />
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => newTag.trim() && addTag.mutate({ propertyId, tagName: newTag.trim() })}>
            <Plus className="h-4 w-4" />
          </Button>
          {showTagSuggestions && newTag && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {allTags.filter(t => t.name.toLowerCase().includes(newTag.toLowerCase()) && !tags?.some(existing => existing.id === t.id)).map(tag => (
                <button key={tag.id} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100" onClick={() => { addTag.mutate({ propertyId, tagName: tag.name }); setShowTagSuggestions(false); }}>
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {property && <LeadSummary property={property} />}
      <PropertyTasks propertyId={propertyId} />
      <AutomatedFollowUps propertyId={propertyId} />
      
      <CollapsibleSection title="Deep Search" icon="🔍" isOpen={showDeepSearch} onToggle={() => setShowDeepSearch(!showDeepSearch)} accentColor="orange">
        <DeepSearchTabs property={property} />
      </CollapsibleSection>

      <CollapsibleSection title="Family Tree" icon="🌳" isOpen={showFamilyTree} onToggle={() => setShowFamilyTree(!showFamilyTree)} accentColor="yellow">
        <FamilyTreeEnhanced propertyId={propertyId} />
      </CollapsibleSection>

      <CollapsibleSection title="Field Visit Check-In (Birddog)" icon="📍" isOpen={showFieldVisit} onToggle={() => setShowFieldVisit(!showFieldVisit)} accentColor="pink">
        <div className="grid gap-6 md:grid-cols-2">
          <PropertyCheckIn propertyId={propertyId} />
          <VisitHistory propertyId={propertyId} />
        </div>
      </CollapsibleSection>

      <PhotoGallery propertyId={propertyId} />
      <DeskChrisNotes propertyId={propertyId} />
      <ContactManagement propertyId={propertyId} />
      <CallTrackingTable propertyId={propertyId} />
      <NotesSection propertyId={propertyId} />
      <ActivityTimeline propertyId={propertyId} />
      
      <CollapsibleSection title="Transfer History" icon={History} accentColor="gray">
        <div className="space-y-4">
          {transferHistory?.map((history: any) => (
            <div key={history.id} className="flex items-start gap-4 p-3 border rounded-md bg-gray-50">
              <div className="mt-1"><ArrowRightLeft className="h-4 w-4 text-gray-400" /></div>
              <div>
                <p className="text-sm font-medium">Assigned to {history.agent?.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(history.createdAt).toLocaleString()}</p>
                {history.reason && <p className="text-sm mt-1 text-gray-600 italic">"{history.reason}"</p>}
              </div>
            </div>
          ))}
          {(!transferHistory || transferHistory.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No transfer history available.</p>}
        </div>
      </CollapsibleSection>

      <DealCalculator propertyId={propertyId} />
      <BuyerMatching propertyId={propertyId} />
    </div>
  );
}
