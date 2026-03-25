/**
 * TwilioCallWidget — Small phone button that opens a number selector, then the CallModal
 * 
 * If the property has a primaryTwilioNumber set, clicking the button will
 * skip the number selector and immediately open the CallModal with that number.
 * If no primary number is set, the dropdown appears to let the user choose.
 */
import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CallModal } from "./CallModal";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
import { toast } from "sonner";

interface TwilioCallWidgetProps {
  phoneNumber: string;
  contactName: string;
  contactId?: number;
  propertyId?: number;
  primaryTwilioNumber?: string | null;
}

/**
 * Format phone number to E.164 format for Twilio
 */
function formatE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return `+1${digits}`;
}

export function TwilioCallWidget({ phoneNumber, contactName, contactId, propertyId, primaryTwilioNumber }: TwilioCallWidgetProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string>("");

  const numbersQuery = trpc.twilio.listNumbers.useQuery({ activeOnly: true }, {
    enabled: selectorOpen, // Only fetch when dropdown opens
  });

  function handleSelectNumber(phone: string) {
    setSelectedNumber(phone);
    setSelectorOpen(false);
    setModalOpen(true);
  }

  function handleCallClick() {
    // If property has a primary Twilio number, skip the selector and use it directly
    if (primaryTwilioNumber) {
      setSelectedNumber(primaryTwilioNumber);
      setModalOpen(true);
    } else {
      setSelectorOpen(true);
    }
  }

  const numbers = numbersQuery.data || [];

  return (
    <>
      <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCallClick}
            className="h-7 w-7 p-0 hover:bg-green-50 rounded-full"
            title={primaryTwilioNumber ? `Call ${contactName} (using default: ${formatPhone(primaryTwilioNumber)})` : `Call ${contactName}`}
          >
            <Phone className="h-3.5 w-3.5 text-green-600" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Select caller number:</p>
          {numbersQuery.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-3 px-2">
              <p className="text-sm text-muted-foreground">No Twilio numbers available.</p>
              <p className="text-xs text-muted-foreground mt-1">Ask an admin to add numbers in Settings.</p>
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
              {numbers.map((num: any) => (
                <button
                  key={num.id}
                  onClick={() => handleSelectNumber(num.phoneNumber)}
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Phone className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{num.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatPhone(num.phoneNumber)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {modalOpen && (
        <CallModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          phoneNumber={formatE164(phoneNumber)}
          contactName={contactName}
          contactId={contactId ?? 0}
          propertyId={propertyId ?? 0}
          callerPhone={selectedNumber}
        />
      )}
    </>
  );
}
