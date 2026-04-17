import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
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
import { Phone, Mail, Plus, Edit2, Trash2, Eye, EyeOff, Clock, Search, Shield, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { TwilioBrowserCallButton } from "./TwilioBrowserCallButton";
import { SMSChatButton } from "./SMSChatButton";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user } = useAuth();
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

  // Fetch property to get primaryTwilioNumber
  const { data: property } = trpc.properties.getById.useQuery(
    { id: propertyId },
    { enabled: !!propertyId && !isNaN(propertyId) && propertyId > 0 }
  );
  const primaryTwilioNumber = property?.primaryTwilioNumber || null;
  const propertyAddress = (property as any)?.addressLine1 || undefined;
  const propertyCity = (property as any)?.city || undefined;
  const agentName = user?.name || undefined;

  // Detect duplicate phones and emails across all contacts in this property
  const { duplicatePhones, duplicateEmails } = useMemo(() => {
    const phoneCount: Record<string, number> = {};
    const emailCount: Record<string, number> = {};
    if (contacts) {
      for (const c of contacts as any[]) {
        if (c.phones) {
          for (const p of c.phones as any[]) {
            const normalized = (p.phoneNumber || "").replace(/\D/g, "");
            if (normalized) phoneCount[normalized] = (phoneCount[normalized] || 0) + 1;
          }
        }
        if (c.emails) {
          for (const e of c.emails as any[]) {
            const normalized = (e.email || "").trim().toLowerCase();
            if (normalized) emailCount[normalized] = (emailCount[normalized] || 0) + 1;
          }
        }
      }
    }
    const dupPhones = new Set<string>();
    const dupEmails = new Set<string>();
    Object.entries(phoneCount).forEach(([k, v]) => { if (v > 1) dupPhones.add(k); });
    Object.entries(emailCount).forEach(([k, v]) => { if (v > 1) dupEmails.add(k); });
    return { duplicatePhones: dupPhones, duplicateEmails: dupEmails };
  }, [contacts]);

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
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Contacts ({contacts?.length || 0})
        </CardTitle>
        <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {/* Primary Twilio Number Selector - Property Level */}
        <PrimaryTwilioNumberSelector propertyId={propertyId} />

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
                        {(contact.phones || []).map((phone: any) => {
                          const normalizedPhone = (phone.phoneNumber || "").replace(/\D/g, "");
                          const isPhoneDup = duplicatePhones.has(normalizedPhone);
                          const scoreColor = phone.trestleScore != null
                            ? phone.trestleScore >= 70 ? 'bg-green-100 text-green-800 border-green-300'
                            : phone.trestleScore >= 30 ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                            : '';
                          return (
                            <div key={phone.id || phone.phoneNumber} className={`flex items-center gap-2 flex-wrap ${isPhoneDup ? 'bg-amber-50 rounded px-1.5 py-0.5 border border-amber-300' : ''}`}>
                              <Phone className={`w-4 h-4 flex-shrink-0 ${isPhoneDup ? 'text-amber-600' : ''}`} />
                              <span className={`${hiddenPhones.has(phone.phoneNumber) ? 'blur-sm' : ''} ${isPhoneDup ? 'text-amber-800 font-medium' : ''}`}>
                                {formatPhone(phone.phoneNumber)}
                              </span>
                              {phone.isPrimary === 1 && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Primary</Badge>}
                              {isPhoneDup && <Badge className="bg-amber-500 text-white text-xs">Duplicate</Badge>}
                              {phone.dnc === 1 && <Badge variant="destructive" className="text-xs">📵 DNC</Badge>}
                              {phone.isLitigator === 1 && <Badge className="bg-red-600 text-white text-xs"><ShieldAlert className="w-3 h-3 mr-1" />Litigator</Badge>}
                              {phone.trestleScore != null && (
                                <Badge className={`text-xs border ${scoreColor}`}>
                                  <Shield className="w-3 h-3 mr-1" />
                                  Score: {phone.trestleScore}
                                </Badge>
                              )}
                              {phone.trestleLineType && (
                                <span className="text-xs text-muted-foreground">{phone.trestleLineType}</span>
                              )}
                              <TrestleLookupButton phoneId={phone.id} phoneNumber={phone.phoneNumber} propertyId={propertyId} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePhoneVisibility(phone.phoneNumber);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {hiddenPhones.has(phone.phoneNumber) ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                              </button>
                              {phone.isPrimary === 1 && (
                                <>
                                  <TwilioBrowserCallButton
                                    phoneNumber={phone.phoneNumber}
                                    contactName={contact.name}
                                    contactId={contact.id}
                                    propertyId={propertyId}
                                    primaryTwilioNumber={primaryTwilioNumber}
                                  />
                                  <SMSChatButton
                                    phoneNumber={phone.phoneNumber}
                                    contactName={contact.name}
                                    contactId={contact.id}
                                    propertyId={propertyId}
                                    propertyAddress={propertyAddress}
                                    propertyCity={propertyCity}
                                    agentName={agentName}
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                        {primaryEmail && (() => {
                          const normalizedEmail = (primaryEmail.email || "").trim().toLowerCase();
                          const isEmailDup = duplicateEmails.has(normalizedEmail);
                          return (
                            <div className={`flex items-center gap-2 ${isEmailDup ? 'bg-amber-50 rounded px-1.5 py-0.5 border border-amber-300' : ''}`}>
                              <Mail className={`w-4 h-4 ${isEmailDup ? 'text-amber-600' : ''}`} />
                              <span className={isEmailDup ? 'text-amber-800 font-medium' : ''}>{primaryEmail.email}</span>
                              {isEmailDup && <Badge className="bg-amber-500 text-white text-xs">Duplicate</Badge>}
                            </div>
                          );
                        })()}
                      </div>



                      {contactCalls.length > 0 && (() => {
                        const lastCall = contactCalls[0];
                        const lastDisp = lastCall.disposition || lastCall.callResult || "";
                        const lastDate = lastCall.communicationDate || lastCall.callDate;
                        // Extract user notes: strip the auto-prefix "Called +1xxx - "
                        const rawNotes = lastCall.notes || "";
                        const userNotes = rawNotes.replace(/^Called [^-]+-?\s*/, "").trim();
                        return (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                              <Clock className="w-4 h-4" />
                              Last Call — {lastDate ? new Date(lastDate).toLocaleDateString() : "—"}
                              {contactCalls.length > 1 && <span className="text-xs text-gray-400 font-normal">({contactCalls.length} total)</span>}
                            </div>
                            {lastDisp && (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${getDispositionBadgeColor(lastDisp)}`}>
                                {lastDisp}
                              </span>
                            )}
                            {userNotes && (
                              <p className="text-xs text-gray-600 mt-1 italic truncate" title={userNotes}>
                                {userNotes}
                              </p>
                            )}
                          </div>
                        );
                      })()}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContact ? `Edit Contact: ${selectedContact.name}` : "Contact Details"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                        getContactCallHistory(selectedContact.id).map((call: any) => {
                          const disp = call.disposition || call.callResult || "-";
                          const callDate = call.communicationDate || call.callDate;
                          const rawNotes = call.notes || "";
                          const userNotes = rawNotes.replace(/^Called [^-]+-?\s*/, "").trim() || rawNotes;
                          return (
                            <TableRow key={call.id}>
                              <TableCell className="text-sm">
                                {callDate ? new Date(callDate).toLocaleDateString() : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getDispositionBadgeColor(disp)}>
                                  {disp}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm max-w-xs truncate" title={userNotes}>
                                {userNotes || "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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


/**
 * TrestleLookupButton - Inline button to query TrestleIQ for a phone number
 */
function TrestleLookupButton({ phoneId, phoneNumber, propertyId }: { phoneId: number; phoneNumber: string; propertyId: number }) {
  const utils = trpc.useUtils();
  const lookupMutation = (trpc as any).trestleiq.lookupPhone.useMutation({
    onSuccess: (data: any) => {
      toast.success(`TrestleIQ: Score ${data.activityScore ?? 'N/A'}${data.isLitigator ? ' - LITIGATOR!' : ''}`);
      utils.communication.getContactsByProperty.invalidate({ propertyId });
    },
    onError: (error: any) => {
      toast.error(`TrestleIQ lookup failed: ${error.message}`);
    },
  });

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        lookupMutation.mutate({ phoneId });
      }}
      disabled={lookupMutation.isPending}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
      title="Query TrestleIQ for this phone number"
    >
      <Search className="w-3 h-3" />
      {lookupMutation.isPending ? 'Checking...' : 'TrestleIQ'}
    </button>
  );
}

/**
 * PrimaryTwilioNumberSelector - Property-level default Twilio number
 * Shows the current primary number and allows changing it.
 * Auto-set when a lead calls in; can be manually changed here.
 */
function PrimaryTwilioNumberSelector({ propertyId }: { propertyId: number }) {
  const utils = trpc.useUtils();
  
  // Fetch the property to get the current primaryTwilioNumber
  const { data: property } = trpc.properties.getById.useQuery(
    { id: propertyId },
    { enabled: !!propertyId && !isNaN(propertyId) && propertyId > 0 }
  );

  // Fetch available Twilio numbers
  const { data: twilioNumbers = [] } = trpc.twilio.listNumbers.useQuery({ activeOnly: true });

  const updateMutation = trpc.communication.updatePrimaryTwilioNumber.useMutation({
    onSuccess: () => {
      toast.success("Default Twilio number updated");
      utils.properties.getById.invalidate({ id: propertyId });
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const currentNumber = property?.primaryTwilioNumber;

  return (
    <div className="mb-4 p-3 rounded-lg border bg-blue-50/50 border-blue-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-blue-800">Default Caller ID</span>
          {currentNumber && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              {formatPhone(currentNumber)}
            </Badge>
          )}
          {!currentNumber && (
            <span className="text-xs text-muted-foreground">(not set — will be auto-set on first inbound call)</span>
          )}
        </div>
        <Select
          value={currentNumber || "_none"}
          onValueChange={(value) => {
            updateMutation.mutate({
              propertyId,
              primaryTwilioNumber: value === "_none" ? null : value,
            });
          }}
        >
          <SelectTrigger className="w-[220px] h-8 text-xs bg-white">
            <SelectValue placeholder="Select default number" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">No default number</SelectItem>
            {(twilioNumbers as any[]).map((num: any) => (
              <SelectItem key={num.id} value={num.phoneNumber}>
                {num.label} ({formatPhone(num.phoneNumber)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        When set, clicking the call button will use this number automatically instead of showing the number selector.
      </p>
    </div>
  );
}
