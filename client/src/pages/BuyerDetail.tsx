import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Home,
  DollarSign,
  Wrench,
  Plus,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function BuyerDetail() {
  const [, params] = useRoute("/buyers/:id");
  const buyerId = parseInt(params?.id || "0");
  
  const utils = trpc.useUtils();
  
  // Fetch buyer data
  const { data: buyer, isLoading } = trpc.buyers.get.useQuery({ id: buyerId });
  
  // Form state
  const [formData, setFormData] = useState<any>(null);
  const [newTag, setNewTag] = useState({ type: "" as "state" | "city" | "zip" | "type", value: "" });

  useEffect(() => {
    if (buyer) {
      setFormData({
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone || "",
        company: buyer.company || "",
        status: buyer.status || "Active",
        notes: buyer.notes || "",
        preferences: {
          states: buyer.preferences?.states || [],
          cities: buyer.preferences?.cities || [],
          zipcodes: buyer.preferences?.zipcodes || [],
          propertyTypes: buyer.preferences?.propertyTypes || [],
          minBeds: buyer.preferences?.minBeds || 0,
          maxBeds: buyer.preferences?.maxBeds || 0,
          minBaths: buyer.preferences?.minBaths ? parseFloat(buyer.preferences.minBaths) : 0,
          maxBaths: buyer.preferences?.maxBaths ? parseFloat(buyer.preferences.maxBaths) : 0,
          minPrice: buyer.preferences?.minPrice || 0,
          maxPrice: buyer.preferences?.maxPrice || 0,
          maxRepairCost: buyer.preferences?.maxRepairCost || 0,
        }
      });
    }
  }, [buyer]);

  // Update buyer mutation
  const updateBuyer = trpc.buyers.update.useMutation({
    onSuccess: () => {
      utils.buyers.get.invalidate({ id: buyerId });
      toast.success("Buyer updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update buyer: " + error.message);
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.email) {
      toast.error("Name and Email are required");
      return;
    }
    updateBuyer.mutate({ id: buyerId, data: formData });
  };

  const addPreferenceTag = (type: "states" | "cities" | "zipcodes" | "propertyTypes", value: string) => {
    if (!value) return;
    const current = formData.preferences[type] || [];
    if (current.includes(value)) return;
    
    setFormData({
      ...formData,
      preferences: {
        ...formData.preferences,
        [type]: [...current, value]
      }
    });
  };

  const removePreferenceTag = (type: "states" | "cities" | "zipcodes" | "propertyTypes", value: string) => {
    setFormData({
      ...formData,
      preferences: {
        ...formData.preferences,
        [type]: formData.preferences[type].filter((v: string) => v !== value)
      }
    });
  };

  if (isLoading || !formData) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading buyer details...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/buyers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{buyer?.name}</h1>
            <p className="text-muted-foreground">Buyer Profile & Preferences</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateBuyer.isPending} className="bg-purple-600 hover:bg-purple-700">
          <Save className="mr-2 h-4 w-4" /> {updateBuyer.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Information */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" /> Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email"
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input 
                id="company" 
                value={formData.company} 
                onChange={(e) => setFormData({...formData, company: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Blacklisted">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-600" /> Buying Criteria
            </CardTitle>
            <CardDescription>Define what types of properties this buyer is looking for.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location Preferences */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                <MapPin className="h-4 w-4" /> Locations
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>States</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. FL" 
                      className="h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addPreferenceTag('states', e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.preferences.states.map((s: string) => (
                      <Badge key={s} variant="secondary" className="gap-1">
                        {s} <X className="h-3 w-3 cursor-pointer" onClick={() => removePreferenceTag('states', s)} />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cities</Label>
                  <Input 
                    placeholder="e.g. Miami" 
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addPreferenceTag('cities', e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.preferences.cities.map((c: string) => (
                      <Badge key={c} variant="secondary" className="gap-1">
                        {c} <X className="h-3 w-3 cursor-pointer" onClick={() => removePreferenceTag('cities', c)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Property Type Preferences */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                <Home className="h-4 w-4" /> Property Details
              </h3>
              
              <div className="space-y-2">
                <Label>Property Types</Label>
                <div className="flex gap-2">
                  {["Single Family", "Multi-Family", "Condo", "Land", "Commercial"].map(type => (
                    <Badge 
                      key={type} 
                      variant={formData.preferences.propertyTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-purple-100 hover:text-purple-800"
                      onClick={() => {
                        if (formData.preferences.propertyTypes.includes(type)) {
                          removePreferenceTag('propertyTypes', type);
                        } else {
                          addPreferenceTag('propertyTypes', type);
                        }
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Min Beds</Label>
                  <Input 
                    type="number" 
                    value={formData.preferences.minBeds} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, minBeds: parseInt(e.target.value)}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Beds</Label>
                  <Input 
                    type="number" 
                    value={formData.preferences.maxBeds} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, maxBeds: parseInt(e.target.value)}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Baths</Label>
                  <Input 
                    type="number" 
                    step="0.5"
                    value={formData.preferences.minBaths} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, minBaths: parseFloat(e.target.value)}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Baths</Label>
                  <Input 
                    type="number" 
                    step="0.5"
                    value={formData.preferences.maxBaths} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, maxBaths: parseFloat(e.target.value)}})}
                  />
                </div>
              </div>
            </div>

            {/* Financial Preferences */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                <DollarSign className="h-4 w-4" /> Financials
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Price ($)</Label>
                  <Input 
                    type="number" 
                    value={formData.preferences.minPrice} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, minPrice: parseInt(e.target.value)}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Price ($)</Label>
                  <Input 
                    type="number" 
                    value={formData.preferences.maxPrice} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, maxPrice: parseInt(e.target.value)}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Repair Cost ($)</Label>
                  <Input 
                    type="number" 
                    value={formData.preferences.maxRepairCost} 
                    onChange={(e) => setFormData({...formData, preferences: {...formData.preferences, maxRepairCost: parseInt(e.target.value)}})}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Add any additional details about this buyer..."
                className="min-h-[100px]"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
