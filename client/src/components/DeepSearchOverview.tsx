import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, AlertTriangle, CheckCircle, Shield, Scale, Home, Eye, Users, FileText } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// OPTION CONSTANTS (from spec)
// ═══════════════════════════════════════════════════════════════════════════════

const PROPERTY_TYPES = [
  "Single Family Home", "Condo", "Duplex", "Triplex", "Fourplex",
  "Townhouse", "Mobile Home", "Vacant Lot", "Other"
] as const;

const PROPERTY_USES = ["Residential", "Commercial", "Mixed Use"] as const;

const PROPERTY_TAGS = [
  "Agricultural Land", "Cottage", "Ranch Land", "Bungalow", "Farm Land",
  "Residential Lot", "Infill Lot", "Timber Land", "Commercial Lot",
  "Manufactured Home", "Villa", "Co-op", "Modular Home", "Waterfront Lot"
];

const CONDITION_RATINGS = ["Excellent", "Good", "Fair", "Average", "Poor"] as const;

const CONDITION_TAG_GROUPS = {
  "Damage/Repairs": ["Major Repairs Needed", "Needs Repairs", "Needs New Roof", "Old/Damaged Carpet", "Deferred Maintenance", "Under Construction", "Partially Renovated"],
  "Water/Environmental": ["Water Damage", "Flood Damage", "Mold Damage"],
  "Fire/Storm": ["Fire Damage", "Hurricane Damage"],
  "Exterior/Visual": ["Boarded Up", "Warning Stickers on Door", "Locked Gates", "Abandoned"],
  "Severe/Unsafe": ["Condemned", "Unlivable"],
};

const OCCUPANCY_OPTIONS = ["Vacant", "Owner Occupied", "Tenant Occupied", "Squatter Occupied", "Unknown"] as const;
const EVICTION_RISK = ["Low", "Medium", "High"] as const;

const SELLER_FINANCIAL_PRESSURE = ["Behind Taxes", "Need Cash Quickly", "Medical Bills", "Job Loss", "Bankruptcy"];
const SELLER_LIFE_EVENTS = ["Divorce", "Death in the Family", "Relocating", "Downsizing", "Moving to Another City", "Moving to Another County", "Moving to Another State"];
const SELLER_LEGAL_BEHAVIORAL = ["Deportation", "Going to Jail/Incarceration", "Hoarder Situation"];

const LEGAL_OWNERSHIP_TITLE = [
  "Title Issues", "Break in Chain of Title", "Unclear Ownership Interests", "Multiple Owners",
  "Missing or Unknown Owners", "Trust Involved", "Trust or Estate Issues", "LLC Owned",
  "Out-of-State Owner", "Sellers Name with HE", "Sellers Name with REV TRUST",
  "Sellers Name with JTRS", "Sellers Name with ETAL", "Sellers Name with Est of"
];
const LEGAL_COURT_LAWSUIT = ["Pending Lawsuit", "Judgments or Lawsuits", "Legal Issues", "Court Approval Required", "Issues with Attorney"];
const LEGAL_PROPERTY_STATUS = ["Property Occupied Without Consent", "Code Violations", "Condemned"];

const PROBATE_STAGES = [
  "Not Started", "Open Case", "Executor Assigned", "Court Approval Required",
  "Ready to Sell", "Probate Not Completed", "Finished"
] as const;

