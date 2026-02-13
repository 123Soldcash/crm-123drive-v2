import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, StickyNote, Search, Download, Trash2, Camera, X, ZoomIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface DeskChrisNotesProps {
  propertyId: number;
}

export function DeskChrisNotes({ propertyId }: DeskChrisNotesProps) {
  const [newNote, setNewNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showDeskChrisNotes');
    return saved ? JSON.parse(saved) : false;
  });
  
  useEffect(() => {
    localStorage.setItem('showDeskChrisNotes', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Handle paste images
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

  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({
    propertyId,
  });

  const { data: allPhotos } = trpc.photos.allByProperty.useQuery({ propertyId });

  const deskChrisNotes = allNotes?.filter((note) => note.noteType === "desk-chris") || [];
  
  const filteredNotes = deskChrisNotes.filter((note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.content.toLowerCase().includes(query) ||
      (note.userName && note.userName.toLowerCase().includes(query)) ||
      formatTimestamp(note.createdAt).toLowerCase().includes(query)
    );
  });

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: async (note) => {
      // Upload photos if any
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

      toast.success("Desk-Chris note added successfully!");
      setNewNote("");
      setSelectedImages([]);
      setPhotoCaptions({});
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  const uploadPhotosMutation = trpc.photos.uploadBulk.useMutation({
    onSuccess: () => {
      utils.photos.allByProperty.invalidate({ propertyId });
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
      toast.success("Note(s) deleted successfully!");
      setSelectedNotes([]);
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      utils.photos.allByProperty.invalidate({ propertyId });
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
  
  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Agent", "Notes"],
      ...deskChrisNotes.map((note) => [
        formatTimestamp(note.createdAt),
        note.userName || "Unknown",
        `"${note.content.replace(/"/g, '""')}"`,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desk-chris-notes-${propertyId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };
  
  const handleBulkDelete = () => {
    if (selectedNotes.length === 0) {
      toast.error("Please select notes to delete");
      return;
    }
    
    if (confirm(`Delete ${selectedNotes.length} selected note(s)?`)) {
      selectedNotes.forEach((noteId) => {
        deleteNoteMutation.mutate({ id: noteId });
      });
    }
  };
  
  const toggleSelectAll = () => {
    if (selectedNotes.length === filteredNotes.length) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(filteredNotes.map((note) => note.id));
    }
  };
  
  const toggleSelectNote = (noteId: number) => {
    setSelectedNotes((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId]
    );
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
    <>
    <CollapsibleSection
      title="Desk-Chris Notes"
      icon={StickyNote}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="green"
      badge={deskChrisNotes.length > 0 ? (
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 ml-1">
          {deskChrisNotes.length}
        </Badge>
      ) : null}
    >
      <div className="mb-6 space-y-3">
        <Textarea
          ref={textareaRef}
          placeholder="Add a new Desk-Chris note... (Ctrl+V to paste screenshots)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          className="resize-none bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
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
                  <img src={img} className="w-full h-20 object-cover rounded-md border border-emerald-200" />
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
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              size="sm" 
              className="border-emerald-200 hover:bg-emerald-50"
            >
              <Camera className="mr-2 h-3 w-3" />
              Add Photos
            </Button>
          </div>
        </div>

        <Button
          onClick={handleAddNote}
          disabled={createNoteMutation.isPending || !newNote.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-slate-200"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={deskChrisNotes.length === 0}
          className="whitespace-nowrap border-slate-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleBulkDelete}
          disabled={selectedNotes.length === 0}
          className="whitespace-nowrap"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete ({selectedNotes.length})
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : deskChrisNotes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <StickyNote className="h-8 w-8 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No Desk-Chris notes yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-2 py-2 text-center w-12">
                    <Checkbox
                      checked={selectedNotes.length === filteredNotes.length && filteredNotes.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 w-48">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 w-32">
                    Agent
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-2 text-center">
                      <Checkbox
                        checked={selectedNotes.includes(note.id)}
                        onCheckedChange={() => toggleSelectNote(note.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      {formatTimestamp(note.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-slate-900">
                      {note.userName || "Unknown"}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      <p className="whitespace-pre-wrap mb-2">{note.content}</p>
                      {allPhotos?.filter(photo => photo.noteId === note.id).length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {allPhotos.filter(photo => photo.noteId === note.id).map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img 
                                src={photo.fileUrl} 
                                alt={photo.caption || "Note photo"}
                                className="w-full h-20 object-cover rounded-md border border-emerald-200 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxPhoto({ url: photo.fileUrl, caption: photo.caption || undefined })}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-5 w-5 bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
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
                                className="absolute top-1 left-1 h-5 w-5 bg-slate-900/60 hover:bg-slate-900/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
