/**
 * Twilio Webhook Routes — Registered under /api/oauth/ prefix
 *
 * CRITICAL ARCHITECTURE NOTE:
 * The Manus deployment platform only forwards these path prefixes to Express:
 *   - /api/oauth/*  → Handled by registerOAuthRoutes() in oauth.ts
 *   - /api/trpc/*   → Handled by tRPC middleware (JSON only, rejects form-urlencoded)
 *
 * All other /api/* paths are intercepted by the platform's static file layer
 * and return the SPA index.html (367KB), causing Twilio Error 11750.
 *
 * Twilio sends webhooks as application/x-www-form-urlencoded POST requests.
 * tRPC middleware rejects these with HTTP 415 (Unsupported Media Type).
 * Therefore, Twilio webhooks MUST be registered as raw Express routes under
 * the /api/oauth/ prefix — the only prefix that reaches Express AND supports
 * non-JSON content types.
 *
 * Webhook paths:
 *   /api/oauth/twilio/voice     — TwiML for incoming/outgoing voice calls
 *   /api/oauth/twilio/connect   — TwiML to bridge calls to destination
 *   /api/oauth/twilio/answered  — TwiML when call is answered (no <Dial>)
 *   /api/oauth/twilio/status    — Call status callback (returns empty TwiML)
 */
import type { Express } from "express";

/**
 * Register all Twilio webhook endpoints.
 * Must be called BEFORE tRPC middleware and static file serving.
 */
export function registerTwilioWebhooks(app: Express) {
  // ─── Voice Webhook ──────────────────────────────────────────────────────
  // Called when Twilio needs TwiML instructions for a voice call.
  // Returns <Dial><Number> to connect to the destination.
  app.all("/api/oauth/twilio/voice", async (req, res) => {
    try {
      const to = req.body?.To || req.query?.To;
      const { buildTwimlResponse } = await import("./twilio");
      const twiml = buildTwimlResponse(to as string);
      console.log("[Twilio Voice] Generating TwiML for:", to);
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
  app.all("/api/oauth/twilio/connect", async (req, res) => {
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
  app.all("/api/oauth/twilio/answered", async (req, res) => {
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
  app.all("/api/oauth/twilio/status", async (req, res) => {
    const callStatus = req.body?.CallStatus || req.query?.CallStatus || "unknown";
    const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";
    console.log("[Twilio Status]", callStatus, "SID:", callSid);
    res.set("Content-Type", "text/xml");
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  });

  console.log("[Twilio] Webhook routes registered at /api/oauth/twilio/*");
}
