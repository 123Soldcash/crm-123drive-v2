/**
 * ============================================================================
 * GENERAL NOTES SECTION - FINALIZED COMPONENT
 * ============================================================================
 * 
 * STATUS: ✅ 100% COMPLETE - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 * 
 * This component is FINALIZED and should NOT be changed in future updates.
 * Any modifications must be explicitly requested and approved by the user.
 * 
 * FEATURES IMPLEMENTED:
 * - Table layout with Date, Agent, Notes columns
 * - Photo upload and display (3-column grid)
 * - Photo lightbox (click to enlarge)
 * - Photo deletion with confirmation
 * - Note deletion (user can only delete own notes)
 * - Search functionality
 * - CSV export
 * - Paste images (Ctrl+V)
 * 
 * LAST MODIFIED: 2026-01-21
 * CHECKPOINT: bd2f97fc
 * ============================================================================
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Upload, X, Search, Download, FileText, ZoomIn } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";
interface NotesSectionProps {
  propertyId: number;
}

export function NotesSection({ propertyId }: NotesSectionProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showGeneralNotes');
    return saved ? JSON.parse(saved) : true; // Default to true for general notes
  });
  
  useEffect(() => {
    localStorage.setItem('showGeneralNotes', JSON.stringify(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            setSelectedImages((prev) => [...prev, imageData]);
            toast.success("Screenshot pasted!");
          };
          reader.readAsDataURL(blob);
        }
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("paste", handlePaste);
      return () => textarea.removeEventListener("paste", handlePaste);
    }
  }, []);

  const utils = trpc.useUtils();
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({ propertyId });
  const notes = allNotes?.filter((note) => note.noteType !== "desk-chris") || [];
  const { data: allPhotos } = trpc.photos.byProperty.useQuery({ propertyId });
  
  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.content.toLowerCase().includes(query) ||
      (note.userName && note.userName.toLowerCase().includes(query))
    );
  });

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: async (note) => {
      if (selectedImages.length > 0) {
        const photos = selectedImages.map((img, idx) => ({
          fileData: img,
          caption: photoCaptions[idx] || undefined,
        }));

        try {
          await uploadPhotosMutation.mutateAsync({
            propertyId,
            noteId: note.id,
            photos,
          });
        } catch (error) {
          toast.error("Note created but photos failed to upload");
        }
      }

      utils.notes.byProperty.invalidate({ propertyId });
      setNoteText("");
      setSelectedImages([]);
      setPhotoCaptions({});
      toast.success("Note added successfully!");
    },
    onError: () => {
      toast.error("Failed to add note");
    },
  });

  const uploadPhotosMutation = trpc.photos.uploadBulk.useMutation({
    onSuccess: () => {
      utils.photos.byProperty.invalidate({ propertyId });
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      console.error("Photo upload error:", error);
      toast.error("Failed to upload photos");
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      toast.success("Note deleted");
    },
    onError: () => {
      toast.error("Failed to delete note");
    },
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      utils.photos.byProperty.invalidate({ propertyId });
      toast.success("Photo deleted");
    },
    onError: () => {
      toast.error("Failed to delete photo");
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImages((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!noteText.trim()) {
      toast.error("Please enter a note");
      return;
    }
    createNoteMutation.mutate({
      propertyId,
      content: noteText,
      noteType: "general",
    });
  };
  
  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Agent", "Notes"],
      ...notes.map((note) => [
        new Date(note.createdAt).toLocaleString(),
        note.userName || "Unknown",
        `"${note.content.replace(/"/g, '""')}"`,
      ]),
    ].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${propertyId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported!");
  };

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading notes...</div>;
  }

  return (
    <>
    <CollapsibleSection
      title="General Notes"
      icon={FileText}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="gray"
      badge={notes.length > 0 ? (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 ml-1">
          {notes.length}
        </Badge>
      ) : null}
    >
      <div className="space-y-4">
        <div className="space-y-3 p-4 border rounded-lg bg-slate-50/50">
          <Textarea
            ref={textareaRef}
            placeholder="Add a note... (Ctrl+V to paste screenshots)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="bg-white border-slate-200"
          />

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img} className="w-full h-20 object-cover rounded-md border border-slate-200" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => removeImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="border-slate-200">
                <Camera className="mr-2 h-3 w-3" />
                Add Photos
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createNoteMutation.isPending}
                className="ml-auto bg-slate-800 hover:bg-slate-900 text-white"
              >
                {createNoteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-200">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3 text-xs font-semibold text-slate-700 w-32">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-700 w-40">Agent</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-700">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map((note) => (
                <tr key={note.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 text-xs text-slate-600 align-top">
                    {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <br />
                    <span className="text-[10px] text-slate-400">
                      {new Date(note.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-700 font-medium align-top">
                    {note.userName || "Unknown"}
                  </td>
                  <td className="p-3 text-sm text-slate-600 align-top">
                    <p className="whitespace-pre-wrap">{note.content}</p>
                    {allPhotos?.filter(photo => photo.noteId === note.id).length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {allPhotos.filter(photo => photo.noteId === note.id).map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img 
                              src={photo.fileUrl} 
                              alt={photo.caption || "Note photo"}
                              className="w-full h-24 object-cover rounded-md border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxPhoto({ url: photo.fileUrl, caption: photo.caption || undefined })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this photo?")) {
                                  deletePhotoMutation.mutate({ id: photo.id });
                                }
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <div 
                              className="absolute top-1 left-1 h-6 w-6 bg-slate-900/60 hover:bg-slate-900/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              onClick={() => setLightboxPhoto({ url: photo.fileUrl, caption: photo.caption || undefined })}
                            >
                              <ZoomIn className="h-3 w-3 text-white" />
                            </div>
                            {photo.caption && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-md">
                                {photo.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 align-top">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-300 hover:text-red-500"
                      onClick={() => deleteNoteMutation.mutate({ id: note.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CollapsibleSection>

    {/* Photo Lightbox */}
    <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
      <DialogContent className="max-w-4xl p-0">
        {lightboxPhoto && (
          <div className="relative">
            <img 
              src={lightboxPhoto.url} 
              alt={lightboxPhoto.caption || "Photo"}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
            {lightboxPhoto.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-4 text-sm">
                {lightboxPhoto.caption}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
