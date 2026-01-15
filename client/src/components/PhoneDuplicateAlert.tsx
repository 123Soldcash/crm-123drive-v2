import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface PhoneDuplicateAlertProps {
  phoneNumber: string;
  onDismiss?: () => void;
}

export function PhoneDuplicateAlert({ phoneNumber, onDismiss }: PhoneDuplicateAlertProps) {
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [, setLocation] = useLocation();

  // Debounce phone number input (wait 500ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only search if phone has at least 7 digits
      const digitsOnly = phoneNumber.replace(/\D/g, '');
      if (digitsOnly.length >= 7) {
        setDebouncedPhone(phoneNumber);
      } else {
        setDebouncedPhone("");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [phoneNumber]);

  const { data: duplicates, isLoading } = trpc.properties.searchLeadsByPhone.useQuery(
    { phoneNumber: debouncedPhone },
    { enabled: debouncedPhone.length > 0 }
  );

  if (isLoading || !duplicates || duplicates.length === 0) {
    return null;
  }

  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="ml-2">
        <div className="flex flex-col gap-2">
          <p className="font-medium text-yellow-800">
            ⚠️ Phone number already exists in {duplicates.length} lead{duplicates.length > 1 ? 's' : ''}
          </p>
          
          <div className="space-y-2">
            {duplicates.slice(0, 3).map((dup) => (
              <div key={dup.propertyId} className="flex items-center justify-between bg-white/50 p-2 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{dup.address}</p>
                  <p className="text-xs text-gray-600">
                    {dup.owner} • {dup.leadTemperature} • {dup.deskStatus}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dup.phoneType}: {dup.phoneNumber}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/properties/${dup.propertyId}`)}
                  className="ml-2"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View
                </Button>
              </div>
            ))}
            
            {duplicates.length > 3 && (
              <p className="text-xs text-gray-600">
                +{duplicates.length - 3} more lead{duplicates.length - 3 > 1 ? 's' : ''} with this phone number
              </p>
            )}
          </div>

          {onDismiss && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDismiss}
              className="mt-2 w-full"
            >
              Add Anyway
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
