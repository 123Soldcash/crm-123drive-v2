/**
 * CHRIS NOTES SECTION - Simple plain-text notes list
 * - Textarea input → adds a note on click or Ctrl+Enter
 * - Each note shown as a card row with timestamp and delete button
 * - Notes stacked vertically, newest first
 * - No file uploads, no screenshots, no rich text
 */

import { useState, useRef, KeyboardEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface ChrisNotesSectionProps {
  propertyId: number;
}

function formatNoteDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChrisNotesSection({ propertyId }: ChrisNotesSectionProps) {
  const [noteText, setNoteText] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({ propertyId });

  // Only desk-chris notes, newest first
  const chrisNotes = (allNotes || [])
    .filter((n) => n.noteType === "desk-chris")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      setNoteText("");
      textareaRef.current?.focus();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add note");
    },
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      setDeletingId(null);
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (err) => {
      setDeletingId(null);
      toast.error(err.message || "Failed to delete note");
    },
  });

  const handleAdd = () => {
    const text = noteText.trim();
    if (!text) return;
    createNote.mutate({ propertyId, content: text, noteType: "desk-chris" });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDelete = (noteId: number) => {
    setDeletingId(noteId);
    deleteNote.mutate({ id: noteId });
  };

  return (
    <CollapsibleSection
      title="Chris Notes"
      icon={MessageSquareText}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="purple"
      badge={
        chrisNotes.length > 0 ? (
          <Badge
            variant="secondary"
            className="ml-1 bg-purple-100 text-purple-700 border-purple-200"
          >
            {chrisNotes.length}
          </Badge>
        ) : null
      }
    >
      {/* Input area */}
      <div className="flex flex-col gap-2 mb-4">
        <Textarea
          ref={textareaRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a note… (Ctrl+Enter to save)"
          className="resize-none text-sm bg-white border-gray-300 text-gray-900 placeholder-gray-400 min-h-[72px]"
          disabled={createNote.isPending}
          rows={3}
        />
        <Button
          size="sm"
          className="self-end h-8 px-4 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleAdd}
          disabled={!noteText.trim() || createNote.isPending}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Note
        </Button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
      ) : chrisNotes.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No notes yet. Type above and press Ctrl+Enter or click Add Note.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {chrisNotes.map((note) => (
            <div
              key={note.id}
              className="group flex items-start gap-3 rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2.5 hover:border-purple-200 hover:bg-purple-50 transition-colors"
            >
              {/* Note content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                  {note.content}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {formatNoteDate(note.createdAt)}
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
                className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Delete note"
                aria-label="Delete note"
              >
                {deletingId === note.id ? (
                  <span className="text-[10px] text-gray-400">…</span>
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
