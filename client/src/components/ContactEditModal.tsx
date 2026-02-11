import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { User, Phone, Mail, MapPin, Save, X, Plus, Trash2, History } from "lucide-react";

interface ContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  propertyId: number;
}

const RELATIONSHIP_OPTIONS = [
  "Owner",
  "Spouse",
  "Son",
  "Daughter",
  "Heir",
  "Attorney",
  "Tenant",
  "Neighbor",
  "Family",
  "Resident",
  "Likely Owner",
  "Potential Owner",
  "Renting",
  "Current Resident - NOT on Board",
  "Representative",
  "Other",
];

export function ContactEditModal({ open, onOpenChange, contact, propertyId }: ContactEditModalProps) {
  const utils = trpc.useUtils();

  // Form state
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [age, setAge] = useState<string>("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [flags, setFlags] = useState("");

  // Boolean flags
  const [deceased, setDeceased] = useState(false);
  const [isDecisionMaker, setIsDecisionMaker] = useState(false);
  const [dnc, setDnc] = useState(false);
  const [isLitigator, setIsLitigator] = useState(false);
  const [currentResident, setCurrentResident] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [onBoard, setOnBoard] = useState(false);
  const [notOnBoard, setNotOnBoard] = useState(false);

  // Phones state
  const [phones, setPhones] = useState<Array<{ phoneNumber: string; phoneType: string; isPrimary: number; dnc: number }>>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneType, setNewPhoneType] = useState("Mobile");

  // Emails state
  const [emails, setEmails] = useState<Array<{ email: string; isPrimary: number }>>([]);
  const [newEmail, setNewEmail] = useState("");

  // Communication log for this contact
  const { data: communications } = trpc.communication.getCommunicationLog.useQuery(
    { propertyId },
    { enabled: open }
  );

  // Filter communications for this contact
  const contactCommunications = communications?.filter(
    (comm: any) => comm.contactId === contact?.id
  ) || [];

  // Initialize form when contact changes
  useEffect(() => {
    if (contact) {
      setName(contact.name || "");
      setRelationship(contact.relationship || "");
      setAge(contact.age != null ? String(contact.age) : "");
      setCurrentAddress(contact.currentAddress || "");
      setFlags(contact.flags || "");
      setDeceased(contact.deceased === 1);
      setIsDecisionMaker(contact.isDecisionMaker === 1);
      setDnc(contact.dnc === 1);
      setIsLitigator(contact.isLitigator === 1);
      setCurrentResident(contact.currentResident === 1);
      setContacted(contact.contacted === 1);
      setOnBoard(contact.onBoard === 1);
      setNotOnBoard(contact.notOnBoard === 1);

      // Initialize phones
      if (contact.phones && Array.isArray(contact.phones)) {
        setPhones(contact.phones.map((p: any) => ({
          phoneNumber: p.phoneNumber || "",
          phoneType: p.phoneType || "Mobile",
          isPrimary: p.isPrimary || 0,
          dnc: p.dnc || 0,
        })));
      } else {
        setPhones([]);
      }

      // Initialize emails
      if (contact.emails && Array.isArray(contact.emails)) {
        setEmails(contact.emails.map((e: any) => ({
          email: e.email || "",
          isPrimary: e.isPrimary || 0,
        })));
      } else {
        setEmails([]);
      }
    }
  }, [contact]);

  const updateContactMutation = trpc.communication.updateContact.useMutation({
    onSuccess: () => {
      toast.success("Contact updated successfully!");
      // Invalidate all relevant queries to refresh the page
      utils.contacts.byProperty.invalidate({ propertyId });
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      utils.properties.getById.invalidate({ id: propertyId });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update contact: ${error.message}`);
    },
  });

  const addPhoneMutation = trpc.communication.addPhone.useMutation({
    onSuccess: () => {
      utils.contacts.byProperty.invalidate({ propertyId });
      utils.communication.getContactsByProperty.invalidate({ propertyId });
    },
    onError: (error: any) => {
      toast.error(`Failed to add phone: ${error.message}`);
    },
  });

  const addEmailMutation = trpc.communication.addEmail.useMutation({
    onSuccess: () => {
      utils.contacts.byProperty.invalidate({ propertyId });
      utils.communication.getContactsByProperty.invalidate({ propertyId });
    },
    onError: (error: any) => {
      toast.error(`Failed to add email: ${error.message}`);
    },
  });

  const handleSave = async () => {
    if (!contact?.id) return;

    try {
      // Send all contact details + phones + emails in a single mutation
      // The backend will delete existing phones/emails and recreate them
      await updateContactMutation.mutateAsync({
        contactId: contact.id,
        name: name || undefined,
        relationship: relationship || undefined,
        age: age ? parseInt(age, 10) : undefined,
        currentAddress: currentAddress || undefined,
        flags: flags || undefined,
        deceased: deceased ? 1 : 0,
        isDecisionMaker: isDecisionMaker ? 1 : 0,
        dnc: dnc ? 1 : 0,
        isLitigator: isLitigator ? 1 : 0,
        currentResident: currentResident ? 1 : 0,
        contacted: contacted ? 1 : 0,
        onBoard: onBoard ? 1 : 0,
        notOnBoard: notOnBoard ? 1 : 0,
        phones: phones.map(p => ({
          phoneNumber: p.phoneNumber,
          phoneType: p.phoneType || "Mobile",
          isPrimary: p.isPrimary || 0,
          dnc: p.dnc || 0,
        })),
        emails: emails.map(e => ({
          email: e.email,
          isPrimary: e.isPrimary || 0,
        })),
      });
    } catch (error) {
      // Error already handled by mutation onError callback
    }
  };

  const handleAddPhone = () => {
    if (!newPhone.trim()) return;
    setPhones([...phones, { phoneNumber: newPhone.trim(), phoneType: newPhoneType, isPrimary: 0, dnc: 0 }]);
    setNewPhone("");
    setNewPhoneType("Mobile");
  };

  const handleRemovePhone = (index: number) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    setEmails([...emails, { email: newEmail.trim(), isPrimary: 0 }]);
    setNewEmail("");
  };

  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Contact: {contact.name || "Unknown"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Contact Details</TabsTrigger>
            <TabsTrigger value="phones">Phones & Emails</TabsTrigger>
            <TabsTrigger value="history">
              Call History
              {contactCommunications.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {contactCommunications.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Contact Details */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Name & Relationship */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name" className="text-sm font-medium">Name</Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-relationship" className="text-sm font-medium">Relationship</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger id="contact-relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((rel) => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Age & Current Address */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-age" className="text-sm font-medium">Age</Label>
                <Input
                  id="contact-age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Age"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-address" className="text-sm font-medium">Current Address</Label>
                <Input
                  id="contact-address"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  placeholder="Current address"
                />
              </div>
            </div>

            {/* Flags text */}
            <div className="space-y-1.5">
              <Label htmlFor="contact-flags" className="text-sm font-medium">Flags / Tags</Label>
              <Input
                id="contact-flags"
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                placeholder="e.g., Likely Owner, Family, Resident"
              />
            </div>

            {/* Boolean Flags Grid */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status Flags</Label>
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isDecisionMaker}
                    onCheckedChange={(v) => setIsDecisionMaker(v as boolean)}
                  />
                  <span className="text-sm">✍ Decision Maker</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={currentResident}
                    onCheckedChange={(v) => setCurrentResident(v as boolean)}
                  />
                  <span className="text-sm">🏠 Current Resident</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={contacted}
                    onCheckedChange={(v) => setContacted(v as boolean)}
                  />
                  <span className="text-sm">📞 Contacted</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={onBoard}
                    onCheckedChange={(v) => setOnBoard(v as boolean)}
                  />
                  <span className="text-sm text-green-700 font-medium">✅ On Board</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={notOnBoard}
                    onCheckedChange={(v) => setNotOnBoard(v as boolean)}
                  />
                  <span className="text-sm text-red-700 font-medium">❌ NOT On Board</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={dnc}
                    onCheckedChange={(v) => setDnc(v as boolean)}
                  />
                  <span className="text-sm text-pink-700 font-medium">📵 DNC</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isLitigator}
                    onCheckedChange={(v) => setIsLitigator(v as boolean)}
                  />
                  <span className="text-sm text-red-700 font-medium">🗣 Litigator</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={deceased}
                    onCheckedChange={(v) => setDeceased(v as boolean)}
                  />
                  <span className="text-sm text-purple-700 font-medium">🕊 Deceased</span>
                </label>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Phones & Emails */}
          <TabsContent value="phones" className="space-y-4 mt-4">
            {/* Phones Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-medium">Phone Numbers</Label>
                <Badge variant="outline" className="text-xs">{phones.length}</Badge>
              </div>

              {phones.length > 0 ? (
                <div className="space-y-2">
                  {phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                      <span className="text-sm font-mono flex-1">{phone.phoneNumber}</span>
                      <Badge variant="outline" className="text-xs">{phone.phoneType}</Badge>
                      {phone.dnc === 1 && <Badge variant="destructive" className="text-xs">DNC</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleRemovePhone(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No phone numbers</p>
              )}

              {/* Add Phone */}
              <div className="flex items-center gap-2">
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Add phone number"
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPhone(); }}
                />
                <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mobile">Mobile</SelectItem>
                    <SelectItem value="Landline">Landline</SelectItem>
                    <SelectItem value="Work">Work</SelectItem>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleAddPhone} disabled={!newPhone.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Emails Section */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-600" />
                <Label className="text-sm font-medium">Email Addresses</Label>
                <Badge variant="outline" className="text-xs">{emails.length}</Badge>
              </div>

              {emails.length > 0 ? (
                <div className="space-y-2">
                  {emails.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                      <span className="text-sm flex-1">{email.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveEmail(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No email addresses</p>
              )}

              {/* Add Email */}
              <div className="flex items-center gap-2">
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Add email address"
                  className="flex-1"
                  type="email"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddEmail(); }}
                />
                <Button variant="outline" size="sm" onClick={handleAddEmail} disabled={!newEmail.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Call History */}
          <TabsContent value="history" className="space-y-3 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <History className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium">Call History for {contact.name || "this contact"}</Label>
            </div>

            {contactCommunications.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {contactCommunications
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((comm: any, idx: number) => (
                  <div key={idx} className="p-3 bg-muted/30 rounded-lg border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(comm.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" "}
                          {new Date(comm.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {comm.phoneNumber && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {comm.phoneNumber}
                          </Badge>
                        )}
                      </div>
                      {comm.disposition && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            comm.disposition.includes("HOT") ? "bg-red-100 text-red-800 border-red-300" :
                            comm.disposition.includes("WARM") ? "bg-orange-100 text-orange-800 border-orange-300" :
                            comm.disposition === "Left Message" ? "bg-green-100 text-green-800 border-green-300" :
                            comm.disposition === "Voicemail" ? "bg-purple-100 text-purple-800 border-purple-300" :
                            comm.disposition === "Not Answer" ? "bg-orange-100 text-orange-800 border-orange-300" :
                            "bg-gray-100 text-gray-800 border-gray-300"
                          }`}
                        >
                          {comm.disposition}
                        </Badge>
                      )}
                    </div>
                    {comm.mood && (
                      <div className="text-xs text-muted-foreground">
                        Mood: {comm.mood}
                      </div>
                    )}
                    {comm.notes && (
                      <p className="text-sm text-foreground mt-1">{comm.notes}</p>
                    )}
                    {comm.agentName && (
                      <div className="text-xs text-muted-foreground">
                        Agent: {comm.agentName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No call history for this contact yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save / Cancel Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateContactMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
