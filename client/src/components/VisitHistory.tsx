import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VisitHistoryProps {
  propertyId: number;
}

export function VisitHistory({ propertyId }: VisitHistoryProps) {
  const { data: visits, isLoading } = trpc.visits.byProperty.useQuery({ propertyId }) as { data: any[] | undefined; isLoading: boolean };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading visits...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit History ({visits?.length || 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {visits && visits.length > 0 ? (
          <div className="space-y-4">
            {visits.map((visit) => (
              <div key={visit.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{visit.userName || "Unknown User"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(visit.checkInTime).toLocaleString()}</span>
                    </div>
                    {visit.latitude && visit.longitude && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {parseFloat(visit.latitude).toFixed(6)}, {parseFloat(visit.longitude).toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View on Map
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                {visit.notes && (
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {visit.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No visits recorded yet. Check in when you arrive at the property.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface PhotoGalleryProps {
  propertyId: number;
}

export function PhotoGallery({ propertyId }: PhotoGalleryProps) {
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
        <CardHeader>
          <CardTitle>Property Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading photos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Photos ({photos?.length || 0})</CardTitle>
      </CardHeader>
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
    </Card>
  );
}
