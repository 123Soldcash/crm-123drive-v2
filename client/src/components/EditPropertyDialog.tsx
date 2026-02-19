import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, FileText, Users, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";


interface EditPropertyDialogProps {
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
    source?: string;
    listName?: string;
    entryDate?: Date;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditPropertyDialog({
  property,
  open,
  onOpenChange,
  onSuccess,
}: EditPropertyDialogProps) {
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
    source: property.source || "Manual",
    listName: property.listName || "",
    entryDate: property.entryDate ? new Date(property.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  });

  // DealMachine CSV import states
  const [showPropertyCSV, setShowPropertyCSV] = useState(false);
  const [showContactCSV, setShowContactCSV] = useState(false);
  const [propertyCSVData, setPropertyCSVData] = useState("");
  const [contactCSVData, setContactCSVData] = useState("");
  const propertyFileRef = useRef<HTMLInputElement>(null);
  const contactFileRef = useRef<HTMLInputElement>(null);

  // Sync form data when property changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
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
        source: property.source || "Manual",
        listName: property.listName || "",
        entryDate: property.entryDate ? new Date(property.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
      setPropertyCSVData("");
      setContactCSVData("");
      setShowPropertyCSV(false);
      setShowContactCSV(false);
    }
  }, [open, property]);

  const utils = trpc.useUtils();

  const updatePropertyMutation = trpc.properties.update.useMutation({
    onSuccess: () => {
      toast.success("Property updated successfully!");
      onOpenChange(false);
      utils.properties.getById.invalidate({ id: property.id });
      utils.properties.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateFromCSVMutation = trpc.properties.updateFromDealMachineCSV.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setPropertyCSVData("");
      setShowPropertyCSV(false);
      utils.properties.getById.invalidate({ id: property.id });
      utils.properties.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`CSV Import Error: ${error.message}`);
    },
  });

  const importContactsCSVMutation = trpc.properties.importContactsFromDealMachineCSV.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setContactCSVData("");
      setShowContactCSV(false);
      utils.properties.getById.invalidate({ id: property.id });
      utils.contacts.byProperty.invalidate({ propertyId: property.id });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Contact Import Error: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updatePropertyMutation.mutate({
      id: property.id,
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
      source: formData.source as any,
      listName: formData.listName || undefined,
      entryDate: new Date(formData.entryDate),
    });
  };

  const handlePropertyCSVImport = () => {
    if (!propertyCSVData.trim()) {
      toast.error("Please paste or upload DealMachine CSV data first.");
      return;
    }
    updateFromCSVMutation.mutate({
      id: property.id,
      csvData: propertyCSVData.trim(),
    });
  };

  const handleContactCSVImport = () => {
    if (!contactCSVData.trim()) {
      toast.error("Please paste or upload DealMachine CSV data first.");
      return;
    }
    importContactsCSVMutation.mutate({
      propertyId: property.id,
      csvData: contactCSVData.trim(),
    });
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setter(text);
        toast.success(`File "${file.name}" loaded successfully`);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property/Lead</DialogTitle>
          <DialogDescription>
            Update property information, lead details, or import data from DealMachine CSV
          </DialogDescription>
        </DialogHeader>

        {/* ─── DealMachine CSV Import Sections ─── */}
        <div className="space-y-3 border-b pb-4 mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-700">
            <Upload className="h-4 w-4" />
            DealMachine CSV Import
          </h3>

          {/* Property Data CSV */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPropertyCSV(!showPropertyCSV)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Property Data (CSV)</span>
                {propertyCSVData && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              {showPropertyCSV ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {showPropertyCSV && (
              <div className="p-3 space-y-2 bg-white">
                <p className="text-xs text-slate-500">
                  Paste the CSV data from DealMachine (header row + data row) or upload a .csv file.
                  This will update the property fields (address, owner, bedrooms, value, etc.).
                </p>
                <Textarea
                  value={propertyCSVData}
                  onChange={(e) => setPropertyCSVData(e.target.value)}
                  placeholder={"property_id,lead_id,property_address_line_1,property_address_city,...\n227965595,2513086631,\"2892 Nw 7th Ct\",\"Fort Lauderdale\",..."}
                  rows={4}
                  className="text-xs font-mono"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={propertyFileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, setPropertyCSVData)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => propertyFileRef.current?.click()}
                    className="text-xs"
                  >
                    <Upload className="h-3 w-3 mr-1" /> Upload CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePropertyCSVImport}
                    disabled={!propertyCSVData.trim() || updateFromCSVMutation.isPending}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    {updateFromCSVMutation.isPending ? "Importing..." : "Import Property Data"}
                  </Button>
                </div>
                {updateFromCSVMutation.isSuccess && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {updateFromCSVMutation.data?.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact Data CSV */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContactCSV(!showContactCSV)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Contact Data (CSV)</span>
                {contactCSVData && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              {showContactCSV ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {showContactCSV && (
              <div className="p-3 space-y-2 bg-white">
                <p className="text-xs text-slate-500">
                  Paste the CSV data from DealMachine (header row + data row) with contact columns
                  (contact_1_name, contact_1_phone1, contact_1_email1, etc.).
                  New contacts will be added to this property.
                </p>
                <Textarea
                  value={contactCSVData}
                  onChange={(e) => setContactCSVData(e.target.value)}
                  placeholder={"...contact_1_name,contact_1_flags,contact_1_phone1,contact_1_email1,...\n...\"Danielle Dixon\",\"Likely Owner\",+17543660623,dixon@gmail.com,..."}
                  rows={4}
                  className="text-xs font-mono"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={contactFileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, setContactCSVData)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => contactFileRef.current?.click()}
                    className="text-xs"
                  >
                    <Upload className="h-3 w-3 mr-1" /> Upload CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleContactCSVImport}
                    disabled={!contactCSVData.trim() || importContactsCSVMutation.isPending}
                    className="text-xs bg-purple-600 hover:bg-purple-700"
                  >
                    {importContactsCSVMutation.isPending ? "Importing..." : "Import Contacts"}
                  </Button>
                </div>
                {importContactsCSVMutation.isSuccess && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {importContactsCSVMutation.data?.message}
                  </div>
                )}
                {importContactsCSVMutation.isError && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {importContactsCSVMutation.error?.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Manual Edit Form ─── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address Section */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Address</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="edit-address">Street Address</Label>
                <Input
                  id="edit-address"
                  value={formData.addressLine1}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine1: e.target.value })
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="edit-state">State</Label>
                <Input
                  id="edit-state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  placeholder="FL"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="edit-zipcode">Zip Code</Label>
                <Input
                  id="edit-zipcode"
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
                <Label htmlFor="edit-owner1">Owner 1 Name</Label>
                <Input
                  id="edit-owner1"
                  value={formData.owner1Name}
                  onChange={(e) =>
                    setFormData({ ...formData, owner1Name: e.target.value })
                  }
                  placeholder="Owner name"
                />
              </div>
              <div>
                <Label htmlFor="edit-owner2">Owner 2 Name</Label>
                <Input
                  id="edit-owner2"
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
                <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                <Input
                  id="edit-bedrooms"
                  type="number"
                  value={formData.totalBedrooms}
                  onChange={(e) =>
                    setFormData({ ...formData, totalBedrooms: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-bathrooms">Bathrooms</Label>
                <Input
                  id="edit-bathrooms"
                  type="number"
                  value={formData.totalBaths}
                  onChange={(e) =>
                    setFormData({ ...formData, totalBaths: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-sqft">Square Feet</Label>
                <Input
                  id="edit-sqft"
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
                <Label htmlFor="edit-yearBuilt">Year Built</Label>
                <Input
                  id="edit-yearBuilt"
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
                <Label htmlFor="edit-value">Estimated Value ($)</Label>
                <Input
                  id="edit-value"
                  type="number"
                  value={formData.estimatedValue}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedValue: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-equity">Equity (%)</Label>
                <Input
                  id="edit-equity"
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
              <Label htmlFor="edit-temperature">Lead Temperature</Label>
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
                  <SelectItem value="SUPER HOT">Super Hot</SelectItem>
                  <SelectItem value="HOT">Hot</SelectItem>
                  <SelectItem value="DEEP SEARCH">Deep Search</SelectItem>
                  <SelectItem value="WARM">Warm</SelectItem>
                  <SelectItem value="COLD">Cold</SelectItem>
                  <SelectItem value="DEAD">Dead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lead Source Tracking */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Lead Source</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="edit-source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData({ ...formData, source: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DealMachine">DealMachine</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Import">Import</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-listName">List Name</Label>
                <Input
                  id="edit-listName"
                  value={formData.listName}
                  onChange={(e) =>
                    setFormData({ ...formData, listName: e.target.value })
                  }
                  placeholder="Campaign or list name"
                />
              </div>
              <div>
                <Label htmlFor="edit-entryDate">Entry Date</Label>
                <Input
                  id="edit-entryDate"
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, entryDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
