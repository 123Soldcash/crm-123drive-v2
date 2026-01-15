import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface MergeLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryLeadId: number;
  secondaryLeadId: number;
  primaryLeadAddress: string;
  secondaryLeadAddress: string;
  primaryLeadOwner: string | null;
  secondaryLeadOwner: string | null;
  onMergeComplete?: () => void;
}

export function MergeLeadsDialog({
  open,
  onOpenChange,
  primaryLeadId,
  secondaryLeadId,
  primaryLeadAddress,
  secondaryLeadAddress,
  primaryLeadOwner,
  secondaryLeadOwner,
  onMergeComplete,
}: MergeLeadsDialogProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<"first" | "second">("first");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"select" | "confirm">("select");

  const utils = trpc.useUtils();
  const mergeMutation = trpc.properties.mergeLeads.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Leads merged successfully! ${data.itemsMerged.contacts} contacts, ${data.itemsMerged.notes} notes, ${data.itemsMerged.tasks} tasks transferred.`
      );
      utils.properties.list.invalidate();
      utils.properties.stats.invalidate();
      onMergeComplete?.();
      onOpenChange(false);
      setStep("select");
      setReason("");
    },
    onError: (error) => {
      toast.error("Failed to merge leads: " + error.message);
    },
  });

  const handleNext = () => {
    setStep("confirm");
  };

  const handleMerge = () => {
    const finalPrimaryId = selectedPrimary === "first" ? primaryLeadId : secondaryLeadId;
    const finalSecondaryId = selectedPrimary === "first" ? secondaryLeadId : primaryLeadId;

    mergeMutation.mutate({
      primaryLeadId: finalPrimaryId,
      secondaryLeadId: finalSecondaryId,
      reason: reason || undefined,
    });
  };

  const handleBack = () => {
    setStep("select");
  };

  const firstLead = {
    id: primaryLeadId,
    address: primaryLeadAddress,
    owner: primaryLeadOwner,
  };

  const secondLead = {
    id: secondaryLeadId,
    address: secondaryLeadAddress,
    owner: secondaryLeadOwner,
  };

  const primaryLead = selectedPrimary === "first" ? firstLead : secondLead;
  const secondaryLead = selectedPrimary === "first" ? secondLead : firstLead;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Merge Duplicate Leads" : "Confirm Merge"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Select which lead to keep as primary. All data from the secondary lead will be transferred to the primary lead."
              : "Review your selection before merging. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-6">
            <RadioGroup
              value={selectedPrimary}
              onValueChange={(value) => setSelectedPrimary(value as "first" | "second")}
            >
              {/* First Lead Option */}
              <div
                className={`relative flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedPrimary === "first"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                onClick={() => setSelectedPrimary("first")}
              >
                <RadioGroupItem value="first" id="first" className="mt-1" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="first" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                    Lead #{firstLead.id}
                    {selectedPrimary === "first" && (
                      <span className="text-xs font-normal px-2 py-0.5 bg-blue-500 text-white rounded-full">
                        Primary
                      </span>
                    )}
                  </Label>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Address:</strong> {firstLead.address}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Owner:</strong> {firstLead.owner || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Second Lead Option */}
              <div
                className={`relative flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedPrimary === "second"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                onClick={() => setSelectedPrimary("second")}
              >
                <RadioGroupItem value="second" id="second" className="mt-1" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="second" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                    Lead #{secondLead.id}
                    {selectedPrimary === "second" && (
                      <span className="text-xs font-normal px-2 py-0.5 bg-blue-500 text-white rounded-full">
                        Primary
                      </span>
                    )}
                  </Label>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Address:</strong> {secondLead.address}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Owner:</strong> {secondLead.owner || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Merge (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="E.g., Same property with different addresses, duplicate entry..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    What will be merged:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200">
                    <li>All contacts, phones, and emails</li>
                    <li>All notes and tasks</li>
                    <li>All photos and visit records</li>
                    <li>All agent assignments</li>
                    <li>All family members</li>
                  </ul>
                  <p className="font-semibold text-amber-900 dark:text-amber-100 mt-2">
                    The secondary lead will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-6">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Primary Lead (Will be kept):
                  </p>
                  <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    <p><strong>Lead ID:</strong> #{primaryLead.id}</p>
                    <p><strong>Address:</strong> {primaryLead.address}</p>
                    <p><strong>Owner:</strong> {primaryLead.owner || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    Secondary Lead (Will be merged and deleted):
                  </p>
                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <p><strong>Lead ID:</strong> #{secondaryLead.id}</p>
                    <p><strong>Address:</strong> {secondaryLead.address}</p>
                    <p><strong>Owner:</strong> {secondaryLead.owner || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>

            {reason && (
              <div className="space-y-2">
                <Label>Reason:</Label>
                <p className="text-sm text-gray-700 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border">
                  {reason}
                </p>
              </div>
            )}

            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This action cannot be undone. Lead #{secondaryLead.id} will be permanently deleted after merge.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "select" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext}>
                Next: Review
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={mergeMutation.isPending}>
                Back
              </Button>
              <Button
                onClick={handleMerge}
                disabled={mergeMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
