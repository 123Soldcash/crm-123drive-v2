import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  ExternalLink, 
  Flame, 
  Snowflake, 
  ThermometerSun, 
  Check, 
  X, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  Users,
  LayoutGrid,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_CONFIGS, getStageConfig, type DealStage } from "@/lib/stageConfig";
import { DistressScoreBadge } from "@/components/DistressScoreBadge";

// Desk options with colors
const DESK_OPTIONS = [
  { value: "BIN", label: "🗑️ BIN", color: "bg-gray-200 text-gray-700 border-gray-300" },
  { value: "DESK_CHRIS", label: "🏀 Chris", color: "bg-orange-200 text-orange-800 border-orange-300" },
  { value: "DESK_DEEP_SEARCH", label: "🔍 Deep Search", color: "bg-purple-200 text-purple-800 border-purple-300" },
  { value: "DESK_1", label: "🟦 Desk 1", color: "bg-sky-200 text-sky-800 border-sky-300" },
  { value: "DESK_2", label: "🟩 Desk 2", color: "bg-emerald-200 text-emerald-800 border-emerald-300" },
  { value: "DESK_3", label: "🟧 Desk 3", color: "bg-pink-200 text-pink-800 border-pink-300" },
  { value: "DESK_4", label: "🔵 Desk 4", color: "bg-blue-600 text-white border-blue-700" },
  { value: "DESK_5", label: "🟨 Desk 5", color: "bg-amber-200 text-amber-800 border-amber-300" },
  { value: "ARCHIVED", label: "⬛ Archived", color: "bg-gray-800 text-white border-gray-900" },
];

