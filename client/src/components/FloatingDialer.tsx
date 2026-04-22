/**
 * FloatingDialer — Global floating dialpad
 *
 * A persistent floating button (bottom-right) that opens a compact dialpad overlay.
 * Allows calling any number from any page without blocking navigation.
 * The overlay stays open during a call so the user can freely navigate the CRM.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { trpc } from "@/lib/trpc";
import { onDialerOpen } from "@/lib/dialerEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Mic,
  MicOff,
  X,
  Delete,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type DialerStatus = "idle" | "initializing" | "connecting" | "ringing" | "in-progress" | "completed" | "failed";

const DIALPAD_KEYS = [
  { digit: "1", sub: "" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "*", sub: "" },
  { digit: "0", sub: "+" },
  { digit: "#", sub: "" },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function normalizePhone(raw: string): string {
  // Strip everything except digits and leading +
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return raw;
  // If it starts with +, keep as-is
  if (digits.startsWith("+")) return digits;
  // If 10 digits, add +1
  if (digits.length === 10) return `+1${digits}`;
  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

export function FloatingDialer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");
  const [status, setStatus] = useState<DialerStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch Twilio access token (always enabled so device is ready)
  const { data: tokenData } = trpc.twilio.getAccessToken.useQuery(undefined, {
    staleTime: 1000 * 60 * 25,
    retry: 2,
  });

  // Fetch available Twilio numbers (active only)
  const { data: twilioNumbers = [] } = trpc.twilio.listNumbers.useQuery({ activeOnly: true });

  // Auto-select first number
  useEffect(() => {
    if (twilioNumbers.length > 0 && !selectedCallerId) {
      setSelectedCallerId((twilioNumbers[0] as any).phoneNumber || "");
    }
  }, [twilioNumbers, selectedCallerId]);

  // Listen for programmatic dialer open events (e.g., Needs Callback click-to-call)
  const autoCallPendingRef = useRef(false);
  useEffect(() => {
    return onDialerOpen((params) => {
      setPhoneInput(params.phone);
      if (params.callerId) setSelectedCallerId(params.callerId);
      setIsOpen(true);
      setIsMinimized(false);
      setStatus("idle");
      setErrorMessage(null);
      setCallDuration(0);
      if (params.autoCall) {
        autoCallPendingRef.current = true;
      }
    });
  }, []);

  const initializeDevice = useCallback(async (token: string): Promise<Device | null> => {
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch {}
      deviceRef.current = null;
      if (mountedRef.current) setDeviceReady(false);
    }
    return new Promise((resolve) => {
      try {
        const device = new Device(token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          edge: ["ashburn", "umatilla", "roaming"] as unknown as string[],
          maxCallSignalingTimeoutMs: 15000,
        });
        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            deviceRef.current = device;
            if (mountedRef.current) setDeviceReady(true);
            resolve(device);
          }
        }, 10000);
        device.on("registered", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            deviceRef.current = device;
            if (mountedRef.current) setDeviceReady(true);
            resolve(device);
          }
        });
        device.on("error", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          }
        });
        device.register().catch(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            deviceRef.current = device;
            if (mountedRef.current) setDeviceReady(true);
            resolve(device);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }, []);

  const handleCall = useCallback(async () => {
    const normalized = normalizePhone(phoneInput.trim());
    if (!normalized || normalized.length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!tokenData?.token) {
      toast.error("Twilio token not available. Please refresh the page.");
      return;
    }

    if (mountedRef.current) {
      setStatus("initializing");
      setErrorMessage(null);
      setCallDuration(0);
    }

    try {
      let device = deviceRef.current;
      if (!device || !deviceReady) {
        device = await initializeDevice(tokenData.token);
        if (!device) {
          if (mountedRef.current) {
            setStatus("failed");
            setErrorMessage("Failed to initialize Twilio device");
          }
          return;
        }
      }

      if (mountedRef.current) setStatus("connecting");

      const callParams: Record<string, string> = { To: normalized };
      if (selectedCallerId) callParams.CallerId = selectedCallerId;

      const call = await device.connect({ params: callParams });
      activeCallRef.current = call;

      call.on("ringing", () => { if (mountedRef.current) setStatus("ringing"); });

      call.on("accept", () => {
        if (!mountedRef.current) return;
        setStatus("in-progress");
        callStartTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current && mountedRef.current) {
            setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
          }
        }, 1000);
      });

      call.on("disconnect", () => {
        if (!mountedRef.current) return;
        setStatus("completed");
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        activeCallRef.current = null;
      });

      call.on("error", (err: any) => {
        if (!mountedRef.current) return;
        setStatus("failed");
        setErrorMessage(err?.message || "Call error occurred");
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        activeCallRef.current = null;
      });

    } catch (err: any) {
      if (mountedRef.current) {
        setStatus("failed");
        setErrorMessage(err?.message || "Failed to start call");
      }
    }
  }, [phoneInput, tokenData, deviceReady, selectedCallerId, initializeDevice]);

  // Auto-call after dialer opens with autoCall flag
  useEffect(() => {
    if (autoCallPendingRef.current && isOpen && phoneInput && status === "idle") {
      autoCallPendingRef.current = false;
      // Small delay to ensure device is ready
      const timer = setTimeout(() => handleCall(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, phoneInput, status, handleCall]);

  const handleHangUp = useCallback(() => {
    try {
      if (activeCallRef.current) {
        activeCallRef.current.disconnect();
        activeCallRef.current = null;
      }
      if (deviceRef.current) {
        deviceRef.current.disconnectAll();
      }
    } catch {}
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (mountedRef.current) setStatus("completed");
  }, []);

  const handleMute = useCallback(() => {
    if (activeCallRef.current) {
      const newMuted = !isMuted;
      activeCallRef.current.mute(newMuted);
      if (mountedRef.current) setIsMuted(newMuted);
    }
  }, [isMuted]);

  const handleDialpadKey = (digit: string) => {
    setPhoneInput((prev) => prev + digit);
    // Send DTMF if in-call
    if (activeCallRef.current && status === "in-progress") {
      try { activeCallRef.current.sendDigits(digit); } catch {}
    }
  };

  const handleClose = () => {
    if (status === "in-progress" || status === "ringing" || status === "connecting") {
      toast.warning("You have an active call. Hang up first before closing.");
      return;
    }
    setIsOpen(false);
    setPhoneInput("");
    setStatus("idle");
    setErrorMessage(null);
    setCallDuration(0);
    setIsMinimized(false);
  };

  const isCallActive = status === "in-progress" || status === "ringing" || status === "connecting" || status === "initializing";

  const statusColor = {
    idle: "bg-gray-100 text-gray-600",
    initializing: "bg-yellow-100 text-yellow-700",
    connecting: "bg-yellow-100 text-yellow-700",
    ringing: "bg-blue-100 text-blue-700",
    "in-progress": "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-700",
  }[status];

  const statusLabel = {
    idle: "Ready",
    initializing: "Initializing...",
    connecting: "Connecting...",
    ringing: "Ringing...",
    "in-progress": `In Call — ${formatDuration(callDuration)}`,
    completed: "Call Ended",
    failed: "Call Failed",
  }[status];

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-300"
          title="Open Dialer"
        >
          <Phone className="h-6 w-6" />
          {isCallActive && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>
      )}

      {/* Dialer panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-400" />
              <span className="font-semibold text-sm">Quick Dialer</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded hover:bg-gray-700 transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div className={`px-4 py-1.5 text-xs font-medium flex items-center gap-2 ${statusColor}`}>
            {(status === "initializing" || status === "connecting") && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {status === "in-progress" && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            )}
            {statusLabel}
          </div>

          {/* Body — collapsible */}
          {!isMinimized && (
            <div className="p-4 flex flex-col gap-3">
              {/* Phone number input */}
              <div className="flex items-center gap-1">
                <Input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Enter phone number"
                  className="text-base font-mono tracking-wider text-center h-10"
                  disabled={isCallActive}
                  onKeyDown={(e) => { if (e.key === "Enter" && !isCallActive) handleCall(); }}
                />
                {phoneInput && !isCallActive && (
                  <button
                    onClick={() => setPhoneInput((p) => p.slice(0, -1))}
                    className="p-2 rounded hover:bg-gray-100 text-gray-500"
                    title="Backspace"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Caller ID selector */}
              {!isCallActive && (
                <Select value={selectedCallerId} onValueChange={setSelectedCallerId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select caller ID..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(twilioNumbers as any[]).map((n: any) => (
                      <SelectItem key={n.id} value={n.phoneNumber}>
                        {n.label || n.phoneNumber} — {n.phoneNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Dialpad */}
              <div className="grid grid-cols-3 gap-1.5">
                {DIALPAD_KEYS.map(({ digit, sub }) => (
                  <button
                    key={digit}
                    onClick={() => handleDialpadKey(digit)}
                    className="flex flex-col items-center justify-center h-12 rounded-lg bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors border border-gray-200 select-none"
                    disabled={!isCallActive && false}
                  >
                    <span className="text-base font-semibold text-gray-800 leading-none">{digit}</span>
                    {sub && <span className="text-[9px] text-gray-400 mt-0.5 tracking-widest">{sub}</span>}
                  </button>
                ))}
              </div>

              {/* Error message */}
              {errorMessage && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">{errorMessage}</p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-1">
                {!isCallActive ? (
                  <Button
                    onClick={handleCall}
                    disabled={!phoneInput.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white h-11 text-sm font-semibold rounded-xl"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                ) : (
                  <>
                    {status === "in-progress" && (
                      <Button
                        onClick={handleMute}
                        variant="outline"
                        className="flex-1 h-11 text-sm rounded-xl"
                      >
                        {isMuted ? <MicOff className="h-4 w-4 mr-1.5 text-red-500" /> : <Mic className="h-4 w-4 mr-1.5" />}
                        {isMuted ? "Unmute" : "Mute"}
                      </Button>
                    )}
                    <Button
                      onClick={handleHangUp}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11 text-sm font-semibold rounded-xl"
                    >
                      <PhoneOff className="h-4 w-4 mr-2" />
                      Hang Up
                    </Button>
                  </>
                )}
              </div>

              {/* Reset after completed/failed */}
              {(status === "completed" || status === "failed") && (
                <button
                  onClick={() => { setStatus("idle"); setErrorMessage(null); setCallDuration(0); }}
                  className="text-xs text-center text-blue-600 hover:underline mt-0.5"
                >
                  New call
                </button>
              )}
            </div>
          )}

          {/* Minimized active call indicator */}
          {isMinimized && isCallActive && (
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <PhoneCall className="h-4 w-4 text-green-600 animate-pulse" />
                <span className="font-mono text-gray-700">{phoneInput}</span>
                <span className="text-green-600 font-medium">{formatDuration(callDuration)}</span>
              </div>
              <Button
                onClick={handleHangUp}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white h-7 px-2 text-xs rounded-lg"
              >
                <PhoneOff className="h-3 w-3 mr-1" />
                End
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
