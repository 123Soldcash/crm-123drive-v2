import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, StickyNote } from "lucide-react";

interface DeskChrisNotesProps {
  propertyId: number;
}

export function DeskChrisNotes({ propertyId }: DeskChrisNotesProps) {
  const [newNote, setNewNote] = useState("");
  const utils = trpc.useUtils();

  // Fetch only desk-chris notes
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({
    propertyId,
  });

  const deskChrisNotes = allNotes?.filter((note) => note.noteType === "desk-chris") || [];

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Desk-Chris note added successfully!");
      setNewNote("");
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    createNoteMutation.mutate({
      propertyId,
      content: newNote.trim(),
      noteType: "desk-chris",
    });
  };

  const formatTimestamp = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Card className="p-6 bg-green-50 border-green-200">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Desk-Chris Notes</h3>
        <span className="text-sm text-gray-500">
          (Exclusive notes with auto-timestamp)
        </span>
      </div>

      {/* Add New Note */}
      <div className="mb-6 space-y-3">
        <Textarea
          placeholder="Add a new Desk-Chris note... (timestamp will be added automatically)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          className="resize-none bg-white"
        />
        <Button
          onClick={handleAddNote}
          disabled={createNoteMutation.isPending || !newNote.trim()}
          className="w-full"
        >
          {createNoteMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Note...
            </>
          ) : (
            "Add Desk-Chris Note"
          )}
        </Button>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-gray-700">
          Notes History ({deskChrisNotes.length})
        </h4>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : deskChrisNotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <StickyNote className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No Desk-Chris notes yet</p>
            <p className="text-sm">Add your first note above</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {deskChrisNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white p-4 rounded-lg border border-green-200 shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-green-600">
                    {formatTimestamp(note.createdAt)}
                  </span>
                  <span className="text-xs text-gray-500">
                    by {note.userName || "Unknown"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
