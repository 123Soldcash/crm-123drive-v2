import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Mail, MessageSquare, Facebook, Instagram, Star, AlertTriangle, Scale, Plus, Edit, Trash2, Eye, EyeOff, MapPin } from "lucide-react";
import { PhoneDuplicateAlert } from "./PhoneDuplicateAlert";
import { toast } from "sonner";

interface ContactManagementProps {
  propertyId: number;
}

interface PhoneEntry {
  id?: number;
  phoneNumber: string;
  phoneType: string;
  isPrimary: number;
}

interface EmailEntry {
  id?: number;
  email: string;
  emailType: string;
  isPrimary: number;
}

interface AddressEntry {
  id?: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  addressType: string;
  isPrimary: number;
}

export function ContactManagement({ propertyId }: ContactManagementProps) {

  const utils = trpc.useUtils();
  
  const { data: contacts, isLoading } = trpc.communication.getContactsByProperty.useQuery({ propertyId });
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [showHidden, setShowHidden] = useState(false);
  
  // Form state with dynamic arrays
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    age: "",
    currentAddress: "",
    isDecisionMaker: false,
    dnc: false,
    isLitigator: false,
    deceased: false,
    phones: [] as PhoneEntry[],
    emails: [] as EmailEntry[],
    addresses: [] as AddressEntry[],
  });
  
  const createContactMutation = trpc.communication.createContact.useMutation({
    onSuccess: () => {
      toast.success("Contact created successfully");
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create contact: ${error.message}`);
    },
  });
  
  const updateContactMutation = trpc.communication.updateContact.useMutation({
    onSuccess: () => {
      toast.success("Contact updated successfully");
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      setEditingContact(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to update contact: ${error.message}`);
    },
  });
  
  const deleteContactMutation = trpc.communication.deleteContact.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted successfully");
      utils.communication.getContactsByProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to delete contact: ${error.message}`);
    },
  });
  
  const toggleHiddenMutation = trpc.contacts.toggleHidden.useMutation({
    onSuccess: () => {
      utils.communication.getContactsByProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to update contact: ${error.message}`);
    },
  });
  
  const resetForm = () => {
    setFormData({
      name: "",
      relationship: "",
      age: "",
      currentAddress: "",
      isDecisionMaker: false,
      dnc: false,
      isLitigator: false,
      deceased: false,
      phones: [],
      emails: [],
      addresses: [],
    });
  };
  
  const handleSave = () => {
    const data = {
      propertyId,
      name: formData.name || undefined,
      relationship: formData.relationship || undefined,
      age: formData.age ? parseInt(formData.age) : undefined,
      currentAddress: formData.currentAddress || undefined,
      isDecisionMaker: formData.isDecisionMaker ? 1 : 0,
      dnc: formData.dnc ? 1 : 0,
      isLitigator: formData.isLitigator ? 1 : 0,
      deceased: formData.deceased ? 1 : 0,
      phones: formData.phones.filter(p => p.phoneNumber),
      emails: formData.emails.filter(e => e.email),
      addresses: formData.addresses.filter(a => a.addressLine1 && a.city && a.state && a.zipcode),
    };
    
    if (editingContact) {
      updateContactMutation.mutate({
        contactId: editingContact.id,
        ...data,
      });
    } else {
      createContactMutation.mutate(data);
    }
  };
  
  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || "",
      relationship: contact.relationship || "",
      age: contact.age ? contact.age.toString() : "",
      currentAddress: contact.currentAddress || "",
      isDecisionMaker: contact.isDecisionMaker === 1,
      dnc: contact.dnc === 1,
      isLitigator: contact.isLitigator === 1,
      deceased: contact.deceased === 1,
      phones: contact.phones || [],
      emails: contact.emails || [],
      addresses: contact.addresses || [],
    });
    setIsAddDialogOpen(true);
  };
  
  const handleDelete = (contactId: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate({ id: contactId });
    }
  };

  const addPhoneField = () => {
    setFormData({
      ...formData,
      phones: [...formData.phones, { phoneNumber: "", phoneType: "Mobile", isPrimary: 0 }],
    });
  };

  const removePhoneField = (index: number) => {
    setFormData({
      ...formData,
      phones: formData.phones.filter((_, i) => i !== index),
    });
  };

  const updatePhoneField = (index: number, field: string, value: any) => {
    const updated = [...formData.phones];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, phones: updated });
  };

  const addEmailField = () => {
    setFormData({
      ...formData,
      emails: [...formData.emails, { email: "", emailType: "Personal", isPrimary: 0 }],
    });
  };

  const removeEmailField = (index: number) => {
    setFormData({
      ...formData,
      emails: formData.emails.filter((_, i) => i !== index),
    });
  };

  const updateEmailField = (index: number, field: string, value: any) => {
    const updated = [...formData.emails];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, emails: updated });
  };

  const addAddressField = () => {
    setFormData({
      ...formData,
      addresses: [...formData.addresses, { addressLine1: "", addressLine2: "", city: "", state: "", zipcode: "", addressType: "Mailing", isPrimary: 0 }],
    });
  };

  const removeAddressField = (index: number) => {
    setFormData({
      ...formData,
      addresses: formData.addresses.filter((_, i) => i !== index),
    });
  };

  const updateAddressField = (index: number, field: string, value: any) => {
    const updated = [...formData.addresses];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, addresses: updated });
  };
  
  if (isLoading) {
    return <div>Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      {contacts && contacts.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">Contacts ({contacts?.length || 0})</h3>
              <Button
                variant={showHidden ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
                className="text-xs"
              >
                {showHidden ? "Hide Hidden Contacts" : "Show All Contacts"}
              </Button>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Basic Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Contact name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="relationship">Relationship to Property</Label>
                      <select
                        id="relationship"
                        value={formData.relationship}
                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                      >
                        <option value="">Select relationship...</option>
                        <option value="Owner">Owner</option>
                        <option value="Co-Owner">Co-Owner</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Family Member">Family Member</option>
                        <option value="Heir">Heir</option>
                        <option value="Attorney">Attorney</option>
                        <option value="Tenant">Tenant</option>
                        <option value="Current Resident - NOT on Board">🔴 Current Resident - NOT on Board</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        placeholder="Age"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Flags</Label>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="isDecisionMaker"
                            checked={formData.isDecisionMaker}
                            onCheckedChange={(checked) => setFormData({ ...formData, isDecisionMaker: checked as boolean })}
                          />
                          <label htmlFor="isDecisionMaker" className="text-sm">Decision Maker</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="dnc"
                            checked={formData.dnc}
                            onCheckedChange={(checked) => setFormData({ ...formData, dnc: checked as boolean })}
                          />
                          <label htmlFor="dnc" className="text-sm">DNC</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="isLitigator"
                            checked={formData.isLitigator}
                            onCheckedChange={(checked) => setFormData({ ...formData, isLitigator: checked as boolean })}
                          />
                          <label htmlFor="isLitigator" className="text-sm">Litigator</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="deceased"
                            checked={formData.deceased}
                            onCheckedChange={(checked) => setFormData({ ...formData, deceased: checked as boolean })}
                          />
                          <label htmlFor="deceased" className="text-sm">Deceased</label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="currentAddress">Current Address</Label>
                    <Textarea
                      id="currentAddress"
                      value={formData.currentAddress}
                      onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                      placeholder="Current address (may be different from property address)"
                      rows={2}
                    />
                  </div>
                  
                  {/* Phone Numbers - Dynamic */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Phone Numbers</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPhoneField}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Phone
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {formData.phones.map((phone, index) => (
                        <div key={index} className="space-y-2">
                          <div className="grid grid-cols-4 gap-2">
                            <Input
                              placeholder="Phone number"
                              value={phone.phoneNumber}
                              onChange={(e) => updatePhoneField(index, "phoneNumber", e.target.value)}
                              className="col-span-2"
                            />
                            <Select
                              value={phone.phoneType}
                              onValueChange={(value) => updatePhoneField(index, "phoneType", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mobile">Mobile</SelectItem>
                                <SelectItem value="Landline">Landline</SelectItem>
                                <SelectItem value="Wireless">Wireless</SelectItem>
                                <SelectItem value="Work">Work</SelectItem>
                                <SelectItem value="Home">Home</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePhoneField(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {phone.phoneNumber && (
                            <PhoneDuplicateAlert phoneNumber={phone.phoneNumber} />
                          )}
                        </div>
                      ))}
                      {formData.phones.length === 0 && (
                        <p className="text-sm text-muted-foreground">No phone numbers added yet.</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Emails - Dynamic */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Email Addresses</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addEmailField}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Email
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {formData.emails.map((email, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Email address"
                            type="email"
                            value={email.email}
                            onChange={(e) => updateEmailField(index, "email", e.target.value)}
                            className="col-span-2"
                          />
                          <div className="flex gap-1">
                            <Select
                              value={email.emailType}
                              onValueChange={(value) => updateEmailField(index, "emailType", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Personal">Personal</SelectItem>
                                <SelectItem value="Work">Work</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEmailField(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {formData.emails.length === 0 && (
                        <p className="text-sm text-muted-foreground">No emails added yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Mailing Addresses - Dynamic */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Mailing Addresses</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addAddressField}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Address
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {formData.addresses.map((address, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-md">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Street address"
                              value={address.addressLine1}
                              onChange={(e) => updateAddressField(index, "addressLine1", e.target.value)}
                            />
                            <Input
                              placeholder="Apt, Suite, etc. (optional)"
                              value={address.addressLine2 || ""}
                              onChange={(e) => updateAddressField(index, "addressLine2", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="City"
                              value={address.city}
                              onChange={(e) => updateAddressField(index, "city", e.target.value)}
                            />
                            <Input
                              placeholder="State"
                              maxLength={2}
                              value={address.state}
                              onChange={(e) => updateAddressField(index, "state", e.target.value.toUpperCase())}
                            />
                            <Input
                              placeholder="Zip code"
                              value={address.zipcode}
                              onChange={(e) => updateAddressField(index, "zipcode", e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Select
                              value={address.addressType}
                              onValueChange={(value) => updateAddressField(index, "addressType", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mailing">Mailing</SelectItem>
                                <SelectItem value="Current">Current</SelectItem>
                                <SelectItem value="Previous">Previous</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAddressField(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {formData.addresses.length === 0 && (
                        <p className="text-sm text-muted-foreground">No addresses added yet.</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={handleSave} className="flex-1">
                      {editingContact ? "Update Contact" : "Create Contact"}
                    </Button>
                    <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setEditingContact(null); resetForm(); }} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="space-y-3">
            {contacts.filter(c => showHidden || c.hidden !== 1).map((contact) => (
              <Card key={contact.id} className={contact.isDecisionMaker === 1 ? "border-yellow-500 border-2" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{contact.name}</h3>
                      {contact.relationship && (
                        <p className="text-sm text-muted-foreground mt-1">{contact.relationship}</p>
                      )}
                      {contact.age && (
                        <p className="text-sm text-muted-foreground">Age: {contact.age}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contact.isDecisionMaker === 1 && (
                          <Badge variant="default" className="bg-yellow-500">
                            <Star className="mr-1 h-3 w-3" />
                            Decision Maker
                          </Badge>
                        )}
                        {contact.dnc === 1 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            DNC
                          </Badge>
                        )}
                        {contact.isLitigator === 1 && (
                          <Badge variant="outline">
                            <Scale className="mr-1 h-3 w-3" />
                            Litigator
                          </Badge>
                        )}
                        {contact.deceased === 1 && (
                          <Badge variant="secondary">Deceased</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => toggleHiddenMutation.mutate({ id: contact.id, hidden: contact.hidden === 1 ? 0 : 1 })}
                        title={contact.hidden === 1 ? "Show contact" : "Hide contact"}
                        className="h-8 w-8"
                      >
                        {contact.hidden === 1 ? (
                          <Eye className="h-4 w-4 text-blue-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(contact)} className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)} className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Phone Numbers - Dynamic Display */}
                  {(contact.phones && contact.phones.length > 0) && (
                    <div className="space-y-1">
                      {contact.phones.map((phone: any, idx: number) => (
                        <div key={idx} className={`flex items-center gap-2 text-sm ${
                          contact.dnc === 1 ? 'font-bold text-red-600' : ''
                        }`}>
                          <Phone className={`h-4 w-4 ${
                            contact.dnc === 1 ? 'text-red-600' : 'text-muted-foreground'
                          }`} />
                          <span>{phone.phoneNumber}</span>
                          <Badge variant="outline" className="text-xs">{phone.phoneType}</Badge>
                          {contact.dnc === 1 && <Badge className="bg-red-600 text-white text-xs">DNC</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Emails - Dynamic Display */}
                  {(contact.emails && contact.emails.length > 0) && (
                    <div className="space-y-1">
                      {contact.emails.map((email: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{email.email}</span>
                          <Badge variant="outline" className="text-xs">{email.emailType}</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mailing Addresses - Dynamic Display */}
                  {(contact.addresses && contact.addresses.length > 0) && (
                    <div className="space-y-2 border-t pt-2">
                      {contact.addresses.map((address: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">{address.addressType}</p>
                              <p className="text-muted-foreground">{address.addressLine1}</p>
                              {address.addressLine2 && <p className="text-muted-foreground">{address.addressLine2}</p>}
                              <p className="text-muted-foreground">{address.city}, {address.state} {address.zipcode}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Current Address */}
                  {contact.currentAddress && (
                    <div className="text-sm text-muted-foreground border-t pt-2">
                      <strong>Current Address (Legacy):</strong> {contact.currentAddress}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No contacts available. Add a contact to start tracking communication.</p>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="relationship">Relationship to Property</Label>
                    <select
                      id="relationship"
                      value={formData.relationship}
                      onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                    >
                      <option value="">Select relationship...</option>
                      <option value="Owner">Owner</option>
                      <option value="Co-Owner">Co-Owner</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Family Member">Family Member</option>
                      <option value="Heir">Heir</option>
                      <option value="Attorney">Attorney</option>
                      <option value="Tenant">Tenant</option>
                      <option value="Current Resident - NOT on Board">🔴 Current Resident - NOT on Board</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="Age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Flags</Label>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isDecisionMaker"
                          checked={formData.isDecisionMaker}
                          onCheckedChange={(checked) => setFormData({ ...formData, isDecisionMaker: checked as boolean })}
                        />
                        <label htmlFor="isDecisionMaker" className="text-sm">Decision Maker</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="dnc"
                          checked={formData.dnc}
                          onCheckedChange={(checked) => setFormData({ ...formData, dnc: checked as boolean })}
                        />
                        <label htmlFor="dnc" className="text-sm">DNC</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isLitigator"
                          checked={formData.isLitigator}
                          onCheckedChange={(checked) => setFormData({ ...formData, isLitigator: checked as boolean })}
                        />
                        <label htmlFor="isLitigator" className="text-sm">Litigator</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="deceased"
                          checked={formData.deceased}
                          onCheckedChange={(checked) => setFormData({ ...formData, deceased: checked as boolean })}
                        />
                        <label htmlFor="deceased" className="text-sm">Deceased</label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="currentAddress">Current Address</Label>
                  <Textarea
                    id="currentAddress"
                    value={formData.currentAddress}
                    onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                    placeholder="Current address (may be different from property address)"
                    rows={2}
                  />
                </div>
                
                {/* Phone Numbers - Dynamic */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Phone Numbers</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPhoneField}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Phone
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.phones.map((phone, index) => (
                      <div key={index} className="space-y-2">
                        <div className="grid grid-cols-4 gap-2">
                          <Input
                            placeholder="Phone number"
                            value={phone.phoneNumber}
                            onChange={(e) => updatePhoneField(index, "phoneNumber", e.target.value)}
                            className="col-span-2"
                          />
                          <Select
                            value={phone.phoneType}
                            onValueChange={(value) => updatePhoneField(index, "phoneType", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mobile">Mobile</SelectItem>
                              <SelectItem value="Landline">Landline</SelectItem>
                              <SelectItem value="Wireless">Wireless</SelectItem>
                              <SelectItem value="Work">Work</SelectItem>
                              <SelectItem value="Home">Home</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePhoneField(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {phone.phoneNumber && (
                          <PhoneDuplicateAlert phoneNumber={phone.phoneNumber} />
                        )}
                      </div>
                    ))}
                    {formData.phones.length === 0 && (
                      <p className="text-sm text-muted-foreground">No phone numbers added yet.</p>
                    )}
                  </div>
                </div>
                
                {/* Emails - Dynamic */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Email Addresses</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEmailField}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Email
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.emails.map((email, index) => (
                      <div key={index} className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Email address"
                          type="email"
                          value={email.email}
                          onChange={(e) => updateEmailField(index, "email", e.target.value)}
                          className="col-span-2"
                        />
                        <div className="flex gap-1">
                          <Select
                            value={email.emailType}
                            onValueChange={(value) => updateEmailField(index, "emailType", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Personal">Personal</SelectItem>
                              <SelectItem value="Work">Work</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEmailField(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {formData.emails.length === 0 && (
                      <p className="text-sm text-muted-foreground">No emails added yet.</p>
                    )}
                  </div>
                </div>

                {/* Mailing Addresses - Dynamic */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Mailing Addresses</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAddressField}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Address
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {formData.addresses.map((address, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-md">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Street address"
                            value={address.addressLine1}
                            onChange={(e) => updateAddressField(index, "addressLine1", e.target.value)}
                          />
                          <Input
                            placeholder="Apt, Suite, etc. (optional)"
                            value={address.addressLine2 || ""}
                            onChange={(e) => updateAddressField(index, "addressLine2", e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="City"
                            value={address.city}
                            onChange={(e) => updateAddressField(index, "city", e.target.value)}
                          />
                          <Input
                            placeholder="State"
                            maxLength={2}
                            value={address.state}
                            onChange={(e) => updateAddressField(index, "state", e.target.value.toUpperCase())}
                          />
                          <Input
                            placeholder="Zip code"
                            value={address.zipcode}
                            onChange={(e) => updateAddressField(index, "zipcode", e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={address.addressType}
                            onValueChange={(value) => updateAddressField(index, "addressType", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mailing">Mailing</SelectItem>
                              <SelectItem value="Current">Current</SelectItem>
                              <SelectItem value="Previous">Previous</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAddressField(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {formData.addresses.length === 0 && (
                      <p className="text-sm text-muted-foreground">No addresses added yet.</p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleSave} className="flex-1">
                    Create Contact
                  </Button>
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
