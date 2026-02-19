import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Calculator, DollarSign, Home, TrendingUp, AlertTriangle, Settings2 } from "lucide-react";

type Category = "SOLD_6MO" | "SOLD_12MO" | "PENDING" | "FOR_SALE" | "FOR_RENT";

const CATEGORY_LABELS: Record<Category, string> = {
  SOLD_6MO: "Sold (6 Months)",
  SOLD_12MO: "Sold (12 Months)",
  PENDING: "Pending / Under Contract",
  FOR_SALE: "For Sale",
  FOR_RENT: "For Rent",
};

const CATEGORY_COLORS: Record<Category, string> = {
  SOLD_6MO: "bg-green-50 border-green-200",
  SOLD_12MO: "bg-emerald-50 border-emerald-200",
  PENDING: "bg-yellow-50 border-yellow-200",
  FOR_SALE: "bg-blue-50 border-blue-200",
  FOR_RENT: "bg-purple-50 border-purple-200",
};

const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Needs Work", "Poor", "Renovated", "New Construction"];

// Default formula values
const DEFAULT_FORMULAS = {
  kitchenRate: 180, kitchenPct: 10,
  bathroomRate: 110, bathroomPct: 3,
  paintingRate: 6,
  flooringRate: 11, flooringPct: 80,
  roofRate: 15,
  acRate: 6.5,
  cleaningRate: 1.5,
  gardensRate: 1.8,
  miscPct: 5, permitsPct: 3,
  holdCostRate: 2, holdCostMonths: 6,
  commissionPct: 6,
};

