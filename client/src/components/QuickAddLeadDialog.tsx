import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { STAGE_CONFIGS } from "@/lib/stageConfig";

interface QuickAddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealStage: string;
}

export function QuickAddLeadDialog({ open, onOpenChange, dealStage }: QuickAddLeadDialogProps) {
  const [formData, setFormData] = useState({
    addressLine1: "",
    city: "",
    state: "",
    zipCode: "",
    owner1Name: "",
  });

  const utils = trpc.useUtils();
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === dealStage);

  const createPropertyMutation = trpc.properties.create.useMutation({
    onSuccess: () => {
      toast.success("Lead created successfully!");
      utils.properties.getPropertiesByStage.invalidate();
      onOpenChange(false);
      setFormData({
        addressLine1: "",
        city: "",
        state: "",
        zipCode: "",
        owner1Name: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create lead: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.addressLine1 || !formData.city || !formData.state) {
      toast.error("Please fill in address, city, and state");
      return;
    }

    createPropertyMutation.mutate({
      ...formData,
      dealStage,
      leadTemperature: "TBD",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{stageConfig?.icon}</span>
            Add Lead to {stageConfig?.shortLabel}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="addressLine1">
              Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="addressLine1"
              placeholder="1234 Main Street"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              required
            />
          </div>

          {/* City & State */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                id="city"
                placeholder="Miami"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">
                State <span className="text-red-500">*</span>
              </Label>
              <Input
                id="state"
                placeholder="FL"
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                required
              />
            </div>
          </div>

          {/* Zip Code */}
          <div className="space-y-2">
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              placeholder="33101"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
            />
          </div>

          {/* Owner Name */}
          <div className="space-y-2">
            <Label htmlFor="owner1Name">Owner Name</Label>
            <Input
              id="owner1Name"
              placeholder="John Doe"
              value={formData.owner1Name}
              onChange={(e) => setFormData({ ...formData, owner1Name: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPropertyMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPropertyMutation.isPending}>
              {createPropertyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
