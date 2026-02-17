/**
 * CallModal — Professional call interface with Twilio Voice SDK
 * 
 * Left side: Contact info, call controls, real-time status
 * Right side: Notes panel with history and live note-taking
 * 
 * Uses browser microphone via Twilio Voice JavaScript SDK.
 * Call flow:
 *   1. Browser gets Access Token with VoiceGrant (outgoingApplicationSid)
 *   2. User clicks "Call" → Device is created with edge fallback
 *   3. Browser calls device.connect({ params: { To: "+1..." } })
 *   4. Twilio sends POST to TwiML App Voice URL (/api/twilio/voice)
 *   5. Voice webhook returns <Dial><Number>+1...</Number></Dial>
 *   6. Twilio dials the destination — browser user hears ringing and can talk
 *
 * Key design decisions:
 * - Device is created lazily on first call (not on modal open) to avoid
 *   unnecessary WebSocket connections that may fail in restricted networks
 * - Edge fallback: tries ashburn → umatilla → roaming for resilience
 * - The REST API is NOT used to initiate calls — only to create call log entries
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Clock,
  User,
  FileText,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

type CallStatus = "idle" | "initializing" | "connecting" | "ringing" | "in-progress" | "completed" | "failed" | "no-answer";

interface CallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  contactName: string;
  contactId: number;
  propertyId: number;
}

const STATUS_CONFIG: Record<CallStatus, { label: string; icon: React.ReactNode }> = {
  idle: { label: "Ready to call", icon: <Phone className="h-5 w-5" /> },
  initializing: { label: "Initializing...", icon: <Loader2 className="h-5 w-5 animate-spin" /> },
  connecting: { label: "Connecting...", icon: <Loader2 className="h-5 w-5 animate-spin" /> },
  ringing: { label: "Ringing...", icon: <PhoneCall className="h-5 w-5 animate-pulse" /> },
  "in-progress": { label: "Call in progress", icon: <PhoneIncoming className="h-5 w-5" /> },
  completed: { label: "Call ended", icon: <CheckCircle2 className="h-5 w-5" /> },
  failed: { label: "Call failed", icon: <AlertCircle className="h-5 w-5" /> },
  "no-answer": { label: "No answer", icon: <PhoneMissed className="h-5 w-5" /> },
};

/** Twilio edge locations to try in order for US-based users */
const TWILIO_EDGES = ["ashburn", "umatilla", "roaming"] as const;

/**
 * Classify a Twilio Device/Call error into a user-friendly message
 */
function classifyError(error: any): { message: string; isNetworkError: boolean; isRetryable: boolean } {
  const code = error?.code ?? error?.twilioError?.code;
  const msg = error?.message ?? "";

  // ConnectionError 31005 — WebSocket connection dropped
  if (code === 31005 || msg.includes("31005") || msg.includes("ConnectionError")) {
    return {
      message: "Network connection to Twilio failed. This may be caused by a firewall or unstable internet. Try again or check your network.",
      isNetworkError: true,
      isRetryable: true,
    };
  }

  // UnknownError 31000 — generic signaling error
  if (code === 31000 || msg.includes("31000") || msg.includes("UnknownError")) {
    return {
      message: "Connection error. Retrying with a different server...",
      isNetworkError: true,
      isRetryable: true,
    };
  }

  // AccessTokenInvalid 20101
  if (code === 20101 || msg.includes("20101") || msg.includes("AccessTokenInvalid")) {
    return {
      message: "Twilio access token is invalid. Please refresh the page and try again.",
      isNetworkError: false,
      isRetryable: false,
    };
  }

  // AccessTokenExpired 20104
  if (code === 20104 || msg.includes("20104") || msg.includes("expired")) {
    return {
      message: "Twilio token expired. Refreshing...",
      isNetworkError: false,
      isRetryable: true,
    };
  }

  return {
    message: msg || "An unexpected error occurred",
    isNetworkError: false,
    isRetryable: false,
  };
}

