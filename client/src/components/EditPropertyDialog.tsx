import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

interface EditPropertyDialogProps {
  propertyId: number;
  property: {
    id: number;
    addressLine1: string;
    city: string;
    state: string;
    zipcode: string;
    leadTemperature: string;
    estimatedValue?: number;
    equityPercent?: number;
    owner1Name?: string;
    owner2Name?: string;
    totalBedrooms?: number;
    totalBaths?: number;
    buildingSquareFeet?: number;
    yearBuilt?: number;
    notes?: string;
  };
  onSuccess?: () => void;
}

export function EditPropertyDialog({
  propertyId,
  property,
  onSuccess,
}: EditPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    addressLine1: property.addressLine1 || "",
    city: property.city || "",
    state: property.state || "",
    zipcode: property.zipcode || "",
    leadTemperature: property.leadTemperature || "COLD",
    estimatedValue: property.estimatedValue?.toString() || "",
    equityPercent: property.equityPercent?.toString() || "",
    owner1Name: property.owner1Name || "",
    owner2Name: property.owner2Name || "",
    totalBedrooms: property.totalBedrooms?.toString() || "",
    totalBaths: property.totalBaths?.toString() || "",
    buildingSquareFeet: property.buildingSquareFeet?.toString() || "",
    yearBuilt: property.yearBuilt?.toString() || "",
  });

  const updatePropertyMutation = trpc.properties.update.useMutation({
    onSuccess: () => {
      toast.success("Property updated successfully!");
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updatePropertyMutation.mutate({
      id: propertyId,
      addressLine1: formData.addressLine1,
      city: formData.city,
      state: formData.state,
      zipcode: formData.zipcode,
      leadTemperature: formData.leadTemperature as any,
      estimatedValue: formData.estimatedValue ? parseInt(formData.estimatedValue) : undefined,
      equityPercent: formData.equityPercent ? parseInt(formData.equityPercent) : undefined,
      owner1Name: formData.owner1Name || undefined,
      owner2Name: formData.owner2Name || undefined,
      totalBedrooms: formData.totalBedrooms ? parseInt(formData.totalBedrooms) : undefined,
      totalBaths: formData.totalBaths ? parseInt(formData.totalBaths) : undefined,
      buildingSquareFeet: formData.buildingSquareFeet ? parseInt(formData.buildingSquareFeet) : undefined,
      yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="h-4 w-4" />
          Edit Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property/Lead</DialogTitle>
          <DialogDescription>
            Update property information and lead details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address Section */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Address</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.addressLine1}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine1: e.target.value })
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  placeholder="FL"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="zipcode">Zip Code</Label>
                <Input
                  id="zipcode"
                  value={formData.zipcode}
                  onChange={(e) =>
                    setFormData({ ...formData, zipcode: e.target.value })
                  }
                  placeholder="12345"
                />
              </div>
            </div>
          </div>

          {/* Owner Section */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Owner Information</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="owner1">Owner 1 Name</Label>
                <Input
                  id="owner1"
                  value={formData.owner1Name}
                  onChange={(e) =>
                    setFormData({ ...formData, owner1Name: e.target.value })
                  }
                  placeholder="Owner name"
                />
              </div>
              <div>
                <Label htmlFor="owner2">Owner 2 Name</Label>
                <Input
                  id="owner2"
                  value={formData.owner2Name}
                  onChange={(e) =>
                    setFormData({ ...formData, owner2Name: e.target.value })
                  }
                  placeholder="Co-owner name"
                />
              </div>
            </div>
          </div>

          {/* Property Details Section */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Property Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={formData.totalBedrooms}
                  onChange={(e) =>
                    setFormData({ ...formData, totalBedrooms: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  value={formData.totalBaths}
                  onChange={(e) =>
                    setFormData({ ...formData, totalBaths: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="sqft">Square Feet</Label>
                <Input
                  id="sqft"
                  type="number"
                  value={formData.buildingSquareFeet}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      buildingSquareFeet: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="yearBuilt">Year Built</Label>
                <Input
                  id="yearBuilt"
                  type="number"
                  value={formData.yearBuilt}
                  onChange={(e) =>
                    setFormData({ ...formData, yearBuilt: e.target.value })
                  }
                  placeholder="2000"
                />
              </div>
            </div>
          </div>

          {/* Financial Section */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Financial Information</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="value">Estimated Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.estimatedValue}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedValue: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="equity">Equity (%)</Label>
                <Input
                  id="equity"
                  type="number"
                  value={formData.equityPercent}
                  onChange={(e) =>
                    setFormData({ ...formData, equityPercent: e.target.value })
                  }
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>

          {/* Lead Temperature */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Lead Status</h3>
            <div>
              <Label htmlFor="temperature">Lead Temperature</Label>
              <Select
                value={formData.leadTemperature}
                onValueChange={(value) =>
                  setFormData({ ...formData, leadTemperature: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER HOT">🔥 Super Hot</SelectItem>
                  <SelectItem value="HOT">🔥 Hot</SelectItem>
                  <SelectItem value="WARM">🌡️ Warm</SelectItem>
                  <SelectItem value="COLD">❄️ Cold</SelectItem>
                  <SelectItem value="DEAD">💀 Dead</SelectItem>
                  <SelectItem value="TBD">❓ TBD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updatePropertyMutation.isPending}
            >
              {updatePropertyMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