interface ComparablesProps {
  propertyId: number;
  buildingSF?: number | null;
  totalBaths?: number | null;
  estimatedValue?: number | null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

// ===== ADD/EDIT COMPARABLE DIALOG =====
function ComparableFormDialog({
  open, onOpenChange, category, propertyId, editData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  propertyId: number;
  editData?: {
    id: number; address: string; bedrooms?: number | null; bathrooms?: string | null;
    squareFeet?: number | null; lotSize?: string | null; yearBuilt?: number | null;
    distanceFromSubject?: string | null; saleDate?: string | null; listedDate?: string | null;
    amount?: number | null; buyerName?: string | null; overallCondition?: string | null;
    source?: string | null; notes?: string | null;
  } | null;
}) {
  const [form, setForm] = useState({
    address: editData?.address || "", bedrooms: editData?.bedrooms?.toString() || "",
    bathrooms: editData?.bathrooms?.toString() || "", squareFeet: editData?.squareFeet?.toString() || "",
    lotSize: editData?.lotSize || "", yearBuilt: editData?.yearBuilt?.toString() || "",
    distanceFromSubject: editData?.distanceFromSubject || "", saleDate: editData?.saleDate || "",
    listedDate: editData?.listedDate || "", amount: editData?.amount?.toString() || "",
    buyerName: editData?.buyerName || "", overallCondition: editData?.overallCondition || "",
    source: editData?.source || "", notes: editData?.notes || "",
  });

  const utils = trpc.useUtils();
  const addMutation = trpc.comparables.addComparable.useMutation({
    onSuccess: () => { toast.success("Comparable added!"); utils.comparables.getByProperty.invalidate({ propertyId }); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.comparables.updateComparable.useMutation({
    onSuccess: () => { toast.success("Comparable updated!"); utils.comparables.getByProperty.invalidate({ propertyId }); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.address.trim()) { toast.error("Address is required"); return; }
    const data = {
      address: form.address,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : undefined,
      squareFeet: form.squareFeet ? parseInt(form.squareFeet) : undefined,
      lotSize: form.lotSize || undefined, yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
      distanceFromSubject: form.distanceFromSubject || undefined,
      saleDate: form.saleDate || undefined, listedDate: form.listedDate || undefined,
      amount: form.amount ? parseInt(form.amount.replace(/[^0-9]/g, "")) : undefined,
      buyerName: form.buyerName || undefined, overallCondition: form.overallCondition || undefined,
      source: form.source || undefined, notes: form.notes || undefined,
    };
    if (editData?.id) { updateMutation.mutate({ id: editData.id, ...data }); }
    else { addMutation.mutate({ propertyId, category, ...data }); }
  };

  const isSoldOrPending = category === "SOLD_6MO" || category === "SOLD_12MO" || category === "PENDING";
  const showBuyer = category === "SOLD_6MO" || category === "SOLD_12MO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit" : "Add"} Comparable — {CATEGORY_LABELS[category]}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Address *</label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, FL" />
          </div>
          <div><label className="text-xs font-medium text-muted-foreground">Bedrooms</label><Input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="3" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Bathrooms</label><Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} placeholder="2" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Square Feet</label><Input type="number" value={form.squareFeet} onChange={(e) => setForm({ ...form, squareFeet: e.target.value })} placeholder="1500" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Lot Size</label><Input value={form.lotSize} onChange={(e) => setForm({ ...form, lotSize: e.target.value })} placeholder="0.25 acres" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Year Built</label><Input type="number" value={form.yearBuilt} onChange={(e) => setForm({ ...form, yearBuilt: e.target.value })} placeholder="1985" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Distance from Subject</label><Input value={form.distanceFromSubject} onChange={(e) => setForm({ ...form, distanceFromSubject: e.target.value })} placeholder="0.3 mi" /></div>
          {isSoldOrPending && (
            <div><label className="text-xs font-medium text-muted-foreground">{category === "PENDING" ? "Listed Date" : "Sale Date"}</label>
            <Input value={category === "PENDING" ? form.listedDate : form.saleDate} onChange={(e) => setForm({ ...form, [category === "PENDING" ? "listedDate" : "saleDate"]: e.target.value })} placeholder="01/15/2026" /></div>
          )}
          {!isSoldOrPending && (
            <div><label className="text-xs font-medium text-muted-foreground">Listed Date</label>
            <Input value={form.listedDate} onChange={(e) => setForm({ ...form, listedDate: e.target.value })} placeholder="01/15/2026" /></div>
          )}
          <div><label className="text-xs font-medium text-muted-foreground">Amount ($)</label><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="350000" /></div>
          {showBuyer && (<div><label className="text-xs font-medium text-muted-foreground">Buyer Name</label><Input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} placeholder="John Doe" /></div>)}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Overall Condition</label>
            <Select value={form.overallCondition} onValueChange={(v) => setForm({ ...form, overallCondition: v })}>
              <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
              <SelectContent>{CONDITION_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div><label className="text-xs font-medium text-muted-foreground">Source</label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Zillow, Redfin..." /></div>
          <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">Notes</label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={addMutation.isPending || updateMutation.isPending}><Save className="w-4 h-4 mr-1" />{editData ? "Update" : "Add"} Comparable</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== COMPARABLE TABLE =====
function ComparableTable({ category, comps, propertyId }: { category: Category; comps: any[]; propertyId: number }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editComp, setEditComp] = useState<any>(null);
  const utils = trpc.useUtils();
  const deleteMutation = trpc.comparables.deleteComparable.useMutation({
    onSuccess: () => { toast.success("Comparable deleted"); utils.comparables.getByProperty.invalidate({ propertyId }); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = comps.filter((c: any) => c.category === category);
  const isSoldOrPending = category === "SOLD_6MO" || category === "SOLD_12MO" || category === "PENDING";
  const showBuyer = category === "SOLD_6MO" || category === "SOLD_12MO";

  return (
    <div className={`border rounded-lg ${CATEGORY_COLORS[category]}`}>
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="text-sm font-semibold">{CATEGORY_LABELS[category]} ({filtered.length})</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
      </div>
      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-white/50">
              <th className="text-left p-2">Address</th><th className="text-center p-2">Bed/Bath/SF</th>
              <th className="text-center p-2">Lot/Year/Dist</th>
              <th className="text-center p-2">{isSoldOrPending ? "Sale Date" : "Listed"}</th>
              <th className="text-right p-2">Amount</th>
              {showBuyer && <th className="text-left p-2">Buyer</th>}
              <th className="text-center p-2">Condition</th><th className="text-center p-2 w-16">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-b hover:bg-white/30">
                  <td className="p-2 font-medium max-w-[180px]">{c.address}</td>
                  <td className="p-2 text-center">{c.bedrooms || "-"}/{c.bathrooms || "-"}/{c.squareFeet || "-"}</td>
                  <td className="p-2 text-center text-muted-foreground">{c.lotSize || "-"}/{c.yearBuilt || "-"}/{c.distanceFromSubject || "-"}</td>
                  <td className="p-2 text-center">{c.saleDate || c.listedDate || "-"}</td>
                  <td className="p-2 text-right font-semibold">{c.amount ? formatCurrency(c.amount) : "-"}</td>
                  {showBuyer && <td className="p-2">{c.buyerName || "-"}</td>}
                  <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded text-[10px] bg-white/60 border">{c.overallCondition || "-"}</span></td>
                  <td className="p-2 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => setEditComp(c)} className="p-1 hover:bg-white/50 rounded"><Edit2 className="w-3 h-3 text-gray-500" /></button>
                      <button onClick={() => { if (confirm("Delete this comparable?")) deleteMutation.mutate({ id: c.id }); }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">No comparables yet. Click "Add" to add one.</div>
      )}
      {showAddDialog && <ComparableFormDialog open={showAddDialog} onOpenChange={setShowAddDialog} category={category} propertyId={propertyId} />}
      {editComp && <ComparableFormDialog open={!!editComp} onOpenChange={(open) => !open && setEditComp(null)} category={category} propertyId={propertyId} editData={editComp} />}
    </div>
  );
}

// ===== EDITABLE FORMULA ROW =====
function FormulaRow({
  label, rate, pct, sfPct, sf, baths, cost, onRateChange, onPctChange, showPct = true, pctLabel,
}: {
  label: string; rate: number; pct?: number; sfPct?: boolean; sf: number; baths?: number;
  cost: number; onRateChange: (v: number) => void; onPctChange?: (v: number) => void;
  showPct?: boolean; pctLabel?: string;
}) {
  const calcBase = showPct && pct !== undefined ? Math.round(sf * (pct / 100)) : sf;
  const multiplier = baths ? ` x ${baths}` : "";
  const formulaText = showPct && pct !== undefined
    ? `$${rate} x ${pct}% of SF${multiplier}`
    : `$${rate} x SF${multiplier}`;
  const calcText = showPct && pct !== undefined
    ? `$${rate} x ${calcBase}${multiplier}`
    : `$${rate} x ${sf}${multiplier}`;

  return (
    <tr className="border-b hover:bg-gray-50/50">
      <td className="p-2 font-medium text-sm">{label}</td>
      <td className="p-2">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">$</span>
          <Input
            type="number" step="0.5" value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
            className="h-7 w-20 text-xs text-center"
          />
          {showPct && pct !== undefined && onPctChange && (
            <>
              <span className="text-muted-foreground text-xs mx-1">x</span>
              <Input
                type="number" step="0.5" value={pct}
                onChange={(e) => onPctChange(parseFloat(e.target.value) || 0)}
                className="h-7 w-16 text-xs text-center"
              />
              <span className="text-muted-foreground text-xs">%{pctLabel || " SF"}</span>
            </>
          )}
        </div>
      </td>
      <td className="p-2 text-muted-foreground text-xs">{calcText}</td>
      <td className="p-2 text-right font-semibold text-sm">{formatCurrency(cost)}</td>
    </tr>
  );
}

// ===== RENOVATION CALCULATOR =====
function RenovationCalculator({ propertyId, defaultSF, defaultBaths, defaultValue }: {
  propertyId: number; defaultSF: number; defaultBaths: number; defaultValue: number;
}) {
  const [sf, setSf] = useState(defaultSF.toString());
  const [baths, setBaths] = useState(defaultBaths.toString());
  const [estValue, setEstValue] = useState(defaultValue.toString());
  const [showFormulas, setShowFormulas] = useState(false);

  // Editable formula rates
  const [formulas, setFormulas] = useState({ ...DEFAULT_FORMULAS });

  const { data: savedEstimate } = trpc.comparables.getRenovationEstimate.useQuery({ propertyId });
  const utils = trpc.useUtils();
  const saveMutation = trpc.comparables.saveRenovationEstimate.useMutation({
    onSuccess: () => {
      toast.success("Renovation estimate saved!");
      utils.comparables.getRenovationEstimate.invalidate({ propertyId });
    },
    onError: (e) => toast.error(e.message),
  });

  // Load saved formulas when data arrives
  useEffect(() => {
    if (savedEstimate) {
      if (savedEstimate.squareFeet) setSf(savedEstimate.squareFeet.toString());
      if (savedEstimate.numberOfBathrooms) setBaths(savedEstimate.numberOfBathrooms.toString());
      if (savedEstimate.estimatedPropertyValue) setEstValue(savedEstimate.estimatedPropertyValue.toString());
      setFormulas({
        kitchenRate: parseFloat(savedEstimate.kitchenRate || "") || DEFAULT_FORMULAS.kitchenRate,
        kitchenPct: parseFloat(savedEstimate.kitchenPct || "") || DEFAULT_FORMULAS.kitchenPct,
        bathroomRate: parseFloat(savedEstimate.bathroomRate || "") || DEFAULT_FORMULAS.bathroomRate,
        bathroomPct: parseFloat(savedEstimate.bathroomPct || "") || DEFAULT_FORMULAS.bathroomPct,
        paintingRate: parseFloat(savedEstimate.paintingRate || "") || DEFAULT_FORMULAS.paintingRate,
        flooringRate: parseFloat(savedEstimate.flooringRate || "") || DEFAULT_FORMULAS.flooringRate,
        flooringPct: parseFloat(savedEstimate.flooringPct || "") || DEFAULT_FORMULAS.flooringPct,
        roofRate: parseFloat(savedEstimate.roofRate || "") || DEFAULT_FORMULAS.roofRate,
        acRate: parseFloat(savedEstimate.acRate || "") || DEFAULT_FORMULAS.acRate,
        cleaningRate: parseFloat(savedEstimate.cleaningRate || "") || DEFAULT_FORMULAS.cleaningRate,
        gardensRate: parseFloat(savedEstimate.gardensRate || "") || DEFAULT_FORMULAS.gardensRate,
        miscPct: parseFloat(savedEstimate.miscPct || "") || DEFAULT_FORMULAS.miscPct,
        permitsPct: parseFloat(savedEstimate.permitsPct || "") || DEFAULT_FORMULAS.permitsPct,
        holdCostRate: parseFloat(savedEstimate.holdCostRate || "") || DEFAULT_FORMULAS.holdCostRate,
        holdCostMonths: savedEstimate.holdCostMonths || DEFAULT_FORMULAS.holdCostMonths,
        commissionPct: parseFloat(savedEstimate.commissionPct || "") || DEFAULT_FORMULAS.commissionPct,
      });
    }
  }, [savedEstimate]);

  const updateFormula = (key: string, value: number) => {
    setFormulas((prev) => ({ ...prev, [key]: value }));
  };

  // Live calculation with custom formulas
  const costs = useMemo(() => {
    const s = parseInt(sf) || 0;
    const b = parseInt(baths) || 1;
    const v = parseInt(estValue) || 0;
    if (s <= 0) return null;

    const f = formulas;
    const kitchenCost = Math.round(f.kitchenRate * (s * (f.kitchenPct / 100)));
    const bathroomCost = Math.round(f.bathroomRate * (s * (f.bathroomPct / 100)) * b);
    const paintingCost = Math.round(f.paintingRate * s);
    const flooringCost = Math.round(f.flooringRate * (s * (f.flooringPct / 100)));
    const roofCost = Math.round(f.roofRate * s);
    const acCost = Math.round(f.acRate * s);
    const cleaningCost = Math.round(f.cleaningRate * s);
    const gardensCost = Math.round(f.gardensRate * s);

    const renovationSubtotal = kitchenCost + bathroomCost + paintingCost + flooringCost + roofCost + acCost + cleaningCost + gardensCost;
    const miscellaneous = Math.round(renovationSubtotal * (f.miscPct / 100));
    const permitsAndRelated = Math.round(renovationSubtotal * (f.permitsPct / 100));
    const holdCost = Math.round(f.holdCostRate * s * f.holdCostMonths);
    const subtotalWithExtras = renovationSubtotal + miscellaneous + permitsAndRelated + holdCost;
    const realEstateCommission = Math.round((f.commissionPct / 100) * (v + subtotalWithExtras));
    const totalGeral = subtotalWithExtras + realEstateCommission;

    const offer60 = Math.round(v * 0.60);
    const offer70 = Math.round(v * 0.70);
    const offer90 = Math.round(v * 0.90);

    return {
      kitchenCost, bathroomCost, paintingCost, flooringCost, roofCost, acCost, cleaningCost, gardensCost,
      renovationSubtotal, miscellaneous, permitsAndRelated, holdCost, realEstateCommission, totalGeral,
      offer60, offer70, offer90,
    };
  }, [sf, baths, estValue, formulas]);

  const handleSave = () => {
    saveMutation.mutate({
      propertyId,
      squareFeet: parseInt(sf) || 0,
      numberOfBathrooms: parseInt(baths) || 1,
      estimatedPropertyValue: parseInt(estValue) || 0,
      ...formulas,
    });
  };

  const handleResetFormulas = () => {
    setFormulas({ ...DEFAULT_FORMULAS });
    toast.info("Formulas reset to defaults");
  };

  return (
    <div className="space-y-4">
      {/* Input Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Calculator Inputs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Square Feet (SF)</label>
              <Input type="number" value={sf} onChange={(e) => setSf(e.target.value)} placeholder="1500" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Number of Bathrooms</label>
              <Input type="number" value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="2" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estimated Property Value ($)</label>
              <Input type="number" value={estValue} onChange={(e) => setEstValue(e.target.value)} placeholder="350000" className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {costs && (
        <>
          {/* Renovation Costs Table with Editable Formulas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Home className="w-4 h-4" /> Estimated Renovation Costs
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={handleResetFormulas} className="h-7 text-xs text-muted-foreground">
                    Reset Defaults
                  </Button>
                  <Button
                    size="sm"
                    variant={showFormulas ? "default" : "outline"}
                    onClick={() => setShowFormulas(!showFormulas)}
                    className="h-7 text-xs"
                  >
                    <Settings2 className="w-3 h-3 mr-1" />
                    {showFormulas ? "Hide Formulas" : "Edit Formulas"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-left p-2 font-medium">{showFormulas ? "Rate / %" : "Formula"}</th>
                    <th className="text-left p-2 font-medium">Calculation</th>
                    <th className="text-right p-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {showFormulas ? (
                    <>
                      <FormulaRow label="New Kitchen + Appliances" rate={formulas.kitchenRate} pct={formulas.kitchenPct} sf={parseInt(sf) || 0} cost={costs.kitchenCost}
                        onRateChange={(v) => updateFormula("kitchenRate", v)} onPctChange={(v) => updateFormula("kitchenPct", v)} />
                      <FormulaRow label={`New Bathroom(s) x${baths}`} rate={formulas.bathroomRate} pct={formulas.bathroomPct} sf={parseInt(sf) || 0} baths={parseInt(baths) || 1} cost={costs.bathroomCost}
                        onRateChange={(v) => updateFormula("bathroomRate", v)} onPctChange={(v) => updateFormula("bathroomPct", v)} />
                      <FormulaRow label="Painting (Int/Ext)" rate={formulas.paintingRate} sf={parseInt(sf) || 0} cost={costs.paintingCost} showPct={false}
                        onRateChange={(v) => updateFormula("paintingRate", v)} />
                      <FormulaRow label="New Flooring" rate={formulas.flooringRate} pct={formulas.flooringPct} sf={parseInt(sf) || 0} cost={costs.flooringCost}
                        onRateChange={(v) => updateFormula("flooringRate", v)} onPctChange={(v) => updateFormula("flooringPct", v)} />
                      <FormulaRow label="New Roof" rate={formulas.roofRate} sf={parseInt(sf) || 0} cost={costs.roofCost} showPct={false}
                        onRateChange={(v) => updateFormula("roofRate", v)} />
                      <FormulaRow label="New A/C" rate={formulas.acRate} sf={parseInt(sf) || 0} cost={costs.acCost} showPct={false}
                        onRateChange={(v) => updateFormula("acRate", v)} />
                      <FormulaRow label="Cleaning" rate={formulas.cleaningRate} sf={parseInt(sf) || 0} cost={costs.cleaningCost} showPct={false}
                        onRateChange={(v) => updateFormula("cleaningRate", v)} />
                      <FormulaRow label="Gardens" rate={formulas.gardensRate} sf={parseInt(sf) || 0} cost={costs.gardensCost} showPct={false}
                        onRateChange={(v) => updateFormula("gardensRate", v)} />
                    </>
                  ) : (
                    <>
                      <tr className="border-b"><td className="p-2">New Kitchen + Appliances</td><td className="p-2 text-muted-foreground text-xs">${formulas.kitchenRate} x {formulas.kitchenPct}% of SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.kitchenRate} x {Math.round((parseInt(sf) || 0) * (formulas.kitchenPct / 100))}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.kitchenCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">New Bathroom(s) x{baths}</td><td className="p-2 text-muted-foreground text-xs">${formulas.bathroomRate} x {formulas.bathroomPct}% of SF x {baths}</td><td className="p-2 text-muted-foreground text-xs">${formulas.bathroomRate} x {Math.round((parseInt(sf) || 0) * (formulas.bathroomPct / 100))} x {baths}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.bathroomCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">Painting (Int/Ext)</td><td className="p-2 text-muted-foreground text-xs">${formulas.paintingRate} x SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.paintingRate} x {sf}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.paintingCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">New Flooring</td><td className="p-2 text-muted-foreground text-xs">${formulas.flooringRate} x {formulas.flooringPct}% of SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.flooringRate} x {Math.round((parseInt(sf) || 0) * (formulas.flooringPct / 100))}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.flooringCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">New Roof</td><td className="p-2 text-muted-foreground text-xs">${formulas.roofRate} x SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.roofRate} x {sf}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.roofCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">New A/C</td><td className="p-2 text-muted-foreground text-xs">${formulas.acRate} x SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.acRate} x {sf}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.acCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">Cleaning</td><td className="p-2 text-muted-foreground text-xs">${formulas.cleaningRate} x SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.cleaningRate} x {sf}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.cleaningCost)}</td></tr>
                      <tr className="border-b"><td className="p-2">Gardens</td><td className="p-2 text-muted-foreground text-xs">${formulas.gardensRate} x SF</td><td className="p-2 text-muted-foreground text-xs">${formulas.gardensRate} x {sf}</td><td className="p-2 text-right font-medium">{formatCurrency(costs.gardensCost)}</td></tr>
                    </>
                  )}

                  <tr className="border-b bg-muted/20 font-semibold">
                    <td className="p-2" colSpan={3}>Renovation Subtotal</td>
                    <td className="p-2 text-right">{formatCurrency(costs.renovationSubtotal)}</td>
                  </tr>

                  {/* Miscellaneous - editable % */}
                  <tr className="border-b">
                    <td className="p-2">Miscellaneous</td>
                    <td className="p-2">
                      {showFormulas ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" step="0.5" value={formulas.miscPct} onChange={(e) => updateFormula("miscPct", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-center" />
                          <span className="text-muted-foreground text-xs">% of subtotal</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{formulas.miscPct}% of renovation subtotal</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">{formulas.miscPct}% x {formatCurrency(costs.renovationSubtotal)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.miscellaneous)}</td>
                  </tr>

                  {/* Permits - editable % */}
                  <tr className="border-b">
                    <td className="p-2">Permits & Related</td>
                    <td className="p-2">
                      {showFormulas ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" step="0.5" value={formulas.permitsPct} onChange={(e) => updateFormula("permitsPct", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-center" />
                          <span className="text-muted-foreground text-xs">% of subtotal</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{formulas.permitsPct}% of renovation subtotal</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">{formulas.permitsPct}% x {formatCurrency(costs.renovationSubtotal)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.permitsAndRelated)}</td>
                  </tr>

                  {/* Hold Cost - editable rate and months */}
                  <tr className="border-b">
                    <td className="p-2">Hold Cost</td>
                    <td className="p-2">
                      {showFormulas ? (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs">$</span>
                          <Input type="number" step="0.5" value={formulas.holdCostRate} onChange={(e) => updateFormula("holdCostRate", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-center" />
                          <span className="text-muted-foreground text-xs">x SF x</span>
                          <Input type="number" value={formulas.holdCostMonths} onChange={(e) => updateFormula("holdCostMonths", parseInt(e.target.value) || 0)} className="h-7 w-12 text-xs text-center" />
                          <span className="text-muted-foreground text-xs">mo</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">${formulas.holdCostRate} x SF x {formulas.holdCostMonths} months</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">${formulas.holdCostRate} x {sf} x {formulas.holdCostMonths}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.holdCost)}</td>
                  </tr>

                  {/* Commission - editable % */}
                  <tr className="border-b">
                    <td className="p-2">Real Estate Commission</td>
                    <td className="p-2">
                      {showFormulas ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" step="0.5" value={formulas.commissionPct} onChange={(e) => updateFormula("commissionPct", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-center" />
                          <span className="text-muted-foreground text-xs">% x (Value + Reno)</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{formulas.commissionPct}% x (Est. Price + Total Reno)</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">{formulas.commissionPct}% x ({formatCurrency(parseInt(estValue) || 0)} + {formatCurrency(costs.renovationSubtotal + costs.miscellaneous + costs.permitsAndRelated + costs.holdCost)})</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.realEstateCommission)}</td>
                  </tr>

                  <tr className="bg-primary/5 font-bold text-base">
                    <td className="p-3" colSpan={3}>TOTAL GERAL</td>
                    <td className="p-3 text-right text-primary">{formatCurrency(costs.totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Offer Generator */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Offer Generator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-xs text-red-600 font-medium mb-1">60% Offer</div>
                  <div className="text-xl font-bold text-red-700">{formatCurrency(costs.offer60)}</div>
                  <div className="text-[10px] text-red-500 mt-1">Aggressive / Distressed</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="text-xs text-yellow-600 font-medium mb-1">70% Offer</div>
                  <div className="text-xl font-bold text-yellow-700">{formatCurrency(costs.offer70)}</div>
                  <div className="text-[10px] text-yellow-500 mt-1">Balanced / Wholesale</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">90% Offer</div>
                  <div className="text-xl font-bold text-green-700">{formatCurrency(costs.offer90)}</div>
                  <div className="text-[10px] text-green-500 mt-1">Fair Market / Retail</div>
                </div>
              </div>

              {/* Net Profit Estimates */}
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <h5 className="text-xs font-semibold mb-2">Net After Renovation & Costs</h5>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="text-center">
                    <div className="text-muted-foreground">Buy at 60%</div>
                    <div className={`font-bold ${(parseInt(estValue) || 0) - costs.offer60 - costs.totalGeral >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency((parseInt(estValue) || 0) - costs.offer60 - costs.totalGeral)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Buy at 70%</div>
                    <div className={`font-bold ${(parseInt(estValue) || 0) - costs.offer70 - costs.totalGeral >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency((parseInt(estValue) || 0) - costs.offer70 - costs.totalGeral)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Buy at 90%</div>
                    <div className={`font-bold ${(parseInt(estValue) || 0) - costs.offer90 - costs.totalGeral >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency((parseInt(estValue) || 0) - costs.offer90 - costs.totalGeral)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm">
                  <Save className="w-4 h-4 mr-1" />
                  Save Estimate
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ===== MAIN COMPARABLES COMPONENT =====
export default function Comparables({ propertyId, buildingSF, totalBaths, estimatedValue }: ComparablesProps) {
  const { data: comps = [], isLoading } = trpc.comparables.getByProperty.useQuery({ propertyId });
  const { data: savedEstimate, isLoading: isLoadingEstimate } = trpc.comparables.getRenovationEstimate.useQuery({ propertyId });

  const categories: Category[] = ["SOLD_6MO", "SOLD_12MO", "PENDING", "FOR_SALE", "FOR_RENT"];

  // Determine if there's a saved calculation
  const hasCalculation = savedEstimate && savedEstimate.totalGeral && savedEstimate.totalGeral > 0;

  return (
    <div className="space-y-4">
      {/* TOTAL VALUE SUMMARY — always visible at the top */}
      {isLoadingEstimate ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      ) : hasCalculation ? (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Total Renovation Cost</div>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(savedEstimate.totalGeral)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Est. Property Value</div>
              <div className="text-lg font-semibold text-gray-700">{formatCurrency(savedEstimate.estimatedPropertyValue)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Offers</div>
              <div className="flex gap-3 text-xs">
                <span className="text-red-600 font-semibold">60%: {formatCurrency(savedEstimate.offer60)}</span>
                <span className="text-yellow-600 font-semibold">70%: {formatCurrency(savedEstimate.offer70)}</span>
                <span className="text-green-600 font-semibold">90%: {formatCurrency(savedEstimate.offer90)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-800">Comparable analysis not performed yet</div>
              <div className="text-xs text-amber-600 mt-0.5">
                Go to the "Renovation Calculator" tab to calculate renovation costs and generate offers.
                {estimatedValue ? (
                  <span className="ml-1 font-medium">Current estimated value: {formatCurrency(estimatedValue)}</span>
                ) : (
                  <span className="ml-1">No estimated value available for this property.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="comparables" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="comparables" className="flex items-center gap-2">
            <Home className="w-4 h-4" /> Comparables
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Renovation Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparables" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading comparables...</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <ComparableTable key={cat} category={cat} comps={comps} propertyId={propertyId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calculator" className="mt-4">
          <RenovationCalculator
            propertyId={propertyId}
            defaultSF={buildingSF || 0}
            defaultBaths={totalBaths || 1}
            defaultValue={estimatedValue || 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
