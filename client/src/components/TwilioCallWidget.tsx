/**
 * TwilioCallWidget — Phone calling from the CRM.
 *
 * Strategy (dual-mode):
 * 1. PRIMARY: Server-side REST API call (always works)
 *    - Backend tells Twilio to call the user's browser client
 *    - When browser answers, Twilio bridges to the destination
 *    - Requires the Twilio Voice SDK to receive the incoming call
 *
 * 2. FALLBACK: Direct browser-to-Twilio (Device.connect)
 *    - Only works when WebSocket to Twilio signaling servers is available
 *    - May fail behind proxies or restrictive networks (error 31000)
 *
 * The widget automatically handles both modes transparently.
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

  // Server-side call mutation
  const makeCallMutation = trpc.twilio.makeCall.useMutation();

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

  // ─── Setup Device to receive incoming call from REST API ───────────────

  async function setupDeviceForIncoming(token: string): Promise<any> {
    const { Device, Call } = await loadTwilioSDK();

    // Destroy any stale device
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch (_) { /* ignore */ }
    }

    const device = new Device(token, {
      logLevel: 1,
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      closeProtection: true,
      // Try multiple edge locations for better connectivity
      edge: ["ashburn", "umatilla", "roaming"],
    });

    deviceRef.current = device;

    // Register device — this opens the signaling WebSocket
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Device registration timed out (15s)."));
      }, 15_000);

      device.on("registered", () => {
        clearTimeout(timeout);
        console.log("[TwilioCallWidget] Device registered successfully");
        resolve();
      });

      device.on("error", (err: any) => {
        console.error("[TwilioCallWidget] Device error:", err.code, err.message);
        // Don't reject on 31000 during registration — it might recover
        if (err.code === 31000) {
          console.warn("[TwilioCallWidget] WebSocket error 31000 — will retry with fallback");
        }
        clearTimeout(timeout);
        reject(err);
      });

      device.register();
    });

    return device;
  }

  // ─── Attach call event handlers ────────────────────────────────────────

  function attachCallHandlers(call: any) {
    callRef.current = call;

    call.on("accept", () => {
      console.log("[TwilioCallWidget] Call accepted/connected");
      safeSet(setCallState, "connected");
      startTimer();
      toast.success(`Connected to ${contactName}`);
    });

    call.on("disconnect", () => {
      console.log("[TwilioCallWidget] Call disconnected");
      stopTimer();
      safeSet(setCallState, "idle");
      safeSet(setIsMuted, false);
      safeSet(setElapsed, 0);
      callRef.current = null;
      toast.info("Call ended");
    });

    call.on("cancel", () => {
      console.log("[TwilioCallWidget] Call cancelled");
      stopTimer();
      safeSet(setCallState, "idle");
      safeSet(setIsMuted, false);
      safeSet(setElapsed, 0);
      callRef.current = null;
    });

    call.on("error", (error: any) => {
      console.error("[TwilioCallWidget] Call error:", error.code, error.message);
      stopTimer();
      safeSet(setCallState, "idle");
      safeSet(setIsMuted, false);
      safeSet(setElapsed, 0);
      callRef.current = null;
      toast.error(friendlyError(error));
    });
  }

  // ─── Primary: Server-side REST API call ────────────────────────────────

  async function startCallViaRestAPI(token: string) {
    try {
      // 1. Setup device to receive the incoming call from Twilio
      const device = await setupDeviceForIncoming(token);

      if (!mountedRef.current) return;

      // 2. Listen for incoming call
      device.on("incoming", (call: any) => {
        console.log("[TwilioCallWidget] Incoming call from REST API bridge");
        safeSet(setCallState, "connecting");
        attachCallHandlers(call);
        // Auto-accept the incoming call (it's from our own REST API)
        call.accept();
      });

      safeSet(setCallState, "connecting");
      toast.info(`Calling ${contactName}...`);

      // 3. Tell the server to initiate the call
      const formattedNumber = formatE164(phoneNumber);
      await makeCallMutation.mutateAsync({ to: formattedNumber });

      console.log("[TwilioCallWidget] REST API call initiated, waiting for incoming...");

    } catch (error: any) {
      console.error("[TwilioCallWidget] REST API call failed:", error);
      // If device registration fails (31000), try direct browser call
      if (error?.code === 31000 || error?.message?.includes("timed out")) {
        console.log("[TwilioCallWidget] Falling back to direct browser call...");
        await startCallViaBrowserSDK(token);
      } else {
        throw error;
      }
    }
  }

  // ─── Fallback: Direct browser-to-Twilio call ──────────────────────────

  async function startCallViaBrowserSDK(token: string) {
    const { Device, Call } = await loadTwilioSDK();

    // Destroy any stale device
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch (_) { /* ignore */ }
    }

    const device = new Device(token, {
      logLevel: 1,
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      closeProtection: true,
      edge: ["ashburn", "umatilla", "roaming"],
    });

    deviceRef.current = device;

    // Register device
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Could not connect to calling service. Please check your internet connection and try again."));
      }, 15_000);

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

    safeSet(setCallState, "connecting");

    const formattedNumber = formatE164(phoneNumber);
    const call = await device.connect({
      params: { To: formattedNumber },
    });

    attachCallHandlers(call);

    call.on("ringing", () => {
      safeSet(setCallState, "ringing");
    });
  }

  // ─── Main Call Entry Point ─────────────────────────────────────────────

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

      // 2. Try REST API method first (most reliable)
      await startCallViaRestAPI(token);

    } catch (error: any) {
      console.error("[TwilioCallWidget] All call methods failed:", error);
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
    const msg = error?.message || "";
    const code = error?.code;

    // Network/WebSocket errors
    if (code === 31000 || msg.includes("WebSocket") || msg.includes("timed out")) {
      return "Network connection issue. The call could not be established. Please try again from the published site.";
    }
    if (code === 31005) return "Connection to calling service lost. Please try again.";
    if (code === 31009) return "No network connection available for calling.";
    if (code === 31205) return "Session expired. Please refresh the page and try again.";
    if (code === 31208) return "Microphone access denied. Please allow microphone access in your browser settings.";

    // Server errors
    if (msg.includes("not configured")) return "Twilio is not fully configured. Please check your credentials.";

    return msg || "Call failed. Please try again.";
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
