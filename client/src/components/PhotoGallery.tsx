import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PhotoGalleryProps {
  propertyId: number;
}

export function PhotoGallery({ propertyId }: PhotoGalleryProps) {
  // localStorage persistence for ADHD-friendly collapsed state
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showPropertyPhotos');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Save state to localStorage whenever it changes
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
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Property Photos</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs"
          >
            {isExpanded ? "Hide" : "Show"}
          </Button>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <p className="text-sm text-muted-foreground">Loading photos...</p>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Property Photos ({photos?.length || 0})</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs"
        >
          {isExpanded ? "Hide" : "Show"}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.fileUrl}
                    alt={photo.caption || "Property photo"}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col justify-between p-2">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="ml-auto"
                      onClick={() => deletePhotoMutation.mutate({ id: photo.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="text-white text-xs space-y-1">
                      {photo.caption && <p className="font-medium">{photo.caption}</p>}
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
            <p className="text-sm text-muted-foreground">
              No photos yet. Upload photos when you visit the property.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
