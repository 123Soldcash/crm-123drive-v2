/**
 * CallModal — Professional call interface with Twilio Voice SDK
 * 
 * 3-column layout:
 *   Left:   Property info (image, address, temperature, desk, details, financial, identifiers, owner)
 *   Center: Call Log & Notes (disposition, mood, templates, notes)
 *   Right:  Call controls (status, timer, buttons) + DTMF Dialpad
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
  MapPin,
  Home,
  DollarSign,
  Flame,
  Snowflake,
  ThermometerSun,
  Skull,
  HelpCircle,
  Search,
  Hash,
  Grid3X3,
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
  "Not Interested - IHATE - DEAD",
  "Not Interested - Hang-up - FU in 4 months",
  "Not Interested - NICE - FU in 2 Months",
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

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "$0";
  return `$${value.toLocaleString()}`;
}

function getLeadTempStyle(temp: string | null | undefined) {
  switch (temp) {
    case "SUPER HOT": return { icon: <Flame className="h-3.5 w-3.5 text-blue-600" />, color: "bg-blue-100 text-blue-800 border-blue-300" };
    case "HOT": return { icon: <Flame className="h-3.5 w-3.5 text-red-600" />, color: "bg-red-100 text-red-800 border-red-300" };
    case "DEEP SEARCH": return { icon: <Search className="h-3.5 w-3.5 text-purple-600" />, color: "bg-purple-100 text-purple-800 border-purple-300" };
    case "WARM": return { icon: <ThermometerSun className="h-3.5 w-3.5 text-amber-600" />, color: "bg-amber-100 text-amber-800 border-amber-300" };
    case "COLD": return { icon: <Snowflake className="h-3.5 w-3.5 text-blue-400" />, color: "bg-blue-50 text-blue-700 border-blue-200" };
    case "DEAD": return { icon: <Skull className="h-3.5 w-3.5 text-gray-500" />, color: "bg-gray-100 text-gray-700 border-gray-300" };
    default: return { icon: <HelpCircle className="h-3.5 w-3.5 text-gray-400" />, color: "bg-gray-50 text-gray-600 border-gray-200" };
  }
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

  // Property details form
  const [bedBath, setBedBath] = useState("");
  const [sf, setSf] = useState("");
  const [roofAge, setRoofAge] = useState("");
  const [acAge, setAcAge] = useState("");
  const [overallCondition, setOverallCondition] = useState("");
  const [reasonToSell, setReasonToSell] = useState("");
  const [howFastToSell, setHowFastToSell] = useState("");
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);

  // Dialpad state
  const [dtmfDigits, setDtmfDigits] = useState("");
  const [showDialpad, setShowDialpad] = useState(false);

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

  // Fetch property data for left panel
  const { data: propertyData } = trpc.properties.getById.useQuery(
    { id: propertyId },
    { enabled: open && !!propertyId }
  );

  // Fetch deep search data for additional property info
  const { data: deepSearchData } = trpc.properties.getDeepSearch.useQuery(
    { propertyId },
    { enabled: open && !!propertyId }
  );

  // Merge property + deep search
  const fullProperty = { ...propertyData, ...deepSearchData } as any;

  // Fetch contacts to get phone DNC status
  const { data: contactsForDNC } = trpc.communication.getContactsByProperty.useQuery(
    { propertyId },
    { enabled: open && !!propertyId }
  );

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

        device.register().catch(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            deviceRef.current = device;
            setDeviceReady(true);
            resolve(device);
          }
        });
      } catch (err) {
        resolve(null);
      }
    });
  }, []);

  // Make call
  const handleMakeCall = useCallback(async () => {
    if (!tokenData?.token) {
      toast.error("No Twilio token available");
      return;
    }

    setCallStatus("initializing");
    setErrorMessage(undefined);
    setDtmfDigits("");

    try {
      let device = deviceRef.current;
      if (!device || !deviceReady) {
        device = await initializeDevice(tokenData.token);
        if (!device) {
          setCallStatus("failed");
          setErrorMessage("Failed to initialize Twilio device");
          return;
        }
      }

      setCallStatus("connecting");

      const callParams: Record<string, string> = { To: phoneNumber };
      if (callerPhone) callParams.CallerId = callerPhone;

      const call = await device.connect({ params: callParams });
      activeCallRef.current = call;

      // Create call log
      createCallLogMutation.mutate(
        { to: phoneNumber, contactId, propertyId, status: "ringing" as const },
        { onSuccess: (data: any) => { setCallLogId(data?.id); } }
      );

      call.on("accept", () => {
        setCallStatus("in-progress");
        callStartTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current) {
            setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
          }
        }, 1000);
      });

      call.on("ringing", () => setCallStatus("ringing"));

      call.on("disconnect", () => {
        setCallStatus("completed");
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        activeCallRef.current = null;
        if (callLogIdRef.current) {
          updateCallLogMutation.mutate({ callLogId: callLogIdRef.current, status: "completed", duration: callDuration });
        }
      });

      call.on("cancel", () => {
        setCallStatus("completed");
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        activeCallRef.current = null;
      });

      call.on("error", (err: any) => {
        const classified = classifyError(err);
        setErrorMessage(classified.message);
        if (!classified.isRetryable) {
          setCallStatus("failed");
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          activeCallRef.current = null;
        }
      });

      call.on("reject", () => {
        setCallStatus("no-answer");
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        activeCallRef.current = null;
      });

    } catch (err: any) {
      const classified = classifyError(err);
      setErrorMessage(classified.message);
      setCallStatus("failed");
    }
  }, [tokenData, phoneNumber, callerPhone, contactId, propertyId, deviceReady, initializeDevice, createCallLogMutation, updateCallLogMutation, callDuration]);

  // Hang up
  const handleHangUp = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    }
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    setCallStatus("completed");
    activeCallRef.current = null;
  }, []);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (activeCallRef.current) {
      const newMuted = !isMuted;
      activeCallRef.current.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Retry
  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setErrorMessage(undefined);
    handleMakeCall();
  }, [handleMakeCall]);

  // Send DTMF tone
  const handleSendDTMF = useCallback((digit: string) => {
    if (activeCallRef.current && callStatus === "in-progress") {
      activeCallRef.current.sendDigits(digit);
      setDtmfDigits((prev) => prev + digit);
      toast.success(`Sent: ${digit}`, { duration: 1000 });
    } else {
      toast.error("No active call to send digits");
    }
  }, [callStatus]);

  // Add note
  const handleAddNote = useCallback(() => {
    if (!noteText.trim()) return;
    createNoteMutation.mutate(
      {
        contactId,
        propertyId,
        content: noteText.trim(),
        callLogId: callLogId,
      },
      {
        onSuccess: () => {
          setNoteText("");
          refetchNotes();
          toast.success("Note added");
        },
        onError: (error: any) => toast.error(`Failed to add note: ${error.message}`),
      }
    );
  }, [noteText, contactId, callStatus, callDuration, createNoteMutation, refetchNotes]);

  // Delete note
  const handleDeleteNote = useCallback((noteId: number) => {
    deleteNoteMutation.mutate(
      { noteId },
      {
        onSuccess: () => {
          refetchNotes();
          toast.success("Note deleted");
        },
        onError: (error: any) => toast.error(`Failed to delete note: ${error.message}`),
      }
    );
  }, [deleteNoteMutation, refetchNotes]);

  // Save call log
  const handleSaveCallLog = useCallback(() => {
    if (!logDisposition) {
      toast.error("Please select a disposition");
      return;
    }

    const propertyDetailsObj: Record<string, string> = {};
    if (bedBath) propertyDetailsObj.bedBath = bedBath;
    if (sf) propertyDetailsObj.sf = sf;
    if (roofAge) propertyDetailsObj.roofAge = roofAge;
    if (acAge) propertyDetailsObj.acAge = acAge;
    if (overallCondition) propertyDetailsObj.overallCondition = overallCondition;
    if (reasonToSell) propertyDetailsObj.reasonToSell = reasonToSell;
    if (howFastToSell) propertyDetailsObj.howFastToSell = howFastToSell;

    const notesText = logNotes ? ` - ${logNotes}` : "";

    logCommunicationMutation.mutate({
      propertyId,
      contactId,
      communicationType: "Phone",
      callResult: logDisposition as any,
      direction: "Outbound",
      mood: logMood || undefined,
      disposition: logDisposition,
      propertyDetails: Object.keys(propertyDetailsObj).length > 0 ? JSON.stringify(propertyDetailsObj) : undefined,
      twilioNumber: callerPhone || undefined,
      contactPhoneNumber: phoneNumber,
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
  }, [logDisposition, logMood, logNotes, bedBath, sf, roofAge, acAge, overallCondition, reasonToSell, howFastToSell, propertyId, contactId, phoneNumber, callerPhone, markAsDecisionMaker, markAsOwnerVerified, logCommunicationMutation, updateContactMutation, updatePropertyMutation, utils]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (activeCallRef.current) {
        try { activeCallRef.current.disconnect(); } catch {}
      }
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const isCallActive = callStatus === "initializing" || callStatus === "connecting" || callStatus === "ringing" || callStatus === "in-progress";
  const isCallEnded = callStatus === "completed" || callStatus === "no-answer" || callStatus === "failed";
  const statusConfig = STATUS_CONFIG[callStatus];

  // Property info helpers
  const prop = fullProperty || {} as any;
  const leadTemp = getLeadTempStyle(prop.leadTemperature);
  const estimatedValue = prop.ourEstimate || prop.dealMachineEstimate || prop.zillowEstimate || prop.estimatedValue || 0;
  const mortgageAmount = prop.mortgageAmount || 0;
  const equityAmount = estimatedValue - mortgageAmount;
  const equityPercent = estimatedValue > 0 && mortgageAmount > 0 ? Math.round(((estimatedValue - mortgageAmount) / estimatedValue) * 100) : 0;

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
      <DialogContent className="sm:max-w-[95vw] w-[95vw] h-[90vh] max-h-[900px] p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Call {contactName}</DialogTitle>
        <div className="flex h-full">

          {/* ═══════════ LEFT PANEL — Property Info ═══════════ */}
          <div className="w-[420px] flex flex-col bg-muted/20 border-r shrink-0 overflow-y-auto">
            {/* Property Image */}
            {prop.propertyImage ? (
              <div className="w-full h-[200px] bg-gray-200 overflow-hidden">
                <img src={prop.propertyImage} alt="Property" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-[100px] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <Home className="h-10 w-10 text-gray-400" />
              </div>
            )}

            <div className="p-3 space-y-3">
              {/* Address */}
              <div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold leading-tight">{prop.addressLine1 || "No address"}</p>
                    <p className="text-xs text-muted-foreground">{prop.city}{prop.city && prop.state ? ", " : ""}{prop.state} {prop.zipcode}</p>
                  </div>
                </div>
              </div>

              {/* Temperature + Desk Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${leadTemp.color}`}>
                  {leadTemp.icon}
                  <span className="ml-1">{prop.leadTemperature || "TBD"}</span>
                </Badge>
                {prop.deskStatus && (
                  <Badge variant="outline" className="text-xs">
                    {prop.deskName || prop.deskStatus}
                  </Badge>
                )}
                {prop.ownerVerified === 1 && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verified
                  </Badge>
                )}
              </div>

              {/* Property Details */}
              <div className="border rounded-md bg-background">
                <div className="px-2.5 py-1.5 border-b bg-muted/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Home className="h-3 w-3" /> Property
                  </p>
                </div>
                <div className="px-2.5 py-2 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{prop.propertyType || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year Built</span>
                    <span className="font-medium">{prop.yearBuilt || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bed/Bath</span>
                    <span className="font-medium">{prop.totalBedrooms || "?"}/{prop.totalBaths || "?"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sq Ft</span>
                    <span className="font-medium">{prop.buildingSquareFeet ? Number(prop.buildingSquareFeet).toLocaleString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lot Size</span>
                    <span className="font-medium">{prop.lotSize || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div className="border rounded-md bg-background">
                <div className="px-2.5 py-1.5 border-b bg-muted/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Financial
                  </p>
                </div>
                <div className="px-2.5 py-2 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Value</span>
                    <span className="font-medium text-green-700">{formatCurrency(estimatedValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mortgage</span>
                    <span className="font-medium text-red-600">{formatCurrency(mortgageAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Equity</span>
                    <span className="font-medium text-purple-700">{formatCurrency(equityAmount)} ({equityPercent}%)</span>
                  </div>
                  {prop.zillowEstimate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zillow</span>
                      <span className="font-medium">{formatCurrency(prop.zillowEstimate)}</span>
                    </div>
                  )}
                  {prop.dealMachineEstimate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DealMachine</span>
                      <span className="font-medium">{formatCurrency(prop.dealMachineEstimate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Identifiers */}
              <div className="border rounded-md bg-background">
                <div className="px-2.5 py-1.5 border-b bg-muted/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Identifiers
                  </p>
                </div>
                <div className="px-2.5 py-2 space-y-1.5 text-xs">
                  {prop.leadId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lead ID</span>
                      <span className="font-medium font-mono">{prop.leadId}</span>
                    </div>
                  )}
                  {prop.folioNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Folio</span>
                      <span className="font-medium font-mono text-[11px]">{prop.folioNumber}</span>
                    </div>
                  )}
                  {prop.county && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">County</span>
                      <span className="font-medium">{prop.county}</span>
                    </div>
                  )}
                  {prop.apnParcelId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">APN</span>
                      <span className="font-medium font-mono text-[11px]">{prop.apnParcelId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Info */}
              <div className="border rounded-md bg-background">
                <div className="px-2.5 py-1.5 border-b bg-muted/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Owner
                  </p>
                </div>
                <div className="px-2.5 py-2 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{prop.owner1Name || contactName}</span>
                  </div>
                  {prop.ownerLocation && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mailing</span>
                      <span className="font-medium text-right max-w-[200px] truncate" title={prop.ownerLocation}>{prop.ownerLocation}</span>
                    </div>
                  )}
                  {prop.occupancy && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-medium">{prop.occupancy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned Agent */}
              {prop.assignedAgent && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Agent: <span className="font-medium text-foreground">{prop.assignedAgent}</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════ CENTER PANEL — Call Log & Notes ═══════════ */}
          <div className="flex flex-col bg-background overflow-hidden" style={{ width: "340px", minWidth: "300px", maxWidth: "400px" }}>
            {/* Header */}
            <div className="px-4 py-2.5 border-b bg-muted/20 shrink-0">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Call Log & Notes
              </h3>
            </div>

            {/* Scrollable content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
              {logSaved ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                  <h3 className="text-base font-semibold">Call Log Saved!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Disposition: <strong>{logDisposition}</strong>
                    {logMood && <> | Mood: {logMood}</>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    You can close this dialog or make another call.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Call ended banner */}
                  {isCallEnded && (
                    <div className={`p-2.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
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

                  {/* Disposition + DNC */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Disposition *</Label>
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border-2 ${
                          phoneDNC
                            ? "bg-red-100 border-red-500 text-red-700 hover:bg-red-200"
                            : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <ShieldAlert className={`h-4 w-4 ${phoneDNC ? "text-red-600" : "text-gray-400"}`} />
                        {phoneDNC ? "DNC ON" : "DNC OFF"}
                      </button>
                    </div>
                    <Select value={logDisposition} onValueChange={setLogDisposition}>
                      <SelectTrigger className="h-9 text-sm">
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
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Mood</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {MOOD_OPTIONS.map((option) => (
                        <Button
                          key={option.label}
                          type="button"
                          variant={logMood === option.emoji ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogMood(logMood === option.emoji ? "" : option.emoji)}
                          className="h-7 px-2 text-xs"
                        >
                          <span className="text-sm mr-0.5">{option.emoji}</span>
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Decision Maker & Owner Verified */}
                  <div className="flex gap-3">
                    <div className="flex items-center space-x-1.5">
                      <Checkbox id="cm-dm" checked={markAsDecisionMaker} onCheckedChange={(c) => setMarkAsDecisionMaker(c as boolean)} />
                      <Label htmlFor="cm-dm" className="text-xs cursor-pointer">Decision Maker</Label>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Checkbox id="cm-ov" checked={markAsOwnerVerified} onCheckedChange={(c) => setMarkAsOwnerVerified(c as boolean)} />
                      <Label htmlFor="cm-ov" className="text-xs cursor-pointer">Owner Verified</Label>
                    </div>
                  </div>

                  {/* Quick Templates */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Quick Templates</Label>
                    <div className="flex gap-1 flex-wrap">
                      {NOTE_TEMPLATES.map((template) => (
                        <Button key={template} type="button" variant="ghost" size="sm"
                          onClick={() => setLogNotes(logNotes ? `${logNotes}. ${template}` : template)}
                          className="h-6 text-[11px] px-2"
                        >
                          {template}
                        </Button>
                      ))}
                      {customTemplates.map((template: any) => (
                        <Button key={template.id} type="button" variant="secondary" size="sm"
                          onClick={() => setLogNotes(logNotes ? `${logNotes}. ${template.templateText}` : template.templateText)}
                          className="h-6 text-[11px] px-2"
                        >
                          {template.templateText}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Call Summary */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Call Summary</Label>
                    <Textarea
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      placeholder="Add notes about this call..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Property Details - Collapsible */}
                  <div className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() => setShowPropertyDetails(!showPropertyDetails)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>Property Details (Optional)</span>
                      <span className="text-[10px]">{showPropertyDetails ? "▲ Hide" : "▼ Show"}</span>
                    </button>
                    {showPropertyDetails && (
                      <div className="px-3 pb-2 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Bed/Bath</Label>
                            <input type="text" placeholder="e.g., 3/2" value={bedBath} onChange={(e) => setBedBath(e.target.value)}
                              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">SF</Label>
                            <input type="text" placeholder="e.g., 1,500" value={sf} onChange={(e) => setSf(e.target.value)}
                              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Roof Age</Label>
                            <input type="text" placeholder="e.g., 5 years" value={roofAge} onChange={(e) => setRoofAge(e.target.value)}
                              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">A/C Age</Label>
                            <input type="text" placeholder="e.g., 3 years" value={acAge} onChange={(e) => setAcAge(e.target.value)}
                              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Condition</Label>
                            <Select value={overallCondition} onValueChange={setOverallCondition}>
                              <SelectTrigger className="h-7 text-xs">
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
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Reason to Sell</Label>
                            <input type="text" placeholder="e.g., Relocation" value={reasonToSell} onChange={(e) => setReasonToSell(e.target.value)}
                              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">How Fast to Sell</Label>
                          <Select value={howFastToSell} onValueChange={setHowFastToSell}>
                            <SelectTrigger className="h-7 text-xs">
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

                  {/* Save Call Log */}
                  <Button
                    onClick={handleSaveCallLog}
                    disabled={!logDisposition || logCommunicationMutation.isPending}
                    className="w-full"
                    size="default"
                  >
                    {logCommunicationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Call Log
                  </Button>

                  {/* Divider */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Call Notes ({notesData?.length ?? 0})
                    </span>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type a note..."
                      className="min-h-[50px] max-h-[100px] resize-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                    />
                    <Button size="icon" onClick={handleAddNote} disabled={!noteText.trim() || createNoteMutation.isPending} className="shrink-0 h-[50px] w-10">
                      {createNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-0.5">Press Enter to send, Shift+Enter for new line</p>

                  {(!notesData || notesData.length === 0) ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground py-4">
                      <FileText className="h-6 w-6 mb-1 opacity-40" />
                      <p className="text-xs">No notes yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {notesData.map((note) => (
                        <div key={note.id} className="group relative bg-muted/50 rounded-lg p-2.5 border border-transparent hover:border-border transition-colors">
                          <div className="flex items-start gap-2">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words flex-1">{note.content}</p>
                            <button onClick={() => handleDeleteNote(note.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            <span>
                              {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                              {new Date(note.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {note.callStatus && (
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1">{note.callStatus}</Badge>
                            )}
                            {note.callDuration != null && note.callDuration > 0 && (
                              <span className="text-[9px]">({formatDuration(note.callDuration)})</span>
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

          {/* ═══════════ RIGHT PANEL — Call Controls + Dialpad ═══════════ */}
          <div className="w-[300px] flex flex-col bg-muted/30 border-l shrink-0">
            {/* Contact Info */}
            <div className="text-center p-4 pb-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <User className="h-7 w-7 text-primary/60" />
              </div>
              <h2 className="text-base font-semibold truncate text-foreground">{contactName}</h2>
              <p className="text-muted-foreground text-sm mt-0.5 font-mono">{formatPhone(phoneNumber)}</p>
              {callerPhone && (
                <p className="text-[10px] text-muted-foreground mt-0.5">via {formatPhone(callerPhone)}</p>
              )}
            </div>

            {/* Call Status */}
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full mb-2 text-xs ${
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

              <div className={`text-3xl font-mono tabular-nums mb-3 ${
                callStatus === "in-progress" ? "text-green-600 font-semibold" :
                isCallEnded ? "text-muted-foreground" : "text-muted-foreground/40"
              }`}>
                {formatDuration(callDuration)}
              </div>

              {(callStatus === "initializing" || callStatus === "connecting" || callStatus === "ringing") && (
                <div className="flex items-center gap-1 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}

              {errorMessage && (
                <div className="text-center mb-2 max-w-[240px]">
                  <div className="flex items-center gap-1 justify-center mb-0.5">
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span className="text-red-500 text-[10px] font-medium">Connection Error</span>
                  </div>
                  <p className="text-red-500/80 text-[10px] leading-relaxed">{errorMessage}</p>
                </div>
              )}

              {tokenError && callStatus === "idle" && (
                <p className="text-amber-600 text-[10px] text-center mb-2 max-w-[220px]">
                  Twilio not configured. Check API Key, Secret, and TwiML App SID.
                </p>
              )}

              {/* Call Buttons */}
              <div className="flex items-center gap-3 mb-3">
                {!isCallActive && (
                  <div className="flex flex-col items-center gap-1.5">
                    {callStatus === "failed" && retryCount < 3 && (
                      <button onClick={handleRetry} className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-all shadow-lg active:scale-95 mb-1">
                        <RefreshCw className="h-5 w-5 text-white" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isCallEnded) {
                          setCallStatus("idle");
                          setCallDuration(0);
                          setErrorMessage(undefined);
                          setDtmfDigits("");
                        }
                        handleMakeCall();
                      }}
                      className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all shadow-lg active:scale-95"
                    >
                      <Phone className="h-6 w-6 text-white" />
                    </button>
                    <span className="text-[10px] text-muted-foreground">
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
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 ${
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

              {isMuted && isCallActive && (
                <Badge variant="destructive" className="text-[10px] mb-2">
                  <MicOff className="h-3 w-3 mr-1" /> Muted
                </Badge>
              )}

              {logSaved && (
                <Badge className="bg-green-100 text-green-700 border-green-300 mb-2">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Call Logged
                </Badge>
              )}

              {callStatus === "failed" && retryCount >= 3 && (
                <p className="text-muted-foreground text-[9px] text-center mt-1 max-w-[220px]">
                  Multiple attempts failed. Check your internet or disable VPN/firewall.
                </p>
              )}
            </div>

            {/* Dialpad Section */}
            <div className="border-t px-4 py-3">
              <button
                type="button"
                onClick={() => setShowDialpad(!showDialpad)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                {showDialpad ? "Hide Dialpad" : "Show Dialpad"}
              </button>

              {showDialpad && (
                <div className="space-y-2">
                  {/* DTMF digits display */}
                  {dtmfDigits && (
                    <div className="text-center">
                      <p className="text-sm font-mono tracking-widest text-foreground bg-muted/50 rounded px-2 py-1">
                        {dtmfDigits}
                      </p>
                    </div>
                  )}

                  {/* Dialpad grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {DIALPAD_KEYS.map((key) => (
                      <button
                        key={key.digit}
                        onClick={() => handleSendDTMF(key.digit)}
                        disabled={callStatus !== "in-progress"}
                        className={`h-11 rounded-lg flex flex-col items-center justify-center transition-all ${
                          callStatus === "in-progress"
                            ? "bg-background hover:bg-accent active:scale-95 border shadow-sm cursor-pointer"
                            : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed border border-transparent"
                        }`}
                      >
                        <span className="text-base font-semibold leading-none">{key.digit}</span>
                        {key.sub && <span className="text-[8px] text-muted-foreground leading-none mt-0.5">{key.sub}</span>}
                      </button>
                    ))}
                  </div>

                  {callStatus !== "in-progress" && (
                    <p className="text-[9px] text-muted-foreground text-center">
                      Dialpad active during calls only
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
