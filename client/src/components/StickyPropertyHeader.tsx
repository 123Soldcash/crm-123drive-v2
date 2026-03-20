import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  Zap,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";

const DEAD_REASON_OPTIONS = [
  { value: "SOLD_COMPANY", label: "Sold to another company", note: "(Note: Potential for us to reach out as a new buyer)" },
  { value: "SOLD_PERSON", label: "Sold to a Person" },
  { value: "SOLD_NO_INFO", label: "Sold — No information is available" },
  { value: "GHOST_SELLER", label: "Ghost Seller", note: "(After 24 attempts, the seller can no longer be reached)" },
  { value: "TITLE_ISSUES", label: "Title Issues", note: "(Problems with the title/legal ownership)" },
  { value: "PROPERTY_CONDITION", label: "Property Condition", note: "The house is in worse shape than expected, or the repair costs make the deal unfeasible" },
  { value: "REFINANCED", label: "Refinanced", note: "The owner found a way to keep the property by restructuring their debt" },
  { value: "DUPLICATE_LEAD", label: "Duplicate Lead", note: "The lead was already in the system under a different name or number" },
  { value: "WRONG_INFO", label: "Wrong Person/Number/Fraud", note: "The contact information was incorrect" },
  { value: "NO_BUYER", label: "Unable to Assign / No Buyer Found" },
  { value: "OTHER", label: "Other (Notes)" },
];
import { STAGE_CONFIGS, getStageConfig, type DealStage } from "@/lib/stageConfig";
import { DistressScoreBadge } from "@/components/DistressScoreBadge";
import { PropertyImage } from "@/components/PropertyImage";

