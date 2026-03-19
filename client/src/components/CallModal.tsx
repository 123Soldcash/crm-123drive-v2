/**
 * CallModal — Professional call interface with Twilio Voice SDK
 * 
 * Left side: Contact info, call controls, real-time status
 * Right side: Single scrollable page with Call Log + Notes integrated
 *   - Disposition, Mood, Decision Maker, Owner Verified
 *   - Quick Templates
 *   - Property Details (optional)
 *   - Full Notes section (add, view, delete notes)
 *   - Save Call Log button
 * 
 * Uses browser microphone via Twilio Voice JavaScript SDK.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  WifiOff,
  Save,
  ShieldAlert,
} from "lucide-react";

type CallStatus = "idle" | "initializing" | "connecting" | "ringing" | "in-progress" | "completed" | "failed" | "no-answer";

interface CallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  contactName: string;
  contactId: number;
  propertyId: number;
  callerPhone?: string;
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

const TWILIO_EDGES = ["ashburn", "umatilla", "roaming"] as const;

const DISPOSITION_OPTIONS = [
  "Interested - HOT LEAD",
  "Interested - WARM LEAD - Wants too Much / Full Price",
  "Interested - WARM LEAD - Not Hated",
  "Left Message - Owner Verified",
  "Left Message",
  "Beep Beep",
  "Busy",
  "Call Back",
  "Disconnected",
  "Duplicated number",
  "Fax",
  "Follow-up",
  "Hang up",
  "Has calling restrictions",
  "Investor/Buyer/Realtor Owned",
  "Irate - DNC",
  "Mail box full",
  "Mail box not set-up",
  "Not Answer",
  "Not Available",
  "Not Ringing",
  "Not Service",
  "Number repeated",
  "Player",
  "Portuguese",
  "Property does not fit our criteria",
  "Restrict",
  "See Notes",
  "Sold - DEAD",
  "Spanish",
  "Voicemail",
  "Wrong Number",
  "Wrong Person",
];

const MOOD_OPTIONS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "😡", label: "Mad" },
  { emoji: "😤", label: "Hated" },
  { emoji: "👴", label: "Senior" },
  { emoji: "🧒", label: "Kid" },
];

const NOTE_TEMPLATES = [
  "Left voicemail",
  "Will call back tomorrow",
  "Not interested",
  "Requested more information",
  "Wants to think about it",
  "Call back next week",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function classifyError(error: any): { message: string; isNetworkError: boolean; isRetryable: boolean } {
  const code = error?.code ?? error?.twilioError?.code;
  const msg = error?.message ?? "";

  if (code === 31005 || msg.includes("31005") || msg.includes("ConnectionError")) {
    return { message: "Network connection to Twilio failed. Try again or check your network.", isNetworkError: true, isRetryable: true };
  }
  if (code === 31000 || msg.includes("31000") || msg.includes("UnknownError")) {
    return { message: "Connection error. Retrying with a different server...", isNetworkError: true, isRetryable: true };
  }
  if (code === 20101 || msg.includes("20101") || msg.includes("AccessTokenInvalid")) {
    return { message: "Twilio access token is invalid. Please refresh the page.", isNetworkError: false, isRetryable: false };
  }
  if (code === 20104 || msg.includes("20104") || msg.includes("expired")) {
    return { message: "Twilio token expired. Refreshing...", isNetworkError: false, isRetryable: true };
  }
  return { message: msg || "An unexpected error occurred", isNetworkError: false, isRetryable: false };
}

export function CallModal({ open, onOpenChange, phoneNumber, contactName, contactId, propertyId, callerPhone }: CallModalProps) {
  // Call state
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callLogId, setCallLogId] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  const [deviceReady, setDeviceReady] = useState(false);

  // Notes state
  const [noteText, setNoteText] = useState("");

  // Call Log form state
  const [logDisposition, setLogDisposition] = useState("");
  const [logMood, setLogMood] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [markAsDecisionMaker, setMarkAsDecisionMaker] = useState(false);
  const [markAsOwnerVerified, setMarkAsOwnerVerified] = useState(false);
  const [logSaved, setLogSaved] = useState(false);

  // Property details
  const [bedBath, setBedBath] = useState("");
  const [sf, setSf] = useState("");
  const [roofAge, setRoofAge] = useState("");
  const [acAge, setAcAge] = useState("");
  const [overallCondition, setOverallCondition] = useState("");
  const [reasonToSell, setReasonToSell] = useState("");
  const [howFastToSell, setHowFastToSell] = useState("");

  // Property details collapsed
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);

  // Refs
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callLogIdRef = useRef<number | undefined>(undefined);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    callLogIdRef.current = callLogId;
  }, [callLogId]);

  // Fetch access token
  const { data: tokenData, error: tokenError, refetch: refetchToken } = trpc.twilio.getAccessToken.useQuery(undefined, {
    enabled: open,
    staleTime: 1000 * 60 * 25,
    retry: 2,
  });

  // Fetch contacts to get phone DNC status
  const { data: contactsForDNC } = trpc.communication.getContactsByProperty.useQuery(
    { propertyId },
    { enabled: open && !!propertyId }
  );

  // Find the current phone's ID and DNC status
  const currentPhoneData = contactsForDNC
    ?.flatMap((c: any) => c.phones || [])
    ?.find((p: any) => p.phoneNumber === phoneNumber || p.phoneNumber === phoneNumber.replace(/^\+1/, ''));
  const currentPhoneId = currentPhoneData?.id || 0;
  const phoneDNC = !!currentPhoneData?.dnc;

  // Fetch notes
  const { data: notesData, refetch: refetchNotes } = trpc.callNotes.getByContact.useQuery(
    { contactId },
    { enabled: open && !!contactId }
  );

  // Custom templates
  const { data: customTemplates = [] } = trpc.noteTemplates.list.useQuery(undefined, { enabled: open });

  // Mutations
  const createCallLogMutation = trpc.twilio.createCallLog.useMutation();
  const updateCallLogMutation = trpc.twilio.updateCallLog.useMutation();
  const togglePhoneDNCMutation = trpc.communication.togglePhoneDNC.useMutation({
    onSuccess: (_, variables) => {
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      toast.success(variables.dnc ? "Number marked as DNC" : "DNC removed from number");
    },
    onError: (error: any) => {
      toast.error(`Failed to update DNC: ${error.message}`);
    },
  });
  const createNoteMutation = trpc.callNotes.create.useMutation();
  const deleteNoteMutation = trpc.callNotes.delete.useMutation();
  const logCommunicationMutation = trpc.communication.addCommunicationLog.useMutation({
    onSuccess: () => {
      toast.success("Call log saved!");
      setLogSaved(true);
    },
    onError: (error: any) => {
      toast.error(`Failed to save call log: ${error.message}`);
    },
  });
  const updateContactMutation = trpc.contacts.updateContact.useMutation();
  const updatePropertyMutation = trpc.properties.updateProperty.useMutation();

  const utils = trpc.useUtils();

  // Initialize Twilio Device
  const initializeDevice = useCallback(async (token: string): Promise<Device | null> => {
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
          edge: TWILIO_EDGES as unknown as string[],
          maxCallSignalingTimeoutMs: 15000,
        });

        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            deviceRef.current = device;
            setDeviceReady(true);
            resolve(device);
          }
        }, 10000);

        device.on("registered", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            deviceRef.current = device;
            setDeviceReady(true);
            resolve(device);
          }
        });

        device.on("error", (err: any) => {
          const classified = classifyError(err);
          if (!resolved && !classified.isRetryable) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          }
        });

        device.register();
      } catch (err) {
        resolve(null);
      }
    });
  }, []);

  // Make call
  const handleMakeCall = useCallback(async () => {
    if (!tokenData?.token) {
      toast.error("No Twilio token available. Please wait or refresh.");
      return;
    }

    setCallStatus("initializing");
    setErrorMessage(undefined);

    let device = deviceRef.current;
    if (!device || !deviceReady) {
      device = await initializeDevice(tokenData.token);
      if (!device) {
        setCallStatus("failed");
        setErrorMessage("Failed to initialize Twilio. Check your network.");
        return;
      }
    }

    try {
      setCallStatus("connecting");

      const logResult = await createCallLogMutation.mutateAsync({
        to: phoneNumber, contactId, propertyId,
      });
      if (logResult.callLogId) {
        setCallLogId(logResult.callLogId);
        callLogIdRef.current = logResult.callLogId;
      }

      const call = await device.connect({
        params: {
          To: phoneNumber,
          ...(callerPhone ? { CallerId: callerPhone } : {}),
        },
      });

      activeCallRef.current = call;

      call.on("ringing", () => setCallStatus("ringing"));

      call.on("accept", () => {
        setCallStatus("in-progress");
        callStartTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current) {
            setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
          }
        }, 1000);
      });

      call.on("disconnect", () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        setCallStatus("completed");
        activeCallRef.current = null;

        const currentLogId = callLogIdRef.current;
        if (currentLogId) {
          const finalDuration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
          updateCallLogMutation.mutate({ callLogId: currentLogId, status: "completed", duration: finalDuration });
        }
      });

      call.on("cancel", () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        setCallStatus("no-answer");
        activeCallRef.current = null;
      });

      call.on("error", (err: any) => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        const classified = classifyError(err);
        setErrorMessage(classified.message);

        if (classified.isRetryable && retryCount < 3) {
          setRetryCount((c) => c + 1);
        }
        setCallStatus("failed");
        activeCallRef.current = null;
      });
    } catch (err: any) {
      const classified = classifyError(err);
      setErrorMessage(classified.message);
      setCallStatus("failed");
    }
  }, [tokenData, deviceReady, phoneNumber, contactId, propertyId, callerPhone, createCallLogMutation, updateCallLogMutation, initializeDevice, retryCount]);

  const handleRetry = useCallback(() => {
    setErrorMessage(undefined);
    handleMakeCall();
  }, [handleMakeCall]);

  // Cleanup on unmount/close
  useEffect(() => {
    if (!open) {
      if (activeCallRef.current) {
        activeCallRef.current.disconnect();
        activeCallRef.current = null;
      }
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch {}
        deviceRef.current = null;
      }
      setCallStatus("idle");
      setCallDuration(0);
      setIsMuted(false);
      setCallLogId(undefined);
      setErrorMessage(undefined);
      setRetryCount(0);
      setDeviceReady(false);
      setNoteText("");
      setLogDisposition("");
      setLogMood("");
      setLogNotes("");
      setMarkAsDecisionMaker(false);
      setMarkAsOwnerVerified(false);
      setLogSaved(false);
      setBedBath("");
      setSf("");
      setRoofAge("");
      setAcAge("");
      setOverallCondition("");
      setReasonToSell("");
      setHowFastToSell("");
      setShowPropertyDetails(false);
    }
  }, [open]);

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

  // Add note
  const handleAddNote = useCallback(async () => {
    if (!noteText.trim()) return;
    try {
      await createNoteMutation.mutateAsync({
        callLogId, contactId, propertyId, content: noteText.trim(),
      });
      setNoteText("");
      refetchNotes();
      toast.success("Note added");
    } catch {
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

  // Save call log
  const handleSaveCallLog = useCallback(() => {
    if (!logDisposition) {
      toast.error("Please select a disposition");
      return;
    }

    const propertyDetails: Record<string, string> = {};
    if (bedBath) propertyDetails.bedBath = bedBath;
    if (sf) propertyDetails.sf = sf;
    if (roofAge) propertyDetails.roofAge = roofAge;
    if (acAge) propertyDetails.acAge = acAge;
    if (overallCondition) propertyDetails.overallCondition = overallCondition;
    if (reasonToSell) propertyDetails.reasonToSell = reasonToSell;
    if (howFastToSell) propertyDetails.howFastToSell = howFastToSell;

    const notesText = logNotes ? ` - ${logNotes}` : "";

    logCommunicationMutation.mutate({
      propertyId,
      contactId,
      communicationType: "Phone",
      callResult: logDisposition as any,
      direction: "Outbound",
      mood: logMood || undefined,
      disposition: logDisposition,
      propertyDetails: Object.keys(propertyDetails).length > 0 ? JSON.stringify(propertyDetails) : undefined,
      notes: `Called ${phoneNumber}${notesText}`,
      nextStep: "",
    });

    if (markAsDecisionMaker) {
      updateContactMutation.mutate({ id: contactId, isDecisionMaker: 1 });
    }
    if (markAsOwnerVerified) {
      updatePropertyMutation.mutate({ id: propertyId, ownerVerified: 1 });
    }

    utils.communication.getCommunicationLog.invalidate();
  }, [logDisposition, logMood, logNotes, bedBath, sf, roofAge, acAge, overallCondition, reasonToSell, howFastToSell, propertyId, contactId, phoneNumber, markAsDecisionMaker, markAsOwnerVerified, logCommunicationMutation, updateContactMutation, updatePropertyMutation, utils]);

  const isCallActive = callStatus === "initializing" || callStatus === "connecting" || callStatus === "ringing" || callStatus === "in-progress";
  const isCallEnded = callStatus === "completed" || callStatus === "no-answer" || callStatus === "failed";
  const statusConfig = STATUS_CONFIG[callStatus];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (isCallActive && !v) {
        toast.warning("Please hang up the call before closing");
        return;
      }
      if (isCallEnded && !logSaved && logDisposition && !v) {
        const confirmed = window.confirm("You have an unsaved call log. Close anyway?");
        if (!confirmed) return;
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[85vh] max-h-[800px] p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Call {contactName}</DialogTitle>
        <div className="flex h-full">
          {/* LEFT SIDE — Call Controls */}
          <div className="w-[280px] flex flex-col bg-muted/30 border-r p-5 shrink-0">
            {/* Contact Info */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <User className="h-8 w-8 text-primary/60" />
              </div>
              <h2 className="text-lg font-semibold truncate text-foreground">{contactName}</h2>
              <p className="text-muted-foreground text-sm mt-1 font-mono">{formatPhone(phoneNumber)}</p>
            </div>

            {/* Call Status */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full mb-2 text-sm ${
                callStatus === "idle" ? "bg-gray-100 text-gray-600" :
                callStatus === "initializing" || callStatus === "connecting" ? "bg-yellow-100 text-yellow-700" :
                callStatus === "ringing" ? "bg-blue-100 text-blue-700" :
                callStatus === "in-progress" ? "bg-green-100 text-green-700" :
                callStatus === "completed" ? "bg-gray-100 text-gray-600" :
                callStatus === "failed" ? "bg-red-100 text-red-700" :
                "bg-orange-100 text-orange-700"
              }`}>
                {statusConfig.icon}
                <span className="font-medium">{statusConfig.label}</span>
              </div>

              <div className={`text-3xl font-mono tabular-nums mb-4 ${
                callStatus === "in-progress" ? "text-green-600 font-semibold" :
                isCallEnded ? "text-muted-foreground" : "text-muted-foreground/40"
              }`}>
                {formatDuration(callDuration)}
              </div>

              {(callStatus === "initializing" || callStatus === "connecting" || callStatus === "ringing") && (
                <div className="flex items-center gap-1 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}

              {errorMessage && (
                <div className="text-center mb-3 max-w-[250px]">
                  <div className="flex items-center gap-1.5 justify-center mb-1">
                    <WifiOff className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">Connection Error</span>
                  </div>
                  <p className="text-red-500/80 text-xs leading-relaxed">{errorMessage}</p>
                </div>
              )}

              {tokenError && callStatus === "idle" && (
                <p className="text-amber-600 text-xs text-center mb-3 max-w-[230px]">
                  Twilio not configured. Check API Key, Secret, and TwiML App SID.
                </p>
              )}

              {/* Call Buttons */}
              <div className="flex items-center gap-3">
                {!isCallActive && (
                  <div className="flex flex-col items-center gap-2">
                    {callStatus === "failed" && retryCount < 3 && (
                      <button onClick={handleRetry} className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-all shadow-lg active:scale-95 mb-1">
                        <RefreshCw className="h-6 w-6 text-white" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isCallEnded) {
                          setCallStatus("idle");
                          setCallDuration(0);
                          setErrorMessage(undefined);
                        }
                        handleMakeCall();
                      }}
                      className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all shadow-lg active:scale-95"
                    >
                      <Phone className="h-6 w-6 text-white" />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {callStatus === "failed" && retryCount < 3 ? "Retry" :
                       isCallEnded ? "Call again" : "Start call"}
                    </span>
                  </div>
                )}

                {isCallActive && (
                  <>
                    {callStatus !== "initializing" && (
                      <button
                        onClick={handleToggleMute}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                          isMuted ? "bg-red-100 text-red-500 hover:bg-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </button>
                    )}
                    <button onClick={handleHangUp} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg active:scale-95">
                      <PhoneOff className="h-6 w-6 text-white" />
                    </button>
                  </>
                )}
              </div>

              {callStatus === "failed" && retryCount >= 3 && (
                <p className="text-muted-foreground text-[10px] text-center mt-2 max-w-[230px]">
                  Multiple attempts failed. Check your internet or disable VPN/firewall.
                </p>
              )}
            </div>

            {isMuted && isCallActive && (
              <div className="text-center">
                <Badge variant="destructive" className="text-xs">
                  <MicOff className="h-3 w-3 mr-1" /> Muted
                </Badge>
              </div>
            )}

            {logSaved && (
              <div className="text-center mt-2">
                <Badge className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Call Logged
                </Badge>
              </div>
            )}
          </div>

          {/* RIGHT SIDE — Single scrollable page: Call Log + Notes */}
          <div className="flex-1 flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b bg-muted/20 shrink-0">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Call Log & Notes
              </h3>
            </div>

            {/* Scrollable content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4">
              {logSaved ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <h3 className="text-lg font-semibold">Call Log Saved!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Disposition: <strong>{logDisposition}</strong>
                    {logMood && <> | Mood: {logMood}</>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    You can close this dialog or make another call.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Call ended banner */}
                  {isCallEnded && (
                    <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      callStatus === "completed" ? "bg-green-50 text-green-700 border border-green-200" :
                      callStatus === "no-answer" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                      "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {statusConfig.icon}
                      {callStatus === "completed" ? `Call ended (${formatDuration(callDuration)})` :
                       callStatus === "no-answer" ? "No answer" : "Call failed"}
                      <span className="ml-auto text-xs font-normal">Log this call below</span>
                    </div>
                  )}

                  {/* ═══════════ CALL LOG SECTION ═══════════ */}
                  <div className="space-y-4">
                    {/* Disposition + DNC Toggle Row */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Disposition *</Label>
                        {/* DNC Toggle - Big and prominent */}
                        <button
                          type="button"
                          onClick={() => {
                            if (phoneDNC) {
                              togglePhoneDNCMutation.mutate({ phoneId: currentPhoneId, dnc: false });
                            } else {
                              togglePhoneDNCMutation.mutate({ phoneId: currentPhoneId, dnc: true });
                            }
                          }}
                          disabled={!currentPhoneId || togglePhoneDNCMutation.isPending}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                            phoneDNC
                              ? "bg-red-100 border-red-500 text-red-700 hover:bg-red-200"
                              : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400"
                          }`}
                        >
                          <ShieldAlert className={`h-5 w-5 ${phoneDNC ? "text-red-600" : "text-gray-400"}`} />
                          {phoneDNC ? "DNC ON" : "DNC OFF"}
                        </button>
                      </div>
                      <Select value={logDisposition} onValueChange={setLogDisposition}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select call result..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {DISPOSITION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Mood */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Mood</Label>
                      <div className="flex gap-2 flex-wrap">
                        {MOOD_OPTIONS.map((option) => (
                          <Button
                            key={option.label}
                            type="button"
                            variant={logMood === option.emoji ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLogMood(logMood === option.emoji ? "" : option.emoji)}
                            className="h-9 px-3"
                          >
                            <span className="text-lg mr-1">{option.emoji}</span>
                            <span className="text-xs">{option.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Decision Maker & Owner Verified */}
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="cm-decision-maker" checked={markAsDecisionMaker} onCheckedChange={(c) => setMarkAsDecisionMaker(c as boolean)} />
                        <Label htmlFor="cm-decision-maker" className="text-sm font-normal cursor-pointer">Decision Maker</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="cm-owner-verified" checked={markAsOwnerVerified} onCheckedChange={(c) => setMarkAsOwnerVerified(c as boolean)} />
                        <Label htmlFor="cm-owner-verified" className="text-sm font-normal cursor-pointer">Owner Verified</Label>
                      </div>
                    </div>

                    {/* Quick Templates */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Quick Templates</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {NOTE_TEMPLATES.map((template) => (
                          <Button
                            key={template}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogNotes(logNotes ? `${logNotes}. ${template}` : template)}
                            className="h-7 text-xs"
                          >
                            {template}
                          </Button>
                        ))}
                        {customTemplates.map((template: any) => (
                          <Button
                            key={template.id}
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setLogNotes(logNotes ? `${logNotes}. ${template.templateText}` : template.templateText)}
                            className="h-7 text-xs"
                          >
                            {template.templateText}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Call Log Notes */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Call Summary</Label>
                      <Textarea
                        value={logNotes}
                        onChange={(e) => setLogNotes(e.target.value)}
                        placeholder="Add notes about this call..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    {/* Property Details - Collapsible */}
                    <div className="border rounded-lg">
                      <button
                        type="button"
                        onClick={() => setShowPropertyDetails(!showPropertyDetails)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>Property Details (Optional)</span>
                        <span className="text-xs">{showPropertyDetails ? "▲ Hide" : "▼ Show"}</span>
                      </button>
                      {showPropertyDetails && (
                        <div className="px-3 pb-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Bed/Bath</Label>
                              <input type="text" placeholder="e.g., 3/2" value={bedBath} onChange={(e) => setBedBath(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">SF</Label>
                              <input type="text" placeholder="e.g., 1,500" value={sf} onChange={(e) => setSf(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Roof Age</Label>
                              <input type="text" placeholder="e.g., 5 years" value={roofAge} onChange={(e) => setRoofAge(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">A/C Age</Label>
                              <input type="text" placeholder="e.g., 3 years" value={acAge} onChange={(e) => setAcAge(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Overall Condition</Label>
                              <Select value={overallCondition} onValueChange={setOverallCondition}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Excellent">Excellent</SelectItem>
                                  <SelectItem value="Good">Good</SelectItem>
                                  <SelectItem value="Fair">Fair</SelectItem>
                                  <SelectItem value="Poor">Poor</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Reason to Sell</Label>
                              <input type="text" placeholder="e.g., Relocation" value={reasonToSell} onChange={(e) => setReasonToSell(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">How Fast to Sell</Label>
                            <Select value={howFastToSell} onValueChange={setHowFastToSell}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ASAP">ASAP</SelectItem>
                                <SelectItem value="Within 3 months">Within 3 months</SelectItem>
                                <SelectItem value="Within 6 months">Within 6 months</SelectItem>
                                <SelectItem value="Within 1 year">Within 1 year</SelectItem>
                                <SelectItem value="No rush">No rush</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Save Call Log Button */}
                    <Button
                      onClick={handleSaveCallLog}
                      disabled={!logDisposition || logCommunicationMutation.isPending}
                      className="w-full"
                      size="lg"
                    >
                      {logCommunicationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Call Log
                    </Button>
                  </div>

                  {/* ═══════════ DIVIDER ═══════════ */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Call Notes ({notesData?.length ?? 0})
                      </span>
                    </div>
                  </div>

                  {/* ═══════════ NOTES SECTION ═══════════ */}
                  <div className="space-y-3">
                    {/* Add Note Input */}
                    <div className="flex gap-2">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Type a note..."
                        className="min-h-[60px] max-h-[120px] resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote();
                          }
                        }}
                      />
                      <Button size="icon" onClick={handleAddNote} disabled={!noteText.trim() || createNoteMutation.isPending} className="shrink-0 h-[56px] w-10">
                        {createNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground -mt-1">Press Enter to send, Shift+Enter for new line</p>

                    {/* Notes List */}
                    {(!notesData || notesData.length === 0) ? (
                      <div className="flex flex-col items-center justify-center text-muted-foreground py-6">
                        <FileText className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">No notes yet</p>
                        <p className="text-xs mt-1">Add a note above during or after the call</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {notesData.map((note) => (
                          <div key={note.id} className="group relative bg-muted/50 rounded-lg p-3 border border-transparent hover:border-border transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
                              <button onClick={() => handleDeleteNote(note.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                                at {new Date(note.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {note.callStatus && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1">{note.callStatus}</Badge>
                              )}
                              {note.callDuration != null && note.callDuration > 0 && (
                                <span className="text-[10px]">({formatDuration(note.callDuration)})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
