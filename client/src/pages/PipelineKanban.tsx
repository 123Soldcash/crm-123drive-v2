import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Loader2,
  Home,
  DollarSign,
  Calendar,
  Plus,
  LayoutGrid,
  List,
  ArrowUpDown,
  ExternalLink,
  Thermometer,
} from "lucide-react";
import { QuickAddLeadDialog } from "@/components/QuickAddLeadDialog";

// ── Desk Options & Helpers ──────────────────────────────────────────────
const DESK_OPTIONS = [
  "NEW_LEAD",
  "DESK_CHRIS",
  "DESK_DEEP_SEARCH",
  "DESK_1",
  "DESK_2",
  "DESK_3",
  "DESK_4",
  "DESK_5",
  "BIN",
  "ARCHIVED",
];

const getDeskLabel = (desk: string) => {
  const labels: Record<string, string> = {
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
  return labels[desk] || desk;
};

const getDeskColor = (desk: string | null | undefined) => {
  const colors: Record<string, string> = {
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
  return colors[desk || ""] || "bg-gray-200 text-gray-700";
};

// ── Types ───────────────────────────────────────────────────────────────
interface PropertyCard {
  id: number;
  leadId: string | null;
  addressLine1: string;
  city: string;
  state: string;
  owner1Name: string | null;
  estimatedValue: number | null;
  dealStage: string;
  stageChangedAt: Date;
  leadTemperature: string | null;
  deskName: string | null;
  deskStatus: string | null;
}

type SortField = "address" | "owner" | "value" | "stage" | "daysInStage" | "desk" | "temperature";
type SortDir = "asc" | "desc";

// ── Draggable Property Card (Kanban) ────────────────────────────────────
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
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
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
          <div className="flex items-start gap-2">
            <Home className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-medium leading-tight">
              {property.addressLine1}
              <div className="text-xs text-muted-foreground">
                {property.city}, {property.state}
              </div>
            </div>
          </div>

          {property.owner1Name && (
            <div className="text-xs text-muted-foreground truncate">
              Owner: {property.owner1Name}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {property.estimatedValue ? (
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
            ) : null}

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

          {/* Desk badge */}
          {property.deskName && (
            <Badge variant="secondary" className={`text-xs ${getDeskColor(property.deskName)}`}>
              {getDeskLabel(property.deskName)}
            </Badge>
          )}

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

// ── Droppable Stage Column (Kanban) ─────────────────────────────────────
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

  const totalValue = properties.reduce((sum, prop) => sum + (prop.estimatedValue || 0), 0);

  return (
    <div className="flex-shrink-0 w-80">
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
              {totalValue > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-3 h-3 text-green-600" />
                  <span className="text-xs font-semibold text-green-600">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    }).format(totalValue)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <QuickAddLeadDialog open={showAddDialog} onOpenChange={setShowAddDialog} dealStage={stageConfig.id} />

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

// ── List View ───────────────────────────────────────────────────────────
function PipelineListView({
  properties,
  sortField,
  sortDir,
  onSort,
}: {
  properties: PropertyCard[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const [, setLocation] = useLocation();

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none ${className || ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`} />
      </div>
    </th>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <SortHeader field="address" label="Address" className="min-w-[200px]" />
              <SortHeader field="owner" label="Owner" className="min-w-[140px]" />
              <SortHeader field="desk" label="Desk" className="min-w-[120px]" />
              <SortHeader field="stage" label="Stage" className="min-w-[140px]" />
              <SortHeader field="temperature" label="Temp" className="min-w-[80px]" />
              <SortHeader field="value" label="Value" className="min-w-[100px]" />
              <SortHeader field="daysInStage" label="Days" className="min-w-[70px]" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {properties.map((property) => {
              const stageConfig = STAGE_CONFIGS.find((s) => s.id === property.dealStage);
              const daysInStage = Math.floor(
                (Date.now() - new Date(property.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <tr
                  key={property.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/properties/${property.id}`)}
                >
                  {/* Address */}
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-sm">{property.addressLine1}</div>
                    <div className="text-xs text-muted-foreground">
                      {property.city}, {property.state}
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">
                    {property.owner1Name || "—"}
                  </td>

                  {/* Desk */}
                  <td className="px-3 py-2.5">
                    {property.deskName ? (
                      <Badge variant="secondary" className={`text-xs ${getDeskColor(property.deskName)}`}>
                        {getDeskLabel(property.deskName)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Stage */}
                  <td className="px-3 py-2.5">
                    {stageConfig ? (
                      <Badge variant="outline" className={`text-xs ${stageConfig.bgColor} ${stageConfig.color}`}>
                        {stageConfig.icon} {stageConfig.shortLabel}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{property.dealStage}</span>
                    )}
                  </td>

                  {/* Temperature */}
                  <td className="px-3 py-2.5">
                    {property.leadTemperature && property.leadTemperature !== "TBD" ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          property.leadTemperature === "SUPER HOT" || property.leadTemperature === "HOT"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : property.leadTemperature === "WARM"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : property.leadTemperature === "COLD"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        {property.leadTemperature}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Value */}
                  <td className="px-3 py-2.5 text-sm font-medium">
                    {property.estimatedValue
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 0,
                        }).format(property.estimatedValue)
                      : "—"}
                  </td>

                  {/* Days in Stage */}
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">
                    {daysInStage === 0 ? "Today" : `${daysInStage}d`}
                  </td>

                  {/* Action */}
                  <td className="px-3 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/properties/${property.id}`);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {properties.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          No leads match the current filters
        </div>
      )}

      {/* Summary footer */}
      <div className="px-4 py-2.5 bg-muted/30 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>{properties.length} lead{properties.length !== 1 ? "s" : ""}</span>
        <span className="font-medium text-green-700">
          Total: {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
          }).format(properties.reduce((sum, p) => sum + (p.estimatedValue || 0), 0))}
        </span>
      </div>
    </div>
  );
}

