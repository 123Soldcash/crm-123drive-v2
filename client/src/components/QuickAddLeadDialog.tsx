import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { STAGE_CONFIGS } from "@/lib/stageConfig";
import { useLocation } from "wouter";

interface QuickAddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealStage: string;
}

export function QuickAddLeadDialog({ open, onOpenChange, dealStage }: QuickAddLeadDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    addressLine1: "",
    city: "",
    state: "",
    zipCode: "",
    owner1Name: "",
  });

  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === dealStage);

  // Search existing properties
  const { data: searchResults, isLoading: isSearching } = trpc.properties.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 3 && !showCreateForm }
  );

  // Update stage mutation
  const updateStageMutation = trpc.properties.updateDealStage.useMutation({
    onSuccess: () => {
      toast.success("Property moved to pipeline!");
      utils.properties.getPropertiesByStage.invalidate();
      onOpenChange(false);
      resetDialog();
    },
    onError: (error) => {
      toast.error(`Failed to move property: ${error.message}`);
    },
  });

  // Create property mutation
  const createPropertyMutation = trpc.properties.create.useMutation({
    onSuccess: (newProperty) => {
      toast.success("Lead created successfully! Redirecting...");
      utils.properties.getPropertiesByStage.invalidate();
      onOpenChange(false);
      resetDialog();
      // Auto-redirect to the new property's detail page
      if (newProperty?.id) {
        setLocation(`/properties/${newProperty.id}`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to create lead: ${error.message}`);
    },
  });

  const resetDialog = () => {
    setSearchQuery("");
    setShowCreateForm(false);
    setFormData({
      addressLine1: "",
      city: "",
      state: "",
      zipCode: "",
      owner1Name: "",
    });
  };

  const handleMoveToStage = (propertyId: number) => {
    updateStageMutation.mutate({
      propertyId,
      newStage: dealStage,
      notes: `Moved to ${stageConfig?.label} from Pipeline quick add`,
    });
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.addressLine1 || !formData.city || !formData.state) {
      toast.error("Please fill in address, city, and state");
      return;
    }

    createPropertyMutation.mutate({
      ...formData,
      leadTemperature: "TBD",
      dealStage: dealStage,
    });
  };

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{stageConfig?.icon}</span>
            Add Lead to {stageConfig?.shortLabel}
          </DialogTitle>
        </DialogHeader>

        {!showCreateForm ? (
          // SEARCH MODE
          <div className="space-y-4">
            {/* Search Box */}
            <div className="space-y-2">
              <Label htmlFor="search">Search Existing Properties</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Type address to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Type at least 3 characters to search
              </p>
            </div>

            {/* Search Results */}
            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Found {searchResults.length} properties:</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {searchResults.map((property) => {
                    const currentStageConfig = STAGE_CONFIGS.find((s) => s.id === property.dealStage);
                    return (
                      <Card key={property.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {property.addressLine1}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {property.city}, {property.state} {property.zipcode}
                            </p>
                            {property.owner1Name && (
                              <p className="text-xs text-muted-foreground">
                                Owner: {property.owner1Name}
                              </p>
                            )}
                            {currentStageConfig && (
                              <Badge className={`mt-1 ${currentStageConfig.bgColor} ${currentStageConfig.color}`}>
                                {currentStageConfig.icon} {currentStageConfig.shortLabel}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleMoveToStage(property.id)}
                              disabled={updateStageMutation.isPending}
                            >
                              {updateStageMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  Move <ArrowRight className="w-3 h-3 ml-1" />
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/properties/${property.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {searchQuery.length >= 3 && !isSearching && searchResults?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No properties found matching "{searchQuery}"</p>
              </div>
            )}

            {/* Create New Button */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => setShowCreateForm(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Property
              </Button>
            </div>
          </div>
        ) : (
          // CREATE FORM MODE
          <form onSubmit={handleCreateNew} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">
                Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="addressLine1"
                placeholder="1234 Main Street"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                autoFocus
              />
            </div>

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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">
                  State <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="state"
                  placeholder="FL"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                placeholder="33101"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner1Name">Owner Name</Label>
              <Input
                id="owner1Name"
                placeholder="John Doe"
                value={formData.owner1Name}
                onChange={(e) => setFormData({ ...formData, owner1Name: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="flex-1"
              >
                Back to Search
              </Button>
              <Button
                type="submit"
                disabled={createPropertyMutation.isPending}
                className="flex-1"
              >
                {createPropertyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Lead
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
