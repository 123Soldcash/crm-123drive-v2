/**
 * TwilioCallWidget — Phone calling from the CRM (Pure REST API)
 *
 * NO browser Voice SDK or WebSocket connection needed.
 *
 * Flow:
 * 1. User clicks the green phone button
 * 2. Frontend calls tRPC mutation `twilio.makeCall`
 * 3. Server uses Twilio REST API to initiate the call
 * 4. Twilio calls the destination number from our Twilio number
 * 5. Frontend polls call status via `twilio.getCallStatus`
 * 6. UI shows real-time call status (ringing, in-progress, completed)
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Phone, PhoneOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Types ──────────────────────────────────────────────────────────────────

type CallState =
  | "idle"
  | "initiating"    // Sending request to server
  | "queued"        // Twilio accepted, call is queued
  | "ringing"       // Destination phone is ringing
  | "in-progress"   // Call is connected and active
  | "completed"     // Call ended normally
  | "failed"        // Call failed
  | "busy"          // Destination was busy
  | "no-answer";    // No answer

interface TwilioCallWidgetProps {
  phoneNumber: string;
  contactName: string;
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
  const [callSid, setCallSid] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Server-side call mutation
  const makeCallMutation = trpc.twilio.makeCall.useMutation();

  // ─── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  // ─── Poll Call Status ─────────────────────────────────────────────────

  const startPolling = useCallback((sid: string) => {
    // Poll every 2 seconds
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        const response = await fetch(
          `/api/trpc/twilio.getCallStatus?input=${encodeURIComponent(JSON.stringify({ callSid: sid }))}`,
          { credentials: "include" }
        );
        const json = await response.json();
        const status = json?.result?.data?.status;

        if (!mountedRef.current) return;

        switch (status) {
          case "queued":
            setCallState("queued");
            break;
          case "ringing":
            setCallState("ringing");
            break;
          case "in-progress":
            if (callState !== "in-progress") {
              setCallState("in-progress");
              startTimer();
              toast.success(`Connected to ${contactName}`);
            }
            break;
          case "completed":
            setCallState("completed");
            stopTimer();
            stopPolling();
            toast.info("Call ended");
            // Reset to idle after 3 seconds
            setTimeout(() => {
              if (mountedRef.current) {
                setCallState("idle");
                setCallSid(null);
                setElapsed(0);
              }
            }, 3000);
            break;
          case "failed":
            setCallState("failed");
            stopTimer();
            stopPolling();
            toast.error("Call failed. The number may be unreachable.");
            setTimeout(() => {
              if (mountedRef.current) {
                setCallState("idle");
                setCallSid(null);
                setElapsed(0);
              }
            }, 3000);
            break;
          case "busy":
            setCallState("busy");
            stopTimer();
            stopPolling();
            toast.warning("Line is busy. Try again later.");
            setTimeout(() => {
              if (mountedRef.current) {
                setCallState("idle");
                setCallSid(null);
                setElapsed(0);
              }
            }, 3000);
            break;
          case "no-answer":
            setCallState("no-answer");
            stopTimer();
            stopPolling();
            toast.warning("No answer. Try again later.");
            setTimeout(() => {
              if (mountedRef.current) {
                setCallState("idle");
                setCallSid(null);
                setElapsed(0);
              }
            }, 3000);
            break;
          case "canceled":
            setCallState("idle");
            stopTimer();
            stopPolling();
            setCallSid(null);
            setElapsed(0);
            toast.info("Call cancelled");
            break;
        }
      } catch (error) {
        // Polling error — just skip this cycle
        console.warn("[TwilioCallWidget] Status poll error:", error);
      }
    }, 2000);
  }, [callState, contactName, startTimer, stopTimer]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ─── Start Call ─────────────────────────────────────────────────────────

  const startCall = async () => {
    if (callState !== "idle") return;

    try {
      setCallState("initiating");

      const formattedNumber = formatE164(phoneNumber);
      toast.info(`Calling ${contactName} at ${formattedNumber}...`);

      const result = await makeCallMutation.mutateAsync({ to: formattedNumber });

      if (!mountedRef.current) return;

      if (result.callSid) {
        setCallSid(result.callSid);
        setCallState("queued");
        startPolling(result.callSid);
      } else {
        throw new Error("No call SID returned from server");
      }
    } catch (error: any) {
      console.error("[TwilioCallWidget] Call initiation failed:", error);
      if (mountedRef.current) {
        setCallState("idle");
        setCallSid(null);

        const msg = error?.message || "Call failed";
        if (msg.includes("not configured")) {
          toast.error("Twilio is not configured. Please check your credentials.");
        } else if (msg.includes("21215") || msg.includes("not valid")) {
          toast.error("Your Twilio account cannot call this number. Check your Twilio account settings.");
        } else if (msg.includes("21214")) {
          toast.error("The destination number is not a valid phone number.");
        } else {
          toast.error(`Call failed: ${msg}`);
        }
      }
    }
  };

  // ─── Cancel Call ────────────────────────────────────────────────────────

  const cancelCall = useCallback(() => {
    stopTimer();
    stopPolling();
    setCallState("idle");
    setCallSid(null);
    setElapsed(0);
    toast.info("Call cancelled");
  }, [stopTimer, stopPolling]);

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

  // INITIATING state — spinner
  if (callState === "initiating") {
    return (
      <div className="flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        <span className="text-xs text-muted-foreground">Starting...</span>
      </div>
    );
  }

  // QUEUED / RINGING state
  if (callState === "queued" || callState === "ringing") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-amber-600 font-medium animate-pulse">
          {callState === "queued" ? "Queued..." : "Ringing..."}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelCall}
          className="h-7 w-7 p-0 hover:bg-red-50 rounded-full"
          title="Cancel"
        >
          <PhoneOff className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    );
  }

  // IN-PROGRESS state — timer and hang up
  if (callState === "in-progress") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-green-600 font-medium min-w-[3rem]">
          {formatTime(elapsed)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelCall}
          className="h-7 w-7 p-0 hover:bg-red-50 rounded-full"
          title="End call"
        >
          <PhoneOff className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    );
  }

  // COMPLETED state — green check
  if (callState === "completed") {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs text-green-600 font-medium">
          Done {elapsed > 0 ? `(${formatTime(elapsed)})` : ""}
        </span>
      </div>
    );
  }

  // FAILED / BUSY / NO-ANSWER state — red X
  return (
    <div className="flex items-center gap-1.5">
      <XCircle className="h-3.5 w-3.5 text-red-500" />
      <span className="text-xs text-red-600 font-medium">
        {callState === "busy" ? "Busy" : callState === "no-answer" ? "No Answer" : "Failed"}
      </span>
    </div>
  );
}
