import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { trpc } from "@/lib/trpc";
import { STAGE_CONFIGS, type DealStage } from "@/lib/stageConfig";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Loader2, Home, DollarSign, Calendar, Plus } from "lucide-react";
import { QuickAddLeadDialog } from "@/components/QuickAddLeadDialog";

interface PropertyCard {
  id: number;
  addressLine1: string;
  city: string;
  state: string;
  owner1Name: string | null;
  estimatedValue: number | null;
  dealStage: string;
  stageChangedAt: Date;
  leadTemperature: string | null;
}

function DraggablePropertyCard({ property }: { property: PropertyCard }) {
  const [, setLocation] = useLocation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `property-${property.id}`,
    data: { property },
  });

  const daysInStage = Math.floor(
    (Date.now() - new Date(property.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === property.dealStage);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={`p-3 cursor-move hover:shadow-md transition-shadow ${
          isDragging ? "opacity-50" : ""
        } ${stageConfig?.bgColor || "bg-white"} border-2`}
        onClick={(e) => {
          if (!isDragging) {
            e.stopPropagation();
            setLocation(`/properties/${property.id}`);
          }
        }}
      >
        <div className="space-y-2">
          {/* Address */}
          <div className="flex items-start gap-2">
            <Home className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-medium leading-tight">
              {property.addressLine1}
              <div className="text-xs text-muted-foreground">
                {property.city}, {property.state}
              </div>
            </div>
          </div>

          {/* Owner */}
          {property.owner1Name && (
            <div className="text-xs text-muted-foreground truncate">
              Owner: {property.owner1Name}
            </div>
          )}

          {/* Value & Temperature */}
          <div className="flex items-center justify-between gap-2">
            {property.estimatedValue && (
              <div className="flex items-center gap-1 text-xs">
                <DollarSign className="w-3 h-3" />
                <span className="font-medium">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(property.estimatedValue)}
                </span>
              </div>
            )}

            {property.leadTemperature && property.leadTemperature !== "TBD" && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  property.leadTemperature === "SUPER HOT" || property.leadTemperature === "HOT"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : property.leadTemperature === "WARM"
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {property.leadTemperature}
              </Badge>
            )}
          </div>

          {/* Days in Stage */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>
              {daysInStage === 0 ? "Today" : `${daysInStage} day${daysInStage > 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DroppableStageColumn({
  stageConfig,
  properties,
}: {
  stageConfig: (typeof STAGE_CONFIGS)[0];
  properties: PropertyCard[];
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: stageConfig.id,
  });

  return (
    <div className="flex-shrink-0 w-80">
      {/* Column Header */}
      <div
        className={`p-3 rounded-t-lg ${stageConfig.bgColor} border-2 ${stageConfig.bgColor.replace("bg-", "border-")}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{stageConfig.icon}</span>
            <div>
              <h3 className={`font-semibold ${stageConfig.color}`}>{stageConfig.shortLabel}</h3>
              <p className="text-xs text-muted-foreground">
                {properties.length} lead{properties.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Add Dialog */}
      <QuickAddLeadDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        dealStage={stageConfig.id}
      />

      {/* Column Body - Droppable Area */}
      <div
        ref={setNodeRef}
        className={`min-h-[600px] p-3 space-y-3 border-x-2 border-b-2 rounded-b-lg transition-colors ${
          isOver ? "bg-primary/10" : "bg-muted/20"
        }`}
      >
        {properties.map((property) => (
          <DraggablePropertyCard key={property.id} property={property} />
        ))}

        {properties.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No leads in this stage
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineKanban() {
  const [activeProperty, setActiveProperty] = useState<PropertyCard | null>(null);
  const utils = trpc.useUtils();

  // Fetch all properties
  const { data: properties, isLoading } = trpc.properties.getPropertiesByStage.useQuery({});

  // Update stage mutation
  const updateStageMutation = trpc.properties.updateDealStage.useMutation({
    onSuccess: () => {
      utils.properties.getPropertiesByStage.invalidate();
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const property = event.active.data.current?.property as PropertyCard;
    setActiveProperty(property);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProperty(null);

    if (!over) return;

    const property = active.data.current?.property as PropertyCard;
    const newStage = over.id as string;

    if (!property || property.dealStage === newStage) return;

    // Update stage
    updateStageMutation.mutate({
      propertyId: property.id,
      newStage,
      notes: `Moved from ${property.dealStage} to ${newStage} via Kanban board`,
    });
  };

  const getPropertiesByStage = (stage: DealStage): PropertyCard[] => {
    if (!properties) return [];
    return properties.filter((p) => p.dealStage === stage) as PropertyCard[];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Deal Pipeline</h1>
        <p className="text-muted-foreground">
          Drag and drop leads between stages to update their status
        </p>
      </div>

      {/* Info Banner */}
      <div className="text-sm text-muted-foreground px-4 py-3 bg-muted/30 rounded-lg border">
        💼 <strong>Pipeline View:</strong> Showing only active deals (seller interested). Pre-pipeline stages (New Lead, Skip Traced, First Contact) remain in Properties list.
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_CONFIGS.filter((s) => s.isPipeline && s.phase !== "dead").map((stageConfig) => (
            <DroppableStageColumn
              key={stageConfig.id}
              stageConfig={stageConfig}
              properties={getPropertiesByStage(stageConfig.id)}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeProperty ? (
            <div className="rotate-3">
              <DraggablePropertyCard property={activeProperty} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
