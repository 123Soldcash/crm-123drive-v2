import React, { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Paperclip,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  Send,
  Download,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize?: number | null;
}

interface Note {
  id: number;
  text: string | null;
  createdAt: Date | string;
  attachments: Attachment[];
}

// ─── Attachment Thumbnail ────────────────────────────────────────────────────
function AttachmentItem({
  attachment,
  onDelete,
}: {
  attachment: Attachment;
  onDelete: (id: number) => void;
}) {
  const isImage = attachment.mimeType.startsWith("image/");

  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 group">
      {isImage ? (
        <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName}
            className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
          />
        </a>
      ) : (
        <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded border border-blue-200">
          <FileText className="w-5 h-5 text-blue-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{attachment.fileName}</p>
        {attachment.fileSize && (
          <p className="text-xs text-gray-400">{(attachment.fileSize / 1024).toFixed(1)} KB</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" download={attachment.fileName}>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600">
            <Download className="w-3 h-3" />
          </Button>
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-400 hover:text-red-600"
          onClick={() => onDelete(attachment.id)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Single Note Item ────────────────────────────────────────────────────────
function NoteItem({
  note,
  propertyId,
  section,
  onDeleted,
}: {
  note: Note;
  propertyId: number;
  section: string;
  onDeleted: () => void;
}) {
  const utils = trpc.useUtils();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deleteMutation = trpc.sectionNotes.delete.useMutation({
    onSuccess: () => {
      utils.sectionNotes.getBySection.invalidate({ propertyId, section });
      toast.success("Note deleted");
      onDeleted();
    },
    onError: () => toast.error("Failed to delete note"),
  });

  const uploadMutation = trpc.sectionNotes.uploadAttachment.useMutation({
    onSuccess: () => {
      utils.sectionNotes.getBySection.invalidate({ propertyId, section });
      toast.success("File attached!");
    },
    onError: () => toast.error("Failed to upload file"),
  });

  const deleteAttachmentMutation = trpc.sectionNotes.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.sectionNotes.getBySection.invalidate({ propertyId, section });
      toast.success("Attachment removed");
    },
    onError: () => toast.error("Failed to remove attachment"),
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 16 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 16MB)`);
          continue;
        }
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(",")[1];
              await uploadMutation.mutateAsync({
                noteId: note.id,
                fileName: file.name,
                mimeType: file.type,
                fileData: base64,
                fileSize: file.size,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [note.id, uploadMutation]);

  const formattedDate = new Date(note.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-400">{formattedDate}</p>
        <div className="flex items-center gap-1">
          {/* Attach file button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-blue-600"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Attach file or screenshot"
          >
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          {/* Delete note */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-red-600"
            onClick={() => deleteMutation.mutate({ noteId: note.id })}
            disabled={deleteMutation.isPending}
            title="Delete note"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Note text */}
      {note.text && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
      )}

      {/* Attachments */}
      {note.attachments.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Attachments ({note.attachments.length})</p>
          <div className="grid grid-cols-1 gap-1.5">
            {note.attachments.map((att) => (
              <AttachmentItem
                key={att.id}
                attachment={att}
                onDelete={(id) => deleteAttachmentMutation.mutate({ attachmentId: id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main SectionNotes Component ─────────────────────────────────────────────
export function SectionNotes({
  propertyId,
  section,
  accentColor = "blue",
}: {
  propertyId: number;
  section: string;
  accentColor?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newText, setNewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const utils = trpc.useUtils();

  const { data: notes = [], isLoading } = trpc.sectionNotes.getBySection.useQuery(
    { propertyId, section },
    { enabled: isExpanded }
  );

  const createMutation = trpc.sectionNotes.create.useMutation({
    onSuccess: async (newNote) => {
      // Upload any pending files to the new note
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const reader = new FileReader();
          await new Promise<void>((resolve) => {
            reader.onload = async () => {
              const base64 = (reader.result as string).split(",")[1];
              await utils.client.sectionNotes.uploadAttachment.mutate({
                noteId: newNote.id,
                fileName: file.name,
                mimeType: file.type,
                fileData: base64,
                fileSize: file.size,
              });
              resolve();
            };
            reader.readAsDataURL(file);
          });
        }
        setPendingFiles([]);
      }
      utils.sectionNotes.getBySection.invalidate({ propertyId, section });
      setNewText("");
      setIsSubmitting(false);
      toast.success("Note added!");
    },
    onError: () => {
      toast.error("Failed to add note");
      setIsSubmitting(false);
    },
  });

  const uploadMutation = trpc.sectionNotes.uploadAttachment.useMutation({
    onSuccess: () => {
      utils.sectionNotes.getBySection.invalidate({ propertyId, section });
    },
  });

  const handleSubmit = async () => {
    if (!newText.trim() && pendingFiles.length === 0) return;
    setIsSubmitting(true);
    createMutation.mutate({
      propertyId,
      section,
      text: newText.trim(),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 16 * 1024 * 1024);
    const oversized = files.filter((f) => f.size > 16 * 1024 * 1024);
    if (oversized.length > 0) toast.error(`${oversized.length} file(s) exceed 16MB limit`);
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const noteCount = isExpanded ? notes.length : 0;

  const accentBorderMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50/30",
    orange: "border-orange-200 bg-orange-50/30",
    green: "border-green-200 bg-green-50/30",
    red: "border-red-200 bg-red-50/30",
    purple: "border-purple-200 bg-purple-50/30",
    yellow: "border-yellow-200 bg-yellow-50/30",
  };

  const accentTextMap: Record<string, string> = {
    blue: "text-blue-600",
    orange: "text-orange-600",
    green: "text-green-600",
    red: "text-red-600",
    purple: "text-purple-600",
    yellow: "text-yellow-600",
  };

  return (
    <div className={`mt-3 rounded-lg border ${accentBorderMap[accentColor] || accentBorderMap.blue}`}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquarePlus className={`w-3.5 h-3.5 ${accentTextMap[accentColor] || accentTextMap.blue}`} />
          <span className={`text-xs font-semibold ${accentTextMap[accentColor] || accentTextMap.blue}`}>
            Section Notes
            {isExpanded && notes.length > 0 && (
              <span className="ml-1.5 bg-white rounded-full px-1.5 py-0.5 text-xs font-bold border">
                {notes.length}
              </span>
            )}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Existing notes */}
          {isLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No notes yet. Add the first one below.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  propertyId={propertyId}
                  section={section}
                  onDeleted={() => {}}
                />
              ))}
            </div>
          )}

          {/* New note input */}
          <div className="space-y-2 border-t border-gray-200 pt-2">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Add a note for this section..."
              className="text-xs h-16 resize-none bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs">
                    {file.type.startsWith("image/") ? (
                      <ImageIcon className="w-3 h-3 text-blue-500" />
                    ) : (
                      <FileText className="w-3 h-3 text-blue-500" />
                    )}
                    <span className="max-w-[120px] truncate text-gray-600">{file.name}</span>
                    <button type="button" onClick={() => removePendingFile(i)}>
                      <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Attach file */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-3 h-3" />
                Attach
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="text-xs text-gray-400 flex-1">Images, PDFs, Docs (max 16MB)</span>
              {/* Submit */}
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleSubmit}
                disabled={isSubmitting || (!newText.trim() && pendingFiles.length === 0)}
              >
                {isSubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Save
              </Button>
            </div>
            <p className="text-xs text-gray-400">Tip: Ctrl+Enter to save quickly</p>
          </div>
        </div>
      )}
    </div>
  );
}
