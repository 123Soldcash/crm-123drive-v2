import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  User, Phone, Mail, Save, X, Plus, Trash2, History, AlertCircle, AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  propertyId: number;
}

const RELATIONSHIP_OPTIONS = [
  "Owner", "Spouse", "Son", "Daughter", "Heir", "Attorney", "Tenant",
  "Neighbor", "Family", "Resident", "Likely Owner", "Potential Owner",
  "Renting", "Current Resident - NOT on Board", "Representative", "Other",
];

export function ContactEditModal({ open, onOpenChange, contact, propertyId }: ContactEditModalProps) {
  const utils = trpc.useUtils();

  // ── Form state ─────────────────────────────────────────────────────────────
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

  // Phones
  const [phones, setPhones] = useState<Array<{ phoneNumber: string; phoneType: string; isPrimary: number; dnc: number }>>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneType, setNewPhoneType] = useState("Mobile");

  // Emails
  const [emails, setEmails] = useState<Array<{ email: string; isPrimary: number }>>([]);
  const [newEmail, setNewEmail] = useState("");

  // Errors & warnings
  const [saveError, setSaveError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [crossPropertyWarnings, setCrossPropertyWarnings] = useState<Array<{ phone: string; propertyId: number; leadId: number | null; address: string }>>([]);
  const [showCrossPropertyConfirm, setShowCrossPropertyConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'addPhone' | 'save' | null>(null);
  const [pendingPhoneToAdd, setPendingPhoneToAdd] = useState<{ phoneNumber: string; phoneType: string } | null>(null);

  // ── Communication log ──────────────────────────────────────────────────────
  const { data: communications } = trpc.communication.getCommunicationLog.useQuery(
    { propertyId },
    { enabled: open }
  );
  const contactCommunications = (communications || [])
    .filter((comm: any) => comm.contactId === contact?.id)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ── Initialize form ────────────────────────────────────────────────────────
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
      setPhones(
        (contact.phones || []).map((p: any) => ({
          phoneNumber: p.phoneNumber || "",
          phoneType: p.phoneType || "Mobile",
          isPrimary: p.isPrimary || 0,
          dnc: p.dnc || 0,
        }))
      );
      setEmails(
        (contact.emails || []).map((e: any) => ({
          email: e.email || "",
          isPrimary: e.isPrimary || 0,
        }))
      );
    }
  }, [contact]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateContactMutation = trpc.communication.updateContact.useMutation({
    onSuccess: () => {
      toast.success("Contact updated successfully!");
      setSaveError(null);
      utils.contacts.byProperty.invalidate({ propertyId });
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      utils.properties.getById.invalidate({ id: propertyId });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error.message || "Failed to update contact";
      setSaveError(msg);
      toast.error(msg);
    },
  });

  const doSave = async () => {
    if (!contact?.id) return;
    try {
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
    } catch (_) { /* handled by onError */ }
  };

  const handleSave = async () => {
    if (!contact?.id) return;
    setSaveError(null);
    const originalPhoneNums = new Set(
      (contact.phones || []).map((p: any) => p.phoneNumber.replace(/\D/g, ''))
    );
    const newPhoneNumbers = phones
      .filter(p => !originalPhoneNums.has(p.phoneNumber.replace(/\D/g, '')))
      .map(p => p.phoneNumber);
    if (newPhoneNumbers.length > 0) {
      try {
        const result = await utils.communication.checkCrossPropertyPhones.fetch({ propertyId, phones: newPhoneNumbers });
        if (result.matches && result.matches.length > 0) {
          setCrossPropertyWarnings(result.matches);
          setPendingAction('save');
          setShowCrossPropertyConfirm(true);
          return;
        }
      } catch (_) { /* proceed anyway */ }
    }
    await doSave();
  };

  const handleAddPhone = async () => {
    if (!newPhone.trim()) return;
    const normalized = newPhone.trim().replace(/\D/g, "");
    if (phones.some(p => p.phoneNumber.replace(/\D/g, "") === normalized)) {
      setPhoneError(`Phone number ${newPhone.trim()} already exists for this contact`);
      return;
    }
    setPhoneError(null);
    try {
      const result = await utils.communication.checkCrossPropertyPhones.fetch({ propertyId, phones: [newPhone.trim()] });
      if (result.matches && result.matches.length > 0) {
        setCrossPropertyWarnings(result.matches);
        setPendingAction('addPhone');
        setPendingPhoneToAdd({ phoneNumber: newPhone.trim(), phoneType: newPhoneType });
        setShowCrossPropertyConfirm(true);
        return;
      }
    } catch (_) { /* proceed anyway */ }
    setPhones([...phones, { phoneNumber: newPhone.trim(), phoneType: newPhoneType, isPrimary: 0, dnc: 0 }]);
    setNewPhone("");
    setNewPhoneType("Mobile");
  };

  const handleCrossPropertyConfirm = () => {
    setShowCrossPropertyConfirm(false);
    setCrossPropertyWarnings([]);
    if (pendingAction === 'addPhone' && pendingPhoneToAdd) {
      setPhones([...phones, { phoneNumber: pendingPhoneToAdd.phoneNumber, phoneType: pendingPhoneToAdd.phoneType, isPrimary: 0, dnc: 0 }]);
      setNewPhone("");
      setNewPhoneType("Mobile");
      setPendingPhoneToAdd(null);
    } else if (pendingAction === 'save') {
      doSave();
    }
    setPendingAction(null);
  };

  const handleRemovePhone = (index: number) => setPhones(phones.filter((_, i) => i !== index));
  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    setEmails([...emails, { email: newEmail.trim(), isPrimary: 0 }]);
    setNewEmail("");
  };
  const handleRemoveEmail = (index: number) => setEmails(emails.filter((_, i) => i !== index));

  if (!contact) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Wide modal, tall — fixed height with internal scroll */}
        <DialogContent className="max-w-3xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Edit Contact: <span className="font-bold">{contact.name || "Unknown"}</span>
            </DialogTitle>
          </DialogHeader>

          {/* ── Scrollable body ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

            {/* ══ SECTION 1: Contact Details ══════════════════════════════════ */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Contact Details
              </h3>
              <div className="space-y-3">
                {/* Name + Relationship */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Relationship</Label>
                    <Select value={relationship} onValueChange={setRelationship}>
                      <SelectTrigger className="h-9">
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

                {/* Age + Address */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Age</Label>
                    <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Current Address</Label>
                    <Input value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} placeholder="Current address" className="h-9" />
                  </div>
                </div>

                {/* Flags text */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Flags / Tags</Label>
                  <Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="e.g., Likely Owner, Family, Resident" className="h-9" />
                </div>

                {/* Status Flags grid */}
                <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg border">
                  {[
                    { label: "✍ Decision Maker", value: isDecisionMaker, set: setIsDecisionMaker, color: "" },
                    { label: "🏠 Current Resident", value: currentResident, set: setCurrentResident, color: "" },
                    { label: "📞 Contacted", value: contacted, set: setContacted, color: "" },
                    { label: "✅ On Board", value: onBoard, set: setOnBoard, color: "text-green-700 font-medium" },
                    { label: "❌ NOT On Board", value: notOnBoard, set: setNotOnBoard, color: "text-red-700 font-medium" },
                    { label: "📵 DNC", value: dnc, set: setDnc, color: "text-pink-700 font-medium" },
                    { label: "🗣 Litigator", value: isLitigator, set: setIsLitigator, color: "text-red-700 font-medium" },
                    { label: "🕊 Deceased", value: deceased, set: setDeceased, color: "text-purple-700 font-medium" },
                  ].map(({ label, value, set, color }) => (
                    <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={value} onCheckedChange={(v) => set(v as boolean)} />
                      <span className={`text-xs ${color}`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* ══ SECTION 2: Phones & Emails ══════════════════════════════════ */}
            <section className="border-t pt-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phones &amp; Emails
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* ── Phones ── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-medium">Phone Numbers</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{phones.length}</Badge>
                  </div>

                  {phones.length > 0 ? (
                    <div className="space-y-1.5">
                      {phones.map((phone, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 p-1.5 bg-muted/30 rounded border text-xs">
                          <span className="font-mono flex-1 truncate">{formatPhone(phone.phoneNumber)}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">{phone.phoneType}</Badge>
                          {phone.dnc === 1 && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">DNC</Badge>}
                          <button onClick={() => handleRemovePhone(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No phone numbers</p>
                  )}

                  {/* Add phone */}
                  <div className="flex gap-1.5">
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Add phone"
                      className="h-8 text-xs flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddPhone(); }}
                    />
                    <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                      <SelectTrigger className="h-8 w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Mobile", "Landline", "Work", "Home", "Other"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleAddPhone} disabled={!newPhone.trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {phoneError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{phoneError}</span>
                    </div>
                  )}
                </div>

                {/* ── Emails ── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs font-medium">Email Addresses</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{emails.length}</Badge>
                  </div>

                  {emails.length > 0 ? (
                    <div className="space-y-1.5">
                      {emails.map((email, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 p-1.5 bg-muted/30 rounded border text-xs">
                          <span className="flex-1 truncate">{email.email}</span>
                          <button onClick={() => handleRemoveEmail(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No email addresses</p>
                  )}

                  {/* Add email */}
                  <div className="flex gap-1.5">
                    <Input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Add email"
                      className="h-8 text-xs flex-1"
                      type="email"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddEmail(); }}
                    />
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleAddEmail} disabled={!newEmail.trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* ══ SECTION 3: Call History (scrollable list) ═══════════════════ */}
            <section className="border-t pt-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Call History
                {contactCommunications.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {contactCommunications.length}
                  </Badge>
                )}
              </h3>

              {contactCommunications.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No call history for this contact yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {contactCommunications.map((comm: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-muted/30 rounded-lg border space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {new Date(comm.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" "}
                            {new Date(comm.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {comm.phoneNumber && (
                            <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4">
                              {formatPhone(comm.phoneNumber)}
                            </Badge>
                          )}
                        </div>
                        {comm.disposition && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${
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
                      {comm.notes && <p className="text-xs text-foreground">{comm.notes}</p>}
                      {comm.mood && <p className="text-xs text-muted-foreground">Mood: {comm.mood}</p>}
                      {comm.agentName && <p className="text-xs text-muted-foreground">Agent: {comm.agentName}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* ── Footer: error + save/cancel ─────────────────────────────────── */}
          <div className="px-6 py-3 border-t bg-background shrink-0 space-y-2">
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateContactMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {/* Cross-Property Phone Warning */}
      <AlertDialog open={showCrossPropertyConfirm} onOpenChange={setShowCrossPropertyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Phone Already Exists in Another Property
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm space-y-3">
                <span className="block text-muted-foreground">
                  This phone number is already linked to the following propert{crossPropertyWarnings.length > 1 ? 'ies' : 'y'}:
                </span>
                <div className="space-y-2">
                  {crossPropertyWarnings.map((match, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                      <Phone className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{match.phone}</span>
                        <span className="block text-muted-foreground text-xs">
                          {match.address}
                          {match.leadId && <span className="ml-1">(Lead #{match.leadId})</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <span className="block text-muted-foreground">Do you want to proceed anyway?</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowCrossPropertyConfirm(false);
              setCrossPropertyWarnings([]);
              setPendingAction(null);
              setPendingPhoneToAdd(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCrossPropertyConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {pendingAction === 'save' ? 'Save Anyway' : 'Add Anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
