import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Calculator, DollarSign, Home, TrendingUp } from "lucide-react";

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

interface ComparablesProps {
  propertyId: number;
  buildingSF?: number | null;
  totalBaths?: number | null;
  estimatedValue?: number | null;
}

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

// ===== ADD/EDIT COMPARABLE DIALOG =====
function ComparableFormDialog({
  open,
  onOpenChange,
  category,
  propertyId,
  editData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  propertyId: number;
  editData?: {
    id: number;
    address: string;
    bedrooms?: number | null;
    bathrooms?: string | null;
    squareFeet?: number | null;
    lotSize?: string | null;
    yearBuilt?: number | null;
    distanceFromSubject?: string | null;
    saleDate?: string | null;
    listedDate?: string | null;
    amount?: number | null;
    buyerName?: string | null;
    overallCondition?: string | null;
    source?: string | null;
    notes?: string | null;
  } | null;
}) {
  const [form, setForm] = useState({
    address: editData?.address || "",
    bedrooms: editData?.bedrooms?.toString() || "",
    bathrooms: editData?.bathrooms?.toString() || "",
    squareFeet: editData?.squareFeet?.toString() || "",
    lotSize: editData?.lotSize || "",
    yearBuilt: editData?.yearBuilt?.toString() || "",
    distanceFromSubject: editData?.distanceFromSubject || "",
    saleDate: editData?.saleDate || "",
    listedDate: editData?.listedDate || "",
    amount: editData?.amount?.toString() || "",
    buyerName: editData?.buyerName || "",
    overallCondition: editData?.overallCondition || "",
    source: editData?.source || "",
    notes: editData?.notes || "",
  });

  const utils = trpc.useUtils();
  const addMutation = trpc.comparables.addComparable.useMutation({
    onSuccess: () => {
      toast.success("Comparable added!");
      utils.comparables.getByProperty.invalidate({ propertyId });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.comparables.updateComparable.useMutation({
    onSuccess: () => {
      toast.success("Comparable updated!");
      utils.comparables.getByProperty.invalidate({ propertyId });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.address.trim()) {
      toast.error("Address is required");
      return;
    }
    const data = {
      address: form.address,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : undefined,
      squareFeet: form.squareFeet ? parseInt(form.squareFeet) : undefined,
      lotSize: form.lotSize || undefined,
      yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
      distanceFromSubject: form.distanceFromSubject || undefined,
      saleDate: form.saleDate || undefined,
      listedDate: form.listedDate || undefined,
      amount: form.amount ? parseInt(form.amount.replace(/[^0-9]/g, "")) : undefined,
      buyerName: form.buyerName || undefined,
      overallCondition: form.overallCondition || undefined,
      source: form.source || undefined,
      notes: form.notes || undefined,
    };

    if (editData?.id) {
      updateMutation.mutate({ id: editData.id, ...data });
    } else {
      addMutation.mutate({ propertyId, category, ...data });
    }
  };

  const isSoldOrPending = category === "SOLD_6MO" || category === "SOLD_12MO" || category === "PENDING";
  const showBuyer = category === "SOLD_6MO" || category === "SOLD_12MO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Edit" : "Add"} Comparable — {CATEGORY_LABELS[category]}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Address *</label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, FL" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bedrooms</label>
            <Input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="3" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bathrooms</label>
            <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} placeholder="2" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Square Feet</label>
            <Input type="number" value={form.squareFeet} onChange={(e) => setForm({ ...form, squareFeet: e.target.value })} placeholder="1500" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Lot Size</label>
            <Input value={form.lotSize} onChange={(e) => setForm({ ...form, lotSize: e.target.value })} placeholder="0.25 acres" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Year Built</label>
            <Input type="number" value={form.yearBuilt} onChange={(e) => setForm({ ...form, yearBuilt: e.target.value })} placeholder="1985" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Distance from Subject</label>
            <Input value={form.distanceFromSubject} onChange={(e) => setForm({ ...form, distanceFromSubject: e.target.value })} placeholder="0.3 mi" />
          </div>
          {isSoldOrPending && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">{category === "PENDING" ? "Listed Date" : "Sale Date"}</label>
              <Input value={category === "PENDING" ? form.listedDate : form.saleDate} onChange={(e) => setForm({ ...form, [category === "PENDING" ? "listedDate" : "saleDate"]: e.target.value })} placeholder="01/15/2026" />
            </div>
          )}
          {!isSoldOrPending && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Listed Date</label>
              <Input value={form.listedDate} onChange={(e) => setForm({ ...form, listedDate: e.target.value })} placeholder="01/15/2026" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Amount ($)</label>
            <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="350000" />
          </div>
          {showBuyer && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Buyer Name</label>
              <Input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} placeholder="John Doe" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Overall Condition</label>
            <Select value={form.overallCondition} onValueChange={(v) => setForm({ ...form, overallCondition: v })}>
              <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source</label>
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Zillow, Redfin, Realtor..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={addMutation.isPending || updateMutation.isPending}>
            <Save className="w-4 h-4 mr-1" />
            {editData ? "Update" : "Add"} Comparable
          </Button>
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
    onSuccess: () => {
      toast.success("Comparable deleted");
      utils.comparables.getByProperty.invalidate({ propertyId });
    },
  });

  const filtered = comps.filter((c) => c.category === category);
  const showBuyer = category === "SOLD_6MO" || category === "SOLD_12MO";
  const dateLabel = category === "PENDING" || category === "FOR_SALE" || category === "FOR_RENT" ? "Listed Date" : "Sale Date";

  // Calculate average amount
  const avgAmount = filtered.length > 0
    ? Math.round(filtered.reduce((sum, c) => sum + (c.amount || 0), 0) / filtered.filter(c => c.amount).length)
    : 0;

  return (
    <div className={`border rounded-lg ${CATEGORY_COLORS[category]} mb-4`}>
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{CATEGORY_LABELS[category]}</h4>
          <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full font-medium">{filtered.length} comps</span>
          {avgAmount > 0 && (
            <span className="text-xs text-muted-foreground">Avg: {formatCurrency(avgAmount)}</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-white/50">
                <th className="text-left p-2 font-medium">Address</th>
                <th className="text-center p-2 font-medium">Bed/Bath/SF</th>
                <th className="text-center p-2 font-medium">Lot Size</th>
                <th className="text-center p-2 font-medium">Year</th>
                <th className="text-center p-2 font-medium">Distance</th>
                <th className="text-center p-2 font-medium">{dateLabel}</th>
                <th className="text-right p-2 font-medium">Amount</th>
                {showBuyer && <th className="text-left p-2 font-medium">Buyer</th>}
                <th className="text-center p-2 font-medium">Condition</th>
                <th className="text-center p-2 font-medium w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((comp) => (
                <tr key={comp.id} className="border-b hover:bg-white/40">
                  <td className="p-2 font-medium max-w-[200px]">{comp.address}</td>
                  <td className="p-2 text-center">{comp.bedrooms || "-"}/{comp.bathrooms || "-"}/{comp.squareFeet?.toLocaleString() || "-"}</td>
                  <td className="p-2 text-center">{comp.lotSize || "-"}</td>
                  <td className="p-2 text-center">{comp.yearBuilt || "-"}</td>
                  <td className="p-2 text-center">{comp.distanceFromSubject || "-"}</td>
                  <td className="p-2 text-center">{comp.saleDate || comp.listedDate || "-"}</td>
                  <td className="p-2 text-right font-semibold text-green-700">{comp.amount ? formatCurrency(comp.amount) : "-"}</td>
                  {showBuyer && <td className="p-2">{comp.buyerName || "-"}</td>}
                  <td className="p-2 text-center">
                    {comp.overallCondition && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        comp.overallCondition === "Excellent" || comp.overallCondition === "Good" ? "bg-green-100 text-green-700" :
                        comp.overallCondition === "Fair" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {comp.overallCondition}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => setEditComp(comp)} className="p-1 hover:bg-white/60 rounded" title="Edit">
                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => { if (confirm("Delete this comparable?")) deleteMutation.mutate({ id: comp.id }); }} className="p-1 hover:bg-red-50 rounded" title="Delete">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">
          No comparables yet. Click "Add" to add one.
        </div>
      )}

      {showAddDialog && (
        <ComparableFormDialog open={showAddDialog} onOpenChange={setShowAddDialog} category={category} propertyId={propertyId} />
      )}
      {editComp && (
        <ComparableFormDialog open={!!editComp} onOpenChange={(open) => !open && setEditComp(null)} category={category} propertyId={propertyId} editData={editComp} />
      )}
    </div>
  );
}

