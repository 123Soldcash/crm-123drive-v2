import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!;
const apiKey = process.env.TWILIO_API_KEY!;
const apiSecret = process.env.TWILIO_API_SECRET!;

const client = twilio(accountSid, authToken);

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it starts with 1 and has 11 digits, add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If it has 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it already starts with +, return as is
  if (phone.startsWith("+")) {
    return phone;
  }

  // Default: assume US number
  return `+1${digits}`;
}

/**
 * Generate Twilio Access Token for browser-based calling
 * @param identity - Unique identifier for the user (e.g., user ID or email)
 * @returns JWT access token for Twilio Voice SDK
 */
export function generateAccessToken(identity: string): string {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  // Create an access token using API Key credentials
  const accessToken = new AccessToken(
    accountSid,
    apiKey,
    apiSecret,
    { identity, ttl: 3600 }
  );

  // Create a Voice grant
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  // Add the grant to the token
  accessToken.addGrant(voiceGrant);

  // Serialize the token to a JWT string
  return accessToken.toJwt();
}

/**
 * Make a phone call using Twilio (for phone-to-phone fallback)
 */
export async function makeCall(params: {
  to: string;
  from?: string;
  url?: string;
}) {
  const { to, from = twilioPhoneNumber, url } = params;

  const call = await client.calls.create({
    to: formatPhoneNumber(to),
    from,
    url: url || `${process.env.VITE_FRONTEND_FORGE_API_URL}/api/twilio/voice`,
  });

  return call;
}

/**
 * Send SMS using Twilio
 */
export async function sendSMS(params: { to: string; body: string; from?: string }) {
  const { to, body, from = twilioPhoneNumber } = params;

  const message = await client.messages.create({
    to: formatPhoneNumber(to),
    from,
    body,
  });

  return message;
}
