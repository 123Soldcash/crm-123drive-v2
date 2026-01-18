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

interface StickyPropertyHeaderProps {
  property: any;
  tags: any[];
  onEdit: () => void;
  onAddToPipeline: () => void;
  onAssignAgent: () => void;
  onUpdateLeadTemperature: (temp: string) => void;
  onToggleOwnerVerified: () => void;
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
  onAssignAgent,
  onUpdateLeadTemperature,
  onToggleOwnerVerified,
  onPrevious,
  onNext,
  currentIndex,
  totalCount,
  zillowUrl
}: StickyPropertyHeaderProps) {
  const [isSticky, setIsSticky] = useState(false);

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
      case "SUPER HOT": return <Zap className="h-3 w-3 mr-1 text-blue-400" />;
      case "HOT": return <Flame className="h-3 w-3 mr-1 text-orange-500" />;
      case "WARM": return <ThermometerSun className="h-3 w-3 mr-1 text-amber-500" />;
      case "COLD": return <Snowflake className="h-3 w-3 mr-1 text-blue-500" />;
      default: return null;
    }
  };

  // Robust data mapping to handle DealMachine and manual entry variations
  const ownerName = property.primaryOwner || property.owner1Name || property.ownerName || "N/A";
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
        ? "fixed top-0 right-0 left-0 md:left-64 bg-white/95 backdrop-blur-sm border-b shadow-md py-2 px-6 animate-in slide-in-from-top" 
        : "relative mb-6"
    )}>
      <div className="max-w-[1600px] mx-auto">
        {/* Top Row: Navigation and Actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            {!isSticky && (
              <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-slate-500">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevious} disabled={currentIndex <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[11px] font-bold px-2 text-slate-600">
                {currentIndex + 1} / {totalCount}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={currentIndex >= totalCount - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <h1 className={cn(
              "font-black tracking-tight text-slate-900 transition-all",
              isSticky ? "text-lg" : "text-3xl"
            )}>
              {property.addressLine1}
              <span className="ml-2 text-slate-400 font-medium text-sm">{property.city}, {property.state}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} className="h-8 text-xs border-slate-200">
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Lead
            </Button>
            <Button onClick={onAddToPipeline} size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Add to Pipeline
            </Button>
            <Button variant="outline" size="sm" onClick={onAssignAgent} className="h-8 text-xs border-slate-200">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Assign Agent
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(zillowUrl, "_blank")} className="h-8 text-xs border-slate-200">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Zillow
            </Button>
          </div>
        </div>

        {/* Middle Row: Status and Tags */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase ml-1 mr-1">Temp:</span>
            {["SUPER HOT", "HOT", "WARM", "COLD", "TBD"].map((temp) => (
              <Button
                key={temp}
                variant={property.leadTemperature === temp ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 px-2 text-[10px] font-bold",
                  property.leadTemperature === temp 
                    ? (temp === "SUPER HOT" ? "bg-blue-600 hover:bg-blue-700" : temp === "HOT" ? "bg-orange-500 hover:bg-orange-600" : temp === "WARM" ? "bg-amber-500 hover:bg-amber-600" : temp === "COLD" ? "bg-blue-500 hover:bg-blue-600" : "bg-slate-600")
                    : "text-slate-500 hover:bg-slate-200"
                )}
                onClick={() => onUpdateLeadTemperature(temp)}
              >
                {getTempIcon(temp)}
                {temp}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-[11px] font-bold border-2",
              property.ownerVerified 
                ? "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" 
                : "border-slate-200 text-slate-400 hover:bg-slate-50"
            )}
            onClick={onToggleOwnerVerified}
          >
            {property.ownerVerified ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
            Owner Verified
          </Button>

          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] py-0 h-6">
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Bottom Row: Compact Info Grid (Pict 3 Style) */}
        <div className="grid grid-cols-3 gap-4 bg-slate-50/50 rounded-xl border border-slate-100 p-3">
          {/* Property Details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-r border-slate-200 pr-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Type</span>
              <span className="text-xs font-bold text-slate-700">{property.propertyType || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Built</span>
              <span className="text-xs font-bold text-slate-700">{yearBuilt}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Beds/Baths</span>
              <span className="text-xs font-bold text-slate-700">{beds}/{baths}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Sqft</span>
              <span className="text-xs font-bold text-slate-700">{sqft}</span>
            </div>
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-r border-slate-200 px-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Value</span>
              <span className="text-xs font-bold text-emerald-600">{formatCurrency(property.estimatedValue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Equity</span>
              <span className="text-xs font-bold text-blue-600">{formatCurrency(property.equityAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Mortgage</span>
              <span className="text-xs font-bold text-rose-600">{formatCurrency(property.mortgageBalance || property.mortgageAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Taxes</span>
              <span className="text-xs font-bold text-slate-700">{formatCurrency(property.taxAmount || property.estimatedTaxes)}</span>
            </div>
          </div>

          {/* Owner Info */}
          <div className="grid grid-cols-1 gap-y-1 pl-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Owner</span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{ownerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Location</span>
              <span className="text-xs font-bold text-slate-700">{location}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
