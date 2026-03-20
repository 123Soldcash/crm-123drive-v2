import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Shield } from "lucide-react";

interface OfferEntry {
  toBeSent: boolean;
  offerSent: boolean;
  viaAdobe: boolean;
  viaEmail: boolean;
  viaTxt: boolean;
  viaUps: boolean;
  viaFedex: boolean;
  viaUsps: boolean;
  viaInPerson: boolean;
  offerDate: string;
  offerAmount: number;
  isVerbal: boolean;
  isWrittenOffer: boolean;
}

function createEmptyOffer(): OfferEntry {
  return {
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
  };
}

interface OfferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number;
  onSuccess?: () => void;
}

export function OfferFormDialog({ open, onOpenChange, propertyId, onSuccess }: OfferFormDialogProps) {
  const [offers, setOffers] = useState<OfferEntry[]>([createEmptyOffer()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = trpc.useUtils();

  const moveToOfferPending = trpc.properties.moveToOfferPending.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      utils.properties.getOffers.invalidate({ propertyId });
      utils.properties.getPropertiesByStage.invalidate();
      setOffers([createEmptyOffer()]);
      setIsSubmitting(false);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      setIsSubmitting(false);
    },
  });

  const updateOffer = (index: number, field: keyof OfferEntry, value: any) => {
    setOffers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addOffer = () => {
    setOffers((prev) => [...prev, createEmptyOffer()]);
  };

  const removeOffer = (index: number) => {
    if (offers.length <= 1) return;
    setOffers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    moveToOfferPending.mutate({
      propertyId,
      offers: offers.map((o) => ({
        ...o,
        offerDate: o.offerDate || new Date().toISOString().split("T")[0],
      })),
    });
  };

  const handleCancel = () => {
    setOffers([createEmptyOffer()]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-amber-500" />
            Offer
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Complete offer details before moving this lead.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {offers.map((offer, idx) => (
            <div key={idx} className="space-y-3">
              {idx > 0 && <Separator className="my-3" />}
              {offers.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Offer #{idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOffer(idx)}
                    className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              )}

              {/* Status checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.toBeSent}
                    onCheckedChange={(v) => updateOffer(idx, "toBeSent", !!v)}
                  />
                  to be Sent
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.offerSent}
                    onCheckedChange={(v) => updateOffer(idx, "offerSent", !!v)}
                  />
                  Offer Sent
                </label>
              </div>

              {/* Delivery method checkboxes - row 1 */}
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaAdobe}
                    onCheckedChange={(v) => updateOffer(idx, "viaAdobe", !!v)}
                  />
                  Adobe
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaEmail}
                    onCheckedChange={(v) => updateOffer(idx, "viaEmail", !!v)}
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaTxt}
                    onCheckedChange={(v) => updateOffer(idx, "viaTxt", !!v)}
                  />
                  Txt
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaUps}
                    onCheckedChange={(v) => updateOffer(idx, "viaUps", !!v)}
                  />
                  UPS
                </label>
              </div>

              {/* Delivery method checkboxes - row 2 */}
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaFedex}
                    onCheckedChange={(v) => updateOffer(idx, "viaFedex", !!v)}
                  />
                  FedEx
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaUsps}
                    onCheckedChange={(v) => updateOffer(idx, "viaUsps", !!v)}
                  />
                  USPS
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.viaInPerson}
                    onCheckedChange={(v) => updateOffer(idx, "viaInPerson", !!v)}
                  />
                  In Person
                </label>
              </div>

              {/* Date and Amount */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Date</Label>
                  <Input
                    type="date"
                    value={offer.offerDate}
                    onChange={(e) => updateOffer(idx, "offerDate", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-medium">Amount ($)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={offer.offerAmount || ""}
                      onChange={(e) => updateOffer(idx, "offerAmount", Number(e.target.value) || 0)}
                      className="pl-7"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Offer type checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.isVerbal}
                    onCheckedChange={(v) => updateOffer(idx, "isVerbal", !!v)}
                  />
                  Verbal
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={offer.isWrittenOffer}
                    onCheckedChange={(v) => updateOffer(idx, "isWrittenOffer", !!v)}
                  />
                  Written Offer
                </label>
              </div>
            </div>
          ))}

          {/* New Offer button */}
          <button
            type="button"
            onClick={addOffer}
            className="w-full py-2 px-4 text-sm font-semibold text-center rounded-md bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            &quot; NEW OFFER &quot;
          </button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? "Moving..." : "Move to Offer Pending"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
