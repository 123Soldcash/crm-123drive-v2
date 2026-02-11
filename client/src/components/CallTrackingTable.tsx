import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import { Phone, Star, Smartphone, PhoneCall, Skull, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { TwilioBrowserCallButton } from "./TwilioBrowserCallButton";

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
];

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

  const { data: contacts, isLoading } = trpc.communication.getContactsByProperty.useQuery({ 
    propertyId 
  });

  const { data: customTemplates = [] } = trpc.noteTemplates.list.useQuery();
  
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
      setSelectedPhone(null);
      setDisposition("");
      setNotes("");
      setMood("");
      setMarkAsDecisionMaker(false);
      setMarkAsOwnerVerified(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });

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

  const handlePhoneClick = (contact: any, phone: any) => {
    setSelectedPhone({
      contactId: contact.id,
      contactName: contact.name,
      phoneNumber: phone.phoneNumber,
      phoneType: phone.phoneType,
    });
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

    // Format notes with mood emoji if selected
    const moodPrefix = mood ? `${mood} ` : "";
    const notesText = notes ? ` - ${moodPrefix}${notes}` : "";
    
    logCommunicationMutation.mutate({
      propertyId,
      contactId: selectedPhone.contactId,
      communicationType: "Phone",
      callResult: disposition as any,
      direction: "Outbound",
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

  // Get last communication for a phone number
  const getLastDisposition = (contactId: number, phoneNumber: string) => {
    if (!communications) return null;
    
    const phoneCalls = communications.filter(
      (c: any) => 
        c.contactId === contactId && 
        c.communicationType === "Phone" &&
        c.notes?.includes(phoneNumber)
    );
    
    return phoneCalls.length > 0 ? phoneCalls[0].callResult : null;
  };

  // Count call attempts for a phone number
  const getCallAttempts = (contactId: number, phoneNumber: string) => {
    if (!communications) return 0;
    
    return communications.filter(
      (c: any) => 
        c.contactId === contactId && 
        c.communicationType === "Phone" &&
        c.notes?.includes(phoneNumber)
    ).length;
  };

  // Get last communication notes for a phone number with date and agent
  const getLastNotes = (contactId: number, phoneNumber: string) => {
    if (!communications) return null;
    
    const phoneCalls = communications.filter(
      (c: any) => 
        c.contactId === contactId && 
        c.communicationType === "Phone" &&
        c.notes?.includes(phoneNumber)
    );
    
    if (phoneCalls.length === 0) return null;
    
    const lastCall = phoneCalls[0];
    const notes = lastCall.notes || "";
    
    // Extract notes after " - " if it exists
    const dashIndex = notes.indexOf(" - ");
    const noteText = dashIndex !== -1 ? notes.substring(dashIndex + 3).trim() : notes;
    
    if (!noteText) return null;
    
    // Format date as "Dec 24"
    const date = new Date(lastCall.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Get agent name (you'll need to fetch user data or pass it)
    // For now, using a placeholder - you may need to join with users table
    const agentName = lastCall.userName || 'Agent';
    
    return `${formattedDate} - ${agentName}: ${noteText}`;
  };

  // Get last communication log for a phone number
  const getLastCommunicationLog = (contactId: number, phoneNumber: string) => {
    if (!communications) return null;
    
    const phoneCalls = communications.filter(
      (c: any) => 
        c.contactId === contactId && 
        c.communicationType === "Phone" &&
        c.notes?.includes(phoneNumber)
    );
    
    return phoneCalls.length > 0 ? phoneCalls[0] : null;
  };

  // Handle inline note editing
  const handleNoteClick = (contactId: number, phoneNumber: string) => {
    const currentNotes = getLastNotes(contactId, phoneNumber) || "";
    setEditingNote({ contactId, phoneNumber });
    setNoteValue(currentNotes);
  };

  const handleNoteSave = (contactId: number, phoneNumber: string) => {
    const log = getLastCommunicationLog(contactId, phoneNumber);
    if (!log) {
      toast.error("No communication log found to update");
      setEditingNote(null);
      return;
    }

    // Update notes with format: "Called (phone) (type) - {new notes}"
    const phonePrefix = `Called ${phoneNumber}`;
    const newNotes = noteValue.trim() ? `${phonePrefix} - ${noteValue.trim()}` : phonePrefix;

    updateNotesMutation.mutate({
      logId: log.id,
      notes: newNotes,
    });
  };

  // Filter contacts based on disposition, flags, date, agent, and phone type
  const filteredContacts = contacts?.filter((contact: any) => {
    // Flag filters
    if (flagFilters.dnc && !contact.dnc) return false;
    if (flagFilters.litigator && !contact.litigator) return false;
    if (flagFilters.deceased && !contact.deceased) return false;
    if (flagFilters.decisionMaker && !contact.decisionMaker) return false;

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
          <CardTitle>Call Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No contacts available. Add a contact to start tracking calls.
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
              Call Tracking Sheet
            </CardTitle>
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

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox
                  checked={flagFilters.dnc}
                  onCheckedChange={(checked) => setFlagFilters(prev => ({ ...prev, dnc: !!checked }))}
                />
                <span>📵 DNC</span>
              </label>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox
                  checked={flagFilters.litigator}
                  onCheckedChange={(checked) => setFlagFilters(prev => ({ ...prev, litigator: !!checked }))}
                />
                <span>🗣 Litigator</span>
              </label>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox
                  checked={flagFilters.deceased}
                  onCheckedChange={(checked) => setFlagFilters(prev => ({ ...prev, deceased: !!checked }))}
                />
                <span>🕊 Deceased</span>
              </label>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox
                  checked={flagFilters.decisionMaker}
                  onCheckedChange={(checked) => setFlagFilters(prev => ({ ...prev, decisionMaker: !!checked }))}
                />
                <span>✍ Decision Maker</span>
              </label>
            </div>

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
                  {filteredContacts?.length || 0} result{(filteredContacts?.length || 0) !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all contacts"
                    />
                  </TableHead>
                  <TableHead className="w-[150px]">Contact Name</TableHead>
                  <TableHead className="w-[120px]">Contact Relationship</TableHead>
                  <TableHead className="w-[24px] text-center px-0">📵</TableHead>
                  <TableHead className="w-[24px] text-center px-0">🗣</TableHead>
                  <TableHead className="w-[24px] text-center px-0">🕊</TableHead>
                  <TableHead className="w-[24px] text-center px-0">✍</TableHead>
                  <TableHead className="w-[28px] text-center px-0">📱</TableHead>
                  <TableHead className="w-[28px] text-center px-0">📞</TableHead>
                  <TableHead className="w-[28px] text-center px-0">📋</TableHead>
                  <TableHead className="w-[130px]">Phone Number</TableHead>
                  <TableHead className="w-[60px] text-center">Attempts</TableHead>
                  <TableHead className="w-[180px]">Disposition</TableHead>
                  <TableHead className="min-w-[300px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts?.map((contact: any) => (
                  contact.phones && contact.phones.length > 0 ? (
                    contact.phones
                      .map((phone: any, phoneIdx: number) => {
                      const attempts = getCallAttempts(contact.id, phone.phoneNumber);
                      const lastDisposition = getLastDisposition(contact.id, phone.phoneNumber);
                      
                      // Determine row background color based on flags (priority: Litigator > DNC > Deceased)
                      const rowBgClass = contact.isLitigator 
                        ? "bg-red-50 hover:bg-red-100" 
                        : contact.dnc 
                        ? "bg-pink-50 hover:bg-pink-100" 
                        : contact.deceased 
                        ? "bg-purple-50 hover:bg-purple-100" 
                        : "hover:bg-muted/50";
                      
                      return (
                        <TableRow key={`${contact.id}-${phoneIdx}`} className={`border-b ${rowBgClass} ${phoneIdx === 0 ? 'border-t-2 border-t-muted' : ''}`}>
                          {phoneIdx === 0 && (
                            <>
                              <TableCell rowSpan={contact.phones.length} className="text-center align-top">
                                <Checkbox
                                  checked={selectedContacts.has(contact.id)}
                                  onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                                  aria-label={`Select ${contact.name}`}
                                />
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="font-medium align-top">
                                {contact.name || <span className="text-muted-foreground italic">No Name</span>}
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="align-top">
                                <Badge variant="outline" className="text-xs">
                                  {contact.relationship || "N/A"}
                                </Badge>
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="text-center align-top px-0">
                                {contact.dnc && <span className="text-pink-600 font-bold text-sm">🚫</span>}
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="text-center align-top px-0">
                                {contact.isLitigator && <span className="text-red-600 font-bold text-sm">⚖️</span>}
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="text-center align-top px-0">
                                {contact.deceased && <Skull className="h-3 w-3 text-purple-600 mx-auto" />}
                              </TableCell>
                              <TableCell rowSpan={contact.phones.length} className="text-center align-top px-0">
                                {contact.isDecisionMaker && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mx-auto" />}
                              </TableCell>
                            </>
                          )}
                          
                          {/* Phone Type Icons */}
                          <TableCell className="text-center px-0">
                            {phone.phoneType === "Mobile" && <Smartphone className="h-3 w-3 text-blue-600 mx-auto" />}
                          </TableCell>
                          <TableCell className="text-center px-0">
                            {phone.phoneType === "Landline" && <PhoneCall className="h-3 w-3 text-green-600 mx-auto" />}
                          </TableCell>
                          <TableCell className="text-center px-0">
                            {!["Mobile", "Landline"].includes(phone.phoneType) && <span className="text-gray-600 text-xs">📞</span>}
                          </TableCell>
                          
                          {/* Phone Number */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TwilioBrowserCallButton
                                phoneNumber={phone.phoneNumber}
                                propertyId={propertyId}
                                contactId={contact.id}
                                contactName={contact.name}
                              />
                              <button
                                onClick={() => handlePhoneClick(contact, phone)}
                                className="text-sm text-blue-600 hover:underline font-medium"
                              >
                                {hiddenPhones.has(phone.phoneNumber) ? "****" : phone.phoneNumber}
                              </button>
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
                          
                          {/* Attempts Counter */}
                          <TableCell className="text-center">
                            <span className="text-sm font-medium">
                              {attempts > 0 ? `${attempts}x` : "-"}
                            </span>
                          </TableCell>
                          
                          {/* Quick Disposition Buttons */}
                          <TableCell>
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
                          <TableCell className="text-sm text-muted-foreground">
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
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow key={contact.id} className="hover:bg-muted/50 border-t-2 border-t-muted">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                          aria-label={`Select ${contact.name || 'Unknown'}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{contact.name || <span className="text-muted-foreground italic">No Name</span>}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {contact.relationship || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-0">
                        {contact.dnc ? <span className="text-pink-600 font-bold text-sm">🚫</span> : null}
                      </TableCell>
                      <TableCell className="text-center px-0">
                        {contact.isLitigator ? <span className="text-red-600 font-bold text-sm">⚖️</span> : null}
                      </TableCell>
                      <TableCell className="text-center px-0">
                        {contact.deceased ? <Skull className="h-3 w-3 text-purple-600 mx-auto" /> : null}
                      </TableCell>
                      <TableCell className="text-center px-0">
                        {contact.isDecisionMaker ? <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mx-auto" /> : null}
                      </TableCell>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        No phone numbers
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Call Log Dialog */}
      <Dialog open={!!selectedPhone} onOpenChange={() => setSelectedPhone(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPhone && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">{selectedPhone.contactName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPhone.phoneNumber} ({selectedPhone.phoneType})
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Disposition *</Label>
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
                    placeholder="e.g., 3/2"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SF</Label>
                  <input
                    type="text"
                    placeholder="e.g., 1,500"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Roof Age</Label>
                  <input
                    type="text"
                    placeholder="e.g., 5 years"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">A/C Age</Label>
                  <input
                    type="text"
                    placeholder="e.g., 3 years"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Overall Condition</Label>
                  <select className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary">
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
                    placeholder="e.g., Relocation"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">How Fast to Sell</Label>
                <select className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary">
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
              <Button variant="outline" onClick={() => setSelectedPhone(null)}>
                Cancel
              </Button>
              <Button onClick={handleLogCall} disabled={!disposition}>
                Log Call
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
    </>
  );
}
