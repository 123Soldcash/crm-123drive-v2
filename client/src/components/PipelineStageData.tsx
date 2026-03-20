import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  DollarSign,
  CalendarDays,
  Send,
  Mail,
  MessageSquare,
  Truck,
  Package,
  UserCheck,
  FileText,
  Mic,
} from "lucide-react";
import { OfferFormDialog } from "./OfferFormDialog";

interface PipelineStageDataProps {
  propertyId: number;
  dealStage: string | null;
}

interface OfferRow {
  id: number;
  propertyId: number;
  toBeSent: number;
  offerSent: number;
  viaAdobe: number;
  viaEmail: number;
  viaTxt: number;
  viaUps: number;
  viaFedex: number;
  viaUsps: number;
  viaInPerson: number;
  offerDate: string | null;
  offerAmount: number;
  isVerbal: number;
  isWrittenOffer: number;
  createdAt: string;
}

function DeliveryBadges({ offer }: { offer: OfferRow }) {
  const methods: { key: keyof OfferRow; label: string; icon: React.ReactNode }[] = [
    { key: "viaAdobe", label: "Adobe", icon: <FileText className="h-3 w-3" /> },
    { key: "viaEmail", label: "Email", icon: <Mail className="h-3 w-3" /> },
    { key: "viaTxt", label: "Txt", icon: <MessageSquare className="h-3 w-3" /> },
    { key: "viaUps", label: "UPS", icon: <Package className="h-3 w-3" /> },
    { key: "viaFedex", label: "FedEx", icon: <Truck className="h-3 w-3" /> },
    { key: "viaUsps", label: "USPS", icon: <Send className="h-3 w-3" /> },
    { key: "viaInPerson", label: "In Person", icon: <UserCheck className="h-3 w-3" /> },
  ];

  const active = methods.filter((m) => offer[m.key] === 1);
  if (active.length === 0) return <span className="text-xs text-muted-foreground">No delivery method</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((m) => (
        <Badge key={m.key} variant="secondary" className="text-xs gap-1 py-0.5">
          {m.icon} {m.label}
        </Badge>
      ))}
    </div>
  );
}

