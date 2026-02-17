/**
 * ContactNotesDialog — View all call notes for a specific contact
 * 
 * Shows a timeline of notes with call information (status, duration, date).
 * Can be opened from the contacts table via the Notes button.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FileText,
  Clock,
  Phone,
  Send,
  Loader2,
  Trash2,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ContactNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: number;
  contactName: string;
  propertyId: number;
}

const CALL_STATUS_ICONS: Record<string, React.ReactNode> = {
  "ringing": <PhoneCall className="h-3 w-3 text-blue-500" />,
  "in-progress": <Phone className="h-3 w-3 text-green-500" />,
  "completed": <CheckCircle2 className="h-3 w-3 text-green-500" />,
  "failed": <AlertCircle className="h-3 w-3 text-red-500" />,
  "no-answer": <PhoneMissed className="h-3 w-3 text-orange-500" />,
};

export function ContactNotesDialog({ open, onOpenChange, contactId, contactName, propertyId }: ContactNotesDialogProps) {
  const [noteText, setNoteText] = useState("");

  const { data: notes, refetch } = trpc.callNotes.getByContact.useQuery(
    { contactId },
    { enabled: open && !!contactId }
  );

  const createNoteMutation = trpc.callNotes.create.useMutation();
  const deleteNoteMutation = trpc.callNotes.delete.useMutation();

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      await createNoteMutation.mutateAsync({
        contactId,
        propertyId,
        content: noteText.trim(),
      });
      setNoteText("");
      refetch();
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await deleteNoteMutation.mutateAsync({ noteId });
      refetch();
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Group notes by date
  const groupedNotes = (notes ?? []).reduce<Record<string, typeof notes>>((acc, note) => {
    const dateKey = new Date(note.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey]!.push(note);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Notes — {contactName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {notes?.length ?? 0} notes across all calls
          </p>
        </DialogHeader>

        {/* Notes Timeline */}
        <ScrollArea className="flex-1 px-5 py-3">
          {(!notes || notes.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No notes yet for this contact</p>
              <p className="text-xs mt-1">Add a note below or during a call</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedNotes).map(([dateKey, dateNotes]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground font-medium px-2">{dateKey}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {dateNotes!.map((note) => (
                      <div
                        key={note.id}
                        className="group relative bg-muted/50 rounded-lg p-3 border border-transparent hover:border-border transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1">{note.content}</p>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(note.createdAt).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {note.callStatus && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1">
                              {CALL_STATUS_ICONS[note.callStatus] || <Phone className="h-3 w-3" />}
                              {note.callStatus}
                            </Badge>
                          )}
                          {note.callDuration != null && note.callDuration > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {formatDuration(note.callDuration)}
                            </Badge>
                          )}
                          {note.callToNumber && (
                            <span className="text-[10px] font-mono">{note.callToNumber}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Add Note Input */}
        <div className="px-5 py-3 border-t">
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              className="min-h-[50px] max-h-[100px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleAddNote}
              disabled={!noteText.trim() || createNoteMutation.isPending}
              className="shrink-0 h-[50px] w-10"
            >
              {createNoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Press Enter to send</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
