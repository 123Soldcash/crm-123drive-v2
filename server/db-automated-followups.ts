import { getDb } from "./db";
import { automatedFollowUps, properties, tasks, notes, contacts, smsMessages } from "../drizzle/schema";
import { eq, lt, and, inArray } from "drizzle-orm";
import { getIntegrationConfig } from "./integrationConfig";
import { ENV } from "./_core/env";

/**
 * Tipos para o Follow-up System
 */
export type FollowUpTrigger = "Cold Lead" | "No Contact" | "Stage Change" | "Custom";
export type FollowUpAction = "Create Task" | "Send Email" | "Send SMS" | "Change Stage";

export interface CreateFollowUpInput {
  propertyId: number;
  type: FollowUpTrigger;
  trigger: string;
  action: FollowUpAction;
  actionDetails: Record<string, any>;
  nextRunAt: Date;
  templateId?: number | null;
  templateBody?: string;
  createdByUserId?: number;
  createdByName?: string;
}

export interface FollowUpWithProperty {
  id: number;
  propertyId: number;
  type: FollowUpTrigger;
  trigger: string;
  action: FollowUpAction;
  actionDetails: string;
  status: "Active" | "Paused" | "Completed";
  lastTriggeredAt: Date | null;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
  property?: {
    addressLine1: string;
    city: string;
    state: string;
    zipcode: string;
  };
}

/**
 * Criar um novo follow-up automatizado
 */
