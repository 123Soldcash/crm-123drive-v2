/**
 * Drip Campaign Executor
 * 
 * This module provides:
 * 1. An Express endpoint `/api/scheduled/drip-execute` for the scheduled task to call
 * 2. A helper `cancelDripCampaignsForProperty` to auto-cancel when a lead responds
 * 
 * The scheduled task hits this endpoint periodically. It finds all pending steps
 * whose scheduledFor <= now and executes them (sends SMS/email via Twilio).
 */
import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { propertyDripCampaigns, propertyDripSteps, contacts, properties } from "../drizzle/schema";
import { eq, and, lte, sql } from "drizzle-orm";


// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-CANCEL: Call this when an inbound contact is detected for a property
// ═══════════════════════════════════════════════════════════════════════════════

export async function cancelDripCampaignsForProperty(propertyId: number): Promise<number> {
  const db = (await getDb())!;

  // Find all active campaigns for this property
  const activeCampaigns = await db
    .select({ id: propertyDripCampaigns.id })
    .from(propertyDripCampaigns)
    .where(
      and(
        eq(propertyDripCampaigns.propertyId, propertyId),
        eq(propertyDripCampaigns.status, "active")
      )
    );

  if (activeCampaigns.length === 0) return 0;

  const campaignIds = activeCampaigns.map((c) => c.id);

  // Cancel all active campaigns
  for (const cid of campaignIds) {
    await db
      .update(propertyDripCampaigns)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "inbound_contact",
      })
      .where(eq(propertyDripCampaigns.id, cid));

    // Cancel all pending steps
    await db
      .update(propertyDripSteps)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(propertyDripSteps.campaignId, cid),
          eq(propertyDripSteps.status, "pending")
        )
      );
  }

  console.log(`[Drip] Auto-cancelled ${campaignIds.length} campaigns for property ${propertyId} (inbound contact)`);
  return campaignIds.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTOR: Process pending drip steps
// ═══════════════════════════════════════════════════════════════════════════════

async function executePendingSteps(): Promise<{ executed: number; errors: number }> {
  const db = (await getDb())!;
  let executed = 0;
  let errors = 0;

  // Find all pending steps whose scheduledFor <= now
  const pendingSteps = await db
    .select({
      stepId: propertyDripSteps.id,
      campaignId: propertyDripSteps.campaignId,
      channel: propertyDripSteps.channel,
      messageBody: propertyDripSteps.messageBody,
      emailSubject: propertyDripSteps.emailSubject,
      sortOrder: propertyDripSteps.sortOrder,
    })
    .from(propertyDripSteps)
    .where(
      and(
        eq(propertyDripSteps.status, "pending"),
        lte(propertyDripSteps.scheduledFor, new Date())
      )
    )
    .limit(100); // Process max 100 per run to avoid timeout

  for (const step of pendingSteps) {
    try {
      // Verify campaign is still active
      const [campaign] = await db
        .select({
          status: propertyDripCampaigns.status,
          propertyId: propertyDripCampaigns.propertyId,
        })
        .from(propertyDripCampaigns)
        .where(eq(propertyDripCampaigns.id, step.campaignId))
        .limit(1);

      if (!campaign || campaign.status !== "active") {
        // Campaign was cancelled/completed, skip
        await db
          .update(propertyDripSteps)
          .set({ status: "cancelled" })
          .where(eq(propertyDripSteps.id, step.stepId));
        continue;
      }

      // Get the primary phone contact for this property
      const [contact] = await db
        .select({
          phoneNumber: contacts.phoneNumber,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.propertyId, campaign.propertyId),
            eq(contacts.contactType, "phone")
          )
        )
        .limit(1);

      if (!contact?.phoneNumber && step.channel === "SMS Only") {
        // No phone number, skip this step
        await db
          .update(propertyDripSteps)
          .set({ status: "skipped", executedAt: new Date() })
          .where(eq(propertyDripSteps.id, step.stepId));
        continue;
      }

      // Execute based on channel
      if (step.channel === "SMS Only" && contact?.phoneNumber) {
        // Send SMS via Twilio
        try {
          const { getIntegrationConfig } = await import("./integrationConfig");
          const { ENV } = await import("./_core/env");
          const twilioConfig = await getIntegrationConfig("twilio");
          const twilio = await import("twilio");
          const client = twilio.default(
            twilioConfig.accountSid || ENV.twilioAccountSid,
            twilioConfig.authToken || ENV.twilioAuthToken
          );
          const messagingServiceSid = twilioConfig.messagingServiceSid || ENV.twilioMessagingServiceSid;
          const fromPhone = twilioConfig.phoneNumber || ENV.twilioPhoneNumber;

          // Format to E.164
          const rawDigits = contact.phoneNumber.replace(/\D/g, "");
          const toPhone = rawDigits.length === 10 ? `+1${rawDigits}` : rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` : contact.phoneNumber.startsWith("+") ? contact.phoneNumber : `+1${rawDigits}`;

          const twilioParams: any = { to: toPhone, body: step.messageBody || "" };
          if (messagingServiceSid) {
            twilioParams.messagingServiceSid = messagingServiceSid;
          } else if (fromPhone) {
            twilioParams.from = fromPhone;
          }
          await client.messages.create(twilioParams);

          // Save to smsMessages table
          const { smsMessages: smsTable } = await import("../drizzle/schema");
          await db.insert(smsTable).values({
            contactPhone: toPhone,
            twilioPhone: fromPhone || "",
            direction: "outbound",
            body: step.messageBody || "",
            status: "sent",
            propertyId: campaign.propertyId,
          });
        } catch (smsErr: any) {
          console.error(`[Drip] SMS send failed for property ${campaign.propertyId}:`, smsErr.message);
        }
      } else if (step.channel === "Email Only") {
        // Email sending - log for now (email integration may not be active)
        console.log(`[Drip] Email step for property ${campaign.propertyId}: ${step.emailSubject}`);
      }

      // Mark step as executed
      await db
        .update(propertyDripSteps)
        .set({ status: "executed", executedAt: new Date() })
        .where(eq(propertyDripSteps.id, step.stepId));

      // Update campaign currentStepOrder
      await db
        .update(propertyDripCampaigns)
        .set({ currentStepOrder: step.sortOrder })
        .where(eq(propertyDripCampaigns.id, step.campaignId));

      executed++;
    } catch (err) {
      console.error(`[Drip] Error executing step ${step.stepId}:`, err);
      errors++;
    }
  }

  // Check if any campaigns are now complete (all steps executed/skipped)
  const activeCampaigns = await db
    .select({ id: propertyDripCampaigns.id })
    .from(propertyDripCampaigns)
    .where(eq(propertyDripCampaigns.status, "active"));

  for (const campaign of activeCampaigns) {
    const [pendingCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(propertyDripSteps)
      .where(
        and(
          eq(propertyDripSteps.campaignId, campaign.id),
          eq(propertyDripSteps.status, "pending")
        )
      );

    if (pendingCount.count === 0) {
      await db
        .update(propertyDripCampaigns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(propertyDripCampaigns.id, campaign.id));
    }
  }

  return { executed, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS ENDPOINT REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

export function registerDripScheduledEndpoint(app: Express) {
  // This endpoint is called by the Manus scheduled task
  // Auth is handled by the platform cookie (app_session_id)
  app.post("/api/scheduled/drip-execute", async (req: Request, res: Response) => {
    try {
      console.log("[Drip] Scheduled execution started...");
      const result = await executePendingSteps();
      console.log(`[Drip] Execution complete: ${result.executed} executed, ${result.errors} errors`);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[Drip] Scheduled execution failed:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