const PROBATE_FINDINGS = [
  "Missing or Unknown Heirs", "Heir Disagreements", "Family Dispute",
  "Everyone on Board", "Not Everyone on Board", "Minor Involved",
  "Executor Lacks Authority to Sell", "No Court-Appointed Executor",
  "Issues with Attorney", "Will Contested", "Estate Debts Exceed Value",
  "Trust and Probate Overlap"
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ChipSelector({ options, selected, onChange, colorClass = "bg-blue-100 text-blue-800 border-blue-300" }: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  colorClass?: string;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 w-full">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
            selected.includes(opt)
              ? colorClass
              : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ title, icon, children, accentColor = "blue" }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
}) {
  const borderColors: Record<string, string> = {
    blue: "border-l-blue-500",
    orange: "border-l-orange-500",
    red: "border-l-red-500",
    green: "border-l-green-500",
    purple: "border-l-purple-500",
    yellow: "border-l-yellow-500",
    pink: "border-l-pink-500",
  };

  return (
    <Card className={`border-l-4 ${borderColors[accentColor] || borderColors.blue} shadow-sm`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DeepSearchOverview({ propertyId }: { propertyId: number }) {
  const { data, isLoading } = trpc.deepSearch.getOverview.useQuery({ propertyId });
  const updateMutation = trpc.deepSearch.updateOverview.useMutation();
  const utils = trpc.useUtils();

  // Local state for all fields
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [propertyUse, setPropertyUse] = useState<string | null>(null);
  const [propertyTags, setPropertyTags] = useState<string[]>([]);
  const [conditionRating, setConditionRating] = useState<string | null>(null);
  const [conditionTags, setConditionTags] = useState<string[]>([]);
  const [occupancy, setOccupancy] = useState<string | null>(null);
  const [evictionRisk, setEvictionRisk] = useState<string | null>(null);
  const [evictionNotes, setEvictionNotes] = useState("");
  const [sellerFinancialPressure, setSellerFinancialPressure] = useState<string[]>([]);
  const [sellerLifeEvents, setSellerLifeEvents] = useState<string[]>([]);
  const [sellerLegalBehavioral, setSellerLegalBehavioral] = useState<string[]>([]);
  const [legalOwnershipTitle, setLegalOwnershipTitle] = useState<string[]>([]);
  const [legalCourtLawsuit, setLegalCourtLawsuit] = useState<string[]>([]);
  const [legalPropertyStatus, setLegalPropertyStatus] = useState<string[]>([]);
  const [probate, setProbate] = useState(false);
  const [probateStage, setProbateStage] = useState<string | null>(null);
  const [probateFindings, setProbateFindings] = useState<string[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [probateNotes, setProbateNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Sync from server data
  useEffect(() => {
    if (data) {
      setPropertyType(data.propertyType || null);
      setPropertyUse(data.propertyUse || null);
      setPropertyTags(safeParseJson(data.propertyTags));
      setConditionRating(data.conditionRating || null);
      setConditionTags(safeParseJson(data.conditionTags));
      setOccupancy(data.occupancy || null);
      setEvictionRisk(data.evictionRisk || null);
      setEvictionNotes(data.evictionNotes || "");
      setSellerFinancialPressure(safeParseJson(data.sellerFinancialPressure));
      setSellerLifeEvents(safeParseJson(data.sellerLifeEvents));
      setSellerLegalBehavioral(safeParseJson(data.sellerLegalBehavioral));
      setLegalOwnershipTitle(safeParseJson(data.legalOwnershipTitle));
      setLegalCourtLawsuit(safeParseJson(data.legalCourtLawsuit));
      setLegalPropertyStatus(safeParseJson(data.legalPropertyStatus));
      setProbate(data.probate === 1);
      setProbateStage(data.probateStage || null);
      setProbateFindings(safeParseJson(data.probateFindings));
      setGeneralNotes(data.generalNotes || "");
      setProbateNotes(data.probateNotes || "");
      setInternalNotes(data.internalNotes || "");
      setIsDirty(false);
    }
  }, [data]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        propertyId,
        propertyType: propertyType as any,
        propertyUse: propertyUse as any,
        propertyTags: JSON.stringify(propertyTags),
        conditionRating: conditionRating as any,
        conditionTags: JSON.stringify(conditionTags),
        occupancy: occupancy as any,
        evictionRisk: evictionRisk as any,
        evictionNotes: evictionNotes || null,
        sellerFinancialPressure: JSON.stringify(sellerFinancialPressure),
        sellerLifeEvents: JSON.stringify(sellerLifeEvents),
        sellerLegalBehavioral: JSON.stringify(sellerLegalBehavioral),
        legalOwnershipTitle: JSON.stringify(legalOwnershipTitle),
        legalCourtLawsuit: JSON.stringify(legalCourtLawsuit),
        legalPropertyStatus: JSON.stringify(legalPropertyStatus),
        probate: probate ? 1 : 0,
        probateStage: probateStage as any,
        probateFindings: JSON.stringify(probateFindings),
        generalNotes: generalNotes || null,
        probateNotes: probateNotes || null,
        internalNotes: internalNotes || null,
      });
      setIsDirty(false);
      utils.deepSearch.getOverview.invalidate({ propertyId });
      utils.deepSearch.getDistressScore.invalidate({ propertyId });
      toast.success("Deep Search Overview saved!");
    } catch (err) {
      toast.error("Failed to save overview");
    }
  };

  const showEviction = occupancy === "Tenant Occupied" || occupancy === "Squatter Occupied";

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Save Bar */}
      {isDirty && (
        <div className="sticky top-0 z-10 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
          <span className="text-sm text-amber-700 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Unsaved changes
          </span>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-1" />
            {updateMutation.isPending ? "Saving..." : "Save All"}
          </Button>
        </div>
      )}

      {/* ── Property Basics ─────────────────────────────────────────────── */}
      <SectionCard title="Property Basics" icon={<Home className="w-4 h-4" />} accentColor="blue">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Property Type</label>
            <Select value={propertyType || ""} onValueChange={(v) => { setPropertyType(v); markDirty(); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Property Use</label>
            <Select value={propertyUse || ""} onValueChange={(v) => { setPropertyUse(v); markDirty(); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select use..." />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_USES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="col-span-full">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Property Tags</label>
          <ChipSelector
            options={PROPERTY_TAGS}
            selected={propertyTags}
            onChange={(v) => { setPropertyTags(v); markDirty(); }}
          />
        </div>
      </SectionCard>

      {/* ── Condition ───────────────────────────────────────────────────── */}
      <SectionCard title="Condition" icon={<Eye className="w-4 h-4" />} accentColor="orange">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Condition Rating</label>
          <div className="flex gap-2">
            {CONDITION_RATINGS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setConditionRating(r); markDirty(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  conditionRating === r
                    ? r === "Excellent" ? "bg-green-100 text-green-800 border-green-300"
                    : r === "Good" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : r === "Fair" ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                    : r === "Average" ? "bg-orange-100 text-orange-800 border-orange-300"
                    : "bg-red-100 text-red-800 border-red-300"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {Object.entries(CONDITION_TAG_GROUPS).map(([group, tags]) => (
          <div key={group}>
            <label className="text-xs font-medium text-gray-400 mb-1 block">{group}</label>
            <ChipSelector
              options={tags}
              selected={conditionTags}
              onChange={(v) => { setConditionTags(v); markDirty(); }}
              colorClass={
                group === "Severe/Unsafe" ? "bg-red-100 text-red-800 border-red-300"
                : group === "Fire/Storm" ? "bg-orange-100 text-orange-800 border-orange-300"
                : group === "Water/Environmental" ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                : "bg-amber-100 text-amber-800 border-amber-300"
              }
            />
          </div>
        ))}
      </SectionCard>

      {/* ── Occupancy ───────────────────────────────────────────────────── */}
      <SectionCard title="Occupancy" icon={<Users className="w-4 h-4" />} accentColor="green">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Occupancy Status</label>
          <div className="flex flex-wrap gap-2">
            {OCCUPANCY_OPTIONS.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { setOccupancy(o); markDirty(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  occupancy === o
                    ? o === "Vacant" ? "bg-amber-100 text-amber-800 border-amber-300"
                    : o === "Squatter Occupied" ? "bg-red-100 text-red-800 border-red-300"
                    : o === "Owner Occupied" ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-blue-100 text-blue-800 border-blue-300"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        {showEviction && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <label className="text-xs font-semibold text-red-700">Eviction Risk</label>
            <div className="flex gap-2">
              {EVICTION_RISK.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setEvictionRisk(r); markDirty(); }}
                  className={`px-3 py-1 rounded text-xs font-medium border ${
                    evictionRisk === r
                      ? r === "High" ? "bg-red-200 text-red-900 border-red-400"
                      : r === "Medium" ? "bg-orange-200 text-orange-900 border-orange-400"
                      : "bg-yellow-200 text-yellow-900 border-yellow-400"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea
              value={evictionNotes}
              onChange={(e) => { setEvictionNotes(e.target.value); markDirty(); }}
              placeholder="Eviction notes..."
              className="text-xs h-16 bg-white"
            />
          </div>
        )}
      </SectionCard>

      {/* ── Seller Situation (Motivation) ───────────────────────────────── */}
      <SectionCard title="Seller Situation (Motivation)" icon={<AlertTriangle className="w-4 h-4" />} accentColor="red">
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Financial Pressure</label>
          <ChipSelector
            options={SELLER_FINANCIAL_PRESSURE}
            selected={sellerFinancialPressure}
            onChange={(v) => { setSellerFinancialPressure(v); markDirty(); }}
            colorClass="bg-red-100 text-red-800 border-red-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Life Events</label>
          <ChipSelector
            options={SELLER_LIFE_EVENTS}
            selected={sellerLifeEvents}
            onChange={(v) => { setSellerLifeEvents(v); markDirty(); }}
            colorClass="bg-purple-100 text-purple-800 border-purple-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Legal / Behavioral</label>
          <ChipSelector
            options={SELLER_LEGAL_BEHAVIORAL}
            selected={sellerLegalBehavioral}
            onChange={(v) => { setSellerLegalBehavioral(v); markDirty(); }}
            colorClass="bg-rose-100 text-rose-800 border-rose-300"
          />
        </div>
      </SectionCard>

      {/* ── Legal & Title ───────────────────────────────────────────────── */}
      <SectionCard title="Legal & Title" icon={<Scale className="w-4 h-4" />} accentColor="purple">
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Ownership / Title</label>
          <ChipSelector
            options={LEGAL_OWNERSHIP_TITLE}
            selected={legalOwnershipTitle}
            onChange={(v) => { setLegalOwnershipTitle(v); markDirty(); }}
            colorClass="bg-purple-100 text-purple-800 border-purple-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Court / Lawsuit</label>
          <ChipSelector
            options={LEGAL_COURT_LAWSUIT}
            selected={legalCourtLawsuit}
            onChange={(v) => { setLegalCourtLawsuit(v); markDirty(); }}
            colorClass="bg-indigo-100 text-indigo-800 border-indigo-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Property Legal Status</label>
          <ChipSelector
            options={LEGAL_PROPERTY_STATUS}
            selected={legalPropertyStatus}
            onChange={(v) => { setLegalPropertyStatus(v); markDirty(); }}
            colorClass="bg-violet-100 text-violet-800 border-violet-300"
          />
        </div>
      </SectionCard>

      {/* ── Probate ─────────────────────────────────────────────────────── */}
      <SectionCard title="Probate" icon={<Shield className="w-4 h-4" />} accentColor="yellow">
        <div className="flex items-center gap-3">
          <Switch
            checked={probate}
            onCheckedChange={(v) => { setProbate(v); markDirty(); }}
          />
          <span className="text-sm font-medium text-gray-700">
            {probate ? "Yes — Probate Case" : "No Probate"}
          </span>
        </div>
        {probate && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Probate Stage</label>
              <Select value={probateStage || ""} onValueChange={(v) => { setProbateStage(v); markDirty(); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  {PROBATE_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Probate Findings</label>
              <ChipSelector
                options={PROBATE_FINDINGS}
                selected={probateFindings}
                onChange={(v) => { setProbateFindings(v); markDirty(); }}
                colorClass="bg-yellow-100 text-yellow-800 border-yellow-300"
              />
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Notes ───────────────────────────────────────────────────────── */}
      <SectionCard title="Notes" icon={<FileText className="w-4 h-4" />} accentColor="blue">
        <div className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-600 mb-2 block">General Notes</label>
            <Textarea
              value={generalNotes}
              onChange={(e) => { setGeneralNotes(e.target.value); markDirty(); }}
              placeholder="General observations, research findings..."
              className="text-xs sm:text-sm h-20 sm:h-24 w-full"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-600 mb-2 block">Probate Notes</label>
            <Textarea
              value={probateNotes}
              onChange={(e) => { setProbateNotes(e.target.value); markDirty(); }}
              placeholder="Probate-specific notes, case numbers..."
              className="text-xs sm:text-sm h-20 sm:h-24 w-full"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-600 mb-2 block">Internal Notes</label>
            <Textarea
              value={internalNotes}
              onChange={(e) => { setInternalNotes(e.target.value); markDirty(); }}
              placeholder="Internal team notes, strategy..."
              className="text-xs sm:text-sm h-20 sm:h-24 w-full"
            />
          </div>
        </div>
      </SectionCard>

      {/* Bottom Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || !isDirty} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Overview"}
        </Button>
      </div>
    </div>
  );
}

function safeParseJson(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