export async function createAutomatedFollowUp(input: CreateFollowUpInput) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db.insert(automatedFollowUps).values({
      propertyId: input.propertyId,
      type: input.type,
      trigger: input.trigger,
      action: input.action,
      actionDetails: JSON.stringify(input.actionDetails),
      status: "Active",
      nextRunAt: input.nextRunAt,
      ...(input.templateId != null ? { templateId: input.templateId } : {}),
      ...(input.templateBody ? { templateBody: input.templateBody } : {}),
      ...(input.createdByUserId != null ? { createdByUserId: input.createdByUserId } : {}),
      ...(input.createdByName ? { createdByName: input.createdByName } : {}),
    });

    return {
      success: true,
      message: "Follow-up created successfully",
      followUpId: (result as any)[0]?.insertId,
    };
  } catch (error) {
    console.error("[FollowUp] Error creating follow-up:", error);
    return {
      success: false,
      message: "Error creating follow-up",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Listar todos os follow-ups de uma propriedade
 */
export async function getFollowUpsByProperty(propertyId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const followUps = await db
      .select()
      .from(automatedFollowUps)
      .where(eq(automatedFollowUps.propertyId, propertyId));

    return followUps.map((fu) => ({
      ...fu,
      actionDetails: typeof fu.actionDetails === "string" ? JSON.parse(fu.actionDetails) : fu.actionDetails,
    }));
  } catch (error) {
    console.error("[FollowUp] Error fetching follow-ups:", error);
    return [];
  }
}

/**
 * Listar follow-ups que devem ser executados agora
 */
export async function getPendingFollowUps() {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const pendingFollowUps = await db
      .select({
        followUp: automatedFollowUps,
        property: properties,
      })
      .from(automatedFollowUps)
      .innerJoin(properties, eq(automatedFollowUps.propertyId, properties.id))
      .where(
        and(
          eq(automatedFollowUps.status, "Active"),
          lt(automatedFollowUps.nextRunAt, now)
        )
      );

    return pendingFollowUps.map((item) => ({
      ...item.followUp,
      actionDetails: typeof item.followUp.actionDetails === "string"
        ? JSON.parse(item.followUp.actionDetails)
        : item.followUp.actionDetails,
      property: item.property,
    }));
  } catch (error) {
    console.error("[FollowUp] Error fetching pending follow-ups:", error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Get primary contact phone/email for a property
// ═══════════════════════════════════════════════════════════════════════════════

async function getPropertyContactInfo(propertyId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get first non-deceased, non-DNC contact with a phone
  const propertyContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.propertyId, propertyId));

  const activeContacts = propertyContacts.filter(c => c.deceased !== 1);
  if (activeContacts.length === 0) return null;

  // Get phones for all active contacts
  const contactIds = activeContacts.map(c => c.id);
  const phones = await db
    .select()
    .from(contacts)
    .where(inArray(contacts.id, contactIds));

  // Get emails for all active contacts
  const emails = await db
    .select()
    .from(contacts)
    .where(inArray(contacts.id, contactIds));

  // Find best phone (non-DNC, primary first)
  const validPhones = phones.filter(p => p.dnc !== 1);
  const primaryPhone = validPhones.find(p => p.id > 0) || validPhones[0];

  // Find best email (primary first)
  const primaryEmail = emails.find(e => e.id > 0) || emails[0];

  // Find the contact that owns the best phone
  const bestContact = primaryPhone
    ? activeContacts.find(c => c.id === primaryPhone.id)
    : activeContacts[0];

  return {
    contact: bestContact,
    phone: primaryPhone?.phoneNumber || null,
    phoneContactId: primaryPhone?.id || null,
    email: primaryEmail?.email || null,
    emailContactId: primaryEmail?.id || null,
    firstName: bestContact?.firstName || bestContact?.name?.split(" ")[0] || "",
    lastName: bestContact?.lastName || bestContact?.name?.split(" ").slice(1).join(" ") || "",
    fullName: bestContact?.name || `${bestContact?.firstName || ""} ${bestContact?.lastName || ""}`.trim(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Get property address fields for template variable substitution
// ═══════════════════════════════════════════════════════════════════════════════

async function getPropertyAddress(propertyId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      zipCode: properties.zipcode,
    })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  return rows[0] || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: Send SMS via Twilio (REAL)
// ═══════════════════════════════════════════════════════════════════════════════

async function executeFollowUpSMS(propertyId: number, actionDetails: any, followUp: any) {
  try {
    const contactInfo = await getPropertyContactInfo(propertyId);
    if (!contactInfo?.phone) {
      return { success: false, message: "No valid phone number found for this property's contacts" };
    }

    const twilioConfig = await getIntegrationConfig("twilio");
    const accountSid = twilioConfig.accountSid || ENV.twilioAccountSid;
    const authToken = twilioConfig.authToken || ENV.twilioAuthToken;
    const messagingServiceSid = twilioConfig.messagingServiceSid || ENV.twilioMessagingServiceSid;
    const fromPhone = twilioConfig.phoneNumber || ENV.twilioPhoneNumber;

    if (!accountSid || !authToken) {
      return { success: false, message: "Twilio not configured. Go to Settings → Integrations → Twilio." };
    }
    if (!messagingServiceSid && !fromPhone) {
      return { success: false, message: "No Twilio Messaging Service or phone number configured." };
    }

    // Build the message body — use template or actionDetails.message
    let messageBody = actionDetails.message || followUp.templateBody || "Follow-up automático";

    // Fetch property address for {{address}} / {{city}} / {{state}} / {{zip}} substitution
    const propAddress = await getPropertyAddress(propertyId);

    // Full variable replacement — contact + property
    messageBody = messageBody
      .replace(/\{\{name\}\}/gi, contactInfo.fullName)
      .replace(/\{\{ownerName\}\}/gi, contactInfo.fullName)
      .replace(/\{\{contactName\}\}/gi, contactInfo.fullName)
      .replace(/\{\{firstName\}\}/gi, contactInfo.firstName)
      .replace(/\{\{lastName\}\}/gi, contactInfo.lastName)
      .replace(/\{\{phone\}\}/gi, contactInfo.phone)
      .replace(/\{\{address\}\}/gi, propAddress?.addressLine1 || "")
      .replace(/\{\{city\}\}/gi, propAddress?.city || "")
      .replace(/\{\{state\}\}/gi, propAddress?.state || "")
      .replace(/\{\{zip\}\}/gi, propAddress?.zipCode || "");

    // Format phone to E.164
    const rawDigits = contactInfo.phone.replace(/\D/g, "");
    const toPhone = rawDigits.length === 10 ? `+1${rawDigits}` :
      rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` :
        contactInfo.phone.startsWith("+") ? contactInfo.phone : `+1${rawDigits}`;

    // Send via Twilio
    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);

    const twilioParams: any = { to: toPhone, body: messageBody };
    if (messagingServiceSid) {
      twilioParams.messagingServiceSid = messagingServiceSid;
    } else {
      twilioParams.from = fromPhone;
    }

    const msg = await client.messages.create(twilioParams);

    // Save to smsMessages table
    const db = await getDb();
    if (db) {
      await db.insert(smsMessages).values({
        contactPhone: toPhone,
        twilioPhone: fromPhone || "",
        direction: "outbound",
        body: messageBody,
        twilioSid: msg.sid,
        status: "sent",
        contactId: contactInfo.phoneContactId,
        propertyId,
        sentByUserId: followUp.createdByUserId || 1,
        sentByName: followUp.createdByName || "System (Auto Follow-up)",
      });
    }

    console.log(`[FollowUp SMS] Sent to ${toPhone} for property ${propertyId}: ${msg.sid}`);
    return {
      success: true,
      twilioSid: msg.sid,
      message: `SMS sent to ${toPhone}: "${messageBody.substring(0, 50)}..."`,
    };
  } catch (error: any) {
    console.error("[FollowUp SMS] Error:", error);
    return {
      success: false,
      message: `SMS failed: ${error?.message || "Unknown error"}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: Send Email via Instantly API (REAL)
// ═══════════════════════════════════════════════════════════════════════════════

async function executeFollowUpEmail(propertyId: number, actionDetails: any) {
  try {
    const contactInfo = await getPropertyContactInfo(propertyId);
    if (!contactInfo?.email) {
      return { success: false, message: "No email address found for this property's contacts" };
    }

    const instantlyConfig = await getIntegrationConfig("instantly");
    const apiKey = instantlyConfig.apiKey;
    const campaignId = actionDetails.campaignId || instantlyConfig.campaignId;

    if (!apiKey) {
      return { success: false, message: "Instantly API Key not configured. Go to Settings → Integrations → Instantly." };
    }
    if (!campaignId) {
      return { success: false, message: "No Instantly Campaign ID configured. Set it in Settings → Integrations → Instantly or in the follow-up action details." };
    }

    // Add lead to Instantly campaign via API v2
    const response = await fetch("https://api.instantly.ai/api/v2/leads/add", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leads: [
          {
            email: contactInfo.email,
            first_name: contactInfo.firstName,
            last_name: contactInfo.lastName,
            phone: contactInfo.phone || "",
            company_name: actionDetails.companyName || "",
            custom_variables: {
              property_id: String(propertyId),
              source: "CRM Follow-up",
              follow_up_type: actionDetails.followUpType || "automated",
            },
          },
        ],
        campaign_id: campaignId,
        skip_if_in_campaign: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Instantly API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    console.log(`[FollowUp Email] Added ${contactInfo.email} to Instantly campaign ${campaignId}:`, result);

    // Log to notes
    const db = await getDb();
    if (db) {
      await db.insert(notes).values({
        propertyId,
        userId: 1,
        content: `[Auto Follow-up] Email: Added ${contactInfo.email} to Instantly campaign. Leads uploaded: ${result.leads_uploaded || 0}`,
      });
    }

    return {
      success: true,
      message: `Email lead added to Instantly campaign: ${contactInfo.email} (${result.leads_uploaded || 0} uploaded)`,
      instantlyResult: result,
    };
  } catch (error: any) {
    console.error("[FollowUp Email] Error:", error);
    return {
      success: false,
      message: `Email follow-up failed: ${error?.message || "Unknown error"}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: Trigger AutoCalls campaign via API (REAL)
// ═══════════════════════════════════════════════════════════════════════════════

async function executeFollowUpAutoCall(propertyId: number, actionDetails: any) {
  try {
    const contactInfo = await getPropertyContactInfo(propertyId);
    if (!contactInfo?.phone) {
      return { success: false, message: "No valid phone number found for this property's contacts" };
    }

    const autocallsConfig = await getIntegrationConfig("autocalls");
    const apiKey = autocallsConfig.apiKey;
    const baseUrl = autocallsConfig.baseUrl;
    const campaignId = actionDetails.campaignId || autocallsConfig.campaignId;

    if (!apiKey) {
      return { success: false, message: "AutoCalls API Key not configured. Go to Settings → Integrations → AutoCalls." };
    }
    if (!baseUrl) {
      return { success: false, message: "AutoCalls API Base URL not configured. Go to Settings → Integrations → AutoCalls." };
    }
    if (!campaignId) {
      return { success: false, message: "No AutoCalls Campaign ID configured. Set it in Settings → Integrations → AutoCalls or in the follow-up action details." };
    }

    // Format phone to E.164
    const rawDigits = contactInfo.phone.replace(/\D/g, "");
    const toPhone = rawDigits.length === 10 ? `+1${rawDigits}` :
      rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` :
        contactInfo.phone.startsWith("+") ? contactInfo.phone : `+1${rawDigits}`;

    // Generic API call — adapts to most AutoCalls providers (VAPI, Bland.ai, etc.)
    // The exact endpoint and body format may need adjustment based on the provider
    const endpoint = `${baseUrl.replace(/\/$/, "")}/campaigns/${campaignId}/leads`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leads: [
          {
            phone_number: toPhone,
            first_name: contactInfo.firstName,
            last_name: contactInfo.lastName,
            name: contactInfo.fullName,
            email: contactInfo.email || "",
            custom_data: {
              property_id: String(propertyId),
              source: "CRM Follow-up",
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AutoCalls API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    console.log(`[FollowUp AutoCall] Added ${toPhone} to campaign ${campaignId}:`, result);

    // Log to notes
    const db = await getDb();
    if (db) {
      await db.insert(notes).values({
        propertyId,
        userId: 1,
        content: `[Auto Follow-up] AutoCall: Added ${toPhone} (${contactInfo.fullName}) to campaign ${campaignId}`,
      });
    }

    return {
      success: true,
      message: `AutoCall lead added to campaign: ${toPhone}`,
      autocallsResult: result,
    };
  } catch (error: any) {
    console.error("[FollowUp AutoCall] Error:", error);
    return {
      success: false,
      message: `AutoCall follow-up failed: ${error?.message || "Unknown error"}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: Create Task
// ═══════════════════════════════════════════════════════════════════════════════

async function createFollowUpTask(propertyId: number, actionDetails: any) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db.insert(tasks).values({
      title: actionDetails.title || "Follow-up Automático",
      description: actionDetails.description || "Task created automatically by the follow-up system",
      taskType: "Follow-up",
      priority: actionDetails.priority || "Medium",
      status: "To Do",
      propertyId,
      dueDate: actionDetails.dueDate ? new Date(actionDetails.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdById: 1,
      assignedToId: actionDetails.assignedToId || null,
    });

    return {
      success: true,
      taskId: (result as any)[0]?.insertId,
      message: "Follow-up task created",
    };
  } catch (error) {
    console.error("[FollowUp Task] Error:", error);
    return {
      success: false,
      message: "Error creating task",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: Change Property Stage
// ═══════════════════════════════════════════════════════════════════════════════

async function changePropertyStage(propertyId: number, newStage: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(properties)
      .set({
        dealStage: newStage as any,
        stageChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    return {
      success: true,
      message: `Property stage changed to: ${newStage}`,
    };
  } catch (error) {
    console.error("[FollowUp Stage] Error:", error);
    return {
      success: false,
      message: "Error changing stage",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: Execute a follow-up
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const followUp = await db
      .select()
      .from(automatedFollowUps)
      .where(eq(automatedFollowUps.id, followUpId))
      .then((rows) => rows[0]);

    if (!followUp) {
      return { success: false, message: "Follow-up not found" };
    }

    const actionDetails = typeof followUp.actionDetails === "string"
      ? JSON.parse(followUp.actionDetails)
      : followUp.actionDetails;

    let actionResult: any = null;

    switch (followUp.action) {
      case "Create Task":
        actionResult = await createFollowUpTask(followUp.propertyId, actionDetails);
        break;

      case "Send Email":
        actionResult = await executeFollowUpEmail(followUp.propertyId, actionDetails);
        break;

      case "Send SMS":
        actionResult = await executeFollowUpSMS(followUp.propertyId, actionDetails, followUp);
        break;

      case "Change Stage":
        actionResult = await changePropertyStage(followUp.propertyId, actionDetails.newStage);
        break;

      default:
        return { success: false, message: "Unknown action" };
    }

    // Update the follow-up with execution timestamp
    const nextRunAt = calculateNextRunDate(followUp.trigger);

    await db
      .update(automatedFollowUps)
      .set({
        lastTriggeredAt: new Date(),
        nextRunAt: nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(automatedFollowUps.id, followUpId));

    return {
      success: true,
      message: `Follow-up executed: ${followUp.action}`,
      actionResult,
    };
  } catch (error) {
    console.error("[FollowUp Execute] Error:", error);
    return {
      success: false,
      message: "Error executing follow-up",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER: Background process that checks and executes pending follow-ups
// ═══════════════════════════════════════════════════════════════════════════════

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function runSchedulerCycle() {
  try {
    const pending = await getPendingFollowUps();
    if (pending.length === 0) return { processed: 0, results: [] };

    console.log(`[FollowUp Scheduler] Found ${pending.length} pending follow-ups`);

    const results: Array<{ followUpId: number; action: string; result: any }> = [];

    for (const followUp of pending) {
      try {
        const result = await executeFollowUp(followUp.id);
        results.push({ followUpId: followUp.id, action: followUp.action, result });
        console.log(`[FollowUp Scheduler] Executed #${followUp.id} (${followUp.action}): ${result.success ? "OK" : "FAILED"}`);
      } catch (err: any) {
        console.error(`[FollowUp Scheduler] Error executing #${followUp.id}:`, err);
        results.push({ followUpId: followUp.id, action: followUp.action, result: { success: false, message: err.message } });
      }
    }

    return { processed: pending.length, results };
  } catch (error) {
    console.error("[FollowUp Scheduler] Cycle error:", error);
    return { processed: 0, results: [] };
  }
}

export function startFollowUpScheduler() {
  if (schedulerInterval) {
    console.log("[FollowUp Scheduler] Already running");
    return;
  }

  console.log(`[FollowUp Scheduler] Starting — checking every ${SCHEDULER_INTERVAL_MS / 1000}s`);

  // Run immediately on start
  runSchedulerCycle().catch(console.error);

  // Then run every 5 minutes
  schedulerInterval = setInterval(() => {
    runSchedulerCycle().catch(console.error);
  }, SCHEDULER_INTERVAL_MS);
}

export function stopFollowUpScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[FollowUp Scheduler] Stopped");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateNextRunDate(trigger: string): Date {
  const now = new Date();

  if (trigger.includes("30 dias") || trigger.includes("30 days")) {
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (trigger.includes("7 dias") || trigger.includes("7 days")) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (trigger.includes("1 dia") || trigger.includes("1 day")) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (trigger.includes("COLD")) {
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  // Default: 7 days
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Pausar um follow-up
 */
export async function pauseFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(automatedFollowUps)
      .set({ status: "Paused", updatedAt: new Date() })
      .where(eq(automatedFollowUps.id, followUpId));
    return { success: true, message: "Follow-up paused" };
  } catch (error) {
    console.error("[FollowUp] Error pausing:", error);
    return { success: false, message: "Error pausing follow-up", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Retomar um follow-up pausado
 */
export async function resumeFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(automatedFollowUps)
      .set({ status: "Active", updatedAt: new Date() })
      .where(eq(automatedFollowUps.id, followUpId));
    return { success: true, message: "Follow-up resumed" };
  } catch (error) {
    console.error("[FollowUp] Error resuming:", error);
    return { success: false, message: "Error resuming follow-up", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Deletar um follow-up
 */
export async function deleteFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(automatedFollowUps).where(eq(automatedFollowUps.id, followUpId));
    return { success: true, message: "Follow-up deleted" };
  } catch (error) {
    console.error("[FollowUp] Error deleting:", error);
    return { success: false, message: "Error deleting follow-up", error: error instanceof Error ? error.message : "Unknown error" };
  }
}
