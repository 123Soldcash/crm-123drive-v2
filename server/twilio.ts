/**
 * Twilio Voice Integration Module — Pure REST API Approach
 *
 * This module uses ONLY the Twilio REST API to make calls.
 * NO browser Voice SDK is required.
 *
 * Call flow:
 * 1. User clicks "Call" button in the CRM
 * 2. Server calls Twilio REST API to create a call
 * 3. Twilio calls the DESTINATION number directly from our Twilio number
 * 4. User can track call status via polling
 *
 * Handles:
 * - Direct outbound calls via REST API
 * - Call status tracking
 * - Phone number formatting to E.164
 * - TwiML response generation for voice webhooks
 * - Twilio configuration validation
 */
import twilio from "twilio";
import { ENV } from "./_core/env";

// ─── Twilio Client ──────────────────────────────────────────────────────────

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    if (!ENV.twilioAccountSid || !ENV.twilioAuthToken) {
      throw new Error("Twilio credentials not configured (ACCOUNT_SID / AUTH_TOKEN)");
    }
    _client = twilio(ENV.twilioAccountSid, ENV.twilioAuthToken);
  }
  return _client;
}

// ─── Phone Number Formatting ────────────────────────────────────────────────

/**
 * Format a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * Handles various input formats: (555) 123-4567, 555-123-4567, +15551234567, etc.
 */
export function formatPhoneNumber(phone: string): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // US 10-digit number → prepend +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If original started with +, trust it
  if (phone.startsWith("+")) {
    return phone.replace(/[^\d+]/g, "");
  }

  // Fallback: assume US
  return `+1${digits}`;
}

// ─── TwiML Response Builder ─────────────────────────────────────────────────

/**
 * Build a TwiML VoiceResponse that dials the requested destination.
 *
 * Called by the /api/twilio/voice webhook when Twilio asks "what should I do
 * with this outbound call?".
 *
 * @param to - Destination phone number or client identity
 * @returns TwiML XML string
 */
export function buildTwimlResponse(to: string | undefined): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (!to) {
    response.say("No destination was specified for this call.");
    return response.toString();
  }

  const callerId = ENV.twilioPhoneNumber;
  const dial = response.dial({ callerId });

  // Phone numbers start with + or are all digits
  if (to.startsWith("+") || /^\d+$/.test(to)) {
    dial.number(to);
  } else {
    // Otherwise it's a Twilio client identity
    dial.client(to);
  }

  return response.toString();
}

// ─── Build TwiML for outbound call ──────────────────────────────────────────

/**
 * Build TwiML that connects the answered call to the destination number.
 * Used as the URL for REST API-initiated calls.
 */
export function buildConnectTwiml(to: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const callerId = ENV.twilioPhoneNumber;
  const dial = response.dial({ callerId, timeout: 30 });
  dial.number(formatPhoneNumber(to));

  return response.toString();
}

// ─── Build TwiML for answered call (no dial) ───────────────────────────────

/**
 * Build TwiML that plays when the destination answers the call.
 * This is a simple greeting/pause — it does NOT dial another number.
 * 
 * CRITICAL: This must NOT contain <Dial> because the REST API already
 * established the call to the destination. Adding <Dial> here would
 * create a duplicate call.
 */
export function buildAnsweredTwiml(): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Just keep the line open — the call is already connected
  // A long pause keeps the call alive without playing anything
  response.pause({ length: 3600 }); // 1 hour max

  return response.toString();
}

// ─── Server-Side Outbound Call (Pure REST API) ──────────────────────────────

/**
 * Make an outbound call using ONLY the Twilio REST API.
 * 
 * This calls the destination number directly from the Twilio number.
 * No browser Voice SDK or WebSocket connection is needed.
 *
 * IMPORTANT: The `url` parameter tells Twilio what TwiML to execute when
 * the call is answered. We use `/api/twilio/voice/answered` which returns
 * a simple greeting. We do NOT use `/api/twilio/voice` (which contains
 * <Dial>) because that would create a SECOND call to the same number.
 *
 * @param to - Destination phone number
 * @returns Call details (SID, status, etc.)
 */
export async function makeOutboundCall(params: {
  to: string;
  statusCallbackUrl?: string;
}) {
  const client = getClient();
  const { to, statusCallbackUrl } = params;
  const formattedTo = formatPhoneNumber(to);
  const baseUrl = getBaseUrl();

  // Create a call from our Twilio number to the destination.
  // The `url` points to a simple TwiML that plays a greeting when answered.
  // Do NOT point to /api/trpc/twilio-webhook/voice which has <Dial> — that would duplicate the call.
  //
  // CRITICAL: Webhook URLs use /api/trpc/twilio-webhook/* prefix because the Manus
  // deployment platform only forwards /api/trpc/* and /api/oauth/* to Express.
  // Using /api/twilio/* would be intercepted by the static layer and return HTML.
  const call = await client.calls.create({
    to: formattedTo,
    from: ENV.twilioPhoneNumber,
    url: `${baseUrl}/api/trpc/twilio-webhook/answered`,
    ...(statusCallbackUrl
      ? {
          statusCallback: statusCallbackUrl,
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
          statusCallbackMethod: "POST" as const,
        }
      : {
          statusCallback: `${baseUrl}/api/trpc/twilio-webhook/status`,
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
          statusCallbackMethod: "POST" as const,
        }),
  });

  return {
    callSid: call.sid,
    status: call.status,
    to: formattedTo,
    from: ENV.twilioPhoneNumber,
  };
}

/**
 * Get the current status of a call by its SID.
 */
export async function getCallStatus(callSid: string) {
  const client = getClient();
  const call = await client.calls(callSid).fetch();
  return {
    callSid: call.sid,
    status: call.status,
    duration: call.duration,
    startTime: call.startTime,
    endTime: call.endTime,
    to: call.to,
    from: call.from,
    direction: call.direction,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive the public base URL for webhook callbacks.
 * Uses the custom domain if available, otherwise falls back to VITE_APP_ID.
 */
function getBaseUrl(): string {
  // Custom domain takes priority (e.g., 123smartdrive.manus.space)
  if (process.env.CUSTOM_DOMAIN) {
    return `https://${process.env.CUSTOM_DOMAIN}`;
  }
  // Fallback to the app ID domain
  return `https://${process.env.VITE_APP_ID}.manus.space`;
}

/**
 * Validate that all required Twilio environment variables are present.
 */
export function validateTwilioConfig(): {
  valid: boolean;
  missing: string[];
} {
  const required: Record<string, string> = {
    TWILIO_ACCOUNT_SID: ENV.twilioAccountSid,
    TWILIO_AUTH_TOKEN: ENV.twilioAuthToken,
    TWILIO_PHONE_NUMBER: ENV.twilioPhoneNumber,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { valid: missing.length === 0, missing };
}
