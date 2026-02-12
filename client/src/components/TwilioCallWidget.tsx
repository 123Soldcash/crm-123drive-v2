/**
 * TwilioCallWidget — Browser-based phone calling via Twilio Voice SDK.
 *
 * Flow:
 * 1. User clicks the green phone icon
 * 2. We fetch a fresh Access Token from the backend
 * 3. We lazy-load @twilio/voice-sdk and create a Device
 * 4. Device.connect({ params: { To: number } }) initiates the call
 * 5. Twilio hits our /api/twilio/voice endpoint for TwiML instructions
 * 6. The call connects and audio flows through the browser
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Types ──────────────────────────────────────────────────────────────────

type CallState = "idle" | "initializing" | "connecting" | "ringing" | "connected";

interface TwilioCallWidgetProps {
  phoneNumber: string;
  contactName: string;
}

// ─── Lazy SDK Loader ────────────────────────────────────────────────────────

let _sdkModule: typeof import("@twilio/voice-sdk") | null = null;

async function loadTwilioSDK() {
  if (!_sdkModule) {
    _sdkModule = await import("@twilio/voice-sdk");
  }
  return _sdkModule;
}

// ─── Phone Number Formatter (client-side) ───────────────────────────────────

function formatE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return `+1${digits}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TwilioCallWidget({ phoneNumber, contactName }: TwilioCallWidgetProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch token on demand (disabled by default)
  const { refetch: fetchToken } = trpc.twilio.getAccessToken.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  // ─── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch (_) { /* ignore */ }
      callRef.current = null;
    }
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch (_) { /* ignore */ }
      deviceRef.current = null;
    }
  }, []);

  // Safe state setter — only updates if component is still mounted
  const safeSet = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  // ─── Call Timer ─────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      if (mountedRef.current) setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Initiate Call ──────────────────────────────────────────────────────

  const startCall = async () => {
    if (callState !== "idle") return;

    try {
      safeSet(setCallState, "initializing");

      // 1. Get fresh access token
      const result = await fetchToken();
      const token = result.data?.token;

      if (!token) {
        toast.error("Could not get calling credentials. Please try again.");
        safeSet(setCallState, "idle");
        return;
      }

      // 2. Load Twilio SDK
      const { Device, Call } = await loadTwilioSDK();

      // 3. Destroy any stale device
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch (_) { /* ignore */ }
      }

      // 4. Create new Device
      const device = new Device(token, {
        logLevel: 0, // Silent
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        closeProtection: true,
      });

      deviceRef.current = device;

      // 5. Register device (opens signaling WebSocket)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Device registration timed out (10s). Check your internet connection."));
        }, 10_000);

        device.on("registered", () => {
          clearTimeout(timeout);
          resolve();
        });

        device.on("error", (err: any) => {
          clearTimeout(timeout);
          reject(err);
        });

        device.register();
      });

      if (!mountedRef.current) return;

      // 6. Connect the call
      safeSet(setCallState, "connecting");

      const formattedNumber = formatE164(phoneNumber);
      const call = await device.connect({
        params: { To: formattedNumber },
      });

      callRef.current = call;

      // ─── Call Event Handlers ──────────────────────────────────────

      call.on("ringing", () => {
        safeSet(setCallState, "ringing");
      });

      call.on("accept", () => {
        safeSet(setCallState, "connected");
        startTimer();
        toast.success(`Connected to ${contactName}`);
      });

      call.on("disconnect", () => {
        stopTimer();
        safeSet(setCallState, "idle");
        safeSet(setIsMuted, false);
        safeSet(setElapsed, 0);
        callRef.current = null;
        toast.info("Call ended");
      });

      call.on("cancel", () => {
        stopTimer();
        safeSet(setCallState, "idle");
        safeSet(setIsMuted, false);
        safeSet(setElapsed, 0);
        callRef.current = null;
      });

      call.on("error", (error: any) => {
        stopTimer();
        safeSet(setCallState, "idle");
        safeSet(setIsMuted, false);
        safeSet(setElapsed, 0);
        callRef.current = null;
        toast.error(friendlyError(error));
      });
    } catch (error: any) {
      safeSet(setCallState, "idle");
      cleanup();
      toast.error(friendlyError(error));
    }
  };

  // ─── Hang Up ────────────────────────────────────────────────────────────

  const hangUp = useCallback(() => {
    stopTimer();
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch (_) { /* ignore */ }
      callRef.current = null;
    }
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch (_) { /* ignore */ }
      deviceRef.current = null;
    }
    setCallState("idle");
    setIsMuted(false);
    setElapsed(0);
  }, [stopTimer]);

  // ─── Mute Toggle ───────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const newMuted = !isMuted;
      callRef.current.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // ─── Error Messages ────────────────────────────────────────────────────

  function friendlyError(error: any): string {
    const code = error?.code;
    switch (code) {
      case 31000: return "Call service unavailable. Please try again.";
      case 31005: return "Connection error. Check your internet.";
      case 31009: return "Transport error. Please try again.";
      case 31205: return "Token expired. Please refresh and try again.";
      default: return error?.message || "Call failed. Please try again.";
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  // IDLE state — green phone button
  if (callState === "idle") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={startCall}
        className="h-7 w-7 p-0 hover:bg-green-50 rounded-full"
        title={`Call ${contactName}`}
      >
        <Phone className="h-3.5 w-3.5 text-green-600" />
      </Button>
    );
  }

  // INITIALIZING state — spinner
  if (callState === "initializing") {
    return (
      <div className="flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        <span className="text-xs text-muted-foreground">Starting...</span>
      </div>
    );
  }

  // CONNECTING / RINGING state
  if (callState === "connecting" || callState === "ringing") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-amber-600 font-medium animate-pulse">
          {callState === "connecting" ? "Connecting..." : "Ringing..."}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={hangUp}
          className="h-7 w-7 p-0 hover:bg-red-50 rounded-full"
          title="Cancel"
        >
          <PhoneOff className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    );
  }

  // CONNECTED state — timer, mute, hang up
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-green-600 font-medium min-w-[3rem]">
        {formatTime(elapsed)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleMute}
        className="h-7 w-7 p-0 rounded-full"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <MicOff className="h-3.5 w-3.5 text-orange-500" />
        ) : (
          <Mic className="h-3.5 w-3.5 text-gray-500" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={hangUp}
        className="h-7 w-7 p-0 hover:bg-red-50 rounded-full"
        title="Hang up"
      >
        <PhoneOff className="h-3.5 w-3.5 text-red-500" />
      </Button>
    </div>
  );
}
