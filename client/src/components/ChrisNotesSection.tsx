/**
 * ============================================================================
 * CHRIS NOTES SECTION - Duplicate of General Notes for "desk-chris" noteType
 * ============================================================================
 * 
 * Same features as General Notes but:
 * - Filters notes by noteType = "desk-chris"
 * - Creates notes with noteType = "desk-chris"
 * - Titled "Chris Notes" with distinct purple accent
 * - Positioned above Tags on PropertyDetail page
 * 
 * CREATED: 2026-04-03
 * ============================================================================
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Upload, X, Search, Download, FileText, ZoomIn, File, Paperclip, FileSpreadsheet, FileImage, FileArchive, ClipboardPaste, ImagePlus, Pin, Pencil, Check, MessageSquareText } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface ChrisNotesSectionProps {
  propertyId: number;
}

const ACCEPTED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (mimeType.includes("word") || mimeType === "application/msword") return <FileText className="h-4 w-4 text-blue-600" />;
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-purple-500" />;
  if (mimeType.includes("zip")) return <FileArchive className="h-4 w-4 text-yellow-600" />;
  return <File className="h-4 w-4 text-slate-500" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(blob);
  });
}

function readFileAsBase64(file: globalThis.File): Promise<string> {
  return readBlobAsDataURL(file);
}

function extractImageBlobs(items: DataTransferItemList): Blob[] {
  const blobs: Blob[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const blob = item.getAsFile();
      if (blob) blobs.push(blob);
    }
  }
  return blobs;
}

export function ChrisNotesSection({ propertyId }: ChrisNotesSectionProps) {
  const { user } = useAuth();
  const [noteText, setNoteText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption?: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<{ file: globalThis.File; description: string }[]>([]);
  const [showDocuments, setShowDocuments] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPastingImage, setIsPastingImage] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formAreaRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showChrisNotes');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('showChrisNotes', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // ─── Process image blobs into base64 previews ───────────────────────────────
  const processImageBlobs = useCallback(async (blobs: Blob[]) => {
    if (blobs.length === 0) return;
    setIsPastingImage(true);
    try {
      const dataUrls = await Promise.all(blobs.map(readBlobAsDataURL));
      setSelectedImages((prev) => [...prev, ...dataUrls]);
      setIsExpanded(true);
      toast.success(blobs.length === 1 ? "Screenshot pasted! Add a note and click Save." : `${blobs.length} images pasted!`);
    } catch (err) {
      console.error("Image paste error:", err);
      toast.error("Failed to read pasted image. Please try again.");
    } finally {
      setIsPastingImage(false);
    }
  }, []);

  // ─── Drag & Drop handlers ────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.some((t) => t === "Files")) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!formAreaRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const items = e.dataTransfer.items;
    const droppedFiles = Array.from(e.dataTransfer.files);

    const imageFiles = droppedFiles.filter((f) => f.type.startsWith("image/"));
    const docFiles = droppedFiles.filter((f) => !f.type.startsWith("image/"));

    if (items) {
      const blobs = extractImageBlobs(items);
      if (blobs.length > 0) {
        await processImageBlobs(blobs);
      }
    }

    if (imageFiles.length > 0) {
      await processImageBlobs(imageFiles);
    }

    if (docFiles.length > 0) {
      const newDocs: { file: globalThis.File; description: string }[] = [];
      docFiles.forEach((file) => {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} is too large (max 10MB)`);
          return;
        }
        newDocs.push({ file, description: "" });
      });
      setSelectedDocs((prev) => [...prev, ...newDocs]);
    }
  };

  const utils = trpc.useUtils();
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({ propertyId });
  // Filter ONLY desk-chris notes
  const chrisNotes = allNotes?.filter((note) => note.noteType === "desk-chris") || [];
  const { data: allPhotos } = trpc.photos.allByProperty.useQuery({ propertyId });
  const { data: documents } = trpc.documents.byProperty.useQuery({ propertyId });

  const noteUsers = Array.from(new Set(chrisNotes.map(note => note.userName).filter(Boolean))) as string[];

  const filteredNotes = chrisNotes.filter((note) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      note.content.toLowerCase().includes(query) ||
      (note.userName && note.userName.toLowerCase().includes(query))
    );
    const matchesUser = !selectedUser || note.userName === selectedUser;
    return matchesSearch && matchesUser;
  });

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: async (note) => {
      if (selectedImages.length > 0) {
        const photos = selectedImages.map((img, idx) => ({
          fileData: img,
          caption: photoCaptions[idx] || undefined,
        }));
        try {
          await uploadPhotosMutation.mutateAsync({ propertyId, noteId: note.id, photos });
        } catch {
          toast.error("Note created but photos failed to upload");
        }
      }

      if (selectedDocs.length > 0) {
        for (const doc of selectedDocs) {
          try {
            const fileData = await readFileAsBase64(doc.file);
            await uploadDocMutation.mutateAsync({
              propertyId,
              noteId: note.id,
              fileName: doc.file.name,
              fileData,
              fileSize: doc.file.size,
              mimeType: doc.file.type || "application/octet-stream",
              description: doc.description || undefined,
            });
          } catch {
            toast.error(`Failed to upload ${doc.file.name}`);
          }
        }
      }

      utils.notes.byProperty.invalidate({ propertyId });
      utils.documents.byProperty.invalidate({ propertyId });
      setNoteText("");
      setSelectedImages([]);
      setPhotoCaptions({});
      setSelectedDocs([]);
      toast.success("Chris Note added successfully!");
    },
    onError: () => {
      toast.error("Failed to add Chris Note");
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

  const uploadDocMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      utils.documents.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      console.error("Document upload error:", error);
    },
  });

  const deleteDocMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.byProperty.invalidate({ propertyId });
      toast.success("Document deleted");
    },
    onError: () => {
      toast.error("Failed to delete document");
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      toast.success("Chris Note deleted");
    },
    onError: () => {
      toast.error("Failed to delete note");
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

  const togglePinMutation = trpc.notes.togglePin.useMutation({
    onSuccess: (result) => {
      utils.notes.byProperty.invalidate({ propertyId });
      toast.success(result.isPinned ? "Note pinned to top" : "Note unpinned");
    },
    onError: () => {
      toast.error("Failed to toggle pin");
    },
  });

  const updateNoteMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      setEditingNoteId(null);
      setEditingContent("");
      toast.success("Chris Note updated successfully");
    },
    onError: () => {
      toast.error("Failed to update note");
    },
  });

  const handleStartEdit = (noteId: number, content: string) => {
    setEditingNoteId(noteId);
    setEditingContent(content);
  };

  const handleSaveEdit = () => {
    if (!editingNoteId || !editingContent.trim()) return;
    updateNoteMutation.mutate({ id: editingNoteId, content: editingContent.trim() });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent("");
  };

  const handleStandaloneDocUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      try {
        const fileData = await readFileAsBase64(file);
        await uploadDocMutation.mutateAsync({
          propertyId,
          fileName: file.name,
          fileData,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        });
        toast.success(`${file.name} uploaded`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    utils.documents.byProperty.invalidate({ propertyId });
  };

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

  const handleDocSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newDocs: { file: globalThis.File; description: string }[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return;
      }
      newDocs.push({ file, description: "" });
    });
    setSelectedDocs((prev) => [...prev, ...newDocs]);
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDoc = (index: number) => {
    setSelectedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!noteText.trim() && selectedImages.length === 0 && selectedDocs.length === 0) {
      toast.error("Please enter a note or attach files");
      return;
    }
    createNoteMutation.mutate({
      propertyId,
      content: noteText || (selectedDocs.length > 0 ? `[Document upload: ${selectedDocs.map(d => d.file.name).join(", ")}]` : "[Photo upload]"),
      noteType: "desk-chris",
    });
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Agent", "Notes"],
      ...chrisNotes.map((note) => [
        new Date(note.createdAt).toLocaleString(),
        note.userName || "Unknown",
        `"${note.content.replace(/"/g, '""')}"`,
      ]),
    ].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chris-notes-${propertyId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported!");
  };

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-purple-50 rounded-lg border border-dashed border-purple-200">Loading Chris Notes...</div>;
  }

  // Get documents associated with chris notes only
  const chrisNoteIds = new Set(chrisNotes.map(n => n.id));
  const chrisDocuments = documents?.filter(d => d.noteId && chrisNoteIds.has(d.noteId)) || [];

  return (
    <>
    <CollapsibleSection
      title="Chris Notes"
      icon={MessageSquareText}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="purple"
      badge={
        <div className="flex gap-1">
          {chrisNotes.length > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 ml-1">
              {chrisNotes.length} notes
            </Badge>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Note Input Form — also the drop target */}
        <div
          ref={formAreaRef}
          className={`space-y-3 p-4 border-2 rounded-lg transition-colors ${
            isDraggingOver
              ? "border-purple-400 bg-purple-50/60 border-dashed"
              : "border-purple-200 bg-purple-50/30"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Paste / drag hint bar */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 select-none">
            <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isDraggingOver
                ? "Drop files here to attach them to this note"
                : isPastingImage
                ? "Processing image…"
                : "Ctrl+V to paste a screenshot · or drag & drop any files here (images, PDF, DOC, XLS, etc.)"}
            </span>
            {isPastingImage && (
              <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            )}
          </div>

          <Textarea
            ref={textareaRef}
            placeholder="Add a Chris Note… (optional when attaching images)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="bg-white border-purple-200 focus:border-purple-400"
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
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              multiple
              onChange={handleDocSelect}
              className="hidden"
            />

            {/* Selected images preview */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      className="w-full h-24 object-cover rounded-md border border-purple-200 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setLightboxPhoto({ url: img })}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div
                      className="absolute top-1 left-1 h-5 w-5 bg-slate-900/60 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => setLightboxPhoto({ url: img })}
                    >
                      <ZoomIn className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 rounded-md border-2 border-dashed border-purple-300 flex flex-col items-center justify-center gap-1 text-purple-400 hover:border-purple-400 hover:text-purple-500 transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">Add more</span>
                </button>
              </div>
            )}

            {/* Selected documents preview */}
            {selectedDocs.length > 0 && (
              <div className="space-y-1">
                {selectedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-purple-200 rounded-md">
                    {getFileIcon(doc.file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{doc.file.name}</p>
                      <p className="text-[10px] text-gray-500">{formatFileSize(doc.file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-500 hover:text-red-500"
                      onClick={() => removeDoc(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                className="border-purple-200"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip";
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (!files) return;
                    const imageFiles: File[] = [];
                    const docFiles: { file: globalThis.File; description: string }[] = [];
                    Array.from(files).forEach((file) => {
                      if (file.type.startsWith("image/")) {
                        imageFiles.push(file);
                      } else {
                        if (file.size > MAX_FILE_SIZE) {
                          toast.error(`${file.name} is too large (max 10MB)`);
                          return;
                        }
                        docFiles.push({ file, description: "" });
                      }
                    });
                    if (imageFiles.length > 0) {
                      imageFiles.forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setSelectedImages((prev) => [...prev, ev.target?.result as string]);
                        };
                        reader.readAsDataURL(file);
                      });
                    }
                    if (docFiles.length > 0) {
                      setSelectedDocs((prev) => [...prev, ...docFiles]);
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="mr-2 h-3 w-3" />
                Attach Files
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createNoteMutation.isPending || uploadDocMutation.isPending}
                className="ml-auto bg-purple-600 hover:bg-purple-700 text-white"
              >
                {createNoteMutation.isPending || uploadDocMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        {chrisNotes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search Chris Notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-purple-200"
              />
            </div>
            {noteUsers.length > 0 && (
              <select
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(e.target.value || null)}
                className="px-3 py-1.5 text-sm border border-purple-200 rounded-md bg-white hover:bg-gray-50 cursor-pointer"
              >
                <option value="">All Users ({chrisNotes.length})</option>
                {noteUsers.map((user) => {
                  const userNoteCount = chrisNotes.filter(note => note.userName === user).length;
                  return (
                    <option key={user} value={user}>
                      {user} ({userNoteCount})
                    </option>
                  );
                })}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-purple-200">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        )}

        {/* Notes Table */}
        <div className="border border-purple-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-purple-50 border-b border-purple-200">
                <th className="w-8 p-2"></th>
                <th className="text-left p-3 text-xs font-semibold text-purple-700 w-32">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-purple-700 w-40">Agent</th>
                <th className="text-left p-3 text-xs font-semibold text-purple-700">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-gray-400">
                    No Chris Notes yet. Add one above.
                  </td>
                </tr>
              )}
              {filteredNotes.map((note) => {
                const noteDocuments = documents?.filter(d => d.noteId === note.id) || [];
                return (
                  <tr key={note.id} className={`border-b border-purple-100 hover:bg-purple-50/50 ${note.isPinned ? 'bg-amber-50/60' : ''}`}>
                    <td className="p-2 align-top text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 transition-colors ${note.isPinned ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-500'}`}
                        onClick={() => togglePinMutation.mutate({ id: note.id })}
                        title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                      >
                        <Pin className={`h-3.5 w-3.5 ${note.isPinned ? 'fill-amber-500' : ''}`} />
                      </Button>
                    </td>
                    <td className="p-3 text-xs text-slate-600 align-top">
                      {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <br />
                      <span className="text-[10px] text-gray-500">
                        {new Date(note.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-700 font-medium align-top">
                      {note.userName || "Unknown"}
                    </td>
                    <td className="p-3 text-sm text-slate-600 align-top">
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="min-h-[80px] text-sm bg-white border-purple-300 focus:border-purple-500"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs"
                              onClick={handleSaveEdit}
                              disabled={updateNoteMutation.isPending || !editingContent.trim()}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {updateNoteMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={handleCancelEdit}
                              disabled={updateNoteMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{note.content}</p>
                      )}

                      {/* Photos attached to this note */}
                      {(allPhotos?.filter(photo => photo.noteId === note.id)?.length ?? 0) > 0 && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {allPhotos?.filter(photo => photo.noteId === note.id).map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.fileUrl}
                                alt={photo.caption || "Note photo"}
                                className="w-full h-24 object-cover rounded-md border border-purple-200 cursor-pointer hover:opacity-90 transition-opacity"
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

                      {/* Documents attached to this note */}
                      {noteDocuments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {noteDocuments.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-purple-50 rounded border border-purple-100 group/doc">
                              {getFileIcon(doc.mimeType)}
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-slate-600 hover:text-purple-600 hover:underline truncate flex-1"
                              >
                                {doc.fileName}
                              </a>
                              <span className="text-[10px] text-gray-500">{formatFileSize(doc.fileSize)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-gray-400 hover:text-red-500 opacity-0 group-hover/doc:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete "${doc.fileName}"?`)) {
                                    deleteDocMutation.mutate({ id: doc.id });
                                  }
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-col gap-1">
                        {user?.id === note.userId && editingNoteId !== note.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-purple-500"
                            onClick={() => handleStartEdit(note.id, note.content)}
                            title="Edit note"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-500"
                          onClick={() => deleteNoteMutation.mutate({ id: note.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </CollapsibleSection>

    {/* Photo Lightbox */}
    <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
      <DialogContent className="max-w-4xl p-0">
        <VisuallyHidden><DialogTitle>Photo Preview</DialogTitle></VisuallyHidden>
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