function OfferCard({ offer, onDelete, onUpdate }: { offer: OfferRow; onDelete: () => void; onUpdate: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    toBeSent: !!offer.toBeSent,
    offerSent: !!offer.offerSent,
    viaAdobe: !!offer.viaAdobe,
    viaEmail: !!offer.viaEmail,
    viaTxt: !!offer.viaTxt,
    viaUps: !!offer.viaUps,
    viaFedex: !!offer.viaFedex,
    viaUsps: !!offer.viaUsps,
    viaInPerson: !!offer.viaInPerson,
    offerDate: offer.offerDate ? new Date(offer.offerDate).toISOString().split("T")[0] : "",
    offerAmount: offer.offerAmount,
    isVerbal: !!offer.isVerbal,
    isWrittenOffer: !!offer.isWrittenOffer,
  });

  const handleSave = () => {
    onUpdate({ offerId: offer.id, ...editData });
    setEditing(false);
  };

  const formattedDate = offer.offerDate
    ? new Date(offer.offerDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    : "N/A";

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(offer.offerAmount || 0);

  if (editing) {
    return (
      <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Edit Offer</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-7 w-7 p-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={editData.toBeSent} onCheckedChange={(v) => setEditData((p) => ({ ...p, toBeSent: !!v }))} />
            to be Sent
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={editData.offerSent} onCheckedChange={(v) => setEditData((p) => ({ ...p, offerSent: !!v }))} />
            Offer Sent
          </label>
        </div>

        {/* Delivery */}
        <div className="flex flex-wrap items-center gap-3">
          {(["viaAdobe", "viaEmail", "viaTxt", "viaUps", "viaFedex", "viaUsps", "viaInPerson"] as const).map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={editData[key]} onCheckedChange={(v) => setEditData((p) => ({ ...p, [key]: !!v }))} />
              {key.replace("via", "")}
            </label>
          ))}
        </div>

        {/* Date + Amount */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={editData.offerDate} onChange={(e) => setEditData((p) => ({ ...p, offerDate: e.target.value }))} className="h-8 text-sm mt-0.5" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Amount ($)</Label>
            <Input type="number" value={editData.offerAmount || ""} onChange={(e) => setEditData((p) => ({ ...p, offerAmount: Number(e.target.value) || 0 }))} className="h-8 text-sm mt-0.5" placeholder="0" />
          </div>
        </div>

        {/* Type */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={editData.isVerbal} onCheckedChange={(v) => setEditData((p) => ({ ...p, isVerbal: !!v }))} />
            Verbal
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={editData.isWrittenOffer} onCheckedChange={(v) => setEditData((p) => ({ ...p, isWrittenOffer: !!v }))} />
            Written Offer
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Check className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {offer.toBeSent === 1 && (
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                To be Sent
              </Badge>
            )}
            {offer.offerSent === 1 && (
              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                <Check className="h-3 w-3 mr-0.5" /> Offer Sent
              </Badge>
            )}
            {offer.isVerbal === 1 && (
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                <Mic className="h-3 w-3 mr-0.5" /> Verbal
              </Badge>
            )}
            {offer.isWrittenOffer === 1 && (
              <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                <FileText className="h-3 w-3 mr-0.5" /> Written
              </Badge>
            )}
          </div>

          {/* Amount and Date */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 font-semibold text-green-700">
              <DollarSign className="h-3.5 w-3.5" />
              {formattedAmount}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
          </div>

          {/* Delivery methods */}
          <DeliveryBadges offer={offer} />
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PipelineStageData({ propertyId, dealStage }: PipelineStageDataProps) {
  const [addOfferOpen, setAddOfferOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: offers, isLoading } = trpc.properties.getOffers.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const updateOffer = trpc.properties.updateOffer.useMutation({
    onSuccess: () => {
      utils.properties.getOffers.invalidate({ propertyId });
    },
  });

  const deleteOffer = trpc.properties.deleteOffer.useMutation({
    onSuccess: () => {
      utils.properties.getOffers.invalidate({ propertyId });
    },
  });

  // Only show if there are offers OR if the stage is OFFER_PENDING or later pipeline stages
  const hasOffers = offers && offers.length > 0;
  if (!hasOffers && !isLoading) return null;
  if (isLoading) return null;

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" />
              Offers ({offers?.length || 0})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOfferOpen(true)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" /> New Offer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          {offers?.map((offer: any) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onDelete={() => deleteOffer.mutate({ offerId: offer.id })}
              onUpdate={(data: any) => updateOffer.mutate(data)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Add Offer Dialog (standalone, not tied to stage transition) */}
      <AddOfferDialog
        open={addOfferOpen}
        onOpenChange={setAddOfferOpen}
        propertyId={propertyId}
      />
    </>
  );
}

// Simpler dialog for adding an offer without changing stage
function AddOfferDialog({ open, onOpenChange, propertyId }: { open: boolean; onOpenChange: (v: boolean) => void; propertyId: number }) {
  const [offer, setOffer] = useState({
    toBeSent: false,
    offerSent: false,
    viaAdobe: false,
    viaEmail: false,
    viaTxt: false,
    viaUps: false,
    viaFedex: false,
    viaUsps: false,
    viaInPerson: false,
    offerDate: new Date().toISOString().split("T")[0],
    offerAmount: 0,
    isVerbal: false,
    isWrittenOffer: false,
  });

  const utils = trpc.useUtils();
  const createOffer = trpc.properties.createOffer.useMutation({
    onSuccess: () => {
      utils.properties.getOffers.invalidate({ propertyId });
      setOffer({
        toBeSent: false, offerSent: false, viaAdobe: false, viaEmail: false,
        viaTxt: false, viaUps: false, viaFedex: false, viaUsps: false,
        viaInPerson: false, offerDate: new Date().toISOString().split("T")[0],
        offerAmount: 0, isVerbal: false, isWrittenOffer: false,
      });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            New Offer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={offer.toBeSent} onCheckedChange={(v) => setOffer((p) => ({ ...p, toBeSent: !!v }))} />
              to be Sent
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={offer.offerSent} onCheckedChange={(v) => setOffer((p) => ({ ...p, offerSent: !!v }))} />
              Offer Sent
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {([["viaAdobe","Adobe"],["viaEmail","Email"],["viaTxt","Txt"],["viaUps","UPS"],["viaFedex","FedEx"],["viaUsps","USPS"],["viaInPerson","In Person"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={(offer as any)[key]} onCheckedChange={(v) => setOffer((p) => ({ ...p, [key]: !!v }))} />
                {label}
              </label>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-sm">Date</Label>
              <Input type="date" value={offer.offerDate} onChange={(e) => setOffer((p) => ({ ...p, offerDate: e.target.value }))} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label className="text-sm">Amount ($)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={offer.offerAmount || ""} onChange={(e) => setOffer((p) => ({ ...p, offerAmount: Number(e.target.value) || 0 }))} className="pl-7" placeholder="0" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={offer.isVerbal} onCheckedChange={(v) => setOffer((p) => ({ ...p, isVerbal: !!v }))} />
              Verbal
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={offer.isWrittenOffer} onCheckedChange={(v) => setOffer((p) => ({ ...p, isWrittenOffer: !!v }))} />
              Written Offer
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createOffer.mutate({ propertyId, ...offer })} disabled={createOffer.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
            {createOffer.isPending ? "Adding..." : "Add Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
