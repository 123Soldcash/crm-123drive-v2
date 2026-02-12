import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface TwilioBrowserCallButtonProps {
  phoneNumber: string;
  propertyId: number;
  contactId: number;
  contactName: string;
}

// Lazy-load Twilio Voice SDK only when user clicks call
let twilioModule: typeof import("@twilio/voice-sdk") | null = null;
async function getTwilioSDK() {
  if (!twilioModule) {
    twilioModule = await import("@twilio/voice-sdk");
  }
  return twilioModule;
}

export function TwilioBrowserCallButton({
  phoneNumber,
  propertyId,
  contactId,
  contactName,
}: TwilioBrowserCallButtonProps) {

  const [callState, setCallState] = useState<"idle" | "connecting" | "ringing" | "in-call">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Get Twilio access token - only fetch when needed
  const { refetch: refetchToken } = trpc.twilio.getAccessToken.useQuery(undefined, {
    enabled: false, // Don't fetch automatically
  });

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (callRef.current) {
        try { callRef.current.disconnect(); } catch (_) {}
        callRef.current = null;
      }
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch (_) {}
        deviceRef.current = null;
      }
    };
  }, []);

  // Helper to safely update state only when mounted
  const safeSetCallState = useCallback((state: typeof callState) => {
    if (isMountedRef.current) setCallState(state);
  }, []);

  // Map Twilio error codes to user-friendly messages
  const getTwilioErrorMessage = (error: any): string => {
    const code = error?.code;
    if (code === 31005) {
      return "Connection error. Please check your internet and try again.";
    } else if (code === 31000) {
      return "Call service temporarily unavailable. Please try again in a moment.";
    } else if (code === 31009) {
      return "Call service transport error. Please try again.";
    } else if (error?.message) {
      return error.message;
    }
    return "Call connection failed. Please try again.";
  };

  // Initialize Twilio Device on demand (when user clicks call button)
  const initializeDevice = async () => {
    if (isInitializing) return;
    
    try {
      setIsInitializing(true);

      // Always fetch a fresh token
      const result = await refetchToken();
      const token = result.data?.token;

      if (!token) {
        toast.error("Failed to get calling credentials. Please try again.");
        setIsInitializing(false);
        return;
      }

      // Lazy-load Twilio SDK
      const { Device, Call } = await getTwilioSDK();

      // Destroy old device if it exists (stale connection)
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch (_) {}
        deviceRef.current = null;
      }

      // Temporarily suppress console.error during Device initialization
      // Twilio SDK internally logs errors we can't control
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const suppressTwilioLogs = () => {
        console.error = (...args: any[]) => {
          const msg = args.map(a => String(a)).join(" ");
          // Suppress known Twilio internal errors
          if (msg.includes("[TwilioVoice]") || msg.includes("31000") || msg.includes("31005") || msg.includes("WebSocket")) {
            return; // Silently ignore
          }
          originalConsoleError.apply(console, args);
        };
        console.warn = (...args: any[]) => {
          const msg = args.map(a => String(a)).join(" ");
          if (msg.includes("[TwilioVoice]")) {
            return;
          }
          originalConsoleWarn.apply(console, args);
        };
      };
      const restoreConsoleLogs = () => {
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
      };

      suppressTwilioLogs();

      const device = new Device(token, {
        logLevel: 0, // Silent - suppress all internal SDK logging
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        closeProtection: true,
      });

      // Wait for device to register before making a call
      const registrationPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          restoreConsoleLogs();
          reject(new Error("Device registration timed out. Please check your internet connection."));
        }, 10000);

        device.on("registered", () => {
          clearTimeout(timeout);
          restoreConsoleLogs();
          resolve();
        });

        device.on("error", (error: any) => {
          clearTimeout(timeout);
          restoreConsoleLogs();

          if (isMountedRef.current) {
            toast.error(getTwilioErrorMessage(error));
            setCallState("idle");
            setIsInitializing(false);
          }
          reject(error);
        });
      });

      device.register();
      deviceRef.current = device;

      // Wait for registration to complete
      await registrationPromise;

      if (!isMountedRef.current) return;
      setIsInitializing(false);

      // Make the call after device is registered
      await makeCall();
    } catch (error: any) {
      if (isMountedRef.current) {
        // Don't show duplicate toast if error handler already showed one
        const code = error?.code;
        if (!code) {
          toast.error(error.message || "Failed to initialize calling device. Please try again.");
        }
        setCallState("idle");
        setIsInitializing(false);
      }
      // Clean up failed device
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch (_) {}
        deviceRef.current = null;
      }
    }
  };

  const makeCall = async () => {
    if (!deviceRef.current) {
      toast.error("Please wait for the calling device to initialize");
      return;
    }

    try {
      safeSetCallState("connecting");

      // Format phone number (remove non-digits, add +1 if needed)
      const digits = phoneNumber.replace(/\D/g, "");
      const formattedNumber = digits.length === 10 ? `+1${digits}` : `+${digits}`;

      const call = await deviceRef.current.connect({
        params: {
          To: formattedNumber,
        },
      });

      callRef.current = call;

      call.on("accept", () => {
        safeSetCallState("in-call");
        toast.success(`Connected to ${contactName}`);
      });

      call.on("disconnect", () => {
        safeSetCallState("idle");
        if (isMountedRef.current) setIsMuted(false);
        callRef.current = null;
        toast.info("The call has been disconnected");
      });

      call.on("error", (error: any) => {
        safeSetCallState("idle");
        if (isMountedRef.current) setIsMuted(false);
        callRef.current = null;
        toast.error(getTwilioErrorMessage(error));
      });

      call.on("ringing", () => {
        safeSetCallState("ringing");
      });
    } catch (error: any) {
      safeSetCallState("idle");
      toast.error(error.message || "Failed to initiate the call. Please try again.");
    }
  };

  const hangUp = () => {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch (_) {}
      callRef.current = null;
    }
    setCallState("idle");
    setIsMuted(false);
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch (_) {}
      deviceRef.current = null;
    }
  };

  const toggleMute = () => {
    if (callRef.current) {
      callRef.current.mute(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  if (callState === "idle") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={initializeDevice}
        disabled={isInitializing}
        className="h-8 w-8 p-0 hover:bg-green-50"
        title={`Call ${contactName}`}
      >
        <Phone className="h-4 w-4 text-green-600" />
      </Button>
    );
  }

  if (callState === "connecting" || callState === "ringing") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {callState === "connecting" ? "Connecting..." : "Ringing..."}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={hangUp}
          className="h-8 w-8 p-0 hover:bg-red-50"
          title="Cancel call"
        >
          <PhoneOff className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  // In-call state
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-green-600">In Call</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleMute}
        className="h-8 w-8 p-0"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <MicOff className="h-4 w-4 text-orange-600" />
        ) : (
          <Mic className="h-4 w-4 text-gray-600" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={hangUp}
        className="h-8 w-8 p-0 hover:bg-red-50"
        title="Hang up"
      >
        <PhoneOff className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  );
}
