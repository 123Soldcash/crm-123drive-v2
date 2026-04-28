import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Phone, Star, Smartphone, PhoneCall, Skull, MessageSquarePlus, UserPlus, Plus, X, FileText, PhoneOff, Ban, ShieldAlert, ShieldCheck, AlertCircle, AlertTriangle, Loader2, Search, ShieldBan, GripVertical, Mail, Copy, List } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SMSChatButton } from "./SMSChatButton";
import { CallModal } from "./CallModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContactEditModal } from "./ContactEditModal";
import { ContactNotesDialog } from "./ContactNotesDialog";
import { BulkContactImport } from "./BulkContactImport";

interface CallTrackingTableProps {
  propertyId: number;
}

// Complete disposition list from user's spreadsheet
const MOOD_OPTIONS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "😡", label: "Mad" },
  { emoji: "😤", label: "Hated" },
  { emoji: "👴", label: "Senior" },
  { emoji: "🧒", label: "Kid" },
];

const NOTE_TEMPLATES = [
  "Left voicemail",
  "Will call back tomorrow",
  "Not interested",
  "Requested more information",
  "Wants to think about it",
  "Call back next week",
];

const DISPOSITION_OPTIONS = [
  "Interested - HOT LEAD",
  "Interested - WARM LEAD - Wants too Much / Full Price",
  "Interested - WARM LEAD - Not Hated",
  "Left Message - Owner Verified",
  "Left Message",
  "Beep Beep",
  "Busy",
  "Call Back",
  "Disconnected",
  "Duplicated number",
  "Fax",
  "Follow-up",
  "Hang up",
  "Has calling restrictions",
  "Investor/Buyer/Realtor Owned",
  "Irate - DNC",
  "Mail box full",
  "Mail box not set-up",
  "Not Answer",
  "Not Available",
  "Not Ringing",
  "Not Service",
  "Number repeated",
  "Player",
  "Portuguese",
  "Property does not fit our criteria",
  "Restrict",
  "See Notes",
  "Sold - DEAD",
  "Spanish",
  "Voicemail",
  "Wrong Number",
  "Wrong Person",
  "Not Interested - IHATE - DEAD",
  "Not Interested - Hang-up - FU in 4 months",
  "Not Interested - NICE - FU in 2 Months",
];

function TrestleLookupBtn({ phoneId, propertyId }: { phoneId: number; propertyId: number }) {
  const utils = trpc.useUtils();
  const lookupMutation = (trpc as any).trestleiq.lookupPhone.useMutation({
    onSuccess: (data: any) => {
      toast.success(`TrestleIQ: Score ${data.activityScore ?? 'N/A'}${data.isLitigator ? ' - LITIGATOR!' : ''}`);
      utils.communication.getContactsByProperty.invalidate({ propertyId });
    },
    onError: (error: any) => {
      toast.error(`TrestleIQ: ${error.message}`);
    },
  });

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        lookupMutation.mutate({ phoneId });
      }}
      disabled={lookupMutation.isPending}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
      title="Query TrestleIQ"
    >
      {lookupMutation.isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Search className="w-3 h-3" />
      )}
      {lookupMutation.isPending ? '...' : 'Check'}
    </button>
  );
}

