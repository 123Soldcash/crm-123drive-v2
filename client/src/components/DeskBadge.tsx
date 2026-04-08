/**
 * DeskBadge — renders a desk name with its DB-configured icon and colour.
 *
 * Usage:
 *   <DeskBadge deskName="DESK_CHRIS" desksMap={desksMap} />
 *   <DeskBadge deskName="List" desksMap={desksMap} onClick={...} />
 *
 * The component reads icon + hex colour from the desksMap (built from
 * the desks.list query). When the desk is not found in the map it falls
 * back to a neutral grey pill.
 */

import { type DeskFromDb, getIconComponent } from "@/lib/deskUtils";
import { cn } from "@/lib/utils";
import React from "react";

interface DeskBadgeProps {
  deskName: string | null | undefined;
  desksMap: Record<string, DeskFromDb>;
  /** Optional click handler — when provided the badge becomes a button */
  onClick?: () => void;
  /** Extra Tailwind classes */
  className?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md";
}

/**
 * Convert a hex colour to an rgba string with the given alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(156,163,175,${alpha})`; // gray fallback
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Determine whether a hex colour is "light" (so we should use dark text).
 */
function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return true;
  // Perceived brightness (YIQ formula)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 150;
}

const SIZE_CLASSES = {
  xs: "text-[10px] px-1.5 py-0.5 gap-1",
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
};

export function DeskBadge({ deskName, desksMap, onClick, className, size = "xs" }: DeskBadgeProps) {
  const name = deskName || "NOT_ASSIGNED";
  const desk = desksMap[name];

  // Resolve icon
  const IconComp = getIconComponent(desk?.icon);

  // Resolve colour — use hex from DB, fall back to a neutral grey
  const hexColor = desk?.color || "#9ca3af"; // gray-400

  // Build inline styles for the badge
  const bgColor = hexToRgba(hexColor, 0.18);
  const textColor = isLightColor(hexColor) ? hexColor : hexColor;
  // For very light colours the text would be invisible on the light bg,
  // so we darken it a bit by using the hex directly (it's already saturated).
  // For dark colours we use them as-is.
  const borderColor = hexToRgba(hexColor, 0.35);

  const style: React.CSSProperties = {
    backgroundColor: bgColor,
    color: hexColor,
    borderColor: borderColor,
  };

  // For very light hex colours, darken the text
  // We check luminance and if it's too light, we use a darker shade
  const clean = hexColor.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    if (yiq > 200) {
      // Very light colour — darken text by 40%
      const dr = Math.round(r * 0.5);
      const dg = Math.round(g * 0.5);
      const db = Math.round(b * 0.5);
      style.color = `rgb(${dr},${dg},${db})`;
    }
  }

  const label = name === "NOT_ASSIGNED" ? "Not Assigned" : name;

  const sizeClass = SIZE_CLASSES[size];
  const iconSize = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  const inner = (
    <>
      <IconComp className={cn(iconSize, "shrink-0")} />
      <span className="truncate">{label}</span>
    </>
  );

  const baseClasses = cn(
    "inline-flex items-center font-semibold rounded-full border whitespace-nowrap",
    sizeClass,
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClasses, "hover:opacity-80 cursor-pointer transition")}
        style={style}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={baseClasses} style={style}>
      {inner}
    </span>
  );
}
