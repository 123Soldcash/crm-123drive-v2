import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PropertyCheckInProps {
  propertyId: number;
}

export function PropertyCheckIn({ propertyId }: PropertyCheckInProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInNotes, setCheckInNotes] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [location, setLocation] = useState<{ lat: string; lng: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const checkInMutation = trpc.visits.checkIn.useMutation({
    onSuccess: () => {
      utils.visits.byProperty.invalidate({ propertyId });
      setCheckInNotes("");
      setLocation(null);
      toast.success("Check-in successful!");
    },
    onError: () => {
      toast.error("Failed to check in");
    },
  });

  const uploadPhotosMutation = trpc.photos.uploadBulk.useMutation({
    onSuccess: (data) => {
      utils.photos.byProperty.invalidate({ propertyId });
      setSelectedImages([]);
      setPhotoCaptions({});
      toast.success(`${data.count} photo(s) uploaded successfully!`);
    },
    onError: () => {
      toast.error("Failed to upload photos");
    },
  });

  const getCurrentLocation = (): Promise<{ lat: string; lng: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  };

  const handleCheckIn = async () => {
    // Require at least one photo
    if (selectedImages.length === 0) {
      toast.error("Please take at least one photo before checking in");
      return;
    }

    setIsCheckingIn(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);

      // Create check-in
      const visitResult: any = await checkInMutation.mutateAsync({
        propertyId,
        latitude: loc.lat,
        longitude: loc.lng,
        notes: checkInNotes || undefined,
      });

      // Upload photos with visit ID
      const photos = selectedImages.map((img, idx) => ({
        fileData: img,
        caption: photoCaptions[idx] || undefined,
      }));

      await uploadPhotosMutation.mutateAsync({
        propertyId,
        visitId: visitResult.id,
        photos,
        latitude: loc.lat,
        longitude: loc.lng,
      });
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Failed to complete check-in. Please try again.");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    
    fileArray.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImages((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setPhotoCaptions((prev) => {
      const newCaptions = { ...prev };
      delete newCaptions[index];
      return newCaptions;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Field Visit Check-In</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Photos (Required - at least 1)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedImages.length === 0 ? (
            <div className="space-y-2">
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                  }
                }}
                variant="outline"
                className="w-full"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photos
              </Button>
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.click();
                  }
                }}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose from Gallery
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={img}
                      alt={`Selected ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Input
                      placeholder="Caption (optional)"
                      value={photoCaptions[idx] || ""}
                      onChange={(e) =>
                        setPhotoCaptions((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      className="mt-1 text-xs"
                    />
                  </div>
                ))}
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Camera className="mr-2 h-3 w-3" />
                Add More Photos
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Visit Notes (Optional)</label>
          <Textarea
            placeholder="Add notes about this visit..."
            value={checkInNotes}
            onChange={(e) => setCheckInNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button
          onClick={handleCheckIn}
          disabled={isCheckingIn || checkInMutation.isPending || uploadPhotosMutation.isPending || selectedImages.length === 0}
          className="w-full"
          size="lg"
        >
          <MapPin className="mr-2 h-5 w-5" />
          {isCheckingIn
            ? "Checking In..."
            : selectedImages.length === 0
            ? "Add Photos to Check In"
            : `Check In with ${selectedImages.length} Photo(s)`}
        </Button>

        {location && (
          <p className="text-xs text-muted-foreground text-center">
            Location: {parseFloat(location.lat).toFixed(6)}, {parseFloat(location.lng).toFixed(6)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
