import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon: LucideIcon | string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  accentColor?: "blue" | "yellow" | "pink" | "purple" | "green" | "gray" | "orange";
}

export function CollapsibleSection({
  title,
  icon,
  children,
  isOpen,
  onToggle,
  badge,
  action,
  className,
  headerClassName,
  accentColor = "gray",
}: CollapsibleSectionProps) {
  const accentStyles = {
    blue: "border-blue-500/50 border-l-4 border-l-blue-500",
    yellow: "border-yellow-500/50 border-l-4 border-l-yellow-500",
    pink: "border-pink-500/50 border-l-4 border-l-pink-500",
    purple: "border-purple-500/50 border-l-4 border-l-purple-500",
    green: "border-green-500/50 border-l-4 border-l-green-500",
    orange: "border-orange-500/50 border-l-4 border-l-orange-500",
    gray: "border-slate-300 border-l-4 border-l-slate-400",
  };

  const Icon = icon;

  return (
    <Card className={cn("overflow-hidden border shadow-sm bg-white transition-all duration-200", accentStyles[accentColor], className)}>
      <CardHeader 
        className={cn(
          "py-3 px-4 flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-slate-50/50 transition-colors",
          headerClassName
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1.5 rounded-md flex items-center justify-center",
            accentColor === "blue" && "bg-blue-50 text-blue-600",
            accentColor === "yellow" && "bg-yellow-50 text-yellow-600",
            accentColor === "pink" && "bg-pink-50 text-pink-600",
            accentColor === "purple" && "bg-purple-50 text-purple-600",
            accentColor === "green" && "bg-green-50 text-green-600",
            accentColor === "orange" && "bg-orange-50 text-orange-600",
            accentColor === "gray" && "bg-slate-100 text-slate-600",
          )}>
            {typeof Icon === 'string' ? (
              <span className="text-sm leading-none">{Icon}</span>
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {title}
            {badge}
          </CardTitle>
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggle}
            className="h-8 w-8 p-0 text-slate-500"
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="p-2 sm:p-4 pt-2 border-t border-slate-100">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
