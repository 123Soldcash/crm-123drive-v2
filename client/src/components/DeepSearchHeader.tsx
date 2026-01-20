import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DeepSearchHeaderProps {
  completionPercent: number;
  leadTemperature?: string;
  propertyAddress?: string;
}

export function DeepSearchHeader({ 
  completionPercent, 
  leadTemperature = "TBD",
  propertyAddress 
}: DeepSearchHeaderProps) {
  const getCompletionStatus = () => {
    if (completionPercent >= 80) return { label: "Almost Complete", color: "text-green-600", icon: CheckCircle2 };
    if (completionPercent >= 50) return { label: "In Progress", color: "text-blue-600", icon: TrendingUp };
    if (completionPercent >= 25) return { label: "Getting Started", color: "text-yellow-600", icon: Clock };
    return { label: "Just Started", color: "text-gray-500", icon: AlertTriangle };
  };

  const status = getCompletionStatus();
  const StatusIcon = status.icon;

  const getTemperatureStyle = () => {
    switch (leadTemperature) {
      case "SUPER HOT":
        return "bg-gradient-to-r from-blue-600 to-blue-800 text-white animate-pulse";
      case "HOT":
        return "bg-gradient-to-r from-green-600 to-green-800 text-white";
      case "DEEP SEARCH":
        return "bg-gradient-to-r from-purple-600 to-purple-800 text-white";
      case "WARM":
        return "bg-gradient-to-r from-amber-500 to-amber-700 text-white";
      case "COLD":
        return "bg-gradient-to-r from-gray-500 to-gray-700 text-white";
      case "DEAD":
        return "bg-gradient-to-r from-purple-700 to-purple-900 text-white";
      default:
        return "bg-white border-2 border-gray-400 text-gray-700";
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 rounded-t-xl p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <Search className="h-8 w-8 text-blue-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">DEEP SEARCH</h2>
            {propertyAddress && (
              <p className="text-sm text-blue-200 mt-1">{propertyAddress}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Lead Temperature Badge */}
          <Badge className={cn("text-lg px-4 py-2 font-bold shadow-lg", getTemperatureStyle())}>
            {leadTemperature === "SUPER HOT" && "🔥🔥 "}
            {leadTemperature === "HOT" && "🔥 "}
            {leadTemperature === "DEEP SEARCH" && "🔍 "}
            {leadTemperature === "WARM" && "☀️ "}
            {leadTemperature === "COLD" && "❄️ "}
            {leadTemperature === "DEAD" && "💀 "}
            {leadTemperature}
          </Badge>
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", status.color.replace("text-", "text-"))} />
            <span className="text-sm font-medium text-blue-100">{status.label}</span>
          </div>
          <span className="text-2xl font-bold text-white">{completionPercent}%</span>
        </div>
        <Progress 
          value={completionPercent} 
          className="h-3 bg-white/20"
        />
        <div className="flex justify-between mt-2 text-xs text-blue-200">
          <span>Research Started</span>
          <span>Analysis Complete</span>
          <span>Ready for Outreach</span>
        </div>
      </div>
    </div>
  );
}
