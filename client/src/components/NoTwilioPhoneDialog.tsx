/**
 * NoTwilioPhoneDialog
 *
 * Shown when a user tries to make a call or send an SMS but does not have
 * a Twilio phone number configured in their account profile.
 *
 * Prevents the action from reaching the server and generating a cryptic error.
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { PhoneOff } from "lucide-react";
import { useLocation } from "wouter";

interface NoTwilioPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "call" or "sms" — changes the dialog copy slightly */
  action?: "call" | "sms";
}

export function NoTwilioPhoneDialog({
  open,
  onOpenChange,
  action = "call",
}: NoTwilioPhoneDialogProps) {
  const [, navigate] = useLocation();

  const actionLabel = action === "sms" ? "send SMS messages" : "make calls";
  const actionIcon = action === "sms" ? "💬" : "📞";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <PhoneOff className="w-5 h-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-base leading-snug">
              No Twilio Phone Number Configured
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm leading-relaxed space-y-2 pt-1">
            <p>
              {actionIcon} To {actionLabel} from this CRM, your account needs a
              <strong> Twilio phone number</strong> assigned to it.
            </p>
            <p className="text-gray-500">
              Without it, the system cannot route the {action === "sms" ? "message" : "call"} and will return an error.
              Ask your administrator to assign a Twilio number to your account in{" "}
              <strong>User Management</strong>.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Close
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              navigate("/users");
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Go to User Management
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
