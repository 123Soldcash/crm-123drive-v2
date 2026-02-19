import React from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  FileText,
  Phone,
  Calculator,
  Handshake,
  FileCheck,
  Home,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface LeadStageNavigationProps {
  currentStage: string;
  onStageClick?: (stage: string) => void;
  isDead?: boolean;
}

const LEAD_STAGES = [
  { id: "research", label: "Research", icon: Search, description: "Initial property research" },
  { id: "deep_search", label: "Deep Search", icon: FileText, description: "Detailed analysis" },
  { id: "outreach", label: "Outreach", icon: Phone, description: "Contact attempts" },
  { id: "analysis", label: "Analysis", icon: Calculator, description: "Financial analysis" },
  { id: "negotiation", label: "Negotiation", icon: Handshake, description: "Deal negotiation" },
  { id: "contract", label: "Contract", icon: FileCheck, description: "Contract phase" },
  { id: "closing", label: "Closing", icon: Home, description: "Final closing" },
  { id: "completed", label: "Completed", icon: CheckCircle2, description: "Deal completed" },
];

export function LeadStageNavigation({ currentStage, onStageClick, isDead = false }: LeadStageNavigationProps) {
  const currentIndex = LEAD_STAGES.findIndex(s => s.id === currentStage);

  // If lead is dead, show special dead state
  if (isDead) {
    return (
      <div className="w-full bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center justify-center gap-4">
          <div className="p-4 bg-red-500/20 rounded-full animate-pulse">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">Lead Marked as DEAD</h3>
            <p className="text-gray-400 text-sm mt-1">This lead is no longer active</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 shadow-sm border-2 border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
          Lead Progress
        </h3>
        <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
          Step {currentIndex + 1} of {LEAD_STAGES.length}
        </span>
      </div>

      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute top-5 left-0 right-0 h-1.5 bg-slate-200 z-0 rounded-full" />
        {/* Progress line filled */}
        <div 
          className="absolute top-5 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-green-500 z-0 transition-all duration-700 ease-out rounded-full"
          style={{ width: `${(currentIndex / (LEAD_STAGES.length - 1)) * 100}%` }}
        />

        {LEAD_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div
              key={stage.id}
              className="relative z-10 flex flex-col items-center group cursor-pointer"
              onClick={() => onStageClick?.(stage.id)}
            >
              {/* Stage circle */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg shadow-green-200",
                  isCurrent && "bg-gradient-to-br from-blue-500 to-blue-700 text-white ring-4 ring-blue-200 scale-125 shadow-xl shadow-blue-300",
                  isFuture && "bg-white text-gray-500 border-2 border-gray-300 hover:border-gray-400 hover:scale-105"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "mt-3 text-xs font-medium transition-colors text-center max-w-[60px]",
                  isCompleted && "text-green-600 font-semibold",
                  isCurrent && "text-blue-700 font-bold",
                  isFuture && "text-gray-500"
                )}
              >
                {stage.label}
              </span>

              {/* Tooltip on hover */}
              <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white text-gray-700 border border-gray-200 text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-xl z-20">
                {stage.description}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Stage Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg text-white">
            {React.createElement(LEAD_STAGES[currentIndex]?.icon || Search, { className: "h-5 w-5" })}
          </div>
          <div>
            <p className="font-bold text-blue-900">
              Current: {LEAD_STAGES[currentIndex]?.label}
            </p>
            <p className="text-sm text-blue-600">
              {LEAD_STAGES[currentIndex]?.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