// ===== RENOVATION CALCULATOR =====
function RenovationCalculator({ propertyId, defaultSF, defaultBaths, defaultValue }: {
  propertyId: number;
  defaultSF: number;
  defaultBaths: number;
  defaultValue: number;
}) {
  const [sf, setSf] = useState(defaultSF.toString());
  const [baths, setBaths] = useState(defaultBaths.toString());
  const [estValue, setEstValue] = useState(defaultValue.toString());

  const { data: savedEstimate } = trpc.comparables.getRenovationEstimate.useQuery({ propertyId });
  const saveMutation = trpc.comparables.saveRenovationEstimate.useMutation({
    onSuccess: () => toast.success("Renovation estimate saved!"),
    onError: (e) => toast.error(e.message),
  });

  // Live calculation
  const costs = useMemo(() => {
    const s = parseInt(sf) || 0;
    const b = parseInt(baths) || 1;
    const v = parseInt(estValue) || 0;
    if (s <= 0) return null;

    const kitchenCost = Math.round(180 * (s * 0.10));
    const bathroomCost = Math.round(110 * (s * 0.03) * b);
    const paintingCost = Math.round(6 * s);
    const flooringCost = Math.round(11 * (s * 0.80));
    const roofCost = Math.round(15 * s);
    const acCost = Math.round(6.5 * s);
    const cleaningCost = Math.round(1.5 * s);
    const gardensCost = Math.round(1.8 * s);

    const renovationSubtotal = kitchenCost + bathroomCost + paintingCost + flooringCost + roofCost + acCost + cleaningCost + gardensCost;
    const miscellaneous = Math.round(renovationSubtotal * 0.05);
    const permitsAndRelated = Math.round(renovationSubtotal * 0.03);
    const holdCost = Math.round(2.00 * s * 6);
    const subtotalWithExtras = renovationSubtotal + miscellaneous + permitsAndRelated + holdCost;
    const realEstateCommission = Math.round(0.06 * (v + subtotalWithExtras));
    const totalGeral = subtotalWithExtras + realEstateCommission;

    const offer60 = Math.round(v * 0.60);
    const offer70 = Math.round(v * 0.70);
    const offer90 = Math.round(v * 0.90);

    return {
      kitchenCost, bathroomCost, paintingCost, flooringCost, roofCost, acCost, cleaningCost, gardensCost,
      renovationSubtotal, miscellaneous, permitsAndRelated, holdCost, realEstateCommission, totalGeral,
      offer60, offer70, offer90,
    };
  }, [sf, baths, estValue]);

  const handleSave = () => {
    saveMutation.mutate({
      propertyId,
      squareFeet: parseInt(sf) || 0,
      numberOfBathrooms: parseInt(baths) || 1,
      estimatedPropertyValue: parseInt(estValue) || 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* Input Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Renovation Calculator Inputs
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
          {/* Renovation Costs Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Home className="w-4 h-4" /> Estimated Renovation Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-left p-2 font-medium">Formula</th>
                    <th className="text-left p-2 font-medium">Calculation</th>
                    <th className="text-right p-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">New Kitchen + Appliances</td>
                    <td className="p-2 text-muted-foreground text-xs">$180 x 10% of SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$180 x {Math.round((parseInt(sf) || 0) * 0.10)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.kitchenCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">New Bathroom(s) x{baths}</td>
                    <td className="p-2 text-muted-foreground text-xs">$110 x 3% of SF x {baths}</td>
                    <td className="p-2 text-muted-foreground text-xs">$110 x {Math.round((parseInt(sf) || 0) * 0.03)} x {baths}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.bathroomCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Painting (Int/Ext)</td>
                    <td className="p-2 text-muted-foreground text-xs">$6 x SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$6 x {sf}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.paintingCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">New Flooring</td>
                    <td className="p-2 text-muted-foreground text-xs">$11 x 80% of SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$11 x {Math.round((parseInt(sf) || 0) * 0.80)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.flooringCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">New Roof</td>
                    <td className="p-2 text-muted-foreground text-xs">$15 x SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$15 x {sf}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.roofCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">New A/C</td>
                    <td className="p-2 text-muted-foreground text-xs">$6.50 x SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$6.50 x {sf}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.acCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Cleaning</td>
                    <td className="p-2 text-muted-foreground text-xs">$1.50 x SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$1.50 x {sf}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.cleaningCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Gardens</td>
                    <td className="p-2 text-muted-foreground text-xs">$1.80 x SF</td>
                    <td className="p-2 text-muted-foreground text-xs">$1.80 x {sf}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.gardensCost)}</td>
                  </tr>
                  <tr className="border-b bg-muted/20 font-semibold">
                    <td className="p-2" colSpan={3}>Renovation Subtotal</td>
                    <td className="p-2 text-right">{formatCurrency(costs.renovationSubtotal)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Miscellaneous</td>
                    <td className="p-2 text-muted-foreground text-xs">5% of renovation subtotal</td>
                    <td className="p-2 text-muted-foreground text-xs">5% x {formatCurrency(costs.renovationSubtotal)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.miscellaneous)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Permits & Related</td>
                    <td className="p-2 text-muted-foreground text-xs">3% of renovation subtotal</td>
                    <td className="p-2 text-muted-foreground text-xs">3% x {formatCurrency(costs.renovationSubtotal)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.permitsAndRelated)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Hold Cost (6 Months)</td>
                    <td className="p-2 text-muted-foreground text-xs">$2.00 x SF x 6</td>
                    <td className="p-2 text-muted-foreground text-xs">$2.00 x {sf} x 6</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(costs.holdCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Real Estate Commission</td>
                    <td className="p-2 text-muted-foreground text-xs">6% x (Est. Price + Total Reno)</td>
                    <td className="p-2 text-muted-foreground text-xs">6% x ({formatCurrency(parseInt(estValue) || 0)} + {formatCurrency(costs.renovationSubtotal + costs.miscellaneous + costs.permitsAndRelated + costs.holdCost)})</td>
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
                  <div className="text-[10px] text-yellow-500 mt-1">Standard Wholesale</div>
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

  const categories: Category[] = ["SOLD_6MO", "SOLD_12MO", "PENDING", "FOR_SALE", "FOR_RENT"];

  return (
    <div className="space-y-6">
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