// Desk options with colors
const NOT_ASSIGNED_DESK = { value: "NOT_ASSIGNED", label: "⚪ Not Assigned", color: "bg-gray-100 text-gray-500 border-gray-300" };
const DESK_OPTIONS = [
  { value: "NEW_LEAD", label: "🆕 New Lead", color: "bg-green-200 text-green-800 border-green-300" },
  { value: "DESK_CHRIS", label: "🏀 Chris", color: "bg-orange-200 text-orange-800 border-orange-300" },
  { value: "DESK_DEEP_SEARCH", label: "🔍 Deep Search", color: "bg-purple-200 text-purple-800 border-purple-300" },
  { value: "DESK_1", label: "🟦 Manager", color: "bg-sky-200 text-sky-800 border-sky-300" },
  { value: "DESK_2", label: "🟩 Edsel", color: "bg-emerald-200 text-emerald-800 border-emerald-300" },
  { value: "DESK_3", label: "🟧 Zach", color: "bg-pink-200 text-pink-800 border-pink-300" },
  { value: "DESK_4", label: "🔵 Rodolfo", color: "bg-blue-600 text-white border-blue-700" },
  { value: "DESK_5", label: "🟨 Lucas", color: "bg-amber-200 text-amber-800 border-amber-300" },
  { value: "BIN", label: "🗑️ BIN", color: "bg-gray-200 text-gray-700 border-gray-300" },
  { value: "DEAD", label: "💀 Dead", color: "bg-gray-800 text-white border-gray-900" },
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
  onUpdateDesk: (deskName: string, deadReason?: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  currentIndex: number;
  totalCount: number;
  zillowUrl: string;
  propertyImage?: string | null;
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
  zillowUrl,
  propertyImage = null
}: StickyPropertyHeaderProps) {
  const [isSticky, setIsSticky] = useState(false);
  const [deskDropdownOpen, setDeskDropdownOpen] = useState(false);
  const [deskDropdownPos, setDeskDropdownPos] = useState({ top: 0, left: 0 });
  const deskButtonRef = useRef<HTMLButtonElement>(null);
  const [showDeadReasonDialog, setShowDeadReasonDialog] = useState(false);
  const [deadReasonCategory, setDeadReasonCategory] = useState("");
  const [deadReason, setDeadReason] = useState("");
  const [deadReasonError, setDeadReasonError] = useState("");
  const [deadCategoryError, setDeadCategoryError] = useState("");

  const currentDesk = DESK_OPTIONS.find(d => d.value === property.deskName) || NOT_ASSIGNED_DESK;

  const openDeskDropdown = useCallback(() => {
    if (deskButtonRef.current) {
      const rect = deskButtonRef.current.getBoundingClientRect();
      setDeskDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
    setDeskDropdownOpen(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 220);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const formatCurrency = (value?: number | string | null) => {
    if (value === null || value === undefined) return "$0";
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
    if (isNaN(numValue) || numValue === 0) return "$0";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numValue);
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

  const owner1 = property.primaryOwner || property.owner1Name || property.ownerName;
  const owner2 = property.owner2Name;
  const ownerName = owner1 && owner2 ? `${owner1}, ${owner2}` : owner1 || "N/A";
  const location = property.ownerOccupied === "Yes" || property.ownerOccupied === true || property.ownerOccupied === "Owner Occupied" 
    ? "Owner Occupied" : "Absentee";
  const beds = property.bedrooms !== null && property.bedrooms !== undefined ? String(property.bedrooms) : "0";
  const baths = property.bathrooms !== null && property.bathrooms !== undefined ? String(property.bathrooms) : "0";
  const sqft = property.squareFeet ? Number(property.squareFeet).toLocaleString() : "N/A";
  const yearBuilt = property.yearBuilt || "N/A";

  // ─── STICKY COMPACT HEADER ───────────────────────────────────────────────
  if (isSticky) {
    return (
      <div className="md:fixed md:top-0 md:right-0 md:left-[var(--sidebar-width)] z-40 bg-white/95 backdrop-blur-sm border-b shadow-md py-2 px-3 md:px-6 md:animate-in md:slide-in-from-top relative mb-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Compact image */}
            <PropertyImage
              propertyId={property.id}
              propertyImage={propertyImage}
              address={property.addressLine1}
              city={property.city}
              state={property.state}
              zipcode={property.zipcode || ""}
              compact={true}
            />

            {/* Navigation */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onPrevious} disabled={currentIndex <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[11px] font-bold px-1.5 text-slate-600">{currentIndex + 1}/{totalCount}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onNext} disabled={currentIndex >= totalCount - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Address */}
            <div className="flex-1 min-w-0">
              <h1 className="font-black tracking-tight text-slate-900 text-sm md:text-base lg:text-lg leading-tight truncate">
                {property.addressLine1}
              </h1>
              <span className="text-gray-500 font-medium text-xs hidden sm:block">
                {property.city}, {property.state} {property.zipcode || ""}
              </span>
            </div>

            {/* Temperature selector */}
            <div className="hidden md:flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-100 overflow-x-auto shrink-0">
              <span className="text-[9px] font-bold text-gray-500 uppercase ml-1 mr-0.5 shrink-0">Temp:</span>
              {["SUPER HOT", "HOT", "WARM", "COLD", "TBD"].map((temp) => (
                <Button
                  key={temp}
                  variant={property.leadTemperature === temp ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-6 px-1.5 text-[9px] font-bold shrink-0 min-h-0 min-w-0",
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

            {/* Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={onEdit} className="h-8 text-xs border-gray-200 min-h-0 min-w-0 px-2">
                <Edit className="h-3.5 w-3.5 mr-1 hidden sm:block" /> Edit
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
                <LayoutGrid className="h-3.5 w-3.5 mr-1 hidden sm:block" />
                {(() => {
                  const stageConfig = currentDealStage ? getStageConfig(currentDealStage as DealStage) : null;
                  return stageConfig?.isPipeline ? stageConfig.shortLabel : "Pipeline";
                })()}
              </Button>
              <Button variant="outline" size="sm" onClick={onAssignAgent} className="h-8 text-xs border-gray-200 min-h-0 min-w-0 px-2 hidden sm:flex">
                <Users className="h-3.5 w-3.5 mr-1" /> Agent
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(zillowUrl, "_blank")} className="h-8 text-xs border-gray-200 min-h-0 min-w-0 px-2 hidden sm:flex">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── EXPANDED HERO HEADER ────────────────────────────────────────────────
  return (
    <div className="relative mb-6">
      {/* Back + Navigation bar */}
      <div className="flex items-center justify-between mb-3 px-0">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-slate-500 h-8 px-2 min-h-0 min-w-0">
          <ChevronLeft className="h-4 w-4 mr-0.5" /> Back
        </Button>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onPrevious} disabled={currentIndex <= 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[11px] font-bold px-1.5 text-slate-600">{currentIndex + 1}/{totalCount}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onNext} disabled={currentIndex >= totalCount - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero Card: Image + Info side by side */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-3">
        <div className="flex flex-col sm:flex-row">
          {/* Large Hero Image */}
          <div className="relative sm:w-72 md:w-80 lg:w-96 shrink-0 h-48 sm:h-auto min-h-[180px] overflow-hidden rounded-t-xl sm:rounded-l-xl sm:rounded-tr-none">
            <PropertyImage
              propertyId={property.id}
              propertyImage={propertyImage}
              address={property.addressLine1}
              city={property.city}
              state={property.state}
              zipcode={property.zipcode || ""}
              compact={false}
              hero={true}
            />
          </div>

          {/* Property Info Panel */}
          <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
            {/* Address + Actions row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h1 className="font-black tracking-tight text-slate-900 text-xl sm:text-2xl md:text-3xl leading-tight">
                  {property.addressLine1}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-gray-500 font-medium text-sm">
                    {property.city}, {property.state} {property.zipcode || ""}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                    return stageConfig?.isPipeline ? stageConfig.shortLabel : "Pipeline";
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

            {/* Temperature + Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Temperature selector */}
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

              {/* Desk Selector */}
              <div className="relative">
                <Button
                  ref={deskButtonRef}
                  variant="outline"
                  size="sm"
                  className={cn("h-7 text-[10px] font-bold border-2 min-h-0 min-w-0 px-2", currentDesk.color)}
                  onClick={() => deskDropdownOpen ? setDeskDropdownOpen(false) : openDeskDropdown()}
                >
                  {currentDesk.label}
                  <ChevronRight className={cn("h-3 w-3 ml-0.5 transition-transform", deskDropdownOpen && "rotate-90")} />
                </Button>
              </div>
              {deskDropdownOpen && createPortal(
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-[9998]" onClick={() => setDeskDropdownOpen(false)} />
                  <div
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl p-1 min-w-[150px]"
                    style={{ top: deskDropdownPos.top, left: deskDropdownPos.left }}
                  >
                    {DESK_OPTIONS.map((desk) => (
                      <button
                        key={desk.value}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-[11px] font-semibold rounded-md transition-colors hover:bg-slate-50",
                          desk.value === property.deskName && "bg-slate-100"
                        )}
                        onClick={() => {
                          if (desk.value === "DEAD") {
                            setDeskDropdownOpen(false);
                            setDeadReason("");
                            setDeadReasonError("");
                            setShowDeadReasonDialog(true);
                          } else {
                            onUpdateDesk(desk.value);
                            setDeskDropdownOpen(false);
                          }
                        }}
                      >
                        {desk.label}
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )}

              {/* Deep Search Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-bold border-2 min-h-0 min-w-0 px-2 border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
                onClick={() => {
                  const el = document.getElementById("deep-search-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                🔍 Deep Search
              </Button>

              {/* Distress Score Badge */}
              <DistressScoreBadge propertyId={property.id} />
            </div>
          </div>
        </div>

        {/* ─── DATA TABLE: Property / Financial / Identifiers / Owner (inside hero card) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-4 pb-3 border-t border-slate-100 pt-2">
          {/* Property Info */}
          <div className="space-y-1 p-1.5 sm:p-2 bg-slate-50 rounded-lg">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Property</h3>
            <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Type</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 truncate max-w-[70px]">{property.propertyType || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Year</span>
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
          <div className="space-y-1 p-1.5 sm:p-2 bg-slate-50 rounded-lg">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Financial</h3>
            <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Value</span>
                <span className="text-[10px] sm:text-xs font-bold text-emerald-600">{formatCurrency(property.estimatedValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Equity</span>
                <span className="text-[10px] sm:text-xs font-bold text-blue-600">{formatCurrency(property.equityAmount || property.equity)}</span>
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
          <div className="space-y-1 p-1.5 sm:p-2 bg-slate-50 rounded-lg">
            <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Identifiers</h3>
            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex justify-between items-center gap-1 sm:gap-2">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase shrink-0">APN</span>
                <span className="text-[10px] sm:text-xs font-bold text-purple-600 font-mono text-right break-all">{property.apnParcelId || property.parcelNumber || property.apn || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center gap-1 sm:gap-2">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase shrink-0">Prop ID</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-600 font-mono text-right break-all">{property.propertyId || property.id || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">Status</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 truncate max-w-[80px]">{property.trackingStatus || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="space-y-1 p-1.5 sm:p-2 bg-slate-50 rounded-lg">
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

      {/* ─── EMPTY SECTION: Reserved for future use ─── */}
      <div className="min-h-0" />

      {/* ─── DEAD REASON DIALOG ─── */}
      <Dialog open={showDeadReasonDialog} onOpenChange={(open) => {
        setShowDeadReasonDialog(open);
        if (!open) { setDeadReasonCategory(""); setDeadReason(""); setDeadReasonError(""); setDeadCategoryError(""); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>💀</span> Mark as Dead
            </DialogTitle>
            <DialogDescription>
              Select a reason and provide additional details. This will be saved to General Notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Reason Selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Reason <span className="text-red-500">*</span></label>
              <Select value={deadReasonCategory} onValueChange={(v) => { setDeadReasonCategory(v); setDeadCategoryError(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {DEAD_REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-medium">{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deadReasonCategory && (() => {
                const selected = DEAD_REASON_OPTIONS.find(o => o.value === deadReasonCategory);
                return selected?.note ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 italic">{selected.note}</p>
                ) : null;
              })()}
              {deadCategoryError && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {deadCategoryError}
                </p>
              )}
            </div>
            {/* Additional Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Additional Notes</label>
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                <Textarea
                  placeholder="Add any additional details or context..."
                  value={deadReason}
                  onChange={(e) => { setDeadReason(e.target.value); setDeadReasonError(""); }}
                  className="min-h-[80px] bg-white dark:bg-gray-900"
                />
                {deadReasonError && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {deadReasonError}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadReasonDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                let hasError = false;
                if (!deadReasonCategory) {
                  setDeadCategoryError("Please select a reason.");
                  hasError = true;
                }
                if (deadReasonCategory === "OTHER" && !deadReason.trim()) {
                  setDeadReasonError("Please provide details when selecting 'Other'.");
                  hasError = true;
                }
                if (hasError) return;
                const selectedLabel = DEAD_REASON_OPTIONS.find(o => o.value === deadReasonCategory)?.label || deadReasonCategory;
                const selectedNote = DEAD_REASON_OPTIONS.find(o => o.value === deadReasonCategory)?.note || "";
                const fullReason = `Category: ${selectedLabel}${selectedNote ? " " + selectedNote : ""}${deadReason.trim() ? "\nDetails: " + deadReason.trim() : ""}`;
                onUpdateDesk("DEAD", fullReason);
                setShowDeadReasonDialog(false);
                setDeadReasonCategory("");
                setDeadReason("");
              }}
            >
              💀 Mark as Dead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
