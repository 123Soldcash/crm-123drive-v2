/**
 * Twilio Voice Integration Module
 *
 * Handles:
 * - Access token generation for browser-based calling (Voice SDK)
 * - TwiML response generation for voice webhooks
 * - Server-side outbound call initiation (REST API)
 * - Phone number formatting to E.164
 * - Twilio client initialization
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

// ─── Access Token Generation ────────────────────────────────────────────────

/**
 * Generate a Twilio Access Token with a VoiceGrant for browser-based calling.
 *
 * The token allows the browser's Twilio Device to:
 * - Make outbound calls via the configured TwiML App
 * - Receive inbound calls addressed to the given identity
 *
 * @param identity - Unique user identifier (e.g., "user_42")
 * @param ttl - Token time-to-live in seconds (default: 3600 = 1 hour)
 */
export function generateAccessToken(identity: string, ttl = 3600): string {
  const { twilioAccountSid, twilioApiKey, twilioApiSecret, twilioTwimlAppSid } = ENV;

  if (!twilioAccountSid || !twilioApiKey || !twilioApiSecret) {
    throw new Error("Twilio API Key credentials not configured");
  }
  if (!twilioTwimlAppSid) {
    throw new Error("TWILIO_TWIML_APP_SID not configured — create a TwiML App in the Twilio Console");
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(twilioAccountSid, twilioApiKey, twilioApiSecret, {
    identity,
    ttl,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twilioTwimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
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

// ─── Build TwiML for connecting a REST-initiated call to a destination ──────

/**
 * Build TwiML that connects the answered call to the destination number.
 * Used as the URL for REST API-initiated calls.
 */
export function buildConnectTwiml(to: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const callerId = ENV.twilioPhoneNumber;
  response.say({ voice: "Polly.Amy" }, "Connecting your call now.");
  const dial = response.dial({ callerId });
  dial.number(formatPhoneNumber(to));

  return response.toString();
}

// ─── Server-Side Outbound Call (REST API) ──────────────────────────────────

/**
 * Initiate a phone call via the Twilio REST API.
 * 
 * This calls the Twilio number first, then when answered, connects to the
 * destination number. This is the most reliable method and works regardless
 * of browser WebSocket connectivity.
 *
 * @param to - Destination phone number
 * @param userIdentity - The Twilio client identity to connect (e.g., "user_1")
 */
export async function makeOutboundCall(params: {
  to: string;
  userIdentity: string;
}) {
  const client = getClient();
  const { to, userIdentity } = params;
  const formattedTo = formatPhoneNumber(to);
  const baseUrl = getBaseUrl();

  // Create a call that first connects to the browser client, then dials out
  const call = await client.calls.create({
    to: `client:${userIdentity}`,
    from: ENV.twilioPhoneNumber,
    url: `${baseUrl}/api/twilio/connect?to=${encodeURIComponent(formattedTo)}`,
    statusCallback: `${baseUrl}/api/twilio/voice/status`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST" as const,
  });

  return {
    callSid: call.sid,
    status: call.status,
    to: formattedTo,
    from: ENV.twilioPhoneNumber,
  };
}

/**
 * Initiate a direct outbound call via REST API (no browser connection needed).
 * Twilio calls the destination directly from your Twilio number.
 */
export async function makeDirectCall(params: {
  to: string;
  from?: string;
  statusCallbackUrl?: string;
}) {
  const client = getClient();
  const { to, from = ENV.twilioPhoneNumber, statusCallbackUrl } = params;

  const call = await client.calls.create({
    to: formatPhoneNumber(to),
    from,
    url: `${getBaseUrl()}/api/twilio/voice`,
    ...(statusCallbackUrl
      ? {
          statusCallback: statusCallbackUrl,
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
          statusCallbackMethod: "POST" as const,
        }
      : {}),
  });
  return call;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive the public base URL for webhook callbacks.
 * In production this is the deployed domain; in dev it falls back to a
 * placeholder (TwiML App Voice URL must be set manually for dev).
 */
function getBaseUrl(): string {
  // In production, use the app's public URL
  if (ENV.isProduction) {
    return `https://${process.env.VITE_APP_ID}.manus.space`;
  }
  // In development, this URL won't be reachable from Twilio's servers,
  // but the TwiML App's Voice URL should be set to the deployed URL anyway
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Validate that all required Twilio environment variables are present.
 * Returns an object with the validation result and any missing keys.
 */
export function validateTwilioConfig(): {
  valid: boolean;
  missing: string[];
} {
  const required: Record<string, string> = {
    TWILIO_ACCOUNT_SID: ENV.twilioAccountSid,
    TWILIO_AUTH_TOKEN: ENV.twilioAuthToken,
    TWILIO_PHONE_NUMBER: ENV.twilioPhoneNumber,
    TWILIO_API_KEY: ENV.twilioApiKey,
    TWILIO_API_SECRET: ENV.twilioApiSecret,
    TWILIO_TWIML_APP_SID: ENV.twilioTwimlAppSid,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { valid: missing.length === 0, missing };
}
