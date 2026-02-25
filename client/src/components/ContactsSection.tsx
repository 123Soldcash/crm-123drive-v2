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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, Mail, Plus, Edit2, Trash2, Eye, EyeOff, Clock } from "lucide-react";
import { toast } from "sonner";
import { TwilioBrowserCallButton } from "./TwilioBrowserCallButton";

interface ContactsSectionProps {
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

interface CallHistoryEntry {
  id: number;
  contactId: number;
  contactName: string;
  phoneNumber: string;
  callDate: Date;
  disposition: string;
  mood?: string;
  notes: string;
  agent?: string;
}

export function ContactsSection({ propertyId }: ContactsSectionProps) {
  const utils = trpc.useUtils();
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenPhones, setHiddenPhones] = useState<Set<string>>(new Set());

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
    phones: [] as PhoneEntry[],
    emails: [] as EmailEntry[],
    addresses: [] as AddressEntry[],
  });

  // Queries
  const { data: contacts, isLoading } = trpc.communication.getContactsByProperty.useQuery(
    { propertyId },
    { enabled: !!propertyId && !isNaN(propertyId) && propertyId > 0 }
  );

  const { data: callHistory = [] } = (trpc.communication.getCommunicationLog as any).useQuery(
    { propertyId },
    { enabled: !!propertyId && !isNaN(propertyId) && propertyId > 0 }
  );

  // Mutations
  const createContactMutation = trpc.communication.createContact.useMutation({
    onSuccess: () => {
      toast.success("Contact created successfully");
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      resetForm();
      setIsAddingContact(false);
    },
    onError: (error) => {
      toast.error(`Failed to create contact: ${error.message}`);
    },
  });

  const updateContactMutation = trpc.communication.updateContact.useMutation({
    onSuccess: () => {
      toast.success("Contact updated successfully");
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      setIsModalOpen(false);
      setSelectedContact(null);
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
      setIsModalOpen(false);
      setSelectedContact(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete contact: ${error.message}`);
    },
  });

  // Handlers
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

  const openContactModal = (contact: any) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name || "",
      relationship: contact.relationship || "",
      age: contact.age?.toString() || "",
      currentAddress: contact.currentAddress || "",
      isDecisionMaker: contact.isDecisionMaker === 1,
      dnc: contact.dnc === 1,
      isLitigator: contact.isLitigator === 1,
      deceased: contact.deceased === 1,
      phones: contact.phones || [],
      emails: contact.emails || [],
      addresses: contact.addresses || [],
    });
    setIsModalOpen(true);
  };

  const handleSaveContact = () => {
    if (!formData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    if (selectedContact) {
      updateContactMutation.mutate({
        contactId: selectedContact.id,
        ...formData,
      } as any);
    } else {
      createContactMutation.mutate({
        propertyId,
        ...formData,
      } as any);
    }
  };

  const handleDeleteContact = () => {
    if (selectedContact) {
      deleteContactMutation.mutate({ contactId: selectedContact.id });
    }
  };

  const getContactCallHistory = (contactId: number) => {
    return callHistory.filter((call: any) => call.contactId === contactId);
  };

  const togglePhoneVisibility = (phoneNumber: string) => {
    const newHidden = new Set(hiddenPhones);
    if (newHidden.has(phoneNumber)) {
      newHidden.delete(phoneNumber);
    } else {
      newHidden.add(phoneNumber);
    }
    setHiddenPhones(newHidden);
  };

  const getDispositionBadgeColor = (disposition: string) => {
    if (disposition.includes("HOT")) return "bg-red-100 text-red-800";
    if (disposition.includes("WARM")) return "bg-orange-100 text-orange-800";
    if (disposition.includes("Interested")) return "bg-green-100 text-green-800";
    if (disposition.includes("DNC")) return "bg-gray-100 text-gray-800";
    return "bg-blue-100 text-blue-800";
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading contacts...</div>;
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Contacts ({contacts?.length || 0})
        </CardTitle>
        <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <Label>Relationship</Label>
                  <Select value={formData.relationship} onValueChange={(value) => setFormData({ ...formData, relationship: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Tenant">Tenant</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age</Label>
                  <Input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Age"
                  />
                </div>
                <div>
                  <Label>Current Address</Label>
                  <Input
                    value={formData.currentAddress}
                    onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                    placeholder="Address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.isDecisionMaker}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDecisionMaker: checked as boolean })}
                  />
                  <Label>✍ Decision Maker</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.dnc}
                    onCheckedChange={(checked) => setFormData({ ...formData, dnc: checked as boolean })}
                  />
                  <Label>📵 DNC</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.isLitigator}
                    onCheckedChange={(checked) => setFormData({ ...formData, isLitigator: checked as boolean })}
                  />
                  <Label>🗣 Litigator</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.deceased}
                    onCheckedChange={(checked) => setFormData({ ...formData, deceased: checked as boolean })}
                  />
                  <Label>🕊 Deceased</Label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAddingContact(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveContact} disabled={createContactMutation.isPending}>
                  {createContactMutation.isPending ? "Creating..." : "Create Contact"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {!contacts || contacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No contacts yet. Click "Add Contact" to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact: any) => {
              const contactCalls = getContactCallHistory(contact.id);
              const primaryPhone = contact.phones?.find((p: any) => p.isPrimary === 1);
              const primaryEmail = contact.emails?.find((e: any) => e.isPrimary === 1);

              return (
                <div
                  key={contact.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => openContactModal(contact)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{contact.name}</h3>
                        <div className="flex gap-1">
                          {contact.isDecisionMaker === 1 && <Badge variant="secondary">✍ Decision Maker</Badge>}
                          {contact.dnc === 1 && <Badge variant="destructive">📵 DNC</Badge>}
                          {contact.isLitigator === 1 && <Badge variant="secondary">🗣 Litigator</Badge>}
                          {contact.deceased === 1 && <Badge variant="secondary">🕊 Deceased</Badge>}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        {contact.relationship && <p>Relationship: {contact.relationship}</p>}
                        {contact.age && <p>Age: {contact.age}</p>}
                      </div>

                      <div className="mt-2 space-y-1 text-sm">
                        {primaryPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span className={hiddenPhones.has(primaryPhone.phoneNumber) ? "blur-sm" : ""}>
                              {primaryPhone.phoneNumber}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePhoneVisibility(primaryPhone.phoneNumber);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {hiddenPhones.has(primaryPhone.phoneNumber) ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </button>
                            <TwilioBrowserCallButton
                              phoneNumber={primaryPhone.phoneNumber}
                              contactName={contact.name}
                              contactId={contact.id}
                              propertyId={propertyId}
                            />
                          </div>
                        )}
                        {primaryEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{primaryEmail.email}</span>
                          </div>
                        )}
                      </div>

                      {contactCalls.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <Clock className="w-4 h-4" />
                            Call History ({contactCalls.length})
                          </div>
                          <div className="space-y-1">
                            {contactCalls.slice(0, 2).map((call: any) => (
                              <div key={call.id} className="text-xs text-gray-600 flex items-center gap-2">
                                <span className={`px-2 py-1 rounded ${getDispositionBadgeColor(call.disposition)}`}>
                                  {call.disposition}
                                </span>
                                <span>{new Date(call.callDate).toLocaleDateString()}</span>
                              </div>
                            ))}
                            {contactCalls.length > 2 && (
                              <div className="text-xs text-gray-500">+{contactCalls.length - 2} more calls</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openContactModal(contact);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Contact Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContact ? `Edit Contact: ${selectedContact.name}` : "Contact Details"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Contact Form */}
            <div className="space-y-4">
              <h3 className="font-semibold">Contact Information</h3>

              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contact name"
                />
              </div>

              <div>
                <Label>Relationship</Label>
                <Select value={formData.relationship} onValueChange={(value) => setFormData({ ...formData, relationship: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Tenant">Tenant</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Age</Label>
                <Input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="Age"
                />
              </div>

              <div>
                <Label>Current Address</Label>
                <Input
                  value={formData.currentAddress}
                  onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                  placeholder="Address"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.isDecisionMaker}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDecisionMaker: checked as boolean })}
                  />
                  <Label>✍ Decision Maker</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.dnc}
                    onCheckedChange={(checked) => setFormData({ ...formData, dnc: checked as boolean })}
                  />
                  <Label>📵 DNC</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.isLitigator}
                    onCheckedChange={(checked) => setFormData({ ...formData, isLitigator: checked as boolean })}
                  />
                  <Label>🗣 Litigator</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.deceased}
                    onCheckedChange={(checked) => setFormData({ ...formData, deceased: checked as boolean })}
                  />
                  <Label>🕊 Deceased</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedContact(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveContact} disabled={updateContactMutation.isPending}>
                  {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                {selectedContact && (
                  <Button
                    variant="destructive"
                    onClick={handleDeleteContact}
                    disabled={deleteContactMutation.isPending}
                  >
                    {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                )}
              </div>
            </div>

            {/* Right: Call History */}
            <div className="space-y-4">
              <h3 className="font-semibold">Call History</h3>

              {selectedContact && getContactCallHistory(selectedContact.id).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No calls yet for this contact
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Disposition</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedContact &&
                        getContactCallHistory(selectedContact.id).map((call: any) => (
                          <TableRow key={call.id}>
                            <TableCell className="text-sm">
                              {new Date(call.callDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={getDispositionBadgeColor(call.disposition)}>
                                {call.disposition}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-xs truncate">
                              {call.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