// ── Main Pipeline Page ──────────────────────────────────────────────────
export default function PipelineKanban() {
  const [activeProperty, setActiveProperty] = useState<PropertyCard | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [deskFilter, setDeskFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("stage");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
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
      activationConstraint: { distance: 8 },
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

    updateStageMutation.mutate({
      propertyId: property.id,
      newStage,
      notes: `Moved from ${property.dealStage} to ${newStage} via Kanban board`,
    });
  };

  // Pipeline stage IDs (same filter as Kanban view)
  const pipelineStageIds = useMemo(
    () => STAGE_CONFIGS.filter((s) => s.isPipeline && s.phase !== "dead").map((s) => s.id as string),
    []
  );

  // Filter properties by desk AND only pipeline stages
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    let filtered = (properties as PropertyCard[]).filter((p) => pipelineStageIds.includes(p.dealStage));
    if (deskFilter !== "all") {
      filtered = filtered.filter((p) => p.deskName === deskFilter);
    }
    return filtered;
  }, [properties, deskFilter, pipelineStageIds]);

  // Sort properties for list view
  const sortedProperties = useMemo(() => {
    const sorted = [...filteredProperties];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "address":
          cmp = (a.addressLine1 || "").localeCompare(b.addressLine1 || "");
          break;
        case "owner":
          cmp = (a.owner1Name || "").localeCompare(b.owner1Name || "");
          break;
        case "desk":
          cmp = (a.deskName || "").localeCompare(b.deskName || "");
          break;
        case "stage": {
          const stageOrder = STAGE_CONFIGS.map((s) => s.id);
          cmp = stageOrder.indexOf(a.dealStage as DealStage) - stageOrder.indexOf(b.dealStage as DealStage);
          break;
        }
        case "temperature": {
          const tempOrder = ["SUPER HOT", "HOT", "WARM", "COLD", "TBD", "DEAD"];
          cmp = tempOrder.indexOf(a.leadTemperature || "TBD") - tempOrder.indexOf(b.leadTemperature || "TBD");
          break;
        }
        case "value":
          cmp = (a.estimatedValue || 0) - (b.estimatedValue || 0);
          break;
        case "daysInStage": {
          const daysA = Date.now() - new Date(a.stageChangedAt).getTime();
          const daysB = Date.now() - new Date(b.stageChangedAt).getTime();
          cmp = daysA - daysB;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProperties, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getPropertiesByStage = (stage: DealStage): PropertyCard[] => {
    return filteredProperties.filter((p) => p.dealStage === stage);
  };

  // Count properties per desk for the filter badge (pipeline stages only)
  const pipelineProperties = useMemo(() => {
    if (!properties) return [];
    return (properties as PropertyCard[]).filter((p) => pipelineStageIds.includes(p.dealStage));
  }, [properties, pipelineStageIds]);

  const deskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pipelineProperties.forEach((p) => {
      const desk = p.deskName || "NOT_ASSIGNED";
      counts[desk] = (counts[desk] || 0) + 1;
    });
    return counts;
  }, [pipelineProperties]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Deal Pipeline</h1>
          <p className="text-muted-foreground">
            {viewMode === "kanban"
              ? "Drag and drop leads between stages to update their status"
              : "List view of all pipeline leads — click any row to open details"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Desk Filter */}
          <Select value={deskFilter} onValueChange={setDeskFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Desks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Desks ({pipelineProperties.length})</SelectItem>
              {DESK_OPTIONS.map((desk) => (
                <SelectItem key={desk} value={desk}>
                  {getDeskLabel(desk)} {deskCounts[desk] ? `(${deskCounts[desk]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-9 px-3 gap-1.5"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Board</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-9 px-3 gap-1.5"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="text-sm text-muted-foreground px-4 py-3 bg-muted/30 rounded-lg border">
        💼 <strong>Pipeline View:</strong> Showing only active deals (seller interested). Pre-pipeline stages (New Lead, Skip Traced, First Contact) remain in Properties list.
        {deskFilter !== "all" && (
          <span className="ml-2">
            — Filtered by <strong>{getDeskLabel(deskFilter)}</strong> ({filteredProperties.length} leads)
          </span>
        )}
      </div>

      {/* Kanban View */}
      {viewMode === "kanban" && (
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

          <DragOverlay>
            {activeProperty ? (
              <div className="rotate-3">
                <DraggablePropertyCard property={activeProperty} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <PipelineListView
          properties={sortedProperties}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}
    </div>
  );
}
