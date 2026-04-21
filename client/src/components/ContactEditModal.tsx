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
  User, Phone, Mail, Save, X, History, AlertCircle, AlertTriangle, Search, Loader2, ShieldAlert, Activity,
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

  // New model: single phone and email directly on the contact
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneType, setPhoneType] = useState("Mobile");
  const [email, setEmail] = useState("");

  // TrestleIQ data (read-only display from the contact's phone)
  const [trestleScore, setTrestleScore] = useState<number | null>(null);
  const [trestleLineType, setTrestleLineType] = useState<string | null>(null);
  const [trestleLastChecked, setTrestleLastChecked] = useState<string | null>(null);
  const [phoneIsLitigator, setPhoneIsLitigator] = useState(false);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);

  // Errors & warnings
  const [saveError, setSaveError] = useState<string | null>(null);
  const [crossPropertyWarnings, setCrossPropertyWarnings] = useState<Array<{ phone: string; propertyId: number; leadId: number | null; address: string }>>([]);
  const [showCrossPropertyConfirm, setShowCrossPropertyConfirm] = useState(false);

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

      // New model: phone/email directly on the contact
      // First check direct fields, then fall back to phones[0]/emails[0] for backward compat
      const directPhone = contact.phoneNumber || (contact.phones?.[0]?.phoneNumber) || "";
      const directPhoneType = contact.phoneType || (contact.phones?.[0]?.phoneType) || "Mobile";
      const directEmail = contact.email || (contact.emails?.[0]?.email) || "";
      setPhoneNumber(directPhone);
      setPhoneType(directPhoneType);
      setEmail(directEmail);

      // TrestleIQ data from the phone
      const phoneData = contact.phones?.[0];
      setTrestleScore(phoneData?.trestleScore ?? contact.trestleScore ?? null);
      setTrestleLineType(phoneData?.trestleLineType ?? contact.trestleLineType ?? null);
      setTrestleLastChecked(phoneData?.trestleLastChecked ?? contact.trestleLastChecked ?? null);
      setPhoneIsLitigator(!!(phoneData?.isLitigator || contact.isLitigator));
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
        // New model: direct phone/email fields
        phoneNumber: phoneNumber || undefined,
        phoneType: phoneType || undefined,
        email: email || undefined,
        contactType: phoneNumber ? "phone" : (email ? "email" : undefined),
        // Also pass legacy phones/emails for backward compat
        phones: phoneNumber ? [{ phoneNumber, phoneType: phoneType || "Mobile", isPrimary: 1, dnc: dnc ? 1 : 0 }] : [],
        emails: email ? [{ email, isPrimary: 1 }] : [],
      });
    } catch (_) { /* handled by onError */ }
  };

  const handleSave = async () => {
    if (!contact?.id) return;
    setSaveError(null);

    // Check if phone changed
    const originalPhone = contact.phoneNumber || contact.phones?.[0]?.phoneNumber || "";
    const normalizedOriginal = originalPhone.replace(/\D/g, "");
    const normalizedNew = phoneNumber.replace(/\D/g, "");

    if (phoneNumber && normalizedNew !== normalizedOriginal) {
      // New phone number — check cross-property
      try {
        const result = await utils.communication.checkCrossPropertyPhones.fetch({ propertyId, phones: [phoneNumber] });
        if (result.matches && result.matches.length > 0) {
          setCrossPropertyWarnings(result.matches);
          setShowCrossPropertyConfirm(true);
          return;
        }
      } catch (_) { /* proceed anyway */ }
    }
    await doSave();
  };

  const handleCrossPropertyConfirm = () => {
    setShowCrossPropertyConfirm(false);
    setCrossPropertyWarnings([]);
    doSave();
  };

  if (!contact) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Wider modal (max-w-5xl ≈ 64rem), tall — fixed height with internal scroll */}
        <DialogContent className="max-w-[90rem] w-[98vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <DialogHeader className="px-8 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <User className="h-6 w-6 text-primary" />
              Edit Contact: <span className="font-bold">{contact.name || "Unknown"}</span>
              {contact.contactType && (
                <Badge variant="outline" className="text-xs ml-2">
                  {contact.contactType === "phone" ? "📞 Phone Contact" : "📧 Email Contact"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* ── Scrollable body ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

            {/* ══ SECTION 1: Contact Details ══════════════════════════════════ */}
            <section>
              <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                <User className="h-4.5 w-4.5" /> Contact Details
              </h3>
              <div className="space-y-5">
                {/* Name + Relationship */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name" className="h-11 text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Relationship</Label>
                    <Select value={relationship} onValueChange={setRelationship}>
                      <SelectTrigger className="h-11 text-base">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_OPTIONS.map((rel) => (
                          <SelectItem key={rel} value={rel} className="text-base">{rel}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Age + Address */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Age</Label>
                    <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="h-11 text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Address</Label>
                    <Input value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} placeholder="Current address" className="h-11 text-base" />
                  </div>
                </div>

                {/* Flags text */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Flags / Tags</Label>
                  <Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="e.g., Likely Owner, Family, Resident" className="h-11 text-base" />
                </div>

                {/* Status Flags grid */}
                <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
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
                    <label key={label} className="flex items-center gap-2 cursor-pointer py-1">
                      <Checkbox checked={value} onCheckedChange={(v) => set(v as boolean)} className="h-5 w-5" />
                      <span className={`text-sm ${color}`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* ══ SECTION 2: Phone & Email (single fields) ═══════════════════ */}
            <section className="border-t pt-6">
              <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                <Phone className="h-4.5 w-4.5" /> Phone &amp; Email
              </h3>

              <div className="grid grid-cols-2 gap-6">
                {/* ── Phone ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Phone Number</span>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Phone number"
                      className="h-11 text-base flex-1"
                    />
                    <Select value={phoneType} onValueChange={setPhoneType}>
                      <SelectTrigger className="h-11 w-[130px] text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Mobile", "Landline", "Work", "Home", "Other"].map(t => (
                          <SelectItem key={t} value={t} className="text-base">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* TrestleIQ Score & Lookup */}
                  {phoneNumber && (
                    <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border">
                      {trestleScore != null && (
                        <div className="flex items-center gap-1">
                          <Activity className={`h-3.5 w-3.5 ${
                            trestleScore >= 70 ? 'text-green-600' :
                            trestleScore >= 30 ? 'text-amber-500' : 'text-red-500'
                          }`} />
                          <span className={`text-xs font-semibold ${
                            trestleScore >= 70 ? 'text-green-700' :
                            trestleScore >= 30 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            Score: {trestleScore}/100
                          </span>
                        </div>
                      )}
                      {trestleLineType && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{trestleLineType}</Badge>
                      )}
                      {phoneIsLitigator && (
                        <Badge className="bg-red-600 text-white text-xs px-1.5 py-0 h-5">
                          <ShieldAlert className="h-3 w-3 mr-0.5" />Litigator
                        </Badge>
                      )}
                      {trestleLastChecked && (
                        <span className="text-xs text-muted-foreground">
                          Checked: {new Date(trestleLastChecked).toLocaleDateString()}
                        </span>
                      )}
                      {/* TrestleIQ Lookup button - uses the phone from the contact's phones array if available */}
                      {contact?.phones?.[0]?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs ml-auto"
                          disabled={lookingUpPhone}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const phoneId = contact.phones[0].id;
                            if (!phoneId) return;
                            setLookingUpPhone(true);
                            try {
                              const result = await utils.client.trestleiq.lookupPhone.mutate({ phoneId });
                              setTrestleScore(result.activityScore);
                              setPhoneIsLitigator(!!result.isLitigator);
                              setTrestleLineType(result.lineType);
                              setTrestleLastChecked(new Date().toISOString());
                              if (result.isLitigator) {
                                toast.error(`⚠️ LITIGATOR RISK: ${formatPhone(phoneNumber)} — Score: ${result.activityScore}/100`);
                              } else {
                                toast.success(`TrestleIQ: Score ${result.activityScore}/100, ${result.lineType || 'Unknown'} — ${result.carrier || ''}`);
                              }
                            } catch (err: any) {
                              toast.error(`TrestleIQ error: ${err.message}`);
                            } finally {
                              setLookingUpPhone(false);
                            }
                          }}
                        >
                          {lookingUpPhone ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Search className="h-3 w-3 mr-1" />
                          )}
                          TrestleIQ
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Email ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Email Address</span>
                  </div>

                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    className="h-11 text-base"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3 italic">
                Each contact has one phone number and/or one email. To add another phone, create a new contact.
              </p>
            </section>

            {/* ══ SECTION 3: Call History (scrollable list) ═══════════════════ */}
            <section className="border-t pt-6">
              <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                <History className="h-4.5 w-4.5" />
                Call History
                {contactCommunications.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0 h-5 ml-1">
                    {contactCommunications.length}
                  </Badge>
                )}
              </h3>

              {contactCommunications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No call history for this contact yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {contactCommunications.map((comm: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-muted/30 rounded-lg border space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-muted-foreground">
                            {new Date(comm.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" "}
                            {new Date(comm.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {comm.phoneNumber && (
                            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-5">
                              {formatPhone(comm.phoneNumber)}
                            </Badge>
                          )}
                        </div>
                        {comm.disposition && (
                          <Badge
                            variant="outline"
                            className={`text-xs px-2 py-0 h-5 shrink-0 ${
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
                      {comm.notes && <p className="text-sm text-foreground">{comm.notes}</p>}
                      {comm.mood && <p className="text-sm text-muted-foreground">Mood: {comm.mood}</p>}
                      {comm.agentName && <p className="text-sm text-muted-foreground">Agent: {comm.agentName}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* ── Footer: error + save/cancel ─────────────────────────────────── */}
          <div className="px-8 py-4 border-t bg-background shrink-0 space-y-3">
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button size="lg" onClick={handleSave} disabled={updateContactMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
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
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCrossPropertyConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
