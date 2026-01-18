import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface PhotoGalleryProps {
  propertyId: number;
}

export function PhotoGallery({ propertyId }: PhotoGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showPropertyPhotos');
    return saved ? JSON.parse(saved) : false;
  });
  
  useEffect(() => {
    localStorage.setItem('showPropertyPhotos', JSON.stringify(isExpanded));
  }, [isExpanded]);

  const { data: photos, isLoading } = trpc.photos.byProperty.useQuery({ propertyId });
  const utils = trpc.useUtils();

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      utils.photos.byProperty.invalidate({ propertyId });
      toast.success("Photo deleted");
    },
    onError: () => {
      toast.error("Failed to delete photo");
    },
  });

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading photos...</div>;
  }

  return (
    <CollapsibleSection
      title="Property Photos"
      icon={ImageIcon}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="gray"
      badge={photos && photos.length > 0 ? (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 ml-1">
          {photos.length}
        </Badge>
      ) : null}
    >
      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.fileUrl}
                alt={photo.caption || "Property photo"}
                className="w-full h-48 object-cover rounded-lg border border-slate-100"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col justify-between p-2">
                <Button
                  variant="destructive"
                  size="icon"
                  className="ml-auto h-8 w-8"
                  onClick={() => deletePhotoMutation.mutate({ id: photo.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="text-white text-[10px] space-y-0.5">
                  {photo.caption && <p className="font-medium truncate">{photo.caption}</p>}
                  <p className="text-white/80">
                    {new Date(photo.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-white/80">By: {photo.userName || "Unknown"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <ImageIcon className="h-8 w-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No photos yet.</p>
        </div>
      )}
    </CollapsibleSection>
  );
}
