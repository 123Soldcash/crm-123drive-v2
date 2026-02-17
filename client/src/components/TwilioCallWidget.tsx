/**
 * TwilioCallWidget — Small phone button that opens the CallModal
 * 
 * This is the inline button shown next to phone numbers in the contacts table.
 * Clicking it opens the full CallModal with call controls and notes.
 */
import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallModal } from "./CallModal";

interface TwilioCallWidgetProps {
  phoneNumber: string;
  contactName: string;
  contactId?: number;
  propertyId?: number;
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

export function TwilioCallWidget({ phoneNumber, contactName, contactId, propertyId }: TwilioCallWidgetProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="h-7 w-7 p-0 hover:bg-green-50 rounded-full"
        title={`Call ${contactName}`}
      >
        <Phone className="h-3.5 w-3.5 text-green-600" />
      </Button>

      {modalOpen && (
        <CallModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          phoneNumber={formatE164(phoneNumber)}
          contactName={contactName}
          contactId={contactId ?? 0}
          propertyId={propertyId ?? 0}
        />
      )}
    </>
  );
}
