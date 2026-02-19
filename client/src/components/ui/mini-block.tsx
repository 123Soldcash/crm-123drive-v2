import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";
import { Badge } from "./badge";

interface MiniBlockProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  badge?: React.ReactNode;
  badgeCount?: number;
  badgeColor?: "green" | "red" | "yellow" | "blue" | "gray" | "purple";
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  headerAction?: React.ReactNode;
}

export function MiniBlock({
  title,
  icon: Icon,
  iconColor = "text-blue-500",
  children,
  collapsible = false,
  defaultExpanded = true,
  badge,
  badgeCount,
  badgeColor = "blue",
  className,
  variant = "default",
  headerAction,
}: MiniBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const variantStyles = {
    default: {
      border: "border-slate-200",
      bg: "bg-gradient-to-br from-white to-slate-50",
      header: "bg-slate-50",
      iconBg: "bg-slate-100",
    },
    success: {
      border: "border-green-200",
      bg: "bg-gradient-to-br from-white to-green-50",
      header: "bg-green-50",
      iconBg: "bg-green-100",
    },
    warning: {
      border: "border-yellow-200",
      bg: "bg-gradient-to-br from-white to-yellow-50",
      header: "bg-yellow-50",
      iconBg: "bg-yellow-100",
    },
    danger: {
      border: "border-red-200",
      bg: "bg-gradient-to-br from-white to-red-50",
      header: "bg-red-50",
      iconBg: "bg-red-100",
    },
    info: {
      border: "border-blue-200",
      bg: "bg-gradient-to-br from-white to-blue-50",
      header: "bg-blue-50",
      iconBg: "bg-blue-100",
    },
    purple: {
      border: "border-purple-200",
      bg: "bg-gradient-to-br from-white to-purple-50",
      header: "bg-purple-50",
      iconBg: "bg-purple-100",
    },
  };

  const badgeStyles = {
    green: "bg-green-100 text-green-800 border-green-300",
    red: "bg-red-100 text-red-800 border-red-300",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
    blue: "bg-blue-100 text-blue-800 border-blue-300",
    gray: "bg-gray-100 text-gray-800 border-gray-300",
    purple: "bg-purple-100 text-purple-800 border-purple-300",
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "border-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200",
        styles.border,
        styles.bg,
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-t-xl border-b",
          styles.header,
          styles.border,
          collapsible && "cursor-pointer hover:bg-opacity-80"
        )}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl shadow-sm", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          {badge}
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge
              variant="outline"
              className={cn("ml-1 font-bold text-xs px-2", badgeStyles[badgeColor])}
            >
              {badgeCount} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {collapsible && (
            <div className="p-1 rounded-full hover:bg-white/50 transition-colors text-gray-500">
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {(!collapsible || isExpanded) && (
        <div className="p-5 bg-white rounded-b-xl">{children}</div>
      )}
    </div>
  );
}

// Tag selector component for checkboxes - IMPROVED VERSION
interface TagSelectorProps {
  tags: string[];
  selectedTags: string[];
  onTagChange: (tags: string[]) => void;
  columns?: number;
  maxHeight?: string;
  variant?: "default" | "compact";
}

export function TagSelector({
  tags,
  selectedTags,
  onTagChange,
  columns = 4,
  maxHeight = "200px",
  variant = "default",
}: TagSelectorProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagChange([...selectedTags, tag]);
    }
  };

  return (
    <div
      className={cn(
        "grid gap-2 p-3 bg-slate-50 rounded-xl border-2 border-slate-200 overflow-y-auto",
        variant === "compact" && "gap-1 p-2"
      )}
      style={{ maxHeight, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <label
            key={tag}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium",
              variant === "compact" && "p-1.5 text-xs",
              isSelected
                ? "bg-blue-500 text-white shadow-md shadow-blue-200 scale-[1.02]"
                : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
            )}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleTag(tag)}
              className="sr-only"
            />
            <div
              className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                variant === "compact" && "w-3 h-3",
                isSelected
                  ? "bg-white border-white"
                  : "border-slate-300 bg-white"
              )}
            >
              {isSelected && (
                <svg
                  className={cn("w-3 h-3 text-blue-500", variant === "compact" && "w-2 h-2")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span className="truncate">{tag}</span>
          </label>
        );
      })}
    </div>
  );
}

// Rating selector component - IMPROVED VERSION
interface RatingSelectorProps {
  ratings: { value: string; color: string; description?: string }[];
  selectedRating: string;
  onRatingChange: (rating: string) => void;
}

export function RatingSelector({
  ratings,
  selectedRating,
  onRatingChange,
}: RatingSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {ratings.map((rating) => {
        const isSelected = selectedRating === rating.value;
        return (
          <button
            key={rating.value}
            type="button"
            onClick={() => onRatingChange(rating.value)}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold transition-all duration-200 shadow-sm",
              isSelected
                ? `${rating.color} text-white shadow-lg scale-105 ring-2 ring-offset-2`
                : "bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:scale-102"
            )}
            title={rating.description}
          >
            {rating.value}
          </button>
        );
      })}
    </div>
  );
}

// Info tooltip component
interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="group relative inline-block ml-1">
      <Info className="h-4 w-4 text-gray-500 cursor-help hover:text-gray-600 transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
      </div>
    </div>
  );
}

// Section divider component
interface SectionDividerProps {
  label?: string;
}

export function SectionDivider({ label }: SectionDividerProps) {
  if (!label) {
    return <div className="border-t border-slate-200 my-4" />;
  }
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 border-t border-slate-200" />
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}
