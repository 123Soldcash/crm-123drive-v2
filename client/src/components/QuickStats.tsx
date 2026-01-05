import React from "react";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Home,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  color?: "green" | "red" | "blue" | "yellow" | "purple" | "gray";
  subtitle?: string;
}

function StatCard({ title, value, icon, trend, color = "blue", subtitle }: StatCardProps) {
  const colorStyles = {
    green: "bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700",
    red: "bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-700",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    yellow: "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-700",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 text-purple-700",
    gray: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700",
  };

  const iconBgStyles = {
    green: "bg-green-200/50",
    red: "bg-red-200/50",
    blue: "bg-blue-200/50",
    yellow: "bg-yellow-200/50",
    purple: "bg-purple-200/50",
    gray: "bg-gray-200/50",
  };

  return (
    <div className={cn(
      "rounded-xl border-2 p-4 transition-all hover:shadow-md hover:scale-[1.02]",
      colorStyles[color]
    )}>
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-lg", iconBgStyles[color])}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trend === "up" && "bg-green-200 text-green-800",
            trend === "down" && "bg-red-200 text-red-800",
            trend === "neutral" && "bg-gray-200 text-gray-800"
          )}>
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trend === "neutral" && "→"}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium opacity-75 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
      </div>
    </div>
  );
}

interface QuickStatsProps {
  estimatedValue?: number;
  equityPercent?: number;
  mortgageAmount?: number;
  delinquentTaxTotal?: number;
  ownerVerified?: boolean;
  hasLiens?: boolean;
  hasCodeViolation?: boolean;
  needsRepairs?: boolean;
  mlsStatus?: string;
  occupancy?: string;
}

export function QuickStats({
  estimatedValue = 0,
  equityPercent = 0,
  mortgageAmount = 0,
  delinquentTaxTotal = 0,
  ownerVerified = false,
  hasLiens = false,
  hasCodeViolation = false,
  needsRepairs = false,
  mlsStatus = "Unknown",
  occupancy = "Unknown",
}: QuickStatsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-xl">
      {/* Estimated Value */}
      <StatCard
        title="Est. Value"
        value={formatCurrency(estimatedValue)}
        icon={<DollarSign className="h-5 w-5" />}
        color="green"
        subtitle="Market estimate"
      />

      {/* Equity */}
      <StatCard
        title="Equity"
        value={`${equityPercent}%`}
        icon={<TrendingUp className="h-5 w-5" />}
        color={equityPercent >= 50 ? "green" : equityPercent >= 25 ? "yellow" : "red"}
        trend={equityPercent >= 50 ? "up" : equityPercent >= 25 ? "neutral" : "down"}
        subtitle={formatCurrency(estimatedValue - mortgageAmount)}
      />

      {/* MLS Status */}
      <StatCard
        title="MLS Status"
        value={mlsStatus}
        icon={<Home className="h-5 w-5" />}
        color={mlsStatus === "Not Listed" ? "green" : mlsStatus === "Listed" ? "yellow" : "gray"}
      />

      {/* Delinquent Taxes */}
      <StatCard
        title="Delinquent Taxes"
        value={delinquentTaxTotal > 0 ? formatCurrency(delinquentTaxTotal) : "None"}
        icon={<Calendar className="h-5 w-5" />}
        color={delinquentTaxTotal > 0 ? "red" : "green"}
        subtitle={delinquentTaxTotal > 0 ? "Outstanding" : "All paid"}
      />

      {/* Issues Summary */}
      <StatCard
        title="Issues Found"
        value={[hasLiens, hasCodeViolation, needsRepairs].filter(Boolean).length}
        icon={<AlertTriangle className="h-5 w-5" />}
        color={[hasLiens, hasCodeViolation, needsRepairs].filter(Boolean).length > 0 ? "yellow" : "green"}
        subtitle={
          [hasLiens, hasCodeViolation, needsRepairs].filter(Boolean).length === 0
            ? "No issues"
            : [
                hasLiens && "Liens",
                hasCodeViolation && "Code",
                needsRepairs && "Repairs",
              ]
                .filter(Boolean)
                .join(", ")
        }
      />
    </div>
  );
}