// Sortable wrapper for contact rows (handles drag-and-drop per contact)
function SortableContactRow({ id, phoneIdx, phonesCount, rowBgClass, contactType, children }: {
  id: number;
  phoneIdx: number;
  phonesCount: number;
  rowBgClass: string;
  contactType?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Use inset box-shadow for left color indicator (border-l doesn't work reliably on <tr>)
  const indicatorColor = contactType === 'email' ? '#3b82f6' : '#10b981'; // blue for email, emerald for phone
  const baseStyle: React.CSSProperties = {
    boxShadow: `inset 4px 0 0 0 ${indicatorColor}`,
  };
  const style = phoneIdx === 0 ? {
    ...baseStyle,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } : baseStyle;

  return (
    <TableRow
      ref={phoneIdx === 0 ? setNodeRef : undefined}
      style={style}
      className={`border-b ${rowBgClass} ${phoneIdx === 0 ? 'border-t-2 border-t-muted' : ''}`}
    >
      {phoneIdx === 0 && (
        <TableCell rowSpan={phonesCount} className="px-1 align-middle cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground mx-auto" />
        </TableCell>
      )}
      {children}
    </TableRow>
  );
}

export function CallTrackingTable({ propertyId }: CallTrackingTableProps) {
  const utils = trpc.useUtils();
  const [selectedPhone, setSelectedPhone] = useState<{
    contactId: number;
    contactName: string;
    phoneNumber: string;
    phoneType: string;
  } | null>(null);
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState<string>("");
  const [markAsDecisionMaker, setMarkAsDecisionMaker] = useState(false);
  const [markAsOwnerVerified, setMarkAsOwnerVerified] = useState(false);
  // Property detail fields for Quick Call Log
  const [propBedBath, setPropBedBath] = useState("");
  const [propSf, setPropSf] = useState("");
  const [propRoofAge, setPropRoofAge] = useState("");
  const [propAcAge, setPropAcAge] = useState("");
  const [propOverallCondition, setPropOverallCondition] = useState("");
  const [propReasonToSell, setPropReasonToSell] = useState("");
  const [propHowFastToSell, setPropHowFastToSell] = useState("");
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);
  const [showAddTemplateDialog, setShowAddTemplateDialog] = useState(false);
  const [newTemplateText, setNewTemplateText] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [hiddenPhones, setHiddenPhones] = useState<Set<string>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showDNCDialog, setShowDNCDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<{ contactId: number; phoneNumber: string } | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState<string>("");
  const [flagFilters, setFlagFilters] = useState<{
    dnc: boolean;
    litigator: boolean;
    deceased: boolean;
    decisionMaker: boolean;
  }>({
    dnc: false,
    litigator: false,
    deceased: false,
    decisionMaker: false,
  });
  const [dateFilter, setDateFilter] = useState<string>("all"); // all, 7days, 30days
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [phoneTypeFilter, setPhoneTypeFilter] = useState<string>("all"); // all, Mobile, Landline, Other
  const [editingContact, setEditingContact] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [notesDialog, setNotesDialog] = useState<{ contactId: number; contactName: string } | null>(null);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [newContactType, setNewContactType] = useState<'phone' | 'email'>('phone');
  const [newContactName, setNewContactName] = useState("");
  const [newContactRelationship, setNewContactRelationship] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactPhoneType, setNewContactPhoneType] = useState("Mobile");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [addContactError, setAddContactError] = useState<string | null>(null);
  const [crossPropertyWarning, setCrossPropertyWarning] = useState<Array<{ phone: string; propertyId: number; leadId: number | null; address: string }> | null>(null);
  const [showCrossPropertyConfirm, setShowCrossPropertyConfirm] = useState(false);
  // Inline call state: clicking phone number starts a call directly
  const [callSelectorOpen, setCallSelectorOpen] = useState<string | null>(null); // phoneNumber that has selector open
  const [callModalOpen, setCallModalOpen] = useState(false);
  // Tab state: 'phones' or 'emails'
  const [contactTab, setContactTab] = useState<'phones' | 'emails'>('phones');
  const [callModalPhone, setCallModalPhone] = useState<{ phoneNumber: string; contactName: string; contactId: number; callerPhone: string } | null>(null);

  // DNC auto-check state
  const [dncCheckResult, setDncCheckResult] = useState<{ checked: number; flagged: number; error?: string } | null>(null);
  const [dncCheckRunning, setDncCheckRunning] = useState(false);
  const [dncCheckDone, setDncCheckDone] = useState(false);

  const { data: contacts, isLoading } = trpc.communication.getContactsByProperty.useQuery({ 
    propertyId 
  });

  // Drag-and-drop ordering state
  const [orderedContactIds, setOrderedContactIds] = useState<number[]>([]);

  // Sync orderedContactIds when contacts data loads or changes
  useEffect(() => {
    if (contacts && contacts.length > 0) {
      setOrderedContactIds(contacts.map((c: any) => c.id));
    }
  }, [contacts]);

  const reorderMutation = trpc.communication.reorderContacts.useMutation({
    onError: () => {
      // Revert on error
      if (contacts) setOrderedContactIds(contacts.map((c: any) => c.id));
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedContactIds((prev) => {
      const oldIndex = prev.indexOf(active.id as number);
      const newIndex = prev.indexOf(over.id as number);
      const newOrder = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate({ propertyId, orderedIds: newOrder });
      return newOrder;
    });
  }, [propertyId, reorderMutation]);

  const { data: customTemplates = [] } = trpc.noteTemplates.list.useQuery();

  // DNC auto-check mutation
  const checkDNCMutation = trpc.communication.checkDNCForProperty.useMutation({
    onSuccess: (result) => {
      setDncCheckResult({ checked: result.checked, flagged: result.flagged, error: result.error });
      setDncCheckRunning(false);
      setDncCheckDone(true);
      if (result.error) {
        // Don't show error toast for "not configured" — just show the banner
      } else if (result.flagged > 0) {
        toast.warning(`DNC Check: ${result.flagged} of ${result.checked} numbers flagged as DNC`);
        // Refresh contacts to show updated DNC flags
        utils.communication.getContactsByProperty.invalidate({ propertyId });
      } else if (result.checked > 0) {
        toast.success(`DNC Check: All ${result.checked} numbers are clean`);
      }
    },
    onError: (err) => {
      setDncCheckResult({ checked: 0, flagged: 0, error: err.message });
      setDncCheckRunning(false);
      setDncCheckDone(true);
    },
  });

  // Auto-run DNC check when property loads and contacts are available
  useEffect(() => {
    if (contacts && contacts.length > 0 && !dncCheckDone && !dncCheckRunning) {
      // Check if any contact has phones
      const hasPhones = contacts.some((c: any) => c.phones && c.phones.length > 0);
      if (hasPhones) {
        setDncCheckRunning(true);
        checkDNCMutation.mutate({ propertyId });
      }
    }
  }, [contacts, dncCheckDone, dncCheckRunning, propertyId]);

  // Fetch property to get primaryTwilioNumber for auto-dial
  const { data: propertyData } = trpc.properties.getById.useQuery(
    { id: propertyId },
    { enabled: !!propertyId && !isNaN(propertyId) && propertyId > 0 }
  );
  const primaryTwilioNumber = propertyData?.primaryTwilioNumber || null;
  const { user } = useAuth();
  const propertyAddress = (propertyData as any)?.addressLine1 || undefined;
  const propertyCity = (propertyData as any)?.city || undefined;
  const agentName = user?.name || undefined;

  // Fetch available Twilio numbers for the Default Caller ID selector
  const { data: twilioNumbersList = [] } = trpc.twilio.listNumbers.useQuery({ activeOnly: true });

  // Mutation to update the primary Twilio number on the property
  const updatePrimaryTwilioNumberMutation = trpc.communication.updatePrimaryTwilioNumber.useMutation({
    onSuccess: () => {
      toast.success("Default Twilio number updated");
      utils.properties.getById.invalidate({ id: propertyId });
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const addTemplateMutation = trpc.noteTemplates.add.useMutation({
    onSuccess: () => {
      toast.success("Template added");
      utils.noteTemplates.list.invalidate();
      setShowAddTemplateDialog(false);
      setNewTemplateText("");
    },
    onError: (error) => {
      toast.error(`Failed to add template: ${error.message}`);
    },
  });

  const deleteTemplateMutation = trpc.noteTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.noteTemplates.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const { data: communications } = trpc.communication.getCommunicationLog.useQuery({ 
    propertyId 
  });

  // Fetch latest call notes per contact (added during calls via CallModal)
  const { data: latestCallNotes, refetch: refetchLatestCallNotes } = trpc.callNotes.getLatestByProperty.useQuery({ propertyId });

  // Mutation for creating inline notes via callNotes table
  const createInlineNoteMutation = trpc.callNotes.create.useMutation({
    onSuccess: () => {
      refetchLatestCallNotes();
      toast.success("Note saved");
    },
    onError: (err) => toast.error(`Failed to save note: ${err.message}`),
  });

  const updateContactMutation = trpc.contacts.updateContact.useMutation({
    onSuccess: () => {
      utils.contacts.byProperty.invalidate();
      toast.success("Contact updated");
    },
  });

  const updatePropertyMutation = trpc.properties.updateProperty.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate();
      toast.success("Property updated");
    },
  });

  const logCommunicationMutation = trpc.communication.addCommunicationLog.useMutation({
    onSuccess: () => {
      toast.success("Call logged successfully");
      utils.communication.getCommunicationLog.invalidate();
      utils.properties.getById.invalidate({ id: propertyId });
      utils.callNotes.getLatestByProperty.invalidate({ propertyId });
      resetCallLogForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });

  const createContactMutation = trpc.communication.createContact.useMutation({
    onSuccess: () => {
      toast.success("Contact added successfully");
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      utils.contacts.byProperty.invalidate();
      utils.properties.getById.invalidate();
      setShowAddContactForm(false);
      setNewContactName("");
      setNewContactRelationship("");
      setNewContactPhone("");
      setNewContactPhoneType("Mobile");
      setNewContactEmail("");
      setAddContactError(null);
      // Re-run DNC check for the new contact's phones
      setDncCheckDone(false);
      setDncCheckResult(null);
    },
    onError: (error: any) => {
      const msg = error.message || "Failed to add contact";
      setAddContactError(msg);
      toast.error(msg);
    },
  });

  const doCreateContact = () => {
    if (newContactType === 'phone') {
      // Phone contact — no email
      createContactMutation.mutate({
        propertyId,
        name: newContactName.trim(),
        relationship: newContactRelationship || undefined,
        phone1: newContactPhone.trim() || undefined,
        phone1Type: newContactPhone.trim() ? newContactPhoneType : undefined,
      });
    } else {
      // Email contact — no phone
      createContactMutation.mutate({
        propertyId,
        name: newContactName.trim(),
        relationship: newContactRelationship || undefined,
        email1: newContactEmail.trim() || undefined,
      });
    }
  };

  const handleAddContact = async () => {
    setAddContactError(null);
    setCrossPropertyWarning(null);
    if (!newContactName.trim()) {
      setAddContactError("Contact name is required");
      return;
    }
    if (newContactType === 'phone') {
      // Phone contact: validate phone and check cross-property
      if (!newContactPhone.trim()) {
        setAddContactError("Phone number is required for phone contacts");
        return;
      }
      const phone = newContactPhone.trim();
      try {
        const result = await utils.communication.checkCrossPropertyPhones.fetch({
          propertyId,
          phones: [phone],
        });
        if (result.matches && result.matches.length > 0) {
          setCrossPropertyWarning(result.matches);
          setShowCrossPropertyConfirm(true);
          return;
        }
      } catch (e) {
        // If check fails, proceed anyway
      }
    } else {
      // Email contact: validate email
      if (!newContactEmail.trim()) {
        setAddContactError("Email address is required for email contacts");
        return;
      }
    }
    doCreateContact();
  };

  const updateNotesMutation = trpc.communication.updateCommunicationLog.useMutation({
    onSuccess: () => {
      toast.success("Notes updated");
      utils.communication.getCommunicationLog.invalidate({ propertyId });
      setEditingNote(null);
      setNoteValue("");
    },
    onError: (error: any) => {
      toast.error(`Failed to update notes: ${error.message}`);
    },
  });

  // Format phone number to E.164 format for Twilio
  const formatE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
    return `+1${digits}`;
  };

  // Click on phone number: start call directly (skip Log Call dialog)
  const handlePhoneCallClick = (contact: any, phone: any) => {
    if (phone.dnc || phone.isLitigator || contact.isLitigator) return; // DNC or Litigator blocked (per-phone check)
    if (primaryTwilioNumber) {
      // Auto-dial with primary number
      setCallModalPhone({
        phoneNumber: formatE164(phone.phoneNumber),
        contactName: contact.name || "Unknown",
        contactId: contact.id,
        callerPhone: primaryTwilioNumber,
      });
      setCallModalOpen(true);
    } else {
      // Show number selector popover
      setCallSelectorOpen(phone.phoneNumber);
    }
  };

  // When a Twilio number is selected from the popover
  const handleSelectTwilioNumber = (contact: any, phone: any, twilioNumber: string) => {
    setCallSelectorOpen(null);
    setCallModalPhone({
      phoneNumber: formatE164(phone.phoneNumber),
      contactName: contact.name || "Unknown",
      contactId: contact.id,
      callerPhone: twilioNumber,
    });
    setCallModalOpen(true);
  };

  const handleQuickDisposition = (contactId: number, phoneNumber: string, disposition: string) => {
    // Map quick dispositions to valid callResult values
    const callResultMap: Record<string, any> = {
      "Answered": "Left Message",
      "Voicemail": "Voicemail",
      "No Answer": "Not Answer",
      "Busy": "Busy",
    };
    
    logCommunicationMutation.mutate({
      propertyId,
      contactId,
      communicationType: "Phone",
      callResult: callResultMap[disposition],
      direction: "Outbound",
      twilioNumber: primaryTwilioNumber || undefined,
      contactPhoneNumber: phoneNumber,
      notes: "",
    });
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const allContactIds = new Set(contacts?.map(c => c.id) || []);
      setSelectedContacts(allContactIds);
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleSelectContact = (contactId: number, checked: boolean) => {
    const newSelected = new Set(selectedContacts);
    if (checked) {
      newSelected.add(contactId);
    } else {
      newSelected.delete(contactId);
      setSelectAll(false);
    }
    setSelectedContacts(newSelected);
  };

  const [showDNCGeralDialog, setShowDNCGeralDialog] = useState(false);
  const [showUnmarkDNCGeralDialog, setShowUnmarkDNCGeralDialog] = useState(false);
  const [dncDeadReason, setDncDeadReason] = useState("");
  const [dncDeadReasonError, setDncDeadReasonError] = useState("");
  const [dncDeadCategory, setDncDeadCategory] = useState("");
  const [dncDeadCategoryError, setDncDeadCategoryError] = useState("");

  const DNC_DEAD_REASON_OPTIONS = [
    { value: "SOLD_COMPANY", label: "Sold to another company", note: "(Note: Potential for us to reach out as a new buyer)" },
    { value: "SOLD_PERSON", label: "Sold to a Person" },
    { value: "SOLD_NO_INFO", label: "Sold \u2014 No information is available" },
    { value: "GHOST_SELLER", label: "Ghost Seller", note: "(After 24 attempts, the seller can no longer be reached)" },
    { value: "TITLE_ISSUES", label: "Title Issues", note: "(Problems with the title/legal ownership)" },
    { value: "PROPERTY_CONDITION", label: "Property Condition", note: "The house is in worse shape than expected, or the repair costs make the deal unfeasible" },
    { value: "REFINANCED", label: "Refinanced", note: "The owner found a way to keep the property by restructuring their debt" },
    { value: "DUPLICATE_LEAD", label: "Duplicate Lead", note: "The lead was already in the system under a different name or number" },
    { value: "WRONG_INFO", label: "Wrong Person/Number/Fraud", note: "The contact information was incorrect" },
    { value: "NO_BUYER", label: "Unable to Assign / No Buyer Found" },
    { value: "OTHER", label: "Other (Notes)" },
  ];

  // Check if ALL phones across ALL contacts are DNC (for DNC Geral toggle)
  // Uses phone-level dnc flag, not contact-level, since DNC is now per-phone
  const allContactsDNC = contacts && contacts.length > 0 && contacts.every((c: any) => 
    c.phones && c.phones.length > 0 && c.phones.every((p: any) => !!p.dnc)
  );

  const togglePhoneDNCMutation = trpc.communication.togglePhoneDNC.useMutation({
    onSuccess: () => {
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      toast.success("Phone DNC status updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update DNC: ${error.message}`);
    },
  });

  const createDncNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
    },
  });

  const markPropertyDNCMutation = trpc.communication.markPropertyDNC.useMutation({
    onSuccess: () => {
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      utils.properties.getById.invalidate({ id: propertyId });
      // Auto-create note with DNC reason
      {
        const catLabel = DNC_DEAD_REASON_OPTIONS.find(o => o.value === dncDeadCategory)?.label || dncDeadCategory;
        const catNote = DNC_DEAD_REASON_OPTIONS.find(o => o.value === dncDeadCategory)?.note || "";
        const noteContent = `💀 Lead Marked as DEAD (DNC)\nCategory: ${catLabel}${catNote ? " " + catNote : ""}${dncDeadReason.trim() ? "\nDetails: " + dncDeadReason.trim() : ""}`;
        createDncNote.mutate({ propertyId, content: noteContent, noteType: "general" });
      }
      toast.success("All contacts marked as DNC. Property marked as Dead.");
      setDncDeadReason("");
    },
    onError: (error: any) => {
      toast.error(`Failed to mark property DNC: ${error.message}`);
    },
  });

  const unmarkPropertyDNCMutation = trpc.communication.unmarkPropertyDNC.useMutation({
    onSuccess: () => {
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("All contacts DNC removed. Property set to Active.");
    },
    onError: (error: any) => {
      toast.error(`Failed to unmark property DNC: ${error.message}`);
    },
  });

  const bulkMarkDNCMutation = trpc.communication.bulkMarkDNC.useMutation({
    onSuccess: () => {
      toast.success(`Marked ${selectedContacts.size} contacts as DNC`);
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      setSelectedContacts(new Set());
      setSelectAll(false);
    },
    onError: (error) => {
      toast.error(`Failed to mark contacts as DNC: ${error.message}`);
    },
  });

  const bulkDeleteMutation = trpc.communication.bulkDeleteContacts.useMutation({
    onSuccess: () => {
      toast.success(`Deleted ${selectedContacts.size} contacts`);
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      setSelectedContacts(new Set());
      setSelectAll(false);
    },
    onError: (error) => {
      toast.error(`Failed to delete contacts: ${error.message}`);
    },
  });

  const handleBulkMarkDNC = () => {
    if (selectedContacts.size === 0) {
      toast.error("Please select contacts first");
      return;
    }
    setShowDNCDialog(true);
  };

  const confirmBulkMarkDNC = () => {
    bulkMarkDNCMutation.mutate({ contactIds: Array.from(selectedContacts) });
    setShowDNCDialog(false);
  };

  const handleBulkDelete = () => {
    if (selectedContacts.size === 0) {
      toast.error("Please select contacts first");
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate({ contactIds: Array.from(selectedContacts) });
    setShowDeleteDialog(false);
  };

  const handleLogCall = () => {
    if (!selectedPhone || !disposition) {
      toast.error("Please select a disposition");
      return;
    }

    // Build property details JSON
    const propertyDetails: Record<string, string> = {};
    if (propBedBath) propertyDetails.bedBath = propBedBath;
    if (propSf) propertyDetails.sf = propSf;
    if (propRoofAge) propertyDetails.roofAge = propRoofAge;
    if (propAcAge) propertyDetails.acAge = propAcAge;
    if (propOverallCondition) propertyDetails.overallCondition = propOverallCondition;
    if (propReasonToSell) propertyDetails.reasonToSell = propReasonToSell;
    if (propHowFastToSell) propertyDetails.howFastToSell = propHowFastToSell;

    // Format notes
    const notesText = notes ? ` - ${notes}` : "";
    
    logCommunicationMutation.mutate({
      propertyId,
      contactId: selectedPhone.contactId,
      communicationType: "Phone",
      callResult: disposition as any,
      direction: "Outbound",
      mood: mood || undefined,
      disposition: disposition,
      propertyDetails: Object.keys(propertyDetails).length > 0 ? JSON.stringify(propertyDetails) : undefined,
      twilioNumber: primaryTwilioNumber || undefined,
      contactPhoneNumber: selectedPhone.phoneNumber,
      notes: `Called ${selectedPhone.phoneNumber} (${selectedPhone.phoneType})${notesText}`,
      nextStep: "",
    });

    // Update Decision Maker flag if checked
    if (markAsDecisionMaker) {
      updateContactMutation.mutate({
        id: selectedPhone.contactId,
        isDecisionMaker: 1,
      });
    }

    // Update Owner Verified flag if checked
    if (markAsOwnerVerified) {
      updatePropertyMutation.mutate({
        id: propertyId,
        ownerVerified: 1,
      });
    }
  };

  // Reset all form fields when dialog closes
  const resetCallLogForm = () => {
    setSelectedPhone(null);
    setDisposition("");
    setNotes("");
    setMood("");
    setMarkAsDecisionMaker(false);
    setMarkAsOwnerVerified(false);
    setPropBedBath("");
    setPropSf("");
    setPropRoofAge("");
    setPropAcAge("");
    setPropOverallCondition("");
    setPropReasonToSell("");
    setPropHowFastToSell("");
    setShowPropertyDetails(false);
  };

  // Get last communication for a phone number
  // Normalize phone to last 10 digits for consistent comparison
  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  // Match communications by contactPhoneNumber field (primary) or fallback to notes-based matching for old logs
  const matchPhoneCalls = (contactId: number, phoneNumber: string) => {
    if (!communications) return [];
    const normalizedInput = normalizePhone(phoneNumber);
    return communications.filter(
      (c: any) => 
        c.contactId === contactId && 
        c.communicationType === "Phone" &&
        (normalizePhone(c.contactPhoneNumber || "") === normalizedInput || (!c.contactPhoneNumber && c.notes?.includes(phoneNumber)))
    );
  };

  const getLastDisposition = (contactId: number, phoneNumber: string) => {
    const phoneCalls = matchPhoneCalls(contactId, phoneNumber);
    return phoneCalls.length > 0 ? phoneCalls[0].callResult : null;
  };

  // Count call attempts for a phone number
  const getCallAttempts = (contactId: number, phoneNumber: string) => {
    return matchPhoneCalls(contactId, phoneNumber).length;
  };

  // Get last communication notes for a phone number with date, disposition, and note text
  // Also checks callNotes table (notes added during calls via CallModal) and returns whichever is more recent
  const getLastNotes = (contactId: number, phoneNumber: string) => {
    const phoneCalls = matchPhoneCalls(contactId, phoneNumber);
    
    // Get latest from communicationLog — includes disposition + notes
    let commDate: Date | null = null;
    let commText: string | null = null;
    let commDisposition: string | null = null;
    let commAgent: string = 'Agent';
    if (phoneCalls.length > 0) {
      const lastCall = phoneCalls[0];
      const rawNotes = lastCall.notes || "";
      // Extract notes after " - " if it exists (format: "Called +1234 (Mobile) - actual notes")
      const dashIndex = rawNotes.indexOf(" - ");
      const noteText = dashIndex !== -1 ? rawNotes.substring(dashIndex + 3).trim() : rawNotes;
      commDate = new Date(lastCall.createdAt);
      commText = noteText || null;
      commDisposition = lastCall.disposition || null;
      commAgent = lastCall.userName || 'Agent';
    }

    // Get latest from callNotes table (notes typed during CallModal)
    let callNoteDate: Date | null = null;
    let callNoteText: string | null = null;
    if (latestCallNotes && latestCallNotes[contactId]) {
      const cn = latestCallNotes[contactId];
      callNoteDate = new Date(cn.createdAt);
      callNoteText = cn.content;
    }

    // Pick whichever is more recent
    let finalDate: Date | null = null;
    let finalText: string | null = null;
    let finalDisposition: string | null = null;
    let finalAgent: string = 'Agent';

    if (callNoteDate && callNoteText && (!commDate || callNoteDate >= commDate)) {
      finalDate = callNoteDate;
      finalText = callNoteText;
      finalDisposition = commDisposition; // disposition still comes from communicationLog
      finalAgent = commAgent || 'Agent';
    } else if (commDate) {
      finalDate = commDate;
      finalText = commText;
      finalDisposition = commDisposition;
      finalAgent = commAgent;
    }

    if (!finalDate) return null;

    const formattedDate = finalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Build summary: "Dec 24 - Agent: [Disposition] Note text"
    const parts: string[] = [`${formattedDate} - ${finalAgent}:`];
    if (finalDisposition) parts.push(`[${finalDisposition}]`);
    if (finalText) parts.push(finalText);
    
    return parts.length > 1 ? parts.join(' ') : null;
  };

  // Get last communication log for a phone number
  const getLastCommunicationLog = (contactId: number, phoneNumber: string) => {
    const phoneCalls = matchPhoneCalls(contactId, phoneNumber);
    return phoneCalls.length > 0 ? phoneCalls[0] : null;
  };

  // Handle inline note editing
  const handleNoteClick = (contactId: number, phoneNumber: string) => {
    const currentNotes = getLastNotes(contactId, phoneNumber) || "";
    setEditingNote({ contactId, phoneNumber });
    setNoteValue(currentNotes);
  };

    const handleNoteSave = (contactId: number, phoneNumber: string) => {
    if (!noteValue.trim()) {
      setEditingNote(null);
      return;
    }
    // Always create a callNote entry (unified notes system)
    createInlineNoteMutation.mutate({
      contactId,
      propertyId,
      content: noteValue.trim(),
    });
    setEditingNote(null);
    setNoteValue("");
  };

  // Filter contacts based on disposition, flags, date, agent, and phone type
  // Build ordered contacts list based on drag-and-drop order
  const orderedContacts = useMemo(() => {
    if (!contacts || orderedContactIds.length === 0) return contacts || [];
    const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
    const ordered = orderedContactIds.map(id => contactMap.get(id)).filter(Boolean);
    // Add any contacts not in orderedContactIds at the end
    const missing = contacts.filter((c: any) => !orderedContactIds.includes(c.id));
    return [...ordered, ...missing];
  }, [contacts, orderedContactIds]);

  const filteredContacts = orderedContacts?.filter((contact: any) => {
    // Flag filters
    // DNC filter: show contact if ANY of its phones is marked DNC
    if (flagFilters.dnc && !contact.phones?.some((p: any) => !!p.dnc)) return false;
    if (flagFilters.litigator && !contact.isLitigator) return false;
    if (flagFilters.deceased && !contact.deceased) return false;
    if (flagFilters.decisionMaker && !contact.isDecisionMaker) return false;

    // Phone type filter - check if any phone matches the type
    if (phoneTypeFilter && phoneTypeFilter !== "all") {
      const hasMatchingPhoneType = contact.phones?.some((phone: any) => phone.phoneType === phoneTypeFilter);
      if (!hasMatchingPhoneType) return false;
    }

    // Disposition filter - check if any phone has matching disposition
    if (dispositionFilter && dispositionFilter !== "all") {
      const hasMatchingDisposition = contact.phones?.some((phone: any) => {
        const disposition = getLastDisposition(contact.id, phone.phoneNumber);
        return disposition === dispositionFilter;
      });
      if (!hasMatchingDisposition) return false;
    }

    // Date filter - check if any communication log matches the date range
    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      const cutoffDate = new Date();
      if (dateFilter === "7days") {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (dateFilter === "30days") {
        cutoffDate.setDate(now.getDate() - 30);
      }
      
      const hasRecentCommunication = contact.phones?.some((phone: any) => {
        const logs = communications?.filter((log: any) => 
          log.contactId === contact.id && log.phoneNumber === phone.phoneNumber
        ) || [];
        return logs.some((log: any) => new Date(log.createdAt) >= cutoffDate);
      });
      if (!hasRecentCommunication) return false;
    }

    // Agent filter - check if any communication log matches the agent
    if (agentFilter && agentFilter !== "all") {
      const hasAgentCommunication = contact.phones?.some((phone: any) => {
        const logs = communications?.filter((log: any) => 
          log.contactId === contact.id && log.phoneNumber === phone.phoneNumber
        ) || [];
        return logs.some((log: any) => log.agentName === agentFilter);
      });
      if (!hasAgentCommunication) return false;
    }

    return true;
  });

  // Split contacts by type for tabs, sorted: contacts with data first
  const phoneContacts = useMemo(() => {
    const filtered = filteredContacts?.filter((c: any) => c.contactType === 'phone' || (!c.contactType && c.phones && c.phones.length > 0)) || [];
    return [...filtered].sort((a: any, b: any) => {
      // Decision makers always come first
      const aDM = a.isDecisionMaker ? 1 : 0;
      const bDM = b.isDecisionMaker ? 1 : 0;
      if (aDM !== bDM) return bDM - aDM;
      // Then contacts with phone data
      const aHasPhone = a.phoneNumber || (a.phones && a.phones.length > 0 && a.phones[0].phoneNumber);
      const bHasPhone = b.phoneNumber || (b.phones && b.phones.length > 0 && b.phones[0].phoneNumber);
      if (aHasPhone && !bHasPhone) return -1;
      if (!aHasPhone && bHasPhone) return 1;
      return 0;
    });
  }, [filteredContacts]);

  const emailContacts = useMemo(() => {
    const filtered = filteredContacts?.filter((c: any) => c.contactType === 'email') || [];
    return [...filtered].sort((a: any, b: any) => {
      // Decision makers always come first
      const aDM = a.isDecisionMaker ? 1 : 0;
      const bDM = b.isDecisionMaker ? 1 : 0;
      if (aDM !== bDM) return bDM - aDM;
      // Then contacts with email data
      const aHasEmail = a.email || (a.emails && a.emails.length > 0 && a.emails[0].email);
      const bHasEmail = b.email || (b.emails && b.emails.length > 0 && b.emails[0].email);
      if (aHasEmail && !bHasEmail) return -1;
      if (!aHasEmail && bHasEmail) return 1;
      return 0;
    });
  }, [filteredContacts]);

  // Counts for tab badges (use unfiltered ordered contacts for total counts)
  const totalPhoneContacts = useMemo(() => 
    orderedContacts?.filter((c: any) => c.contactType === 'phone' || (!c.contactType && c.phones && c.phones.length > 0)).length || 0,
    [orderedContacts]
  );
  const totalEmailContacts = useMemo(() => 
    orderedContacts?.filter((c: any) => c.contactType === 'email').length || 0,
    [orderedContacts]
  );

  const activeTabContacts = contactTab === 'phones' ? phoneContacts : emailContacts;

  const hasActiveFilters = dispositionFilter || Object.values(flagFilters).some(v => v) || dateFilter !== "all" || agentFilter !== "all" || phoneTypeFilter !== "all";
  const activeFilterCount = (dispositionFilter ? 1 : 0) + Object.values(flagFilters).filter(v => v).length + (dateFilter !== "all" ? 1 : 0) + (agentFilter !== "all" ? 1 : 0) + (phoneTypeFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setDispositionFilter("");
    setFlagFilters({
      dnc: false,
      litigator: false,
      deceased: false,
      decisionMaker: false,
    });
    setDateFilter("all");
    setAgentFilter("all");
    setPhoneTypeFilter("all");
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading contacts...</div>;
  }

  if (!contacts || contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contacts
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={showAddContactForm ? "secondary" : "outline"}
                size="sm"
                onClick={() => { setShowAddContactForm(!showAddContactForm); setShowBulkImportDialog(false); setAddContactError(null); }}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add Contact
              </Button>
              <Button
                variant={showBulkImportDialog ? "secondary" : "outline"}
                size="sm"
                onClick={() => { setShowBulkImportDialog(!showBulkImportDialog); setShowAddContactForm(false); }}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                Add Contact List
              </Button>
            </div>
          </div>

          {/* Add Contact Form (inline, at top) */}
          {showAddContactForm && (
            <div className="mt-3 bg-muted/30 border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  New Contact
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setShowAddContactForm(false);
                    setNewContactName("");
                    setNewContactRelationship("");
                    setNewContactPhone("");
                    setNewContactPhoneType("Mobile");
                    setNewContactEmail("");
                    setAddContactError(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Type toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Type:</span>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setNewContactType('phone')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      newContactType === 'phone'
                        ? 'bg-emerald-100 text-emerald-800 border-r'
                        : 'bg-background text-muted-foreground hover:bg-muted border-r'
                    }`}
                  >
                    <Phone className="h-3 w-3" />
                    Phone Number
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewContactType('email')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      newContactType === 'email'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    placeholder="Contact name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddContact(); }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relationship</Label>
                  <Select value={newContactRelationship} onValueChange={setNewContactRelationship}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Relative">Relative</SelectItem>
                      <SelectItem value="Tenant">Tenant</SelectItem>
                      <SelectItem value="Neighbor">Neighbor</SelectItem>
                      <SelectItem value="Attorney">Attorney</SelectItem>
                      <SelectItem value="Personal Representative">Personal Representative</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newContactType === 'phone' ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="(555) 123-4567"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddContact(); }}
                        className="flex-1"
                      />
                      <Select value={newContactPhoneType} onValueChange={setNewContactPhoneType}>
                        <SelectTrigger className="w-[110px]">
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
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Email Address *</Label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddContact(); }}
                    />
                  </div>
                )}
              </div>
              {addContactError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{addContactError}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleAddContact}
                  disabled={!newContactName.trim() || createContactMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {createContactMutation.isPending ? "Adding..." : (newContactType === 'phone' ? "Add Phone Contact" : "Add Email Contact")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddContactForm(false);
                    setNewContactName("");
                    setNewContactRelationship("");
                    setNewContactPhone("");
                    setNewContactPhoneType("Mobile");
                    setNewContactEmail("");
                    setAddContactError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Import Dialog */}
          <BulkContactImport
            propertyId={propertyId}
            contactTab="universal"
            open={showBulkImportDialog}
            onOpenChange={(isOpen) => setShowBulkImportDialog(isOpen)}
            onSuccess={() => { setDncCheckDone(false); setDncCheckResult(null); setShowBulkImportDialog(false); }}
          />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No contacts available. Click "Add Contact" to add a phone or email contact, or "Add Contact List" to bulk import.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contacts
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={showAddContactForm ? "secondary" : "outline"}
                size="sm"
                onClick={() => { setShowAddContactForm(!showAddContactForm); setShowBulkImportDialog(false); setAddContactError(null); }}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add Contact
              </Button>
              <Button
                variant={showBulkImportDialog ? "secondary" : "outline"}
                size="sm"
                onClick={() => { setShowBulkImportDialog(!showBulkImportDialog); setShowAddContactForm(false); }}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                Add Contact List
              </Button>
            </div>
          </div>

          {/* Add Contact Form (inline, at top) */}
          {showAddContactForm && (
            <div className="mt-3 bg-muted/30 border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  New Contact
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setShowAddContactForm(false);
                    setNewContactName("");
                    setNewContactRelationship("");
                    setNewContactPhone("");
                    setNewContactPhoneType("Mobile");
                    setNewContactEmail("");
                    setAddContactError(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Type toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Type:</span>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setNewContactType('phone')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      newContactType === 'phone'
                        ? 'bg-emerald-100 text-emerald-800 border-r'
                        : 'bg-background text-muted-foreground hover:bg-muted border-r'
                    }`}
                  >
                    <Phone className="h-3 w-3" />
                    Phone Number
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewContactType('email')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      newContactType === 'email'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    placeholder="Contact name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddContact(); }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relationship</Label>
                  <Select value={newContactRelationship} onValueChange={setNewContactRelationship}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Relative">Relative</SelectItem>
                      <SelectItem value="Tenant">Tenant</SelectItem>
                      <SelectItem value="Neighbor">Neighbor</SelectItem>
                      <SelectItem value="Attorney">Attorney</SelectItem>
                      <SelectItem value="Personal Representative">Personal Representative</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newContactType === 'phone' ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="(555) 123-4567"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddContact(); }}
                        className="flex-1"
                      />
                      <Select value={newContactPhoneType} onValueChange={setNewContactPhoneType}>
                        <SelectTrigger className="w-[110px]">
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
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Email Address *</Label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddContact(); }}
                    />
                  </div>
                )}
              </div>
              {addContactError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{addContactError}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleAddContact}
                  disabled={!newContactName.trim() || createContactMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {createContactMutation.isPending ? "Adding..." : (newContactType === 'phone' ? "Add Phone Contact" : "Add Email Contact")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddContactForm(false);
                    setNewContactName("");
                    setNewContactRelationship("");
                    setNewContactPhone("");
                    setNewContactPhoneType("Mobile");
                    setNewContactEmail("");
                    setAddContactError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Import Dialog */}
          <BulkContactImport
            propertyId={propertyId}
            contactTab="universal"
            open={showBulkImportDialog}
            onOpenChange={(isOpen) => setShowBulkImportDialog(isOpen)}
            onSuccess={() => { setDncCheckDone(false); setDncCheckResult(null); setShowBulkImportDialog(false); }}
          />

          {/* Phone Numbers / Emails Tabs */}
          <div className="flex items-center gap-1 mt-3 border-b">
            <button
              onClick={() => setContactTab('phones')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                contactTab === 'phones'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Phone className="h-4 w-4" />
              Phone Numbers
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {totalPhoneContacts}
              </Badge>
            </button>
            <button
              onClick={() => setContactTab('emails')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                contactTab === 'emails'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Mail className="h-4 w-4" />
              Emails
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {totalEmailContacts}
              </Badge>
            </button>
          </div>

          {contactTab === 'phones' && (
          <>
          {/* Default Caller ID Selector - Property Level (only on phone tab) */}
          <div className="mt-3 p-3 rounded-lg border bg-blue-50/50 border-blue-200">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-blue-800">Default Caller ID</span>
                {primaryTwilioNumber && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                    {formatPhone(primaryTwilioNumber)}
                  </Badge>
                )}
                {!primaryTwilioNumber && (
                  <span className="text-xs text-muted-foreground">(not set — will be auto-set on first inbound call)</span>
                )}
              </div>
              <Select
                value={primaryTwilioNumber || "_none"}
                onValueChange={(value) => {
                  updatePrimaryTwilioNumberMutation.mutate({
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
                  {(twilioNumbersList as any[]).map((num: any) => (
                    <SelectItem key={num.id} value={num.phoneNumber}>
                      {num.label} {formatPhone(num.phoneNumber)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              When set, clicking the call button will use this number automatically instead of showing the number selector.
            </p>
          </div>


          
          {/* Filters */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Disposition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dispositions</SelectItem>
                <SelectItem value="Interested - HOT LEAD">HOT LEAD</SelectItem>
                <SelectItem value="Interested - WARM LEAD - Wants too Much / Full Price">WARM - Full Price</SelectItem>
                <SelectItem value="Interested - WARM LEAD - Not Hated">WARM - Not Hated</SelectItem>
                <SelectItem value="Left Message">Left Message</SelectItem>
                <SelectItem value="Voicemail">Voicemail</SelectItem>
                <SelectItem value="Not Answer">No Answer</SelectItem>
                <SelectItem value="Busy">Busy</SelectItem>
                <SelectItem value="Disconnected">Disconnected</SelectItem>
                <SelectItem value="Wrong Number">Wrong Number</SelectItem>
                <SelectItem value="Not Interested - IHATE - DEAD">Not Interested - IHATE - DEAD</SelectItem>
                <SelectItem value="Not Interested - Hang-up - FU in 4 months">Not Interested - Hang-up - FU 4m</SelectItem>
                <SelectItem value="Not Interested - NICE - FU in 2 Months">Not Interested - NICE - FU 2m</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={phoneTypeFilter} onValueChange={setPhoneTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Phone Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Mobile">Mobile</SelectItem>
                <SelectItem value="Landline">Landline</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            {communications && (() => {
              const uniqueAgents = Array.from(new Set(communications.map((log: any) => log.agentName).filter(Boolean)));
              return uniqueAgents.length > 0 ? (
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {uniqueAgents.map((agent: string) => (
                      <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null;
            })()}

            {/* DNC Geral Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={allContactsDNC ? "default" : "outline"}
                    size="sm"
                    className={allContactsDNC 
                      ? "bg-red-600 hover:bg-red-700 text-white border-red-600 gap-1.5" 
                      : "border-red-300 text-red-600 hover:bg-red-50 gap-1.5"}
                    onClick={() => {
                      if (allContactsDNC) {
                        setShowUnmarkDNCGeralDialog(true);
                      } else {
                        setShowDNCGeralDialog(true);
                      }
                    }}
                  >
                    {allContactsDNC ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    DNC General {allContactsDNC ? "(ON)" : "(OFF)"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {allContactsDNC 
                    ? "Click to remove DNC from all contacts and set property to ACTIVE" 
                    : "Click to mark ALL contacts as DNC and archive this property"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>



            {hasActiveFilters && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {phoneContacts?.length || 0} result{(phoneContacts?.length || 0) !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          </>
          )}

          <div className="flex items-center justify-end mt-4">
            <div className="flex items-center gap-2">
              {selectedContacts.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedContacts.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMarkDNC}
                  >
                    Mark as DNC
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    Delete
                  </Button>
                </div>
              )}
              {hiddenPhones.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHiddenPhones(new Set());
                    toast.success("All phones shown");
                  }}
                >
                  Show Hidden ({hiddenPhones.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* ===== PHONE TAB TABLE ===== */}
          {contactTab === 'phones' && (
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedContactIds} strategy={verticalListSortingStrategy}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28px] px-1" title="Drag to reorder"><GripVertical className="h-3.5 w-3.5 text-muted-foreground mx-auto" /></TableHead>
                  <TableHead className="w-[50px] text-center">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all contacts"
                    />
                  </TableHead>
                  <TableHead className="w-[150px]">Contact Name</TableHead>
                  <TableHead className="w-[120px]">Contact Relationship</TableHead>


                  <TableHead className="w-[130px]">Phone Number</TableHead>
                  <TableHead className="w-[70px] text-center">DNC</TableHead>
                  <TableHead className="w-[60px] text-center">Attempts</TableHead>
                  <TableHead className="w-[180px]">Disposition</TableHead>
                  <TableHead className="min-w-[300px]">Notes</TableHead>
                  <TableHead className="w-[80px] text-center">Score</TableHead>
                  <TableHead className="w-[100px] text-center">TrestleIQ</TableHead>
                  <TableHead className="w-[80px] text-center">Call Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneContacts?.map((contact: any) => (
                  contact.phones && contact.phones.length > 0 ? (
                    contact.phones
                      .map((phone: any, phoneIdx: number) => {
                      const attempts = getCallAttempts(contact.id, phone.phoneNumber);
                      const lastDisposition = getLastDisposition(contact.id, phone.phoneNumber);
                      
                      // Determine row background color based on flags
                      // Priority: Litigator (red) > Deceased (purple) > Decision Maker (blue) > default
                      // Phone contacts get a green left shadow indicator
                      const rowBgClass = contact.isLitigator 
                        ? "bg-red-50 hover:bg-red-100" 
                        : contact.deceased 
                        ? "bg-purple-50 hover:bg-purple-100" 
                        : contact.isDecisionMaker
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-muted/50";
                      
                      return (
                        <SortableContactRow key={`${contact.id}-${phoneIdx}`} id={contact.id} phoneIdx={phoneIdx} phonesCount={contact.phones.length} rowBgClass={rowBgClass} contactType={contact.contactType || 'phone'}>
                          {phoneIdx === 0 && (
                            <>
                              <TableCell rowSpan={contact.phones.length} className="text-center align-middle">
                                <Checkbox
                                  checked={selectedContacts.has(contact.id)}
                                  onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                                  aria-label={`Select ${contact.name}`}
                                />
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="font-medium align-middle">
                                <button
                                  onClick={() => { setEditingContact(contact); setShowEditModal(true); }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium text-left"
                                  title="Click to edit contact"
                                >
                                  {contact.name || <span className="text-muted-foreground italic">No Name</span>}
                                </button>
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="align-middle">
                                <Badge variant="outline" className="text-xs">
                                  {contact.relationship || "N/A"}
                                </Badge>
                              </TableCell>

                            </>
                          )}
                          

                          


                          {/* Phone Number */}
                          <TableCell className="align-middle">
                            <div className="flex items-center gap-1.5">
                              {/* Call & SMS buttons - disabled if phone is DNC or Litigator */}
                              {phone.dnc || phone.isLitigator || contact.isLitigator ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1.5 cursor-not-allowed">
                                        <span className="text-sm font-medium text-red-600">
                                          {hiddenPhones.has(phone.phoneNumber) ? "****" : formatPhone(phone.phoneNumber)}
                                        </span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-red-50 border-red-200 text-red-800">
                                      <div className="flex items-center gap-1.5">
                                        <ShieldAlert className="h-4 w-4" />
                                        <span>
                                          {phone.isLitigator || contact.isLitigator
                                            ? "⚖️ LITIGATOR — Calls are blocked. Remove litigator flag to enable."
                                            : "📵 DNC — Calls are blocked."}
                                        </span>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <>
                                  {/* When primaryTwilioNumber is set, click goes straight to CallModal — no popover */}
                                  {primaryTwilioNumber ? (
                                    <button
                                      onClick={() => handlePhoneCallClick(contact, phone)}
                                      className="text-sm font-medium text-green-700 hover:text-green-900 hover:underline cursor-pointer flex items-center gap-1"
                                      title={`Call ${contact.name} (using default: ${formatPhone(primaryTwilioNumber)})`}
                                    >
                                      <Phone className="h-3 w-3 text-green-600" />
                                      {hiddenPhones.has(phone.phoneNumber) ? "****" : formatPhone(phone.phoneNumber)}
                                    </button>
                                  ) : (
                                    <Popover 
                                      open={callSelectorOpen === phone.phoneNumber} 
                                      onOpenChange={(open) => setCallSelectorOpen(open ? phone.phoneNumber : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          onClick={() => handlePhoneCallClick(contact, phone)}
                                          className="text-sm font-medium text-green-700 hover:text-green-900 hover:underline cursor-pointer flex items-center gap-1"
                                          title={`Click to call ${contact.name} — select a number`}
                                        >
                                          <Phone className="h-3 w-3 text-green-600" />
                                          {hiddenPhones.has(phone.phoneNumber) ? "****" : formatPhone(phone.phoneNumber)}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 p-2" align="start">
                                        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Select caller number:</p>
                                        {(twilioNumbersList as any[]).length === 0 ? (
                                          <div className="text-center py-3 px-2">
                                            <p className="text-sm text-muted-foreground">No Twilio numbers available.</p>
                                          </div>
                                        ) : (
                                          <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                                            {(twilioNumbersList as any[]).map((num: any) => (
                                              <button
                                                key={num.id}
                                                onClick={() => handleSelectTwilioNumber(contact, phone, num.phoneNumber)}
                                                className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                                              >
                                                <Phone className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                                <div className="min-w-0">
                                                  <p className="text-sm font-medium truncate">{num.label}</p>
                                                  <p className="text-xs text-muted-foreground font-mono">{formatPhone(num.phoneNumber)}</p>
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  )}
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
                              <button
                                onClick={() => handleNoteClick(contact.id, phone.phoneNumber)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Quick note"
                              >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const newHidden = new Set(hiddenPhones);
                                  if (hiddenPhones.has(phone.phoneNumber)) {
                                    newHidden.delete(phone.phoneNumber);
                                    toast.success("Phone number shown");
                                  } else {
                                    newHidden.add(phone.phoneNumber);
                                    toast.success("Phone number hidden");
                                  }
                                  setHiddenPhones(newHidden);
                                }}
                                className={`text-xs ${
                                  hiddenPhones.has(phone.phoneNumber)
                                    ? "text-gray-600 hover:text-gray-400"
                                    : "text-gray-400 hover:text-gray-600"
                                }`}
                                title={hiddenPhones.has(phone.phoneNumber) ? "Show this phone number" : "Hide this phone number"}
                              >
                                {hiddenPhones.has(phone.phoneNumber) ? "👁️" : "👁️‍🗨️"}
                              </button>
                            </div>
                          </TableCell>

                          {/* DNC Status */}
                          <TableCell className="text-center align-middle">
                            {dncCheckRunning && !phone.dncChecked ? (
                              <div className="flex items-center justify-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                                <span className="text-[10px] font-medium text-amber-600">Checking</span>
                              </div>
                            ) : phone.dncChecked ? (
                              phone.dnc ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300 font-semibold">
                                  DNC
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-300">
                                  Clean
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          
                          {/* Attempts Counter */}
                          <TableCell className="text-center align-middle">
                            <span className="text-sm font-medium">
                              {attempts > 0 ? `${attempts}x` : "-"}
                            </span>
                          </TableCell>
                          
                          {/* Quick Disposition Buttons */}
                          <TableCell className="align-middle">
                            {lastDisposition ? (
                              <Badge 
                                variant="outline" 
                                className={`text-xs font-medium ${
                                  lastDisposition === "Left Message" ? "bg-green-100 text-green-800 border-green-300" :
                                  lastDisposition === "Voicemail" ? "bg-purple-100 text-purple-800 border-purple-300" :
                                  lastDisposition === "Not Answer" ? "bg-orange-100 text-orange-800 border-orange-300" :
                                  lastDisposition === "Busy" ? "bg-red-100 text-red-800 border-red-300" :
                                  lastDisposition === "Disconnected" ? "bg-gray-100 text-gray-800 border-gray-300" :
                                  lastDisposition.includes("HOT") ? "bg-red-100 text-red-800 border-red-300 font-semibold" :
                                  lastDisposition.includes("WARM") ? "bg-orange-100 text-orange-800 border-orange-300 font-semibold" :
                                  lastDisposition.includes("COLD") ? "bg-blue-100 text-blue-800 border-blue-300" :
                                  lastDisposition.includes("Not Interested") ? "bg-rose-100 text-rose-800 border-rose-300 font-semibold" :
                                  "bg-gray-100 text-gray-800 border-gray-300"
                                }`}
                              >
                                {lastDisposition}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Notes */}
                          <TableCell className="text-sm text-muted-foreground align-middle">
                            {editingNote?.contactId === contact.id && editingNote?.phoneNumber === phone.phoneNumber ? (
                              <input
                                type="text"
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                onBlur={() => handleNoteSave(contact.id, phone.phoneNumber)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleNoteSave(contact.id, phone.phoneNumber);
                                  } else if (e.key === "Escape") {
                                    setEditingNote(null);
                                    setNoteValue("");
                                  }
                                }}
                                autoFocus
                                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Add notes..."
                              />
                            ) : (
                              <div
                                onClick={() => handleNoteClick(contact.id, phone.phoneNumber)}
                                className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-h-[24px]"
                                title="Click to edit notes"
                              >
                                {getLastNotes(contact.id, phone.phoneNumber) || "-"}
                              </div>
                            )}
                          </TableCell>

                          {/* TrestleIQ Score */}
                          <TableCell className="text-center align-middle">
                            {phone.trestleScore != null ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-sm font-bold ${
                                  phone.trestleScore >= 70 ? 'text-green-600' :
                                  phone.trestleScore >= 30 ? 'text-amber-600' :
                                  'text-red-600'
                                }`}>
                                  {phone.trestleScore}
                                </span>
                                {phone.isLitigator && (
                                  <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-1 rounded">LIT</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* TrestleIQ Lookup Button */}
                          <TableCell className="text-center align-middle">
                            <TrestleLookupBtn phoneId={phone.id} propertyId={propertyId} />
                          </TableCell>

                          {/* Call Notes Button */}
                          <TableCell className="text-center align-middle">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setNotesDialog({ contactId: contact.id, contactName: contact.name || "Unknown" })}
                              className="h-7 w-7 p-0 hover:bg-blue-50 rounded-full"
                              title={`View call notes for ${contact.name}`}
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          </TableCell>
                        </SortableContactRow>
                      );
                    })
                  ) : (
                    <TableRow key={contact.id} style={{ boxShadow: 'inset 4px 0 0 0 #10b981' }} className={`${contact.isLitigator ? 'bg-red-50 hover:bg-red-100' : contact.deceased ? 'bg-purple-50 hover:bg-purple-100' : contact.isDecisionMaker ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-muted/50'} border-t-2 border-t-muted`}>
                      <TableCell className="text-center align-middle px-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                          aria-label={`Select ${contact.name || 'Unknown'}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium align-middle">
                        <button
                          onClick={() => { setEditingContact(contact); setShowEditModal(true); }}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium text-left"
                          title="Click to edit contact"
                        >
                          {contact.name || <span className="text-muted-foreground italic">No Name</span>}
                        </button>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="outline" className="text-xs">
                          {contact.relationship || "N/A"}
                        </Badge>
                      </TableCell>

<TableCell colSpan={5} className="text-center align-middle text-sm text-muted-foreground">
                         No phone numbers
                       </TableCell>
                      <TableCell className="text-center align-middle">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNotesDialog({ contactId: contact.id, contactName: contact.name || "Unknown" })}
                          className="h-7 w-7 p-0 hover:bg-blue-50 rounded-full"
                          title={`View call notes for ${contact.name}`}
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
            </SortableContext>
            </DndContext>
          </div>
          )}

          {/* ===== EMAIL TAB TABLE ===== */}
          {contactTab === 'emails' && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all email contacts"
                    />
                  </TableHead>
                  <TableHead className="w-[180px]">Contact Name</TableHead>
                  <TableHead className="w-[140px]">Relationship</TableHead>
                  <TableHead className="min-w-[250px]">Email Address</TableHead>
                  <TableHead className="min-w-[300px]">Notes</TableHead>
                  <TableHead className="w-[80px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Mail className="h-8 w-8 text-muted-foreground/40" />
                        <p>No email contacts found.</p>
                        <p className="text-xs">Add a contact with an email address to see it here.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  emailContacts.map((contact: any) => {
                    const emailAddress = contact.email || (contact.emails && contact.emails.length > 0 ? contact.emails[0].email : null);
                    return (
                      <TableRow key={contact.id} style={{ boxShadow: 'inset 4px 0 0 0 #3b82f6' }} className={`${contact.isLitigator ? 'bg-red-50 hover:bg-red-100' : contact.deceased ? 'bg-purple-50 hover:bg-purple-100' : contact.isDecisionMaker ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-muted/50'}`}>
                        <TableCell className="text-center align-middle">
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                            aria-label={`Select ${contact.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium align-middle">
                          <button
                            onClick={() => { setEditingContact(contact); setShowEditModal(true); }}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium text-left"
                            title="Click to edit contact"
                          >
                            {contact.name || <span className="text-muted-foreground italic">No Name</span>}
                          </button>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Badge variant="outline" className="text-xs">
                            {contact.relationship || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-middle">
                          {emailAddress ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={`mailto:${emailAddress}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                                title={`Send email to ${emailAddress}`}
                              >
                                <Mail className="h-3.5 w-3.5" />
                                {emailAddress}
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(emailAddress);
                                  toast.success("Email copied to clipboard");
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                title="Copy email"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No email</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground align-middle">
                          {editingNote?.contactId === contact.id && editingNote?.phoneNumber === (emailAddress || '') ? (
                            <input
                              type="text"
                              value={noteValue}
                              onChange={(e) => setNoteValue(e.target.value)}
                              onBlur={() => handleNoteSave(contact.id, emailAddress || '')}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleNoteSave(contact.id, emailAddress || '');
                                } else if (e.key === "Escape") {
                                  setEditingNote(null);
                                  setNoteValue("");
                                }
                              }}
                              autoFocus
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Add notes..."
                            />
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNote({ contactId: contact.id, phoneNumber: emailAddress || '' });
                                setNoteValue("");
                              }}
                              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-h-[24px]"
                              title="Click to add notes"
                            >
                              {getLastNotes(contact.id, emailAddress || '') || "-"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setNotesDialog({ contactId: contact.id, contactName: contact.name || "Unknown" })}
                              className="h-7 w-7 p-0 hover:bg-blue-50 rounded-full"
                              title={`View notes for ${contact.name}`}
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          )}


        </CardContent>
      </Card>

      {/* Quick Call Log Dialog */}
      <Dialog open={!!selectedPhone} onOpenChange={(open) => { if (!open) resetCallLogForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPhone && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">{selectedPhone.contactName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPhone(selectedPhone.phoneNumber)} ({selectedPhone.phoneType})
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Disposition *</Label>
                {/* DNC Toggle - Mark this specific phone as DNC */}
                {selectedPhone && (() => {
                  const phoneData = contacts?.flatMap((c: any) => (c.phones || []).map((p: any) => ({ ...p, contactId: c.id })))
                    ?.find((p: any) => p.phoneNumber === selectedPhone.phoneNumber);
                  const isPhoneDNC = !!phoneData?.dnc;
                  const phoneId = phoneData?.id || 0;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (phoneId) {
                          togglePhoneDNCMutation.mutate({ phoneId, dnc: !isPhoneDNC });
                        }
                      }}
                      disabled={!phoneId || togglePhoneDNCMutation.isPending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                        isPhoneDNC
                          ? "bg-red-100 border-red-500 text-red-700 hover:bg-red-200"
                          : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400"
                      }`}
                    >
                      <PhoneOff className={`h-5 w-5 ${isPhoneDNC ? "text-red-600" : "text-gray-400"}`} />
                      {isPhoneDNC ? "DNC ON" : "Mark DNC"}
                    </button>
                  );
                })()}
              </div>
              <Select value={disposition} onValueChange={setDisposition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select call result..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {DISPOSITION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mood (Optional)</Label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_OPTIONS.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    variant={mood === option.emoji ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMood(mood === option.emoji ? "" : option.emoji)}
                    className="h-10 px-3"
                  >
                    <span className="text-lg mr-1">{option.emoji}</span>
                    <span className="text-xs">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Decision Maker & Owner Verified Checkboxes */}
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="decision-maker"
                  checked={markAsDecisionMaker}
                  onCheckedChange={(checked) => setMarkAsDecisionMaker(checked as boolean)}
                />
                <Label htmlFor="decision-maker" className="text-sm font-normal cursor-pointer">
                  Mark as Decision Maker
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="owner-verified"
                  checked={markAsOwnerVerified}
                  onCheckedChange={(checked) => setMarkAsOwnerVerified(checked as boolean)}
                />
                <Label htmlFor="owner-verified" className="text-sm font-normal cursor-pointer">
                  Mark as Owner Verified
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quick Templates</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddTemplateDialog(true)}
                  className="h-7 text-xs"
                >
                  + Add Template
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Default templates */}
                {NOTE_TEMPLATES.map((template) => (
                  <Button
                    key={template}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotes(notes ? `${notes}. ${template}` : template)}
                    className="h-8 text-xs"
                  >
                    {template}
                  </Button>
                ))}
                {/* Custom templates */}
                {customTemplates.map((template) => (
                  <div key={template.id} className="relative group">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setNotes(notes ? `${notes}. ${template.templateText}` : template.templateText)}
                      className="h-8 text-xs pr-8"
                    >
                      {template.templateText}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTemplateMutation.mutate({ id: template.id })}
                      className="absolute right-0 top-0 h-8 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Property Details Section */}
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Property Details (Optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bed/Bath</Label>
                  <input
                    type="text"
                    value={propBedBath}
                    onChange={(e) => setPropBedBath(e.target.value)}
                    placeholder="e.g., 3/2"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SF</Label>
                  <input
                    type="text"
                    value={propSf}
                    onChange={(e) => setPropSf(e.target.value)}
                    placeholder="e.g., 1,500"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Roof Age</Label>
                  <input
                    type="text"
                    value={propRoofAge}
                    onChange={(e) => setPropRoofAge(e.target.value)}
                    placeholder="e.g., 5 years"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">A/C Age</Label>
                  <input
                    type="text"
                    value={propAcAge}
                    onChange={(e) => setPropAcAge(e.target.value)}
                    placeholder="e.g., 3 years"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Overall Condition</Label>
                  <select
                    value={propOverallCondition}
                    onChange={(e) => setPropOverallCondition(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason to Sell</Label>
                  <input
                    type="text"
                    value={propReasonToSell}
                    onChange={(e) => setPropReasonToSell(e.target.value)}
                    placeholder="e.g., Relocation"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">How Fast to Sell</Label>
                <select
                  value={propHowFastToSell}
                  onChange={(e) => setPropHowFastToSell(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select...</option>
                  <option value="ASAP">ASAP</option>
                  <option value="Within 3 months">Within 3 months</option>
                  <option value="Within 6 months">Within 6 months</option>
                  <option value="Within 1 year">Within 1 year</option>
                  <option value="No rush">No rush</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => resetCallLogForm()}>
                Cancel
              </Button>
              <Button onClick={handleLogCall} disabled={!disposition}>
                Save Call Log
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Mark DNC Confirmation Dialog */}
      <AlertDialog open={showDNCDialog} onOpenChange={setShowDNCDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {selectedContacts.size} Contact{selectedContacts.size > 1 ? 's' : ''} as DNC?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the selected contact{selectedContacts.size > 1 ? 's' : ''} as "Do Not Call". 
              You can still view and manage {selectedContacts.size > 1 ? 'these contacts' : 'this contact'}, but {selectedContacts.size > 1 ? 'they' : 'it'} will be flagged to prevent future outreach.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkMarkDNC}>
              Mark as DNC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.size} Contact{selectedContacts.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contact{selectedContacts.size > 1 ? 's' : ''} and all associated data (phones, emails, communication logs). 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Template Dialog */}
      <Dialog open={showAddTemplateDialog} onOpenChange={setShowAddTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Text</Label>
              <Textarea
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                placeholder="Enter your template text..."
                className="min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {newTemplateText.length}/500 characters
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddTemplateDialog(false);
                setNewTemplateText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (newTemplateText.trim()) {
                  addTemplateMutation.mutate({ templateText: newTemplateText.trim() });
                }
              }}
              disabled={!newTemplateText.trim() || addTemplateMutation.isPending}
            >
              {addTemplateMutation.isPending ? "Adding..." : "Add Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Edit Modal */}
      <ContactEditModal
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) setEditingContact(null);
        }}
        contact={editingContact}
        propertyId={propertyId}
      />

      {/* Contact Notes Dialog */}
      {notesDialog && (
        <ContactNotesDialog
          open={!!notesDialog}
          onOpenChange={(open) => {
            if (!open) setNotesDialog(null);
          }}
          contactId={notesDialog.contactId}
          contactName={notesDialog.contactName}
          propertyId={propertyId}
        />
      )}

      {/* DNC Geral - Mark All Contacts Dialog */}
      <AlertDialog open={showDNCGeralDialog} onOpenChange={setShowDNCGeralDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              Mark ALL Contacts as DNC?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm space-y-2">
                <span>This will:</span>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Block ALL phone numbers</strong> for every contact in this property</li>
                  <li><strong>Mark this property as Dead</strong> (Desk Status → DEAD)</li>
                  <li>Disable all call and SMS buttons for these contacts</li>
                </ul>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1.5">💀 Reason <span className="text-red-500">*</span></p>
                    <select
                      value={dncDeadCategory}
                      onChange={(e) => { setDncDeadCategory(e.target.value); setDncDeadCategoryError(""); }}
                      className="w-full p-2 text-sm border rounded-md bg-white dark:bg-gray-900"
                    >
                      <option value="">Select a reason...</option>
                      {DNC_DEAD_REASON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {dncDeadCategory && (() => {
                      const sel = DNC_DEAD_REASON_OPTIONS.find(o => o.value === dncDeadCategory);
                      return sel?.note ? <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">{sel.note}</p> : null;
                    })()}
                    {dncDeadCategoryError && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {dncDeadCategoryError}
                      </p>
                    )}
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">Additional Notes:</p>
                    <textarea
                      placeholder="Add any additional details or context..."
                      value={dncDeadReason}
                      onChange={(e) => { setDncDeadReason(e.target.value); setDncDeadReasonError(""); }}
                      className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-white dark:bg-gray-900"
                    />
                    {dncDeadReasonError && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {dncDeadReasonError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDncDeadReason(""); setDncDeadReasonError(""); setDncDeadCategory(""); setDncDeadCategoryError(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                let hasErr = false;
                if (!dncDeadCategory) {
                  e.preventDefault();
                  setDncDeadCategoryError("Please select a reason.");
                  hasErr = true;
                }
                if (dncDeadCategory === "OTHER" && !dncDeadReason.trim()) {
                  e.preventDefault();
                  setDncDeadReasonError("Please provide details when selecting 'Other'.");
                  hasErr = true;
                }
                if (hasErr) return;
                markPropertyDNCMutation.mutate({ propertyId });
                setShowDNCGeralDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <ShieldAlert className="h-4 w-4 mr-1" />
              Mark All as DNC & Dead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DNC Geral - Unmark All Contacts Dialog */}
      <AlertDialog open={showUnmarkDNCGeralDialog} onOpenChange={setShowUnmarkDNCGeralDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <ShieldCheck className="h-5 w-5" />
              Remove DNC from ALL Contacts?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm space-y-2">
                <span>This will:</span>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Unblock ALL phone numbers</strong> for every contact in this property</li>
                  <li><strong>Set property to ACTIVE</strong> (Desk Status → ACTIVE)</li>
                  <li>Re-enable all call and SMS buttons</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                unmarkPropertyDNCMutation.mutate({ propertyId });
                setShowUnmarkDNCGeralDialog(false);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              Remove DNC & Set Active
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cross-Property Phone Warning Dialog */}
      <AlertDialog open={showCrossPropertyConfirm} onOpenChange={setShowCrossPropertyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Phone Already Exists in Another Property
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm space-y-3">
                <span className="block text-muted-foreground">This phone number is already linked to the following propert{crossPropertyWarning && crossPropertyWarning.length > 1 ? 'ies' : 'y'}:</span>
                <div className="space-y-2">
                  {crossPropertyWarning?.map((match, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                      <Phone className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{formatPhone(match.phone)}</span>
                        <span className="block text-muted-foreground">
                          {match.address}
                          {match.leadId && <span className="text-xs ml-1">(Lead #{match.leadId})</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <span className="block text-muted-foreground">Do you want to add this contact anyway?</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowCrossPropertyConfirm(false); setCrossPropertyWarning(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCrossPropertyConfirm(false);
                setCrossPropertyWarning(null);
                doCreateContact();
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Call Modal — triggered when clicking a phone number */}
      {callModalOpen && callModalPhone && (
        <CallModal
          open={callModalOpen}
          onOpenChange={(open) => {
            setCallModalOpen(open);
            if (!open) setCallModalPhone(null);
          }}
          phoneNumber={callModalPhone.phoneNumber}
          contactName={callModalPhone.contactName}
          contactId={callModalPhone.contactId}
          propertyId={propertyId}
          callerPhone={callModalPhone.callerPhone}
        />
      )}
    </>
  );
}
