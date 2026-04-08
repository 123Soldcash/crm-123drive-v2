/**
 * Shared Desk Icon & Color Utilities
 *
 * Centralised registry so every component (Properties list, DeskDialog,
 * StickyPropertyHeader, DeskManagement, etc.) renders desk badges
 * consistently using the icon + color stored in the DB.
 */

import {
  Briefcase,
  Building,
  Building2,
  CircleDollarSign,
  FileText,
  Flame,
  FolderOpen,
  Globe,
  Heart,
  Home,
  Inbox,
  Landmark,
  Layers,
  LayoutGrid,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Rocket,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Smile,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

// ─── Icon Registry (must stay in sync with DeskManagement.tsx) ───
export const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "folder", icon: FolderOpen },
  { name: "briefcase", icon: Briefcase },
  { name: "building", icon: Building },
  { name: "building2", icon: Building2 },
  { name: "home", icon: Home },
  { name: "users", icon: Users },
  { name: "user-check", icon: UserCheck },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
  { name: "flame", icon: Flame },
  { name: "rocket", icon: Rocket },
  { name: "target", icon: Target },
  { name: "trophy", icon: Trophy },
  { name: "zap", icon: Zap },
  { name: "trending-up", icon: TrendingUp },
  { name: "dollar", icon: CircleDollarSign },
  { name: "shopping-cart", icon: ShoppingCart },
  { name: "phone", icon: Phone },
  { name: "mail", icon: Mail },
  { name: "megaphone", icon: Megaphone },
  { name: "globe", icon: Globe },
  { name: "map-pin", icon: MapPin },
  { name: "landmark", icon: Landmark },
  { name: "shield", icon: Shield },
  { name: "search", icon: Search },
  { name: "file-text", icon: FileText },
  { name: "list-checks", icon: ListChecks },
  { name: "inbox", icon: Inbox },
  { name: "layout-grid", icon: LayoutGrid },
  { name: "settings", icon: Settings },
  { name: "layers", icon: Layers },
  { name: "smile", icon: Smile },
];

/**
 * Resolve a stored icon name (e.g. "rocket") to its Lucide component.
 * Falls back to FolderOpen when the name is null or not found.
 */
export function getIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FolderOpen;
  const found = ICON_OPTIONS.find((i) => i.name === iconName);
  return found ? found.icon : FolderOpen;
}

// ─── Desk type coming from the desks.list tRPC query ───
export interface DeskFromDb {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  propertyCount?: number;
}

/**
 * Build a lookup map from the desks DB list, keyed by desk name.
 * Returns an empty object when the list is not yet loaded.
 */
export function buildDeskMap(desks: DeskFromDb[] | undefined | null): Record<string, DeskFromDb> {
  if (!desks || desks.length === 0) return {};
  const map: Record<string, DeskFromDb> = {};
  for (const d of desks) {
    map[d.name] = d;
  }
  return map;
}
