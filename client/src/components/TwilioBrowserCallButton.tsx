import { useState, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Device, Call } from "@twilio/voice-sdk";

interface TwilioBrowserCallButtonProps {
  phoneNumber: string;
  propertyId: number;
  contactId: number;
  contactName: string;
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
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  // Get Twilio access token - only fetch when needed
  const { data: tokenData, refetch: refetchToken } = trpc.twilio.getAccessToken.useQuery(undefined, {
    enabled: false, // Don't fetch automatically
  });

  // Initialize Twilio Device on demand (when user clicks call button)
  const initializeDevice = async () => {
    if (isInitializing) return;
    
    try {
      setIsInitializing(true);

      // Fetch token if not already available
      let token = tokenData?.token;
      if (!token) {
        const result = await refetchToken();
        token = result.data?.token;
      }

      if (!token) {
        toast.error("Failed to get calling credentials");
        setIsInitializing(false);
        return;
      }

      // Only initialize if not already initialized
      if (deviceRef.current) {
        await makeCall();
        setIsInitializing(false);
        return;
      }

      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      device.on("registered", () => {
        console.log("[Twilio] Device registered");
      });

      device.on("error", (error) => {
        console.error("[Twilio] Device error:", error);
        toast.error(error.message || "Failed to initialize calling device");
        setCallState("idle");
        setIsInitializing(false);
      });

      device.register();
      deviceRef.current = device;
      setIsInitializing(false);

      // Make the call after device is ready
      await makeCall();
    } catch (error: any) {
      console.error("[Twilio] Initialization error:", error);
      toast.error(error.message || "Failed to initialize calling device");
      setCallState("idle");
      setIsInitializing(false);
    }
  };

  const makeCall = async () => {
    if (!deviceRef.current) {
      toast.error("Please wait for the calling device to initialize");
      return;
    }

    try {
      setCallState("connecting");

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
        console.log("[Twilio] Call accepted");
        setCallState("in-call");
        toast.success(`Connected to ${contactName}`);
      });

      call.on("disconnect", () => {
        console.log("[Twilio] Call disconnected");
        setCallState("idle");
        setIsMuted(false);
        callRef.current = null;
        toast.info("The call has been disconnected");
      });

      call.on("error", (error) => {
        console.error("[Twilio] Call error:", error);
        setCallState("idle");
        setIsMuted(false);
        callRef.current = null;
        toast.error(error.message || "Failed to connect the call");
      });

      call.on("ringing", () => {
        console.log("[Twilio] Call ringing");
        setCallState("ringing");
      });
    } catch (error: any) {
      console.error("[Twilio] Failed to make call:", error);
      setCallState("idle");
      toast.error(error.message || "Failed to initiate the call");
    }
  };

  const hangUp = () => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    setCallState("idle");
    setIsMuted(false);
  };

  const toggleMute = () => {
    if (callRef.current) {
      callRef.current.mute(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  // Cleanup on unmount
  const cleanup = () => {
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
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
