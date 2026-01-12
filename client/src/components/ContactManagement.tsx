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
import { Phone, Mail, MessageSquare, Facebook, Instagram, Star, AlertTriangle, Scale, Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ContactManagementProps {
  propertyId: number;
}

export function ContactManagement({ propertyId }: ContactManagementProps) {

  const utils = trpc.useUtils();
  
  const { data: contacts, isLoading } = trpc.communication.getContactsByProperty.useQuery({ propertyId });
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [showHidden, setShowHidden] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    age: "",
    currentAddress: "",
    isDecisionMaker: false,
    dnc: false,
    isLitigator: false,
    deceased: false,
    phone1: "",
    phone1Type: "Mobile",
    phone2: "",
    phone2Type: "Mobile",
    phone3: "",
    phone3Type: "Mobile",
    email1: "",
    email2: "",
    email3: "",
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
      phone1: "",
      phone1Type: "Mobile",
      phone2: "",
      phone2Type: "Mobile",
      phone3: "",
      phone3Type: "Mobile",
      email1: "",
      email2: "",
      email3: "",
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
      phone1: formData.phone1 || undefined,
      phone1Type: formData.phone1Type || undefined,
      phone2: formData.phone2 || undefined,
      phone2Type: formData.phone2Type || undefined,
      phone3: formData.phone3 || undefined,
      phone3Type: formData.phone3Type || undefined,
      email1: formData.email1 || undefined,
      email2: formData.email2 || undefined,
      email3: formData.email3 || undefined,
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
      phone1: contact.phone1 || "",
      phone1Type: contact.phone1Type || "Mobile",
      phone2: contact.phone2 || "",
      phone2Type: contact.phone2Type || "Mobile",
      phone3: contact.phone3 || "",
      phone3Type: contact.phone3Type || "Mobile",
      email1: contact.email1 || "",
      email2: contact.email2 || "",
      email3: contact.email3 || "",
    });
    setIsAddDialogOpen(true);
  };
  
  const handleDelete = (contactId: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate({ id: contactId });
    }
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
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  
                  {/* Phone Numbers */}
                  <div className="space-y-2">
                    <Label>Phone Numbers</Label>
                    {[1, 2, 3].map((num) => (
                      <div key={num} className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder={`Phone ${num}`}
                          value={formData[`phone${num}` as keyof typeof formData] as string}
                          onChange={(e) => setFormData({ ...formData, [`phone${num}`]: e.target.value })}
                          className="col-span-2"
                        />
                        <Select
                          value={formData[`phone${num}Type` as keyof typeof formData] as string}
                          onValueChange={(value) => setFormData({ ...formData, [`phone${num}Type`]: value })}
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
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  
                  {/* Emails */}
                  <div className="space-y-2">
                    <Label>Email Addresses</Label>
                    {[1, 2, 3].map((num) => (
                      <Input
                        key={num}
                        placeholder={`Email ${num}`}
                        type="email"
                        value={formData[`email${num}` as keyof typeof formData] as string}
                        onChange={(e) => setFormData({ ...formData, [`email${num}`]: e.target.value })}
                      />
                    ))}
                  </div>
                  
                  <div className="flex gap-2 pt-4">
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
                  {/* Phone Numbers - show only individual fields to avoid duplicates */}
                  {(contact.phone1 || contact.phone2 || contact.phone3) && (
                    <div className="space-y-1">
                      {contact.phone1 && (
                        <div className={`flex items-center gap-2 text-sm ${
                          contact.dnc === 1 ? 'font-bold text-red-600' : ''
                        }`}>
                          <Phone className={`h-4 w-4 ${
                            contact.dnc === 1 ? 'text-red-600' : 'text-muted-foreground'
                          }`} />
                          <span>{contact.phone1}</span>
                          <Badge variant="outline" className="text-xs">{contact.phone1Type}</Badge>
                          {contact.dnc === 1 && <Badge className="bg-red-600 text-white text-xs">DNC</Badge>}
                        </div>
                      )}
                      {contact.phone2 && (
                        <div className={`flex items-center gap-2 text-sm ${
                          contact.dnc === 1 ? 'font-bold text-red-600' : ''
                        }`}>
                          <Phone className={`h-4 w-4 ${
                            contact.dnc === 1 ? 'text-red-600' : 'text-muted-foreground'
                          }`} />
                          <span>{contact.phone2}</span>
                          <Badge variant="outline" className="text-xs">{contact.phone2Type}</Badge>
                          {contact.dnc === 1 && <Badge className="bg-red-600 text-white text-xs">DNC</Badge>}
                        </div>
                      )}
                      {contact.phone3 && (
                        <div className={`flex items-center gap-2 text-sm ${
                          contact.dnc === 1 ? 'font-bold text-red-600' : ''
                        }`}>
                          <Phone className={`h-4 w-4 ${
                            contact.dnc === 1 ? 'text-red-600' : 'text-muted-foreground'
                          }`} />
                          <span>{contact.phone3}</span>
                          <Badge variant="outline" className="text-xs">{contact.phone3Type}</Badge>
                          {contact.dnc === 1 && <Badge className="bg-red-600 text-white text-xs">DNC</Badge>}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Emails from emails array (imported) or individual fields (manual) */}
                  {(contact.emails && contact.emails.length > 0 || contact.email1 || contact.email2 || contact.email3) && (
                    <div className="space-y-1">
                      {contact.emails && contact.emails.map((email: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{email.email}</span>
                        </div>
                      ))}
                      {contact.email1 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{contact.email1}</span>
                        </div>
                      )}
                      {contact.email2 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{contact.email2}</span>
                        </div>
                      )}
                      {contact.email3 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{contact.email3}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Current Address */}
                  {contact.currentAddress && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Current Address:</strong> {contact.currentAddress}
                    </div>
                  )}
                  
                  {/* Quick Actions */}
                  {/* Action buttons removed - use Call Tracking Table instead */}
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                
                {/* Phone Numbers */}
                <div className="space-y-2">
                  <Label>Phone Numbers</Label>
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder={`Phone ${num}`}
                        value={formData[`phone${num}` as keyof typeof formData] as string}
                        onChange={(e) => setFormData({ ...formData, [`phone${num}`]: e.target.value })}
                        className="col-span-2"
                      />
                      <Select
                        value={formData[`phone${num}Type` as keyof typeof formData] as string}
                        onValueChange={(value) => setFormData({ ...formData, [`phone${num}Type`]: value })}
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
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                
                {/* Emails */}
                <div className="space-y-2">
                  <Label>Email Addresses</Label>
                  {[1, 2, 3].map((num) => (
                    <Input
                      key={num}
                      placeholder={`Email ${num}`}
                      type="email"
                      value={formData[`email${num}` as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [`email${num}`]: e.target.value })}
                    />
                  ))}
                </div>
                
                <div className="flex gap-2 pt-4">
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
      )}
    </div>
  );
}