export function CallModal({ open, onOpenChange, phoneNumber, contactName, contactId, propertyId }: CallModalProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [callLogId, setCallLogId] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  const [deviceReady, setDeviceReady] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callLogIdRef = useRef<number | undefined>(undefined);

  // Keep ref in sync with state
  useEffect(() => {
    callLogIdRef.current = callLogId;
  }, [callLogId]);

  // Fetch access token for Twilio Device SDK (pre-fetch when modal opens)
  const { data: tokenData, error: tokenError, refetch: refetchToken } = trpc.twilio.getAccessToken.useQuery(undefined, {
    enabled: open,
    staleTime: 1000 * 60 * 25, // 25 min (tokens last 60 min, refresh early)
    retry: 2,
  });

  // Fetch notes for this contact
  const { data: notesData, refetch: refetchNotes } = trpc.callNotes.getByContact.useQuery(
    { contactId },
    { enabled: open && !!contactId }
  );

  // Mutations — createCallLog only creates a DB entry, does NOT call Twilio REST API
  const createCallLogMutation = trpc.twilio.createCallLog.useMutation();
  const updateCallLogMutation = trpc.twilio.updateCallLog.useMutation();
  const createNoteMutation = trpc.callNotes.create.useMutation();
  const deleteNoteMutation = trpc.callNotes.delete.useMutation();

  /**
   * Create and register a Twilio Device with edge fallback.
   * Returns the device if successful, null if failed.
   * This is called lazily — only when the user clicks "Call".
   */
  const initializeDevice = useCallback(async (token: string): Promise<Device | null> => {
    // Destroy any existing device
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch {}
      deviceRef.current = null;
      setDeviceReady(false);
    }

    return new Promise((resolve) => {
      try {
        const device = new Device(token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          // Edge fallback: try multiple Twilio data centers
          // This helps when the primary edge is unreachable due to network/firewall
          edge: TWILIO_EDGES as unknown as string[],
          // Max time to wait for signaling connection (15 seconds)
          maxCallSignalingTimeoutMs: 15000,
        });

        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn("[CallModal] Device registration timed out after 10s");
            // Don't destroy — the device might still connect
            // Just resolve with the device and let the call attempt proceed
            deviceRef.current = device;
            setDeviceReady(true);
            resolve(device);
          }
        }, 10000);

        device.on("registered", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            console.log("[CallModal] Device registered successfully");
            deviceRef.current = device;
            setDeviceReady(true);
            resolve(device);
          }
        });

        device.on("error", (error: any) => {
          const classified = classifyError(error);
          console.error("[CallModal] Device error:", error.code, error.message, "| Classified:", classified.message);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);

            if (classified.isNetworkError) {
              // For network errors during registration, still resolve with the device
              // The device might recover via edge fallback
              console.log("[CallModal] Network error during registration, device may recover via edge fallback");
              deviceRef.current = device;
              setDeviceReady(true);
              resolve(device);
            } else {
              // For non-network errors (invalid token, etc.), fail
              setErrorMessage(classified.message);
              resolve(null);
            }
          } else {
            // Error after registration — during a call or idle
            if (classified.isNetworkError && !activeCallRef.current) {
              // Network error while idle — don't show error, device will auto-reconnect
              console.log("[CallModal] Network error while idle, device will attempt reconnection");
            } else {
              setErrorMessage(classified.message);
              if (callStatus === "idle" || callStatus === "initializing" || callStatus === "connecting") {
                setCallStatus("failed");
              }
            }
          }
        });

        device.on("unregistered", () => {
          console.log("[CallModal] Device unregistered");
          setDeviceReady(false);
        });

        device.register();
      } catch (err: any) {
        console.error("[CallModal] Failed to create Device:", err);
        setErrorMessage(`Failed to initialize: ${err.message}`);
        resolve(null);
      }
    });
  }, [callStatus]);

  // Duration timer
  useEffect(() => {
    if (callStatus === "in-progress" && !durationIntervalRef.current) {
      callStartTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }
      }, 1000);
    }

    if (callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer" || callStatus === "idle") {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [callStatus]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!open) {
      if (activeCallRef.current) {
        activeCallRef.current.disconnect();
        activeCallRef.current = null;
      }
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch {}
        deviceRef.current = null;
      }
      setCallStatus("idle");
      setIsMuted(false);
      setCallDuration(0);
      setCallLogId(undefined);
      setErrorMessage(undefined);
      setNoteText("");
      setRetryCount(0);
      setDeviceReady(false);
      callLogIdRef.current = undefined;
    }
  }, [open]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Make a call using ONLY the Twilio Device SDK (browser audio).
   * 
   * Flow:
   * 1. Initialize Device (lazy — only on first call)
   * 2. Create call log in DB
   * 3. device.connect() → Twilio → TwiML App → Dial destination
   */
  const handleMakeCall = useCallback(async () => {
    if (!tokenData?.token) {
      if (tokenError) {
        toast.error("Failed to get Twilio token. Check Twilio configuration.");
      } else {
        toast.error("Loading Twilio token... Please wait a moment.");
      }
      return;
    }

    try {
      setCallStatus("initializing");
      setErrorMessage(undefined);
      setCallDuration(0);

      // Step 1: Initialize Device lazily (with edge fallback)
      let device = deviceRef.current;
      if (!device || !deviceReady) {
        console.log("[CallModal] Initializing Twilio Device with edge fallback:", TWILIO_EDGES);
        device = await initializeDevice(tokenData.token);
        if (!device) {
          setCallStatus("failed");
          if (!errorMessage) {
            setErrorMessage("Failed to initialize Twilio Device. Check your network connection.");
          }
          return;
        }
      }

      setCallStatus("connecting");

      // Step 2: Create a call log entry in the database BEFORE connecting
      try {
        const logResult = await createCallLogMutation.mutateAsync({
          to: phoneNumber,
          contactId,
          propertyId,
          status: "ringing",
        });
        if (logResult.callLogId) {
          setCallLogId(logResult.callLogId);
          callLogIdRef.current = logResult.callLogId;
        }
      } catch (logErr) {
        console.warn("[CallModal] Failed to create call log:", logErr);
      }

      // Step 3: Connect via the Twilio Voice SDK
      console.log("[CallModal] Calling device.connect() to:", phoneNumber);
      const call = await device.connect({
        params: {
          To: phoneNumber,
          ContactId: String(contactId),
          PropertyId: String(propertyId),
        },
      });

      activeCallRef.current = call;

      call.on("accept", () => {
        console.log("[CallModal] Call accepted (connected to Twilio)");
        setCallStatus("in-progress");
        setRetryCount(0); // Reset retry count on successful call
        const logId = callLogIdRef.current;
        if (logId) {
          updateCallLogMutation.mutate({ callLogId: logId, status: "in-progress" });
        }
      });

      call.on("ringing", (hasEarlyMedia: boolean) => {
        console.log("[CallModal] Call ringing, earlyMedia:", hasEarlyMedia);
        setCallStatus("ringing");
      });

      call.on("disconnect", () => {
        console.log("[CallModal] Call disconnected");
        setCallStatus("completed");
        activeCallRef.current = null;
        const logId = callLogIdRef.current;
        if (logId) {
          const duration = callStartTimeRef.current
            ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
            : 0;
          updateCallLogMutation.mutate({
            callLogId: logId,
            status: "completed",
            duration,
          });
        }
      });

      call.on("cancel", () => {
        console.log("[CallModal] Call cancelled");
        setCallStatus("no-answer");
        activeCallRef.current = null;
        const logId = callLogIdRef.current;
        if (logId) {
          updateCallLogMutation.mutate({ callLogId: logId, status: "no-answer" });
        }
      });

      call.on("error", (error: any) => {
        const classified = classifyError(error);
        console.error("[CallModal] Call error:", error.code, error.message);
        setCallStatus("failed");
        setErrorMessage(classified.message);
        activeCallRef.current = null;
        const logId = callLogIdRef.current;
        if (logId) {
          updateCallLogMutation.mutate({
            callLogId: logId,
            status: "failed",
            errorMessage: classified.message,
          });
        }
      });

    } catch (error: any) {
      const classified = classifyError(error);
      console.error("[CallModal] Failed to initiate call:", error);
      setCallStatus("failed");
      setErrorMessage(classified.message);
      toast.error("Failed to initiate call");
    }
  }, [phoneNumber, contactId, propertyId, tokenData?.token, tokenError, deviceReady, createCallLogMutation, updateCallLogMutation, initializeDevice, errorMessage]);

  const handleRetry = useCallback(async () => {
    setRetryCount((c) => c + 1);
    setErrorMessage(undefined);
    setCallStatus("idle");

    // Destroy existing device to force fresh connection
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch {}
      deviceRef.current = null;
      setDeviceReady(false);
    }

    // Refresh token if needed
    await refetchToken();

    // Small delay then retry
    setTimeout(() => {
      handleMakeCall();
    }, 500);
  }, [handleMakeCall, refetchToken]);

  const handleHangUp = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
      activeCallRef.current = null;
    }
    setCallStatus("completed");
  }, []);

  const handleToggleMute = useCallback(() => {
    if (activeCallRef.current) {
      const newMuteState = !isMuted;
      activeCallRef.current.mute(newMuteState);
      setIsMuted(newMuteState);
      toast.info(newMuteState ? "Microphone muted" : "Microphone unmuted");
    }
  }, [isMuted]);

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim()) return;

    try {
      await createNoteMutation.mutateAsync({
        callLogId: callLogId,
        contactId,
        propertyId,
        content: noteText.trim(),
      });
      setNoteText("");
      refetchNotes();
      toast.success("Note added");
    } catch (error: any) {
      toast.error("Failed to add note");
    }
  }, [noteText, callLogId, contactId, propertyId, createNoteMutation, refetchNotes]);

  const handleDeleteNote = useCallback(async (noteId: number) => {
    try {
      await deleteNoteMutation.mutateAsync({ noteId });
      refetchNotes();
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  }, [deleteNoteMutation, refetchNotes]);

  const isCallActive = callStatus === "initializing" || callStatus === "connecting" || callStatus === "ringing" || callStatus === "in-progress";
  const statusConfig = STATUS_CONFIG[callStatus];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (isCallActive && !v) {
        toast.warning("Please hang up the call before closing");
        return;
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-6xl w-[90vw] h-[650px] p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Call {contactName}</DialogTitle>
        <div className="flex h-full">
          {/* LEFT SIDE — Call Controls (Light Theme) */}
          <div className="w-[340px] flex flex-col bg-muted/30 border-r p-6 shrink-0">
            {/* Contact Info */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User className="h-10 w-10 text-primary/60" />
              </div>
              <h2 className="text-xl font-semibold truncate text-foreground">{contactName}</h2>
              <p className="text-muted-foreground text-sm mt-1 font-mono">{phoneNumber}</p>
            </div>

            {/* Call Status */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Status Badge */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full mb-3 ${
                callStatus === "idle" ? "bg-gray-100 text-gray-600" :
                callStatus === "initializing" ? "bg-yellow-100 text-yellow-700" :
                callStatus === "connecting" ? "bg-yellow-100 text-yellow-700" :
                callStatus === "ringing" ? "bg-blue-100 text-blue-700" :
                callStatus === "in-progress" ? "bg-green-100 text-green-700" :
                callStatus === "completed" ? "bg-gray-100 text-gray-600" :
                callStatus === "failed" ? "bg-red-100 text-red-700" :
                "bg-orange-100 text-orange-700"
              }`}>
                {statusConfig.icon}
                <span className="text-sm font-medium">{statusConfig.label}</span>
              </div>

              {/* Duration Timer — always visible during and after call */}
              <div className={`text-4xl font-mono tabular-nums mb-5 ${
                callStatus === "in-progress" ? "text-green-600 font-semibold" :
                callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer" ? "text-muted-foreground" :
                "text-muted-foreground/40"
              }`}>
                {formatDuration(callDuration)}
              </div>

              {/* Ringing Animation */}
              {(callStatus === "initializing" || callStatus === "connecting" || callStatus === "ringing") && (
                <div className="flex items-center gap-1 mb-5">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="text-center mb-4 max-w-[280px]">
                  <div className="flex items-center gap-1.5 justify-center mb-1">
                    <WifiOff className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">Connection Error</span>
                  </div>
                  <p className="text-red-500/80 text-xs leading-relaxed">{errorMessage}</p>
                </div>
              )}

              {/* Token Error Warning */}
              {tokenError && callStatus === "idle" && (
                <p className="text-amber-600 text-xs text-center mb-4 max-w-[250px]">
                  Twilio not configured. Check API Key, Secret, and TwiML App SID.
                </p>
              )}

              {/* Call/HangUp/Retry Button Area */}
              <div className="flex items-center gap-4">
                {/* Call Button — shown when idle OR after call ended */}
                {!isCallActive && (
                  <div className="flex flex-col items-center gap-2">
                    {/* Show retry button when failed with retryable error */}
                    {callStatus === "failed" && retryCount < 3 && (
                      <button
                        onClick={handleRetry}
                        className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 active:scale-95 mb-2"
                      >
                        <RefreshCw className="h-7 w-7 text-white" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer") {
                          setCallStatus("idle");
                          setCallDuration(0);
                          setErrorMessage(undefined);
                        }
                        handleMakeCall();
                      }}
                      className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 active:scale-95"
                    >
                      <Phone className="h-7 w-7 text-white" />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {callStatus === "failed" && retryCount < 3 ? "Retry / Call" :
                       callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer" ? "Call again" : "Start call"}
                    </span>
                  </div>
                )}

                {/* During active call: Mute + Hang Up */}
                {isCallActive && (
                  <>
                    {callStatus !== "initializing" && (
                      <button
                        onClick={handleToggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                          isMuted
                            ? "bg-red-100 text-red-500 hover:bg-red-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                      </button>
                    )}

                    <button
                      onClick={handleHangUp}
                      className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40 active:scale-95"
                    >
                      <PhoneOff className="h-7 w-7 text-white" />
                    </button>
                  </>
                )}
              </div>

              {/* Network hint for failed calls */}
              {callStatus === "failed" && retryCount >= 3 && (
                <p className="text-muted-foreground text-[10px] text-center mt-3 max-w-[250px]">
                  Multiple connection attempts failed. Please check your internet connection, 
                  disable any VPN or firewall that may block WebSocket connections, and try again.
                </p>
              )}
            </div>

            {/* Mute indicator */}
            {isMuted && isCallActive && (
              <div className="text-center">
                <Badge variant="destructive" className="text-xs">
                  <MicOff className="h-3 w-3 mr-1" /> Muted
                </Badge>
              </div>
            )}
          </div>

          {/* RIGHT SIDE — Notes Panel */}
          <div className="flex-1 flex flex-col bg-background">
            {/* Notes Header */}
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Call Notes</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {notesData?.length ?? 0} notes
              </Badge>
            </div>

            {/* Notes List */}
            <ScrollArea className="flex-1 px-5 py-3">
              {(!notesData || notesData.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <FileText className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No notes yet</p>
                  <p className="text-xs mt-1">Add a note below during or after the call</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notesData.map((note) => (
                    <div
                      key={note.id}
                      className="group relative bg-muted/50 rounded-lg p-3 border border-transparent hover:border-border transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(note.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          at{" "}
                          {new Date(note.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {note.callStatus && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {note.callStatus}
                          </Badge>
                        )}
                        {note.callDuration != null && note.callDuration > 0 && (
                          <span className="text-[10px]">
                            ({formatDuration(note.callDuration)})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Note Input */}
            <div className="px-5 py-3 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Type a note..."
                  className="min-h-[80px] max-h-[150px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || createNoteMutation.isPending}
                  className="shrink-0 h-[60px] w-10"
                >
                  {createNoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
