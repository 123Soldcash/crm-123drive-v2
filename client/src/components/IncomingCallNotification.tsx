/**
 * IncomingCallNotification — Global non-intrusive notification for incoming calls
 *
 * Sits in the bottom-right corner of the screen. When an incoming call arrives
 * via the Twilio Device SDK, it shows:
 *   - The caller's phone number
 *   - Accept (green) and Reject (red) buttons
 *   - A pulsing animation to draw attention
 *
 * This component initializes a Twilio Device on mount (if the user is logged in)
 * and listens for the "incoming" event. It does NOT block the user's workflow.
 *
 * The Device is kept alive globally so inbound calls can be received on any page.
 *
 * FREEZE PREVENTION:
 * - All Twilio operations wrapped in try/catch to prevent unhandled errors
 * - Device initialization is guarded against re-entry with a ref flag
 * - Token refresh is debounced to prevent rapid re-initialization
 * - WebSocket errors are caught and logged without blocking the UI
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  X,
  User,
  Clock,
} from "lucide-react";

type IncomingCallState = "idle" | "ringing" | "active" | "ended";

export function IncomingCallNotification() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<IncomingCallState>("idle");
  const [callerNumber, setCallerNumber] = useState<string>("");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  // Guard against concurrent initialization
  const initializingRef = useRef(false);
  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Debounce token refresh
  const lastInitTimeRef = useRef(0);

  // Heartbeat mutation — called every 30s when Device is registered
  const heartbeatMutation = trpc.twilio.heartbeat.useMutation();
  const goOfflineMutation = trpc.twilio.goOffline.useMutation();
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch access token for Twilio Device SDK
  const { data: tokenData, refetch: refetchToken } = trpc.twilio.getAccessToken.useQuery(
    undefined,
    {
      enabled: !!user,
      staleTime: 1000 * 60 * 25, // 25 min (tokens last 60 min)
      retry: 2,
      // Prevent refetch storms
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  // Initialize Twilio Device for receiving incoming calls
  const initializeDevice = useCallback(async (token: string) => {
    // Guard: prevent concurrent initialization
    if (initializingRef.current) {
      console.log("[IncomingCall] Already initializing, skipping...");
      return;
    }

    // Guard: debounce — don't re-init within 5 seconds
    const now = Date.now();
    if (now - lastInitTimeRef.current < 5000) {
      console.log("[IncomingCall] Debounced — last init was <5s ago");
      return;
    }

    initializingRef.current = true;
    lastInitTimeRef.current = now;

    // Destroy any existing device safely
    if (deviceRef.current) {
      try {
        deviceRef.current.removeAllListeners();
        deviceRef.current.destroy();
      } catch (e) {
        console.warn("[IncomingCall] Error destroying old device:", e);
      }
      deviceRef.current = null;
      if (mountedRef.current) setDeviceReady(false);
    }

    try {
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        edge: ["ashburn", "umatilla", "roaming"] as unknown as string[],
        maxCallSignalingTimeoutMs: 15000,
      });

      // Listen for incoming calls
      device.on("incoming", (call: Call) => {
        if (!mountedRef.current) return;
        try {
          console.log("[IncomingCall] Incoming call from:", call.parameters?.From);
          incomingCallRef.current = call;
          setCallerNumber(call.parameters?.From || "Unknown");
          setCallState("ringing");

          // Auto-reject after 30 seconds if not answered
          const autoRejectTimeout = setTimeout(() => {
            if (incomingCallRef.current && mountedRef.current) {
              try {
                console.log("[IncomingCall] Auto-rejecting after 30s timeout");
                incomingCallRef.current.reject();
              } catch (e) {
                console.warn("[IncomingCall] Error auto-rejecting:", e);
              }
              if (mountedRef.current) {
                setCallState("idle");
                setCallerNumber("");
              }
              incomingCallRef.current = null;
            }
          }, 30000);

          // Listen for call events
          call.on("cancel", () => {
            console.log("[IncomingCall] Call cancelled by caller");
            clearTimeout(autoRejectTimeout);
            if (mountedRef.current) {
              setCallState("idle");
              setCallerNumber("");
              toast.info("Incoming call was cancelled by the caller");
            }
            incomingCallRef.current = null;
          });

          call.on("disconnect", () => {
            console.log("[IncomingCall] Call disconnected");
            clearTimeout(autoRejectTimeout);
            if (mountedRef.current) {
              setCallState("ended");
            }
            incomingCallRef.current = null;
            // Clear duration timer
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }
            // Auto-hide after 3 seconds
            setTimeout(() => {
              if (mountedRef.current) {
                setCallState("idle");
                setCallerNumber("");
                setCallDuration(0);
                setIsMuted(false);
              }
            }, 3000);
          });

          call.on("reject", () => {
            console.log("[IncomingCall] Call rejected");
            clearTimeout(autoRejectTimeout);
            if (mountedRef.current) {
              setCallState("idle");
              setCallerNumber("");
            }
            incomingCallRef.current = null;
          });

          call.on("error", (err: any) => {
            console.warn("[IncomingCall] Call error:", err?.code, err?.message);
            // Don't freeze — just log and clean up
            clearTimeout(autoRejectTimeout);
            if (mountedRef.current) {
              setCallState("idle");
              setCallerNumber("");
            }
            incomingCallRef.current = null;
          });
        } catch (e) {
          console.error("[IncomingCall] Error handling incoming call:", e);
        }
      });

      device.on("registered", () => {
        console.log("[IncomingCall] Device registered — ready to receive calls");
        deviceRef.current = device;
        if (mountedRef.current) setDeviceReady(true);
        initializingRef.current = false;
        // Start heartbeat: send immediately, then every 30 seconds
        heartbeatMutation.mutate();
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (mountedRef.current) heartbeatMutation.mutate();
        }, 30_000);
      });

      device.on("error", (error: any) => {
        console.error("[IncomingCall] Device error:", error?.code, error?.message);
        // Don't try to re-initialize on error — just log it
        // The tokenWillExpire handler will refresh when needed
        initializingRef.current = false;
      });

      device.on("unregistered", () => {
        console.log("[IncomingCall] Device unregistered");
        if (mountedRef.current) setDeviceReady(false);
        initializingRef.current = false;
        // Stop heartbeat and mark user as offline
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (mountedRef.current) goOfflineMutation.mutate();
      });

      device.on("tokenWillExpire", () => {
        console.log("[IncomingCall] Token expiring, refreshing...");
        refetchToken().then(({ data }) => {
          if (data?.token && deviceRef.current && mountedRef.current) {
            try {
              deviceRef.current.updateToken(data.token);
              console.log("[IncomingCall] Token refreshed successfully");
            } catch (e) {
              console.warn("[IncomingCall] Error updating token:", e);
            }
          }
        }).catch((e) => {
          console.warn("[IncomingCall] Error refetching token:", e);
        });
      });

      // Register with timeout protection
      const registerTimeout = setTimeout(() => {
        if (initializingRef.current) {
          console.warn("[IncomingCall] Device registration timed out after 15s");
          initializingRef.current = false;
          // Still keep the device — it may register later
          deviceRef.current = device;
          if (mountedRef.current) setDeviceReady(true);
        }
      }, 15000);

      device.register().then(() => {
        clearTimeout(registerTimeout);
      }).catch((err) => {
        clearTimeout(registerTimeout);
        console.warn("[IncomingCall] Device register() rejected:", err);
        initializingRef.current = false;
        // Still keep the device reference — it may work for outbound
        deviceRef.current = device;
        if (mountedRef.current) setDeviceReady(true);
      });
    } catch (err: any) {
      console.error("[IncomingCall] Failed to create Device:", err);
      initializingRef.current = false;
    }
  }, [refetchToken]);

  // Initialize device when token is available
  useEffect(() => {
    if (tokenData?.token && user && !deviceReady && !initializingRef.current) {
      initializeDevice(tokenData.token);
    }

    return () => {
      // Only destroy on full unmount, not on re-renders
    };
  }, [tokenData?.token, user, deviceReady, initializeDevice]);

  // Full cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      initializingRef.current = false;
      // Stop heartbeat and mark offline on unmount
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      goOfflineMutation.mutate();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (incomingCallRef.current) {
        try { incomingCallRef.current.reject(); } catch {}
        incomingCallRef.current = null;
      }
      if (deviceRef.current) {
        try {
          deviceRef.current.removeAllListeners();
          deviceRef.current.destroy();
        } catch {}
        deviceRef.current = null;
      }
    };
  }, []);

  // Duration timer for active calls
  useEffect(() => {
    if (callState === "active" && !durationIntervalRef.current) {
      callStartTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current && mountedRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }
      }, 1000);
    }

    if (callState !== "active" && durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [callState]);

  // Accept the incoming call
  const handleAccept = useCallback(() => {
    if (incomingCallRef.current) {
      try {
        console.log("[IncomingCall] Accepting call from:", callerNumber);
        incomingCallRef.current.accept();
        setCallState("active");
        toast.success("Call connected");
      } catch (e) {
        console.error("[IncomingCall] Error accepting call:", e);
        toast.error("Failed to accept call");
        setCallState("idle");
        incomingCallRef.current = null;
      }
    }
  }, [callerNumber]);

  // Reject the incoming call
  const handleReject = useCallback(() => {
    if (incomingCallRef.current) {
      try {
        console.log("[IncomingCall] Rejecting call from:", callerNumber);
        incomingCallRef.current.reject();
      } catch (e) {
        console.warn("[IncomingCall] Error rejecting call:", e);
      }
      setCallState("idle");
      setCallerNumber("");
      incomingCallRef.current = null;
      toast.info("Call rejected");
    }
  }, [callerNumber]);

  // Hang up an active call
  const handleHangup = useCallback(() => {
    if (incomingCallRef.current) {
      try {
        console.log("[IncomingCall] Hanging up call");
        incomingCallRef.current.disconnect();
      } catch (e) {
        console.warn("[IncomingCall] Error hanging up:", e);
        // Force cleanup
        setCallState("idle");
        setCallerNumber("");
        incomingCallRef.current = null;
      }
    }
  }, []);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (incomingCallRef.current) {
      try {
        const newMuted = !isMuted;
        incomingCallRef.current.mute(newMuted);
        setIsMuted(newMuted);
      } catch (e) {
        console.warn("[IncomingCall] Error toggling mute:", e);
      }
    }
  }, [isMuted]);

  // Dismiss the ended notification
  const handleDismiss = useCallback(() => {
    setCallState("idle");
    setCallerNumber("");
    setCallDuration(0);
    setIsMuted(false);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't render anything if idle
  if (callState === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`
        rounded-xl shadow-2xl border-2 overflow-hidden w-80
        ${callState === "ringing" ? "border-green-500 bg-gradient-to-br from-gray-900 to-gray-800" : ""}
        ${callState === "active" ? "border-blue-500 bg-gradient-to-br from-gray-900 to-gray-800" : ""}
        ${callState === "ended" ? "border-gray-500 bg-gradient-to-br from-gray-900 to-gray-800" : ""}
      `}>
        {/* Header */}
        <div className={`
          px-4 py-2 flex items-center gap-2 text-white text-sm font-medium
          ${callState === "ringing" ? "bg-green-600" : ""}
          ${callState === "active" ? "bg-blue-600" : ""}
          ${callState === "ended" ? "bg-gray-600" : ""}
        `}>
          {callState === "ringing" && (
            <>
              <PhoneIncoming className="h-4 w-4 animate-pulse" />
              <span>Incoming Call</span>
            </>
          )}
          {callState === "active" && (
            <>
              <Phone className="h-4 w-4" />
              <span>Call In Progress</span>
              <span className="ml-auto font-mono">{formatDuration(callDuration)}</span>
            </>
          )}
          {callState === "ended" && (
            <>
              <PhoneOff className="h-4 w-4" />
              <span>Call Ended</span>
              <button onClick={handleDismiss} className="ml-auto hover:bg-white/20 rounded p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {/* Caller info */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`
              h-10 w-10 rounded-full flex items-center justify-center
              ${callState === "ringing" ? "bg-green-500/20 text-green-400" : ""}
              ${callState === "active" ? "bg-blue-500/20 text-blue-400" : ""}
              ${callState === "ended" ? "bg-gray-500/20 text-gray-400" : ""}
            `}>
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">
                {formatPhone(callerNumber)}
              </p>
              <p className="text-gray-400 text-xs">
                {callState === "ringing" && "Ringing..."}
                {callState === "active" && "Connected"}
                {callState === "ended" && `Duration: ${formatDuration(callDuration)}`}
              </p>
            </div>
          </div>

          {/* Ringing: Accept / Reject buttons */}
          {callState === "ringing" && (
            <div className="flex gap-2">
              <Button
                onClick={handleAccept}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <Phone className="h-4 w-4 mr-1.5" />
                Accept
              </Button>
              <Button
                onClick={handleReject}
                variant="destructive"
                className="flex-1"
                size="sm"
              >
                <PhoneOff className="h-4 w-4 mr-1.5" />
                Reject
              </Button>
            </div>
          )}

          {/* Active: Mute / Hang Up buttons */}
          {callState === "active" && (
            <div className="flex gap-2">
              <Button
                onClick={handleToggleMute}
                variant="outline"
                className={`flex-1 ${isMuted ? "bg-yellow-600/20 border-yellow-500 text-yellow-400 hover:bg-yellow-600/30 hover:text-yellow-300" : "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                size="sm"
              >
                {isMuted ? <MicOff className="h-4 w-4 mr-1.5" /> : <Mic className="h-4 w-4 mr-1.5" />}
                {isMuted ? "Unmute" : "Mute"}
              </Button>
              <Button
                onClick={handleHangup}
                variant="destructive"
                className="flex-1"
                size="sm"
              >
                <PhoneOff className="h-4 w-4 mr-1.5" />
                Hang Up
              </Button>
            </div>
          )}

          {/* Ended: just shows the duration, auto-dismisses */}
          {callState === "ended" && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Clock className="h-4 w-4" />
              <span>Call ended after {formatDuration(callDuration)}</span>
            </div>
          )}
        </div>

        {/* Ringing animation bar */}
        {callState === "ringing" && (
          <div className="h-1 bg-green-600/30 overflow-hidden">
            <div className="h-full bg-green-400 animate-pulse" style={{ width: "100%" }} />
          </div>
        )}
      </div>
    </div>
  );
}
