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
  // Handles BOTH outbound (browser → phone) and inbound (phone → browser) calls.
  //
  // OUTBOUND: Device.connect() sends To=+1xxx, Direction=outbound
  //   → Returns <Dial><Number>+1xxx</Number></Dial>
  //
  // INBOUND: External caller dials a registered Twilio number
  //   → Direction is missing or "inbound", To is the Twilio number
  //   → Returns <Dial> with <Client> tags to ring all logged-in CRM users
  app.all("/api/twilio/voice", async (req, res) => {
    try {
      const to = req.body?.To || req.query?.To;
      const from = req.body?.From || req.query?.From;
      const direction = req.body?.Direction || req.query?.Direction;
      const callerPhone = req.body?.CallerPhone || req.query?.CallerPhone;
      const callSid = req.body?.CallSid || req.query?.CallSid;

      console.log("[Twilio Voice] Request. Method:", req.method, "Direction:", direction, "To:", to, "From:", from, "CallSid:", callSid);

      const twilio = await import("twilio");
      const VoiceResponse = twilio.default.twiml.VoiceResponse;

      // Determine if this is an OUTBOUND call (from browser) or INBOUND call (from external caller)
      // Outbound: The "To" param is a phone number the agent wants to call
      // Inbound: The "To" param is one of our registered Twilio numbers
      const isOutbound = callerPhone || (to && !from?.startsWith("client:") && direction === "outbound-api");
      const isFromBrowserClient = from?.startsWith("client:");

      if (isFromBrowserClient || isOutbound) {
        // ── OUTBOUND CALL (browser → phone) ──
        console.log("[Twilio Voice] OUTBOUND call from browser to:", to);
        const { buildTwimlResponse, formatPhoneNumber } = await import("./twilio");
        const formattedTo = to && (to.startsWith("+") || /^\d+$/.test(to))
          ? formatPhoneNumber(to)
          : to;
        const twiml = buildTwimlResponse(formattedTo as string, callerPhone as string | undefined);
        console.log("[Twilio Voice] Generated outbound TwiML for:", formattedTo);
        res.set("Content-Type", "text/xml");
        res.send(twiml);
      } else {
        // ── INBOUND CALL (external caller → CRM) ──
        console.log("[Twilio Voice] INBOUND call from:", from, "to Twilio number:", to);

        const response = new VoiceResponse();

        // Get all active CRM users to ring them
        // We ring all users with identity pattern "crm-user-{id}"
        try {
          const { getDb } = await import("./db");
          const { users: usersTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const database = await getDb();

          if (database) {
            const activeUsers = await database
              .select({ id: usersTable.id })
              .from(usersTable)
              .where(eq(usersTable.status, "Active"));

            if (activeUsers.length > 0) {
              // Ring all active users simultaneously with a 30-second timeout
              // The first user to accept gets the call
              const dial = response.dial({
                callerId: from, // Show the external caller's number
                timeout: 30,
                action: "/api/twilio/inbound-status",
                method: "POST",
              });

              for (const user of activeUsers) {
                dial.client(`crm-user-${user.id}`);
              }

              console.log(`[Twilio Voice] Ringing ${activeUsers.length} CRM users for inbound call from ${from}`);
            } else {
              // No active users — send to voicemail message
              response.say("Thank you for calling. No agents are currently available. Please try again later.");
              response.hangup();
              console.log("[Twilio Voice] No active users found, playing unavailable message");
            }
          } else {
            response.say("System is temporarily unavailable. Please try again later.");
            response.hangup();
          }
        } catch (dbError) {
          console.error("[Twilio Voice] Error fetching users for inbound call:", dbError);
          // Fallback: ring a default client identity
          const dial = response.dial({ callerId: from, timeout: 30 });
          dial.client("crm-user-1");
        }

        // Log the inbound call in communication log
        try {
          const { getDb } = await import("./db");
          const { communicationLog } = await import("../drizzle/schema");
          const database = await getDb();
          if (database) {
            await database.insert(communicationLog).values({
              propertyId: 0, // Unknown property for inbound calls
              communicationType: "Phone",
              direction: "Inbound",
              userId: 1, // System user
              notes: `Inbound call from ${from} to ${to}. CallSid: ${callSid || "unknown"}`,
            });
          }
        } catch (logError) {
          console.error("[Twilio Voice] Error logging inbound call:", logError);
        }

        res.set("Content-Type", "text/xml");
        res.send(response.toString());
      }
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
      const callerPhone = (req.query?.callerPhone as string) || req.body?.CallerPhone;
      const { buildConnectTwiml } = await import("./twilio");
      const twiml = buildConnectTwiml(to, callerPhone as string | undefined);
      console.log("[Twilio Connect] Bridging call to:", to, "with callerId:", callerPhone || "default");
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

  // ─── Inbound Call Status Callback ─────────────────────────────────────────
  // Called when an inbound call's <Dial> completes (answered, no-answer, busy, etc.)
  app.all("/api/twilio/inbound-status", async (req, res) => {
    const dialCallStatus = req.body?.DialCallStatus || req.query?.DialCallStatus || "unknown";
    const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";
    console.log("[Twilio Inbound Status] DialCallStatus:", dialCallStatus, "SID:", callSid);

    const twilio = await import("twilio");
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // If no one answered, play a message
    if (dialCallStatus === "no-answer" || dialCallStatus === "busy" || dialCallStatus === "failed") {
      response.say("We're sorry, no agents are available right now. Please try again later.");
      response.hangup();
    }
    // If completed (someone answered and hung up), just end

    res.set("Content-Type", "text/xml");
    res.send(response.toString());
  });

  // ─── Inbound SMS Webhook ────────────────────────────────────────────────────────
  // Twilio sends POST to this URL when a contact replies to a message.
  // Configure this URL in Twilio Console > Phone Numbers > Messaging > Webhook.
  // URL: https://{your-domain}/api/twilio/sms/incoming
  app.post("/api/twilio/sms/incoming", async (req, res) => {
    try {
      const from: string = req.body?.From || "";
      const to: string = req.body?.To || "";
      const body: string = req.body?.Body || "";
      const messageSid: string = req.body?.MessageSid || req.body?.SmsSid || "";
      console.log("[Twilio SMS Inbound] From:", from, "To:", to, "Body:", body.substring(0, 50));
      if (from && body) {
        const { smsMessages } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const database = await getDb();
        if (!database) {
          res.set("Content-Type", "text/xml");
          res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
          return;
        }
        // Check for duplicate (Twilio may retry webhooks)
        if (messageSid) {
          const { eq } = await import("drizzle-orm");
          const existing = await database
            .select({ id: smsMessages.id })
            .from(smsMessages)
            .where(eq(smsMessages.twilioSid, messageSid))
            .limit(1);
          if (existing.length > 0) {
            console.log("[Twilio SMS Inbound] Duplicate SID, skipping:", messageSid);
            res.set("Content-Type", "text/xml");
            res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
            return;
          }
        }
        await database.insert(smsMessages).values({
          contactPhone: from,
          twilioPhone: to,
          direction: "inbound",
          body,
          twilioSid: messageSid || undefined,
          status: "received",
        });
        console.log("[Twilio SMS Inbound] Saved inbound message from", from);
      }
      // Return empty TwiML so Twilio doesn’t auto-reply
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    } catch (error) {
      console.error("[Twilio SMS Inbound] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    }
  });

  console.log("[Twilio] Webhook routes registered at /api/twilio/*");
}
