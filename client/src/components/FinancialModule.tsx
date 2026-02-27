import React, { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CheckCircle, Loader2, AlertTriangle, DollarSign, Wrench, Landmark, Gavel, FileWarning, ScrollText, Plus, Trash2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const REPAIR_CATEGORIES = ["Roof", "Kitchen", "Bath", "Outdated", "Other"];
const LIEN_TYPES = ["HOA", "IRS", "Judgment", "Utility", "Contractor", "Other"];

interface DeedEntry {
  deedType: string;
  date: string;
  amount: string;
  notes: string;
}

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
    <div className="flex flex-wrap gap-1.5">
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

function FinancialCard({ title, icon, children, accentColor = "blue" }: {
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
    emerald: "border-l-emerald-500",
    slate: "border-l-slate-500",
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

function CurrencyInput({ value, onChange, placeholder }: {
  value: number | null;
  onChange: (val: number | null) => void;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(value != null ? value.toString() : "");

  useEffect(() => {
    setDisplay(value != null ? value.toString() : "");
  }, [value]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
      <Input
        type="text"
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          setDisplay(raw);
          onChange(raw ? parseInt(raw) : null);
        }}
        placeholder={placeholder || "0"}
        className="pl-7 h-9 text-sm"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function FinancialModule({ propertyId }: { propertyId: number }) {
  const { data, isLoading } = trpc.deepSearch.getFinancial.useQuery({ propertyId });
  const updateMutation = trpc.deepSearch.updateFinancial.useMutation();
  const utils = trpc.useUtils();

  // Card 1: Delinquent Taxes
  const [tax2025, setTax2025] = useState<number | null>(null);
  const [tax2024, setTax2024] = useState<number | null>(null);
  const [tax2023, setTax2023] = useState<number | null>(null);
  const [tax2022, setTax2022] = useState<number | null>(null);
  const [tax2021, setTax2021] = useState<number | null>(null);
  const [tax2020, setTax2020] = useState<number | null>(null);
  const [taxNotes, setTaxNotes] = useState("");

  // Card 2: Repairs
  const [needsRepairs, setNeedsRepairs] = useState(false);
  const [repairCategories, setRepairCategories] = useState<string[]>([]);
  const [estimatedRepairCost, setEstimatedRepairCost] = useState<number | null>(null);
  const [repairNotes, setRepairNotes] = useState("");

  // Card 3: Debt & Liens
  const [mortgage, setMortgage] = useState<string | null>(null);
  const [mortgageNotes, setMortgageNotes] = useState("");
  const [liens, setLiens] = useState(false);
  const [totalLienAmount, setTotalLienAmount] = useState<number | null>(null);
  const [lienTypes, setLienTypes] = useState<string[]>([]);
  const [lienNotes, setLienNotes] = useState("");

  // Card 4: Foreclosure
  const [preForeclosure, setPreForeclosure] = useState(false);
  const [auctionScheduled, setAuctionScheduled] = useState(false);
  const [lisPendens, setLisPendens] = useState(false);
  const [nodFiled, setNodFiled] = useState(false);
  const [foreclosureNotes, setForeclosureNotes] = useState("");

  // Card 5: Code / Tax Lien
  const [codeViolations, setCodeViolations] = useState(false);
  const [taxLien, setTaxLien] = useState(false);
  const [codeTaxNotes, setCodeTaxNotes] = useState("");

  // Card 6: Deed History
  const [deedHistory, setDeedHistory] = useState<DeedEntry[]>([]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const isInitialLoad = useRef(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server data
  useEffect(() => {
    if (data) {
      setTax2025(data.delinquentTax2025);
      setTax2024(data.delinquentTax2024);
      setTax2023(data.delinquentTax2023);
      setTax2022(data.delinquentTax2022);
      setTax2021(data.delinquentTax2021);
      setTax2020(data.delinquentTax2020);
      setTaxNotes(data.taxNotes || "");
      setNeedsRepairs(data.needsRepairs === 1);
      setRepairCategories(safeParseJson(data.repairCategories));
      setEstimatedRepairCost(data.estimatedRepairCost);
      setRepairNotes(data.repairNotes || "");
      setMortgage(data.mortgage || null);
      setMortgageNotes(data.mortgageNotes || "");
      setLiens(data.liens === 1);
      setTotalLienAmount(data.totalLienAmount);
      setLienTypes(safeParseJson(data.lienTypes));
      setLienNotes(data.lienNotes || "");
      setPreForeclosure(data.preForeclosure === 1);
      setAuctionScheduled(data.auctionScheduled === 1);
      setLisPendens(data.lisPendens === 1);
      setNodFiled(data.nodFiled === 1);
      setForeclosureNotes(data.foreclosureNotes || "");
      setCodeViolations(data.codeViolations === 1);
      setTaxLien(data.taxLien === 1);
      setCodeTaxNotes(data.codeTaxNotes || "");
      setDeedHistory(safeParseJsonDeeds(data.deedHistory));
      isInitialLoad.current = false;
    }
  }, [data]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const performSave = useCallback(async (vals: {
    tax2025: number|null; tax2024: number|null; tax2023: number|null; tax2022: number|null;
    tax2021: number|null; tax2020: number|null; taxNotes: string; needsRepairs: boolean;
    repairCategories: string[]; estimatedRepairCost: number|null; repairNotes: string;
    mortgage: string|null; mortgageNotes: string; liens: boolean; totalLienAmount: number|null;
    lienTypes: string[]; lienNotes: string; preForeclosure: boolean; auctionScheduled: boolean;
    lisPendens: boolean; nodFiled: boolean; foreclosureNotes: string; codeViolations: boolean;
    taxLien: boolean; codeTaxNotes: string; deedHistory: DeedEntry[];
  }) => {
    setSaveStatus("saving");
    try {
      await updateMutation.mutateAsync({
        propertyId,
        delinquentTax2025: vals.tax2025,
        delinquentTax2024: vals.tax2024,
        delinquentTax2023: vals.tax2023,
        delinquentTax2022: vals.tax2022,
        delinquentTax2021: vals.tax2021,
        delinquentTax2020: vals.tax2020,
        taxNotes: vals.taxNotes || null,
        needsRepairs: vals.needsRepairs ? 1 : 0,
        repairCategories: JSON.stringify(vals.repairCategories),
        estimatedRepairCost: vals.estimatedRepairCost,
        repairNotes: vals.repairNotes || null,
        mortgage: vals.mortgage as any,
        mortgageNotes: vals.mortgageNotes || null,
        liens: vals.liens ? 1 : 0,
        totalLienAmount: vals.totalLienAmount,
        lienTypes: JSON.stringify(vals.lienTypes),
        lienNotes: vals.lienNotes || null,
        preForeclosure: vals.preForeclosure ? 1 : 0,
        auctionScheduled: vals.auctionScheduled ? 1 : 0,
        lisPendens: vals.lisPendens ? 1 : 0,
        nodFiled: vals.nodFiled ? 1 : 0,
        foreclosureNotes: vals.foreclosureNotes || null,
        codeViolations: vals.codeViolations ? 1 : 0,
        taxLien: vals.taxLien ? 1 : 0,
        codeTaxNotes: vals.codeTaxNotes || null,
        deedHistory: JSON.stringify(vals.deedHistory),
      });
      setSaveStatus("saved");
      utils.deepSearch.getFinancial.invalidate({ propertyId });
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("idle");
      toast.error("Auto-save failed");
    }
  }, [propertyId, updateMutation, utils]);

  const triggerAutoSave = useCallback((vals: Parameters<typeof performSave>[0]) => {
    if (isInitialLoad.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus("saving");
    autoSaveTimer.current = setTimeout(() => performSave(vals), 800);
  }, [performSave]);

  const markDirty = useCallback(() => {
    if (isInitialLoad.current) return;
    triggerAutoSave({
      tax2025, tax2024, tax2023, tax2022, tax2021, tax2020, taxNotes, needsRepairs,
      repairCategories, estimatedRepairCost, repairNotes, mortgage, mortgageNotes,
      liens, totalLienAmount, lienTypes, lienNotes, preForeclosure, auctionScheduled,
      lisPendens, nodFiled, foreclosureNotes, codeViolations, taxLien, codeTaxNotes, deedHistory,
    });
  }, [triggerAutoSave, tax2025, tax2024, tax2023, tax2022, tax2021, tax2020, taxNotes, needsRepairs,
    repairCategories, estimatedRepairCost, repairNotes, mortgage, mortgageNotes,
    liens, totalLienAmount, lienTypes, lienNotes, preForeclosure, auctionScheduled,
    lisPendens, nodFiled, foreclosureNotes, codeViolations, taxLien, codeTaxNotes, deedHistory]);

  // Auto-calculate tax total
  const taxTotal = [tax2025, tax2024, tax2023, tax2022, tax2021, tax2020]
    .reduce((sum: number, v) => sum + (v || 0), 0);

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
      {/* Auto-Save Status Indicator */}
      {saveStatus !== "idle" && (
        <div className="sticky top-0 z-10 rounded-lg p-2.5 flex items-center gap-2 shadow-sm text-sm font-medium transition-all"
          style={{ background: saveStatus === "saved" ? "#f0fdf4" : "#eff6ff", border: `1px solid ${saveStatus === "saved" ? "#bbf7d0" : "#bfdbfe"}`, color: saveStatus === "saved" ? "#15803d" : "#1d4ed8" }}
        >
          {saveStatus === "saving" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Saved!</>
          )}
        </div>
      )}

      {/* ── Card 1: Delinquent Taxes ────────────────────────────────────── */}
      <FinancialCard title="Delinquent Taxes" icon={<DollarSign className="w-4 h-4" />} accentColor="red">
        <div className="space-y-2">
          {[
            { year: "2025", val: tax2025, set: setTax2025 },
            { year: "2024", val: tax2024, set: setTax2024 },
            { year: "2023", val: tax2023, set: setTax2023 },
            { year: "2022", val: tax2022, set: setTax2022 },
            { year: "2021", val: tax2021, set: setTax2021 },
            { year: "2020", val: tax2020, set: setTax2020 },
          ].map(({ year, val, set }) => (
            <div key={year} className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 w-10">{year}</span>
              <CurrencyInput
                value={val}
                onChange={(v) => { set(v); markDirty(); }}
                placeholder="Amount"
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
            <span className="text-xs font-bold text-gray-700 w-10">Total</span>
            <div className="text-sm font-bold text-red-600">
              ${(taxTotal ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <Textarea
          value={taxNotes}
          onChange={(e) => { setTaxNotes(e.target.value); markDirty(); }}
          placeholder="Tax notes..."
          className="text-xs h-16"
        />
      </FinancialCard>

      {/* ── Card 2: Repairs ─────────────────────────────────────────────── */}
      <FinancialCard title="Repairs" icon={<Wrench className="w-4 h-4" />} accentColor="orange">
        <div className="flex items-center gap-3">
          <Switch
            checked={needsRepairs}
            onCheckedChange={(v) => { setNeedsRepairs(v); markDirty(); }}
          />
          <span className="text-sm font-medium text-gray-700">
            {needsRepairs ? "Yes — Needs Repairs" : "No Repairs Needed"}
          </span>
        </div>
        {needsRepairs && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Repair Categories</label>
              <ChipSelector
                options={REPAIR_CATEGORIES}
                selected={repairCategories}
                onChange={(v) => { setRepairCategories(v); markDirty(); }}
                colorClass="bg-orange-100 text-orange-800 border-orange-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Estimated Repair Cost</label>
              <CurrencyInput
                value={estimatedRepairCost}
                onChange={(v) => { setEstimatedRepairCost(v); markDirty(); }}
                placeholder="Estimated cost"
              />
            </div>
            <Textarea
              value={repairNotes}
              onChange={(e) => { setRepairNotes(e.target.value); markDirty(); }}
              placeholder="Repair notes..."
              className="text-xs h-16"
            />
          </>
        )}
      </FinancialCard>

      {/* ── Card 3: Debt & Liens ────────────────────────────────────────── */}
      <FinancialCard title="Debt & Liens" icon={<Landmark className="w-4 h-4" />} accentColor="purple">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Mortgage</label>
          <div className="flex gap-2">
            {["Yes", "No", "Unknown"].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { setMortgage(opt); markDirty(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  mortgage === opt
                    ? opt === "Yes" ? "bg-red-100 text-red-800 border-red-300"
                    : opt === "No" ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-gray-200 text-gray-700 border-gray-300"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          value={mortgageNotes}
          onChange={(e) => { setMortgageNotes(e.target.value); markDirty(); }}
          placeholder="Mortgage notes (balance, lender, etc.)..."
          className="text-xs h-16"
        />
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center gap-3 mb-2">
            <Switch
              checked={liens}
              onCheckedChange={(v) => { setLiens(v); markDirty(); }}
            />
            <span className="text-sm font-medium text-gray-700">
              {liens ? "Yes — Liens Present" : "No Liens"}
            </span>
          </div>
          {liens && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Total Lien Amount</label>
                <CurrencyInput
                  value={totalLienAmount}
                  onChange={(v) => { setTotalLienAmount(v); markDirty(); }}
                  placeholder="Total amount"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Lien Types</label>
                <ChipSelector
                  options={LIEN_TYPES}
                  selected={lienTypes}
                  onChange={(v) => { setLienTypes(v); markDirty(); }}
                  colorClass="bg-purple-100 text-purple-800 border-purple-300"
                />
              </div>
              <Textarea
                value={lienNotes}
                onChange={(e) => { setLienNotes(e.target.value); markDirty(); }}
                placeholder="Lien notes..."
                className="text-xs h-16"
              />
            </>
          )}
        </div>
      </FinancialCard>

      {/* ── Card 4: Foreclosure / Pre-Foreclosure ──────────────────────── */}
      <FinancialCard title="Foreclosure / Pre-Foreclosure" icon={<Gavel className="w-4 h-4" />} accentColor="red">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Pre-foreclosure", val: preForeclosure, set: setPreForeclosure },
            { label: "Auction Scheduled", val: auctionScheduled, set: setAuctionScheduled },
            { label: "Lis Pendens", val: lisPendens, set: setLisPendens },
            { label: "NOD Filed", val: nodFiled, set: setNodFiled },
          ].map(({ label, val, set }) => (
            <div key={label} className="flex items-center gap-2">
              <Switch
                checked={val}
                onCheckedChange={(v) => { set(v); markDirty(); }}
              />
              <span className="text-xs font-medium text-gray-600">{label}</span>
            </div>
          ))}
        </div>
        <Textarea
          value={foreclosureNotes}
          onChange={(e) => { setForeclosureNotes(e.target.value); markDirty(); }}
          placeholder="Foreclosure notes..."
          className="text-xs h-16"
        />
      </FinancialCard>

      {/* ── Card 5: Code / Tax Lien ─────────────────────────────────────── */}
      <FinancialCard title="Code / Tax Lien" icon={<FileWarning className="w-4 h-4" />} accentColor="yellow">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={codeViolations}
              onCheckedChange={(v) => { setCodeViolations(v); markDirty(); }}
            />
            <span className="text-xs font-medium text-gray-600">Code Violations</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={taxLien}
              onCheckedChange={(v) => { setTaxLien(v); markDirty(); }}
            />
            <span className="text-xs font-medium text-gray-600">Tax Lien</span>
          </div>
        </div>
        <Textarea
          value={codeTaxNotes}
          onChange={(e) => { setCodeTaxNotes(e.target.value); markDirty(); }}
          placeholder="Code/Tax lien notes..."
          className="text-xs h-16"
        />
      </FinancialCard>

      {/* ── Card 6: Deed / Title History ────────────────────────────────── */}
      <FinancialCard title="Deed / Title History" icon={<ScrollText className="w-4 h-4" />} accentColor="slate">
        <div className="space-y-2">
          {deedHistory.map((entry, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-start">
              <Input
                value={entry.deedType}
                onChange={(e) => {
                  const updated = [...deedHistory];
                  updated[idx] = { ...updated[idx], deedType: e.target.value };
                  setDeedHistory(updated);
                  markDirty();
                }}
                placeholder="Deed Type"
                className="h-8 text-xs"
              />
              <Input
                type="date"
                value={entry.date}
                onChange={(e) => {
                  const updated = [...deedHistory];
                  updated[idx] = { ...updated[idx], date: e.target.value };
                  setDeedHistory(updated);
                  markDirty();
                }}
                className="h-8 text-xs"
              />
              <Input
                value={entry.amount}
                onChange={(e) => {
                  const updated = [...deedHistory];
                  updated[idx] = { ...updated[idx], amount: e.target.value };
                  setDeedHistory(updated);
                  markDirty();
                }}
                placeholder="$0"
                className="h-8 text-xs"
              />
              <Input
                value={entry.notes}
                onChange={(e) => {
                  const updated = [...deedHistory];
                  updated[idx] = { ...updated[idx], notes: e.target.value };
                  setDeedHistory(updated);
                  markDirty();
                }}
                placeholder="Notes"
                className="h-8 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                onClick={() => {
                  setDeedHistory(deedHistory.filter((_, i) => i !== idx));
                  markDirty();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {deedHistory.length === 0 && (
            <p className="text-xs text-gray-400 italic">No deed history entries yet.</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDeedHistory([...deedHistory, { deedType: "", date: "", amount: "", notes: "" }]);
            markDirty();
          }}
          className="text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Deed Entry
        </Button>
      </FinancialCard>


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

function safeParseJsonDeeds(val: string | null | undefined): DeedEntry[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