interface StickyPropertyHeaderProps {
  property: any;
  tags: any[];
  onEdit: () => void;
  onAddToPipeline: () => void;
  currentDealStage?: string | null;
  onAssignAgent: () => void;
  onUpdateLeadTemperature: (temp: string) => void;
  onToggleOwnerVerified: () => void;
  onUpdateDesk: (deskName: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  currentIndex: number;
  totalCount: number;
  zillowUrl: string;
}

export function StickyPropertyHeader({
  property,
  tags,
  onEdit,
  onAddToPipeline,
  currentDealStage,
  onAssignAgent,
  onUpdateLeadTemperature,
  onToggleOwnerVerified,
  onUpdateDesk,
  onPrevious,
  onNext,
  currentIndex,
  totalCount,
  zillowUrl
}: StickyPropertyHeaderProps) {
  const [isSticky, setIsSticky] = useState(false);
  const [deskDropdownOpen, setDeskDropdownOpen] = useState(false);

  const currentDesk = DESK_OPTIONS.find(d => d.value === property.deskName) || DESK_OPTIONS[0];

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Robust financial formatting with fallbacks for ADHD-friendly focus
  const formatCurrency = (value?: number | string | null) => {
    if (value === null || value === undefined) return "$0";
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
    if (isNaN(numValue) || numValue === 0) return "$0";
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const getTempIcon = (temp: string) => {
    switch (temp) {
      case "SUPER HOT": return <Zap className="h-3 w-3 mr-0.5 text-blue-400" />;
      case "HOT": return <Flame className="h-3 w-3 mr-0.5 text-orange-500" />;
      case "WARM": return <ThermometerSun className="h-3 w-3 mr-0.5 text-amber-500" />;
      case "COLD": return <Snowflake className="h-3 w-3 mr-0.5 text-blue-500" />;
      default: return null;
    }
  };

  // Robust data mapping
  const owner1 = property.primaryOwner || property.owner1Name || property.ownerName;
  const owner2 = property.owner2Name;
  const ownerName = owner1 && owner2 
    ? `${owner1}, ${owner2}` 
    : owner1 || "N/A";
  const location = property.ownerOccupied === "Yes" || property.ownerOccupied === true || property.ownerOccupied === "Owner Occupied" 
    ? "Owner Occupied" 
    : "Absentee";
  
  const beds = property.bedrooms !== null && property.bedrooms !== undefined ? String(property.bedrooms) : "0";
  const baths = property.bathrooms !== null && property.bathrooms !== undefined ? String(property.bathrooms) : "0";
  const sqft = property.squareFeet ? Number(property.squareFeet).toLocaleString() : "N/A";
  const yearBuilt = property.yearBuilt || "N/A";

  return (
    <div className={cn(
      "z-40 transition-all duration-300 ease-in-out",
      isSticky 
        ? "md:fixed md:top-0 md:right-0 md:left-0 bg-white/95 backdrop-blur-sm border-b shadow-md py-2 px-3 md:px-6 md:animate-in md:slide-in-from-top relative mb-6" 
        : "relative mb-6"
    )}>
      <div className="max-w-[1600px] mx-auto">
        {/* === ROW 1: Back + Navigation + Address === */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          {/* Left: Back + Nav */}
          <div className="flex items-center gap-2">
            {!isSticky && (
              <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-slate-500 h-8 px-2 min-h-0 min-w-0">
                <ChevronLeft className="h-4 w-4 mr-0.5" /> Back
              </Button>
            )}
            
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onPrevious} disabled={currentIndex <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[11px] font-bold px-1.5 text-slate-600">
                {currentIndex + 1}/{totalCount}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onNext} disabled={currentIndex >= totalCount - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Address - full width on mobile */}
          <div className="flex-1 min-w-0">
            <h1 className={cn(
              "font-black tracking-tight text-slate-900 transition-all leading-tight",
              isSticky ? "text-sm md:text-base lg:text-lg" : "text-base sm:text-lg md:text-2xl lg:text-3xl"
            )}>
              {property.addressLine1}
            </h1>
            <span className="text-gray-500 font-medium text-xs sm:text-xs md:text-sm">
              {property.city}, {property.state} {property.zipcode || ""}
            </span>
          </div>

          {/* Action Buttons - wrap on mobile */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onEdit} className="h-8 text-xs border-gray-200 min-h-0 min-w-0 px-2">
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button 
              onClick={onAddToPipeline} 
              size="sm" 
              className={cn(
                "h-8 text-xs text-white min-h-0 min-w-0 px-2",
                currentDealStage && currentDealStage !== "NEW_LEAD" && currentDealStage !== "LEAD_IMPORTED" && currentDealStage !== "SKIP_TRACED" && currentDealStage !== "FIRST_CONTACT_MADE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              {(() => {
                const stageConfig = currentDealStage ? getStageConfig(currentDealStage as DealStage) : null;
                const isInPipeline = stageConfig?.isPipeline;
                return isInPipeline ? `${stageConfig!.shortLabel}` : "Pipeline";
              })()}
            </Button>
            <Button variant="outline" size="sm" onClick={onAssignAgent} className="h-8 text-xs border-gray-200 min-h-0 min-w-0 px-2">
              <Users className="h-3.5 w-3.5 mr-1" /> Agent
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(zillowUrl, "_blank")} className="h-8 text-xs border-gray-200 min-h-0 min-w-0 px-2">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* === ROW 2: Temperature + Owner Verified + Desk + Distress + Tags === */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Temperature selector - scrollable on mobile */}
          <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-100 overflow-x-auto">
            <span className="text-[9px] font-bold text-gray-500 uppercase ml-1 mr-0.5 shrink-0">Temp:</span>
            {["SUPER HOT", "HOT", "WARM", "COLD", "TBD"].map((temp) => (
              <Button
                key={temp}
                variant={property.leadTemperature === temp ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 px-1.5 text-[9px] md:text-[10px] font-bold shrink-0 min-h-0 min-w-0",
                  property.leadTemperature === temp 
                    ? (temp === "SUPER HOT" ? "bg-blue-700 hover:bg-blue-800 text-white" : temp === "HOT" ? "bg-green-700 hover:bg-green-800 text-white" : temp === "WARM" ? "bg-amber-600 hover:bg-amber-700 text-white" : temp === "COLD" ? "bg-gray-600 hover:bg-gray-700 text-white" : "bg-white border-2 border-gray-400 text-gray-700")
                    : "text-slate-500 hover:bg-slate-200"
                )}
                onClick={() => onUpdateLeadTemperature(temp)}
              >
                {getTempIcon(temp)}
                {temp === "SUPER HOT" ? "S.HOT" : temp}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-[10px] font-bold border-2 min-h-0 min-w-0 px-2",
              property.ownerVerified 
                ? "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" 
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
            onClick={onToggleOwnerVerified}
          >
            {property.ownerVerified ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
            Verified
          </Button>

          {/* Desk Selector Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 text-[10px] font-bold border-2 min-h-0 min-w-0 px-2",
                currentDesk.color
              )}
              onClick={() => setDeskDropdownOpen(!deskDropdownOpen)}
            >
              {currentDesk.label}
              <ChevronRight className={cn("h-3 w-3 ml-0.5 transition-transform", deskDropdownOpen && "rotate-90")} />
            </Button>
            {deskDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                {DESK_OPTIONS.map((desk) => (
                  <button
                    key={desk.value}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-xs font-bold hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 min-h-[44px]",
                      property.deskName === desk.value && "bg-slate-100"
                    )}
                    onClick={() => {
                      onUpdateDesk(desk.value);
                      setDeskDropdownOpen(false);
                    }}
                  >
                    <span className={cn("px-2 py-0.5 rounded text-[10px]", desk.color)}>
                      {desk.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DistressScoreBadge propertyId={property.id} />
        </div>

        {/* Tags row - separate for mobile clarity */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="bg-slate-100 text-slate-600 border-gray-200 text-[10px] py-0 h-5">
                {tag.tag}
              </Badge>
            ))}
          </div>
        )}

        {/* === ROW 3: Property Info Grid — responsive 1 col mobile, 2 col tablet, 4 col desktop === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 bg-slate-50/50 rounded-xl border border-slate-100 p-2 sm:p-3">
          {/* Property Details */}
          <div className="space-y-1 sm:space-y-1.5 p-1.5 sm:p-2 bg-white rounded-lg border border-slate-100">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Property</h3>
            <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Type</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{property.propertyType || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Built</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{yearBuilt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Bed/Bath</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{beds}/{baths}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Sqft</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{sqft}</span>
              </div>
            </div>
          </div>

          {/* Financial Info */}
          <div className="space-y-1 sm:space-y-1.5 p-1.5 sm:p-2 bg-white rounded-lg border border-slate-100">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Financial</h3>
            <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Value</span>
                <span className="text-[10px] sm:text-xs font-bold text-emerald-600">{formatCurrency(property.estimatedValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Equity</span>
                <span className="text-[10px] sm:text-xs font-bold text-blue-600">{formatCurrency(property.equityAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Mortgage</span>
                <span className="text-[10px] sm:text-xs font-bold text-rose-600">{formatCurrency(property.mortgageBalance || property.mortgageAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Taxes</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{formatCurrency(property.taxAmount || property.estimatedTaxes)}</span>
              </div>
            </div>
          </div>

          {/* Identifiers */}
          <div className="space-y-1 sm:space-y-1.5 p-1.5 sm:p-2 bg-white rounded-lg border border-slate-100">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Identifiers</h3>
            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex justify-between items-center gap-1 sm:gap-2">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase shrink-0">APN</span>
                <span className="text-[10px] sm:text-xs font-bold text-purple-600 font-mono text-right break-all">{property.apnParcelId || property.parcelNumber || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center gap-1 sm:gap-2">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase shrink-0">Prop ID</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-600 font-mono text-right break-all">{property.propertyId || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Status</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{property.trackingStatus || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="space-y-1 sm:space-y-1.5 p-1.5 sm:p-2 bg-white rounded-lg border border-slate-100">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Owner</h3>
            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex justify-between items-start gap-1 sm:gap-2">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase shrink-0">Name</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 text-right break-words">{ownerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Location</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{location}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Equity %</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">{property.equityPercent || "0"}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
