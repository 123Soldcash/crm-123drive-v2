import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MessageSquare, Share2, DoorClosed, MailOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface CommunicationLogProps {
  propertyId: number;
  contactId?: number; // Optional: filter by specific contact
}

type CommunicationType = "phone" | "email" | "sms" | "social_media" | "door_knock" | "letter";
// Use exact backend enum values
type CallResult = 
  | "Interested - HOT LEAD"
  | "Interested - WARM LEAD"
  | "NOT INTERESTED - WARM LEAD"
  | "NOT INTERESTED - DEAD"
  | "Voice Mail"
  | "Disconnected"
  | "Wrong Number"
  | "Left Message"
  | "No Answer"
  | "Callback Requested"
  | "IHATED"
  | "Number Repeated"
  | "2nd Action Needed"
  | "Other";

const communicationIcons: Record<CommunicationType, React.ReactNode> = {
  phone: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  social_media: <Share2 className="h-4 w-4" />,
  door_knock: <DoorClosed className="h-4 w-4" />,
  letter: <MailOpen className="h-4 w-4" />,
};

const communicationLabels: Record<CommunicationType, string> = {
  phone: "Phone Call",
  email: "Email",
  sms: "SMS/Text",
  social_media: "Social Media",
  door_knock: "Door Knock",
  letter: "Letter/Mail",
};

// Call result options array for dropdown
const callResultOptions: CallResult[] = [
  "Interested - HOT LEAD",
  "Interested - WARM LEAD",
  "NOT INTERESTED - WARM LEAD",
  "NOT INTERESTED - DEAD",
  "Voice Mail",
  "Disconnected",
  "Wrong Number",
  "Left Message",
  "No Answer",
  "Callback Requested",
  "IHATED",
  "Number Repeated",
  "2nd Action Needed",
  "Other",
];

const resultColors: Record<CallResult, string> = {
  "Interested - HOT LEAD": "bg-red-100 text-red-800 border-red-300",
  "Interested - WARM LEAD": "bg-orange-100 text-orange-800 border-orange-300",
  "NOT INTERESTED - WARM LEAD": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "NOT INTERESTED - DEAD": "bg-gray-100 text-gray-800 border-gray-300",
  "Voice Mail": "bg-blue-100 text-blue-800 border-blue-300",
  "Disconnected": "bg-purple-100 text-purple-800 border-purple-300",
  "Wrong Number": "bg-pink-100 text-pink-800 border-pink-300",
  "Left Message": "bg-cyan-100 text-cyan-800 border-cyan-300",
  "No Answer": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Callback Requested": "bg-teal-100 text-teal-800 border-teal-300",
  "IHATED": "bg-red-200 text-red-900 border-red-400",
  "Number Repeated": "bg-amber-100 text-amber-800 border-amber-300",
  "2nd Action Needed": "bg-lime-100 text-lime-800 border-lime-300",
  "Other": "bg-slate-100 text-slate-800 border-slate-300",
};

export function CommunicationLog({ propertyId, contactId }: CommunicationLogProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CommunicationType>("phone");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [nextStep, setNextStep] = useState("");
  // teamMember removed - userId is automatically set by backend from ctx.user

  const utils = trpc.useUtils();

  // Fetch communication log
  const { data: logs, isLoading } = trpc.communication.getCommunicationLog.useQuery({
    propertyId,
  });

  // Fetch contacts for dropdown
  const { data: contacts } = trpc.communication.getContactsByProperty.useQuery({ propertyId });

  // Add communication mutation
  const addCommunication = trpc.communication.addCommunicationLog.useMutation({
    onSuccess: () => {
      toast.success("Communication logged successfully");
      utils.communication.getCommunicationLog.invalidate();
      utils.properties.getById.invalidate();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to log communication: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedContactId("");
    setResult("");
    setNotes("");
    setNextStep("");
    // teamMember removed
  };

  const handleSubmit = () => {
    if (!selectedContactId) {
      toast.error("Please select a contact");
      return;
    }

    addCommunication.mutate({
      propertyId,
      contactId: parseInt(selectedContactId),
      communicationType: selectedType === "phone" ? "Phone" : 
                        selectedType === "email" ? "Email" :
                        selectedType === "sms" ? "SMS" :
                        selectedType === "social_media" ? "Facebook" :
                        selectedType === "door_knock" ? "DoorKnock" :
                        selectedType === "letter" ? "Letter" : "Other",
      callResult: result ? (result as any) : undefined,
      notes: notes || undefined,
      nextStep: nextStep || undefined,
    });
  };

  const openAddDialog = (type: CommunicationType, preselectedContactId?: number) => {
    setSelectedType(type);
    if (preselectedContactId) {
      setSelectedContactId(preselectedContactId.toString());
    }
    setIsAddDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading communication history...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Communication History</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Log Communication
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Communication</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Communication Type */}
              <div className="space-y-2">
                <Label>Communication Type</Label>
                <Select value={selectedType} onValueChange={(v) => setSelectedType(v as CommunicationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(communicationLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          {communicationIcons[value as CommunicationType]}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Selection */}
              <div className="space-y-2">
                <Label>Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts?.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name} {contact.isDecisionMaker && "⭐"} - {contact.relationship || "Contact"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Result (for phone calls mainly) */}
              <div className="space-y-2">
                <Label>Result (Optional)</Label>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    {callResultOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecting "Interested - HOT" or "IHATED" will automatically update the lead temperature
                </p>
              </div>

              {/* Team Member - automatically tracked via userId */}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this communication..."
                  rows={4}
                />
              </div>

              {/* Next Step */}
              <div className="space-y-2">
                <Label>Next Step (Optional)</Label>
                <Input
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="e.g., Follow up next week, Send offer, etc."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={addCommunication.isPending}>
                  {addCommunication.isPending ? "Saving..." : "Save Communication"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Communication Timeline */}
      <div className="space-y-3">
        {!logs || logs.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No communication history yet. Start tracking by logging your first interaction.
          </Card>
        ) : (
          logs.map((log) => {
            const contact = contacts?.find((c) => c.id === log.contactId);
            return (
              <Card key={log.id} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">
                    {communicationIcons[log.communicationType.toLowerCase() as CommunicationType] || <Phone className="h-4 w-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">
                            {communicationLabels[log.communicationType.toLowerCase() as CommunicationType] || log.communicationType}
                          </span>
                          {log.callResult && (
                            <span
                              className={`text-xs px-2 py-1 rounded-full border ${
                                resultColors[log.callResult as CallResult] || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {log.callResult}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Contact: <span className="font-medium">{contact?.name || "Unknown"}</span>
                          {contact?.isDecisionMaker && " ⭐"}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.communicationDate), { addSuffix: true })}
                      </span>
                    </div>

                    {log.notes && (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        {log.notes}
                      </p>
                    )}

                    {log.nextStep && (
                      <div className="text-sm">
                        <span className="font-medium">Next Step:</span> {log.nextStep}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Export function for quick-add from contact buttons */}
      {/* This will be called from ContactManagement component */}
    </div>
  );
}

// Export helper function to open dialog from external components
export function useCommunicationLog() {
  return {
    openAddDialog: (type: CommunicationType, contactId?: number) => {
      // This will be handled by lifting state up or using context if needed
      console.log("Open dialog for", type, contactId);
    },
  };
}
