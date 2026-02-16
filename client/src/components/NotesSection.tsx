/**
 * ============================================================================
 * GENERAL NOTES SECTION - WITH DOCUMENT UPLOAD
 * ============================================================================
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
 * - Document upload (PDF, DOC, DOCX, XLS, XLSX, TXT, etc.)
 * - Document list with download/delete
 * 
 * LAST MODIFIED: 2026-02-16
 * ============================================================================
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Upload, X, Search, Download, FileText, ZoomIn, File, Paperclip, FileSpreadsheet, FileImage, FileArchive } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface NotesSectionProps {
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

export function NotesSection({ propertyId }: NotesSectionProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption?: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<{ file: globalThis.File; description: string }[]>([]);
  const [showDocuments, setShowDocuments] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showGeneralNotes');
    return saved ? JSON.parse(saved) : true;
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
  const { data: allPhotos } = trpc.photos.allByProperty.useQuery({ propertyId });
  const { data: documents, isLoading: docsLoading } = trpc.documents.byProperty.useQuery({ propertyId });
  
  const noteUsers = Array.from(new Set(notes.map(note => note.userName).filter(Boolean))) as string[];

  const filteredNotes = notes.filter((note) => {
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

      // Upload documents if any
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
          } catch (error) {
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
      toast.success("Note added successfully!");
    },
    onError: () => {
      toast.error("Failed to add note");
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
      toast.success("Note deleted");
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

  // Standalone document upload (not attached to a note)
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
      } catch (error) {
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
    // Reset input so same file can be selected again
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
      badge={
        <div className="flex gap-1">
          {notes.length > 0 && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 ml-1">
              {notes.length} notes
            </Badge>
          )}
          {documents && documents.length > 0 && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 ml-1">
              {documents.length} docs
            </Badge>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Note Input Form */}
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

            {/* Selected documents preview */}
            {selectedDocs.length > 0 && (
              <div className="space-y-1">
                {selectedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-md">
                    {getFileIcon(doc.file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{doc.file.name}</p>
                      <p className="text-[10px] text-slate-400">{formatFileSize(doc.file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={() => removeDoc(idx)}
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
                Photos
              </Button>
              <Button onClick={() => docInputRef.current?.click()} variant="outline" size="sm" className="border-slate-200">
                <Paperclip className="mr-2 h-3 w-3" />
                Documents
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createNoteMutation.isPending || uploadDocMutation.isPending}
                className="ml-auto bg-slate-800 hover:bg-slate-900 text-white"
              >
                {createNoteMutation.isPending || uploadDocMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        {documents && documents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowDocuments(!showDocuments)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
              >
                <Paperclip className="h-4 w-4" />
                Documents ({documents.length})
                <span className="text-xs text-slate-400">{showDocuments ? "▼" : "▶"}</span>
              </button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 h-7 text-xs"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip";
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) handleStandaloneDocUpload(files);
                  };
                  input.click();
                }}
              >
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </div>
            
            {showDocuments && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 hover:bg-slate-50/50 group">
                    {getFileIcon(doc.mimeType)}
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline truncate block"
                      >
                        {doc.fileName}
                      </a>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{doc.uploaderName || "Unknown"}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-500"
                        onClick={() => {
                          if (confirm(`Delete "${doc.fileName}"?`)) {
                            deleteDocMutation.mutate({ id: doc.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state for documents when no documents exist */}
        {(!documents || documents.length === 0) && (
          <div
            className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip";
              input.multiple = true;
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleStandaloneDocUpload(files);
              };
              input.click();
            }}
          >
            <Paperclip className="h-5 w-5 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Click to upload documents (PDF, DOC, XLS, etc.)</p>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          {noteUsers.length > 0 && (
            <select
              value={selectedUser || ""}
              onChange={(e) => setSelectedUser(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 cursor-pointer"
            >
              <option value="">All Users ({notes.length})</option>
              {noteUsers.map((user) => {
                const userNoteCount = notes.filter(note => note.userName === user).length;
                return (
                  <option key={user} value={user}>
                    {user} ({userNoteCount})
                  </option>
                );
              })}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-200">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Notes Table */}
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
              {filteredNotes.map((note) => {
                const noteDocuments = documents?.filter(d => d.noteId === note.id) || [];
                return (
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
                      
                      {/* Photos attached to this note */}
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

                      {/* Documents attached to this note */}
                      {noteDocuments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {noteDocuments.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded border border-slate-100 group/doc">
                              {getFileIcon(doc.mimeType)}
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-slate-600 hover:text-blue-600 hover:underline truncate flex-1"
                              >
                                {doc.fileName}
                              </a>
                              <span className="text-[10px] text-slate-400">{formatFileSize(doc.fileSize)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-slate-300 hover:text-red-500 opacity-0 group-hover/doc:opacity-100 transition-opacity"
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

function readFileAsBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
