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
 *
 * INBOUND CALL ROUTING LOGIC (updated):
 *   1. Identify the Twilio number that received the call (by "To" param)
 *   2. Only consider ACTIVE Twilio numbers (isActive = 1)
 *   3. Look up which desks are assigned to that number via twilioNumberDesks
 *   4. Find users assigned to those desks via userDesks
 *   5. Filter to users who are BOTH:
 *      a. status = "Active" (account not suspended/inactive)
 *      b. Have a userSessions row with isOnline = 1 AND lastHeartbeat within 90 seconds
 *         (meaning their browser is open and their Twilio Device is registered)
 *   6. If no desk is assigned to the number → play voicemail (do NOT ring all users)
 *   7. If desk is assigned but no users are online → play voicemail
 *   8. Error fallback → play voicemail (do NOT hardcode crm-user-1)
 */
import type { Express } from "express";

// Session timeout: users must have sent a heartbeat within this many ms to be considered online
const SESSION_TIMEOUT_MS = 90_000; // 90 seconds

/**
 * Register all Twilio webhook endpoints.
 * Must be called BEFORE Vite middleware and static file serving.
 */
export function registerTwilioWebhooks(app: Express) {

  /**
   * Shared helper: play voicemail greeting + record caller message.
   * Used by ALL paths where no agent answers (early-exit, no-answer, busy, error).
   */
  async function playVoicemailAndRecord(response: any) {
    // Fetch the voicemail greeting MP3 URL from integration settings
    let greetingUrl: string | null = null;
    try {
      const { getIntegrationConfig } = await import("./integrationConfig");
      const vmConfig = await getIntegrationConfig("voicemail");
      greetingUrl = vmConfig.greetingUrl || null;
      console.log("[Voicemail] Greeting URL from DB:", greetingUrl || "(none, using TTS fallback)");
    } catch (e) {
      console.error("[Voicemail] Error fetching greeting config:", e);
    }

    if (greetingUrl) {
      response.play({}, greetingUrl);
    } else {
      response.say(
        { voice: "alice", language: "en-US" },
        "Hi, you have reached our office. We are currently unavailable. Please leave your name and message after the beep and we will call you back as soon as possible."
      );
    }

    // Build the recording callback URL using CUSTOM_DOMAIN (reliable)
    const { getBaseUrl } = await import("./twilio");
    const baseUrl = getBaseUrl();
    console.log("[Voicemail] Recording callback URL:", `${baseUrl}/api/twilio/voicemail-recording`);

    response.record({
      action: `${baseUrl}/api/twilio/voicemail-recording`,
      method: "POST",
      maxLength: 120,
      playBeep: true,
      transcribe: false,
    });
    response.hangup();
  }
  // ─── Voice Webhook ──────────────────────────────────────────────────────
  // Called when Twilio needs TwiML instructions for a voice call.
  // Handles BOTH outbound (browser → phone) and inbound (phone → browser) calls.
  //
  // OUTBOUND: Device.connect() sends To=+1xxx, Direction=outbound
  //   → Returns <Dial><Number>+1xxx</Number></Dial>
  //
  // INBOUND: External caller dials a registered Twilio number
  //   → Direction is missing or "inbound", To is the Twilio number
  //   → Returns <Dial> with <Client> tags to ring desk-matched online users
  app.all("/api/twilio/voice", async (req, res) => {
    try {
      const to = req.body?.To || req.query?.To;
      const from = req.body?.From || req.query?.From;
      const direction = req.body?.Direction || req.query?.Direction;
      const callerPhone = req.body?.CallerPhone || req.query?.CallerPhone || req.body?.CallerId || req.query?.CallerId;
      const callSid = req.body?.CallSid || req.query?.CallSid;

      console.log("[Twilio Voice] Request. Method:", req.method, "Direction:", direction, "To:", to, "From:", from, "CallSid:", callSid);

      const twilio = await import("twilio");
      const VoiceResponse = twilio.default.twiml.VoiceResponse;

      // Determine if this is an OUTBOUND call (from browser) or INBOUND call (from external caller)
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

        // Shared state accessible across try blocks
        let matchedDeskNames: string[] = [];

        try {
          const { getDb } = await import("./db");
          const {
            users: usersTable,
            twilioNumbers: twilioNumbersTable,
            twilioNumberDesks,
            userDesks,
            desks: desksTable,
            userSessions,
          } = await import("../drizzle/schema");
          const { eq, and, inArray, gte } = await import("drizzle-orm");
          const database = await getDb();

          if (!database) {
            console.error("[Twilio Voice] No database connection for inbound call routing");
            response.say("System is temporarily unavailable. Please try again later.");
            response.hangup();
            res.set("Content-Type", "text/xml");
            res.send(response.toString());
            return;
          }

          // ─── STEP 1: Find the Twilio number record (ACTIVE numbers only) ───
          const calledNumber = to ? (to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`) : "";
          const calledDigits = calledNumber.replace(/\D/g, "");

          const allActiveTwilioNumbers = await database
            .select()
            .from(twilioNumbersTable)
            .where(eq(twilioNumbersTable.isActive, 1));

          const matchedTwilioNumber = allActiveTwilioNumbers.find((tn) => {
            const tnDigits = tn.phoneNumber.replace(/\D/g, "");
            return tnDigits === calledDigits || tn.phoneNumber === calledNumber;
          });

          if (!matchedTwilioNumber) {
            console.warn(`[Twilio Voice] No active Twilio number found for "${to}" — playing voicemail`);
            await playVoicemailAndRecord(response);
            res.set("Content-Type", "text/xml");
            res.send(response.toString());
            return;
          }

          console.log(`[Twilio Voice] Matched active Twilio number ID ${matchedTwilioNumber.id} (${matchedTwilioNumber.label})`);

          // ─── STEP 2: Find desks assigned to this Twilio number ───
          const numberDeskRows = await database
            .select({ deskId: twilioNumberDesks.deskId })
            .from(twilioNumberDesks)
            .where(eq(twilioNumberDesks.twilioNumberId, matchedTwilioNumber.id));

          const deskIds = numberDeskRows.map(r => r.deskId);

          if (deskIds.length === 0) {
            // No desk assigned to this number — do NOT ring all users, play voicemail
            console.warn(`[Twilio Voice] Twilio number ${matchedTwilioNumber.phoneNumber} has no desk assigned — playing voicemail`);
            await playVoicemailAndRecord(response);
            res.set("Content-Type", "text/xml");
            res.send(response.toString());
            return;
          }

          // Resolve desk names for logging
          const deskRows = await database
            .select({ id: desksTable.id, name: desksTable.name, description: desksTable.description })
            .from(desksTable)
            .where(inArray(desksTable.id, deskIds));
          matchedDeskNames = deskRows.map(d => d.description || d.name);
          console.log(`[Twilio Voice] Desks for this number: [${matchedDeskNames.join(", ")}]`);

          // ─── STEP 3: Find users assigned to these desks ───
          const userDeskRows = await database
            .select({ userId: userDesks.userId })
            .from(userDesks)
            .where(inArray(userDesks.deskId, deskIds));

          const deskUserIds = Array.from(new Set(userDeskRows.map(r => r.userId)));

          if (deskUserIds.length === 0) {
            console.warn(`[Twilio Voice] No users assigned to desks [${deskIds.join(", ")}] — playing voicemail`);
            await playVoicemailAndRecord(response);
            res.set("Content-Type", "text/xml");
            res.send(response.toString());
            return;
          }

          // ─── STEP 4: Filter to users who are Active AND have an active session ───
          // Active session = isOnline = 1 AND lastHeartbeat within SESSION_TIMEOUT_MS
          const sessionCutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);

          const activeUsers = await database
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(and(
              eq(usersTable.status, "Active"),
              inArray(usersTable.id, deskUserIds)
            ));

          const activeUserIds = activeUsers.map(u => u.id);

          // Check which of these users have a live heartbeat
          let onlineUserIds: number[] = [];
          if (activeUserIds.length > 0) {
            const onlineSessions = await database
              .select({ userId: userSessions.userId })
              .from(userSessions)
              .where(and(
                eq(userSessions.isOnline, 1),
                gte(userSessions.lastHeartbeat, sessionCutoff),
                inArray(userSessions.userId, activeUserIds)
              ));
            onlineUserIds = onlineSessions.map(s => s.userId);
          }

          console.log(`[Twilio Voice] Desk users: ${deskUserIds.length} | Active: ${activeUserIds.length} | Online (heartbeat): ${onlineUserIds.length}`);

          if (onlineUserIds.length === 0) {
            // No online users in the correct desk — play voicemail
            console.warn(`[Twilio Voice] No online agents for desks [${matchedDeskNames.join(", ")}] — playing voicemail`);
            await playVoicemailAndRecord(response);
            res.set("Content-Type", "text/xml");
            res.send(response.toString());
            return;
          }

          // ─── STEP 5: Ring the online desk users simultaneously ───
          const dial = response.dial({
            callerId: from, // Show the external caller's number
            timeout: 30,
            action: "/api/twilio/inbound-status",
            method: "POST",
          });

          for (const userId of onlineUserIds) {
            dial.client(`crm-user-${userId}`);
          }

          console.log(`[Twilio Voice] Ringing ${onlineUserIds.length} online CRM users for inbound call from ${from} (desks: ${matchedDeskNames.join(", ")})`);

        } catch (dbError) {
          // ─── SAFE ERROR FALLBACK: play voicemail, do NOT hardcode a user ───
          console.error("[Twilio Voice] Error during desk-based routing:", dbError);
          await playVoicemailAndRecord(response);
          res.set("Content-Type", "text/xml");
          res.send(response.toString());
          return;
        }

        // Set primary Twilio number on PROPERTIES where the caller is a contact
        // Flow: caller phone -> find contacts -> find their properties -> set primaryTwilioNumber
        // Only sets if the property doesn't already have a primaryTwilioNumber
        // Searches BOTH contactPhones table (legacy) AND contacts.phoneNumber (new model)
        try {
          const { getDb } = await import("./db");
          const { contacts, contactPhones, properties } = await import("../drizzle/schema");
          const { eq, isNull, and, inArray } = await import("drizzle-orm");
          const database = await getDb();
          if (database && from && to) {
            // Normalize the caller's phone number for matching
            const callerDigits = from.replace(/\D/g, "");
            const callerVariants = [
              from,
              `+${callerDigits}`,
              callerDigits,
              callerDigits.length === 11 && callerDigits.startsWith("1") ? callerDigits.slice(1) : null,
              callerDigits.length === 10 ? `1${callerDigits}` : null,
            ].filter(Boolean) as string[];

            // Collect all matching property IDs from both data models
            const allPropertyIds = new Set<number>();

            // --- MODEL 1: Search contactPhones table (legacy) ---
            const matchingPhones: { contactId: number }[] = [];
            for (const variant of callerVariants) {
              const matches = await database
                .select({ contactId: contactPhones.contactId })
                .from(contactPhones)
                .where(eq(contactPhones.phoneNumber, variant));
              matchingPhones.push(...matches);
            }
            const uniqueContactIdsFromPhones = Array.from(new Set(matchingPhones.map(m => m.contactId)));
            if (uniqueContactIdsFromPhones.length > 0) {
              const contactRecords = await database
                .select({ propertyId: contacts.propertyId })
                .from(contacts)
                .where(inArray(contacts.id, uniqueContactIdsFromPhones));
              for (const c of contactRecords) {
                if (c.propertyId != null && c.propertyId > 0) allPropertyIds.add(c.propertyId);
              }
            }

            // --- MODEL 2: Search contacts.phoneNumber directly (new model) ---
            for (const variant of callerVariants) {
              const directMatches = await database
                .select({ propertyId: contacts.propertyId })
                .from(contacts)
                .where(
                  and(
                    eq(contacts.phoneNumber, variant),
                    eq(contacts.contactType, "phone")
                  )
                );
              for (const m of directMatches) {
                if (m.propertyId != null && m.propertyId > 0) allPropertyIds.add(m.propertyId);
              }
            }

            // --- Update properties that don't have a primaryTwilioNumber yet ---
            if (allPropertyIds.size > 0) {
              const twilioNumber = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
              const propIdArray = Array.from(allPropertyIds);
              let updatedCount = 0;
              for (const propId of propIdArray) {
                const result = await database.update(properties)
                  .set({ primaryTwilioNumber: twilioNumber })
                  .where(
                    and(
                      eq(properties.id, propId),
                      isNull(properties.primaryTwilioNumber)
                    )
                  );
                if (result[0]?.affectedRows > 0) updatedCount++;
              }
              console.log(`[Twilio Voice] Default Caller ID: found ${propIdArray.length} property(ies) for caller ${from}, updated ${updatedCount} (skipped ${propIdArray.length - updatedCount} already set)`);
            }
          }
        } catch (primaryError) {
          console.error("[Twilio Voice] Error setting primary Twilio number:", primaryError);
        }

        // Log the inbound call in communication log
        // Guard: skip logging if the caller's phone number is missing (robocall probes, carrier pings, etc.)
        if (from && from !== "undefined" && !from.startsWith("client:")) {
          try {
            const { getDb } = await import("./db");
            const { communicationLog } = await import("../drizzle/schema");
            const database = await getDb();
            if (database) {
              await database.insert(communicationLog).values({
                propertyId: 0, // Unknown property for inbound calls
                communicationType: "Phone",
                direction: "Inbound",
                twilioNumber: to || undefined, // The Twilio number that received the call
                contactPhoneNumber: from, // The caller's phone number
                deskName: matchedDeskNames.length > 0 ? matchedDeskNames.join(", ") : null,
                userId: 1, // System user
                notes: `Inbound call from ${from} to ${to}. CallSid: ${callSid || "unknown"}`,
              });
            }
          } catch (logError) {
            console.error("[Twilio Voice] Error logging inbound call:", logError);
          }
        } else {
          console.log("[Twilio Voice] Skipping log for inbound call with no caller ID (from:", from, ")");
        }

        res.set("Content-Type", "text/xml");
        res.send(response.toString());
      }
    } catch (error) {
      console.error("[Twilio Voice] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say></Response>');
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
    const parentCallSid = req.body?.ParentCallSid || req.query?.ParentCallSid || "";
    console.log("[Twilio Inbound Status] DialCallStatus:", dialCallStatus, "SID:", callSid, "ParentSID:", parentCallSid);

    const twilio = await import("twilio");
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // If no one answered, play voicemail greeting and record the caller's message
    if (dialCallStatus === "no-answer" || dialCallStatus === "busy" || dialCallStatus === "failed") {
      // Fetch the voicemail greeting MP3 URL from integration settings
      let greetingUrl: string | null = null;
      try {
        const { getIntegrationConfig } = await import("./integrationConfig");
        const vmConfig = await getIntegrationConfig("voicemail");
        greetingUrl = vmConfig.greetingUrl || null;
        console.log("[Twilio Inbound Status] Greeting URL from DB:", greetingUrl || "(none, using TTS fallback)");
      } catch (greetErr) {
        console.error("[Twilio Inbound Status] Error fetching greeting config:", greetErr);
      }

      if (greetingUrl) {
        response.play({}, greetingUrl);
      } else {
        response.say(
          { voice: "alice", language: "en-US" },
          "Hi, you have reached our office. We are currently unavailable. Please leave your name and message after the beep and we will call you back as soon as possible."
        );
      }

      // Record the caller message — Twilio POSTs to /api/twilio/voicemail-recording when done
      const { getBaseUrl } = await import("./twilio");
      const baseUrl = getBaseUrl();
      console.log("[Twilio Inbound Status] Recording callback URL:", `${baseUrl}/api/twilio/voicemail-recording`);
      response.record({
        action: `${baseUrl}/api/twilio/voicemail-recording`,
        method: "POST",
        maxLength: 120,
        playBeep: true,
        transcribe: false,
      });
      response.hangup();

      // Flag the inbound call log entry for this CallSid as needsCallback
      // Use CallSid matching (not "most recent") to avoid race conditions with concurrent calls
      try {
        const { getDb } = await import("./db");
        const { communicationLog } = await import("../drizzle/schema");
        const { eq, and, desc, like } = await import("drizzle-orm");
        const database = await getDb();
        if (database) {
          // Match by CallSid stored in the notes field
          const sidToMatch = parentCallSid || callSid;
          const matchedRows = await database
            .select({ id: communicationLog.id })
            .from(communicationLog)
            .where(
              and(
                eq(communicationLog.direction, "Inbound"),
                eq(communicationLog.communicationType, "Phone"),
                like(communicationLog.notes, `%${sidToMatch}%`)
              )
            )
            .orderBy(desc(communicationLog.createdAt))
            .limit(1);

          if (matchedRows.length > 0) {
            await database
              .update(communicationLog)
              .set({ needsCallback: 1 })
              .where(eq(communicationLog.id, matchedRows[0].id));
            console.log(`[Twilio Inbound Status] Flagged call ${matchedRows[0].id} as needsCallback (${dialCallStatus}) via CallSid ${sidToMatch}`);
          } else {
            // Fallback: flag the most recent inbound call if no SID match
            const recent = await database
              .select({ id: communicationLog.id })
              .from(communicationLog)
              .where(
                and(
                  eq(communicationLog.direction, "Inbound"),
                  eq(communicationLog.communicationType, "Phone")
                )
              )
              .orderBy(desc(communicationLog.createdAt))
              .limit(1);
            if (recent.length > 0) {
              await database
                .update(communicationLog)
                .set({ needsCallback: 1 })
                .where(eq(communicationLog.id, recent[0].id));
              console.log(`[Twilio Inbound Status] Flagged most recent call ${recent[0].id} as needsCallback (fallback)`);
            }
          }
        }
      } catch (cbErr) {
        console.error("[Twilio Inbound Status] Error flagging needsCallback:", cbErr);
      }
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
          isRead: 0, // Mark as unread until an agent opens the conversation
        });
        console.log("[Twilio SMS Inbound] Saved inbound message from", from);
      }
      // Return empty TwiML so Twilio doesn't auto-reply
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    } catch (error) {
      console.error("[Twilio SMS Inbound] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    }
  });

  // --- Voicemail Recording Callback -------------------------------------------
  // Twilio POSTs here after recording the caller voicemail message.
  // Downloads the recording from Twilio (authenticated), uploads to S3,
  // and stores the public S3 URL so the browser can play it without login.
  app.all("/api/twilio/voicemail-recording", async (req, res) => {
    const callSid = req.body?.CallSid || req.query?.CallSid || "";
    const recordingSid = req.body?.RecordingSid || req.query?.RecordingSid || "";
    const recordingUrl = req.body?.RecordingUrl || req.query?.RecordingUrl || "";
    const durationStr = req.body?.RecordingDuration || req.query?.RecordingDuration || "0";
    const callerPhone = req.body?.From || req.query?.From || req.body?.Caller || "";
    const calledNumber = req.body?.To || req.query?.To || req.body?.Called || "";
    const duration = parseInt(durationStr, 10) || 0;

    console.log(`[Twilio Voicemail] Recording received: ${recordingSid} from ${callerPhone} (${duration}s)`);

    if (!recordingUrl) {
      res.set("Content-Type", "text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
      return;
    }

    try {
      const { getDb } = await import("./db");
      const { voicemails, contacts, contactPhones } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { getIntegrationConfig } = await import("./integrationConfig");
      const { storagePut } = await import("./storage");
      const database = await getDb();

      if (database) {
        // ── Step 1: Download recording from Twilio using API credentials ──
        const twilioConfig = await getIntegrationConfig("twilio");
        const accountSid = twilioConfig.accountSid || "";
        const authToken = twilioConfig.authToken || "";

        const mp3TwilioUrl = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;
        let publicUrl = mp3TwilioUrl; // fallback to Twilio URL if S3 upload fails

        try {
          console.log(`[Twilio Voicemail] Downloading recording from Twilio: ${mp3TwilioUrl}`);
          const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
          const twilioResponse = await fetch(mp3TwilioUrl, {
            headers: { Authorization: authHeader },
            redirect: "follow",
          });

          if (twilioResponse.ok) {
            const audioBuffer = Buffer.from(await twilioResponse.arrayBuffer());
            const randomSuffix = Math.random().toString(36).substring(2, 10);
            const s3Key = `voicemail-recordings/${recordingSid || callSid}-${randomSuffix}.mp3`;

            const { url: s3Url } = await storagePut(s3Key, audioBuffer, "audio/mpeg");
            publicUrl = s3Url;
            console.log(`[Twilio Voicemail] Uploaded to S3: ${s3Url}`);
          } else {
            console.error(`[Twilio Voicemail] Failed to download from Twilio (${twilioResponse.status}), storing Twilio URL as fallback`);
          }
        } catch (downloadErr) {
          console.error("[Twilio Voicemail] Error downloading/uploading recording:", downloadErr);
          // Keep the Twilio URL as fallback — better than nothing
        }

        // ── Step 2: Match caller phone to property ──
        let matchedPropertyId: number | undefined = undefined;
        let matchedContactId: number | undefined = undefined;

        if (callerPhone) {
          const callerDigits = callerPhone.replace(/\D/g, "");
          const allPhones = await database.select().from(contactPhones);
          const matchedPhone = allPhones.find((p: any) => {
            const d = (p.phoneNumber || "").replace(/\D/g, "");
            return d === callerDigits || d === callerDigits.slice(-10);
          });
          if (matchedPhone) {
            matchedContactId = matchedPhone.contactId;
            const contactRow = await database
              .select({ propertyId: contacts.propertyId })
              .from(contacts)
              .where(eq(contacts.id, matchedPhone.contactId))
              .limit(1);
            if (contactRow.length > 0) {
              matchedPropertyId = contactRow[0].propertyId ?? undefined;
            }
          }
        }

        // ── Step 3: Save to DB with public S3 URL ──
        await database.insert(voicemails).values({
          callerPhone,
          calledTwilioNumber: calledNumber || undefined,
          propertyId: matchedPropertyId,
          contactId: matchedContactId,
          recordingUrl: publicUrl,
          recordingSid: recordingSid || undefined,
          callSid: callSid || undefined,
          durationSeconds: duration,
          isHeard: 0,
        });

        console.log(`[Twilio Voicemail] Saved voicemail from ${callerPhone} (property: ${matchedPropertyId ?? "unknown"}, url: ${publicUrl})`);
      }
    } catch (err) {
      console.error("[Twilio Voicemail] Error saving recording:", err);
    }

    res.set("Content-Type", "text/xml");
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  });

  // --- Voicemail Audio Proxy ---------------------------------------------------
  // Streams voicemail audio from Twilio through our server using API credentials.
  // This avoids the browser showing a Twilio login prompt for authenticated URLs.
  // Also handles migration: downloads from Twilio, uploads to S3, updates DB.
  app.get("/api/twilio/voicemail-audio/:id", async (req, res) => {
    try {
      const voicemailId = parseInt(req.params.id, 10);
      if (isNaN(voicemailId)) {
        res.status(400).json({ error: "Invalid voicemail ID" });
        return;
      }

      const { getDb } = await import("./db");
      const { voicemails } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const database = await getDb();

      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      const [vm] = await database
        .select({ id: voicemails.id, recordingUrl: voicemails.recordingUrl, recordingSid: voicemails.recordingSid })
        .from(voicemails)
        .where(eq(voicemails.id, voicemailId))
        .limit(1);

      if (!vm || !vm.recordingUrl) {
        res.status(404).json({ error: "Voicemail not found" });
        return;
      }

      const url = vm.recordingUrl;
      const isTwilioUrl = url.includes("api.twilio.com") || url.includes("twilio.com/2010-04-01");

      if (!isTwilioUrl) {
        // Already an S3/public URL — redirect directly
        res.redirect(url);
        return;
      }

      // Fetch from Twilio with credentials
      const { getIntegrationConfig } = await import("./integrationConfig");
      const twilioConfig = await getIntegrationConfig("twilio");
      const accountSid = twilioConfig.accountSid || "";
      const authToken = twilioConfig.authToken || "";

      if (!accountSid || !authToken) {
        console.error("[Voicemail Proxy] Missing Twilio credentials");
        res.status(500).json({ error: "Twilio credentials not configured" });
        return;
      }

      const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const mp3Url = url.endsWith(".mp3") ? url : `${url}.mp3`;

      console.log(`[Voicemail Proxy] Fetching audio for voicemail ${voicemailId} from Twilio`);
      const twilioResponse = await fetch(mp3Url, {
        headers: { Authorization: authHeader },
        redirect: "follow",
      });

      if (!twilioResponse.ok) {
        console.error(`[Voicemail Proxy] Twilio returned ${twilioResponse.status}`);
        res.status(502).json({ error: `Twilio returned ${twilioResponse.status}` });
        return;
      }

      // Also migrate: upload to S3 and update DB in background
      const audioBuffer = Buffer.from(await twilioResponse.arrayBuffer());

      // Stream to browser immediately
      res.set("Content-Type", "audio/mpeg");
      res.set("Content-Length", String(audioBuffer.length));
      res.set("Cache-Control", "public, max-age=86400");
      res.send(audioBuffer);

      // Background: upload to S3 and update DB so next time it's direct
      try {
        const { storagePut } = await import("./storage");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const s3Key = `voicemail-recordings/${vm.recordingSid || voicemailId}-${randomSuffix}.mp3`;
        const { url: s3Url } = await storagePut(s3Key, audioBuffer, "audio/mpeg");

        await database.update(voicemails)
          .set({ recordingUrl: s3Url })
          .where(eq(voicemails.id, voicemailId));

        console.log(`[Voicemail Proxy] Migrated voicemail ${voicemailId} to S3: ${s3Url}`);
      } catch (migrateErr) {
        console.error(`[Voicemail Proxy] Failed to migrate voicemail ${voicemailId} to S3:`, migrateErr);
      }
    } catch (error) {
      console.error("[Voicemail Proxy] Error:", error);
      res.status(500).json({ error: "Failed to fetch voicemail audio" });
    }
  });

  console.log("[Twilio] Webhook routes registered at /api/twilio/*");
}
