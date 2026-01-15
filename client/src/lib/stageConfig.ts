// Deal Pipeline Stage Configuration
// ADHD-friendly: Clear visual hierarchy with color coding

export type DealStage =
  | "NEW_LEAD"
  | "LEAD_IMPORTED"
  | "SKIP_TRACED"
  | "FIRST_CONTACT_MADE"
  | "ANALYZING_DEAL"
  | "OFFER_PENDING"
  | "FOLLOW_UP_ON_CONTRACT"
  | "UNDER_CONTRACT_A"
  | "MARKETING_TO_BUYERS"
  | "BUYER_INTERESTED"
  | "CONTRACT_B_SIGNED"
  | "ASSIGNMENT_FEE_AGREED"
  | "ESCROW_DEPOSIT_A"
  | "ESCROW_DEPOSIT_B"
  | "INSPECTION_PERIOD"
  | "TITLE_COMPANY"
  | "MUNICIPAL_LIENS"
  | "TITLE_SEARCH"
  | "TITLE_INSURANCE"
  | "CLOSING"
  | "CLOSED_WON"
  | "DEAD_LOST";

export interface StageConfig {
  id: DealStage;
  label: string;
  shortLabel: string;
  color: string; // Tailwind color class
  bgColor: string; // Background color
  phase: "acquisition" | "seller" | "buyer" | "closing" | "complete" | "dead";
  icon: string; // Emoji for visual recognition
}

export const STAGE_CONFIGS: StageConfig[] = [
  // 🟢 Acquisition Phase (Green)
  {
    id: "NEW_LEAD",
    label: "New Lead",
    shortLabel: "New",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    phase: "acquisition",
    icon: "🎯",
  },
  {
    id: "LEAD_IMPORTED",
    label: "Lead Imported",
    shortLabel: "Imported",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    phase: "acquisition",
    icon: "📥",
  },
  {
    id: "SKIP_TRACED",
    label: "Skip Traced",
    shortLabel: "Traced",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    phase: "acquisition",
    icon: "🔍",
  },

  // 🔵 Seller Phase (Blue)
  {
    id: "FIRST_CONTACT_MADE",
    label: "First Contact Made",
    shortLabel: "Contacted",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    phase: "seller",
    icon: "📞",
  },
  {
    id: "ANALYZING_DEAL",
    label: "Analyzing Deal",
    shortLabel: "Analyzing",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    phase: "seller",
    icon: "📊",
  },
  {
    id: "OFFER_PENDING",
    label: "Offer Pending",
    shortLabel: "Offer Pending",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    phase: "seller",
    icon: "💰",
  },
  {
    id: "FOLLOW_UP_ON_CONTRACT",
    label: "Follow-up on Contract",
    shortLabel: "Follow-up",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    phase: "seller",
    icon: "📋",
  },
  {
    id: "UNDER_CONTRACT_A",
    label: "Under Contract (Seller)",
    shortLabel: "Contract A",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    phase: "seller",
    icon: "✅",
  },

  // 🟠 Buyer Phase (Orange)
  {
    id: "MARKETING_TO_BUYERS",
    label: "Marketing to Buyers",
    shortLabel: "Marketing",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "📢",
  },
  {
    id: "BUYER_INTERESTED",
    label: "Buyer Interested",
    shortLabel: "Buyer Found",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "👤",
  },
  {
    id: "CONTRACT_B_SIGNED",
    label: "Contract B Signed",
    shortLabel: "Contract B",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "📝",
  },
  {
    id: "ASSIGNMENT_FEE_AGREED",
    label: "Assignment Fee Agreed",
    shortLabel: "Fee Agreed",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "💵",
  },
  {
    id: "ESCROW_DEPOSIT_A",
    label: "Escrow Deposit A",
    shortLabel: "Escrow A",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "💰",
  },
  {
    id: "ESCROW_DEPOSIT_B",
    label: "Escrow Deposit B",
    shortLabel: "Escrow B",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "💰",
  },
  {
    id: "INSPECTION_PERIOD",
    label: "Inspection Period",
    shortLabel: "Inspection",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    phase: "buyer",
    icon: "🔎",
  },

  // 🟣 Closing Phase (Purple)
  {
    id: "TITLE_COMPANY",
    label: "Title Company",
    shortLabel: "Title Work",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    phase: "closing",
    icon: "🏛️",
  },
  {
    id: "MUNICIPAL_LIENS",
    label: "Municipal Liens Search",
    shortLabel: "Liens",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    phase: "closing",
    icon: "📋",
  },
  {
    id: "TITLE_SEARCH",
    label: "Title Search",
    shortLabel: "Title Search",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    phase: "closing",
    icon: "🔍",
  },
  {
    id: "TITLE_INSURANCE",
    label: "Title Insurance",
    shortLabel: "Insurance",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    phase: "closing",
    icon: "🛡️",
  },
  {
    id: "CLOSING",
    label: "Closing",
    shortLabel: "Closing",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    phase: "closing",
    icon: "🎉",
  },

  // ✅ Complete (Dark Green)
  {
    id: "CLOSED_WON",
    label: "Closed/Won",
    shortLabel: "Won",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    phase: "complete",
    icon: "✅",
  },

  // ❌ Dead (Red)
  {
    id: "DEAD_LOST",
    label: "Dead/Lost",
    shortLabel: "Lost",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    phase: "dead",
    icon: "❌",
  },
];

export function getStageConfig(stageId: DealStage): StageConfig | undefined {
  return STAGE_CONFIGS.find((s) => s.id === stageId);
}

export function getStagesByPhase(phase: StageConfig["phase"]): StageConfig[] {
  return STAGE_CONFIGS.filter((s) => s.phase === phase);
}
