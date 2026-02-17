/**
 * Twilio Webhook Routes — Registered as raw Express routes
 *
 * CRITICAL ARCHITECTURE NOTE (Feb 17, 2026):
 * The Manus deployment platform routing works as follows:
 *   - /api/oauth/callback (EXACT match only) → Express
 *   - /api/trpc/*   → tRPC middleware (JSON only, rejects form-urlencoded)
 *   - /api/*        → Express (if registered BEFORE static file serving)
 *
 * Previous bug: Routes were under /api/oauth/twilio/* which the platform
 * did NOT forward (only /api/oauth/callback exact match is forwarded).
 * This caused Twilio to receive the SPA HTML (367KB) → Error 11750.
 *
 * Fix: Register routes at /api/twilio/* directly on Express BEFORE
 * Vite/static middleware. Express route matching happens in registration
 * order, so these routes are matched before the catch-all SPA handler.
 *
 * Twilio sends webhooks as application/x-www-form-urlencoded POST requests.
 *
 * Webhook paths:
 *   /api/twilio/voice     — TwiML for incoming/outgoing voice calls
 *   /api/twilio/connect   — TwiML to bridge calls to destination
 *   /api/twilio/answered  — TwiML when call is answered (no <Dial>)
 *   /api/twilio/status    — Call status callback (returns empty TwiML)
 */
import type { Express } from "express";

/**
 * Register all Twilio webhook endpoints.
 * Must be called BEFORE Vite middleware and static file serving.
 */
export function registerTwilioWebhooks(app: Express) {
  // ─── Voice Webhook ──────────────────────────────────────────────────────
  // Called when Twilio needs TwiML instructions for a voice call.
  // Returns <Dial><Number> to connect to the destination.
  app.all("/api/twilio/voice", async (req, res) => {
    try {
      // When the Twilio Device SDK calls device.connect({ params: { To: "+1..." } }),
      // Twilio sends a POST to this webhook with the 'To' parameter in the body.
      // The body is application/x-www-form-urlencoded.
      const to = req.body?.To || req.query?.To;
      console.log("[Twilio Voice] Incoming request. Method:", req.method, "Body keys:", Object.keys(req.body || {}));
      console.log("[Twilio Voice] To:", to, "| From:", req.body?.From, "| CallSid:", req.body?.CallSid);

      const { buildTwimlResponse, formatPhoneNumber } = await import("./twilio");
      // Format the number to E.164 if it's a phone number
      const formattedTo = to && (to.startsWith("+") || /^\d+$/.test(to))
        ? formatPhoneNumber(to)
        : to;
      const twiml = buildTwimlResponse(formattedTo as string);
      console.log("[Twilio Voice] Generated TwiML for:", formattedTo);
      res.set("Content-Type", "text/xml");
      res.send(twiml);
    } catch (error) {
      console.error("[Twilio Voice] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>');
    }
  });

  // ─── Connect Webhook ────────────────────────────────────────────────────
  // Called by REST API-initiated calls to bridge to the destination number.
  app.all("/api/twilio/connect", async (req, res) => {
    try {
      const to = (req.query?.to as string) || req.body?.To;
      const { buildConnectTwiml } = await import("./twilio");
      const twiml = buildConnectTwiml(to);
      console.log("[Twilio Connect] Bridging call to:", to);
      res.set("Content-Type", "text/xml");
      res.send(twiml);
    } catch (error) {
      console.error("[Twilio Connect] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>');
    }
  });

  // ─── Answered Webhook ───────────────────────────────────────────────────
  // Called when the destination answers a REST API-initiated call.
  // CRITICAL: Must NOT contain <Dial> — the REST API already connected the call.
  // Adding <Dial> here would create a DUPLICATE call.
  app.all("/api/twilio/answered", async (req, res) => {
    try {
      const { buildAnsweredTwiml } = await import("./twilio");
      const twiml = buildAnsweredTwiml();
      console.log("[Twilio Answered] Call answered, keeping line open");
      res.set("Content-Type", "text/xml");
      res.send(twiml);
    } catch (error) {
      console.error("[Twilio Answered] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="3600"/></Response>');
    }
  });

  // ─── Status Callback ───────────────────────────────────────────────────
  // Called by Twilio to report call status changes (initiated, ringing, answered, completed).
  // MUST return a small response (<64KB) or Twilio throws Error 11750.
  app.all("/api/twilio/status", async (req, res) => {
    const callStatus = req.body?.CallStatus || req.query?.CallStatus || "unknown";
    const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";
    console.log("[Twilio Status]", callStatus, "SID:", callSid);
    res.set("Content-Type", "text/xml");
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  });

  console.log("[Twilio] Webhook routes registered at /api/twilio/*");
}
