/**
 * Call Logs Database Helpers
 *
 * CRUD operations for the callLogs table. Every phone call made through
 * the platform is recorded here for audit trail and analytics.
 */
import { getDb } from "./db";
import { callLogs } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createCallLog(data: {
  propertyId: number;
  contactId: number;
  userId: number;
  toPhoneNumber: string;
  fromPhoneNumber: string;
  callType?: "outbound" | "inbound" | "missed";
  status: "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
  twilioCallSid?: string;
  notes?: string;
  errorMessage?: string;
  startedAt: Date;
  endedAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(callLogs).values({
    propertyId: data.propertyId,
    contactId: data.contactId,
    userId: data.userId,
    toPhoneNumber: data.toPhoneNumber,
    fromPhoneNumber: data.fromPhoneNumber,
    callType: data.callType ?? "outbound",
    status: data.status,
    twilioCallSid: data.twilioCallSid,
    notes: data.notes,
    errorMessage: data.errorMessage,
    startedAt: data.startedAt,
    endedAt: data.endedAt,
  });

  return result;
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateCallLog(
  callLogId: number,
  data: Partial<{
    status: "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
    duration: number;
    endedAt: Date;
    recordingUrl: string;
    errorMessage: string;
    notes: string;
    twilioCallSid: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(callLogs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(callLogs.id, callLogId));
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getCallLogsByProperty(propertyId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(callLogs)
    .where(eq(callLogs.propertyId, propertyId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);
}

export async function getCallLogsByContact(contactId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(callLogs)
    .where(eq(callLogs.contactId, contactId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);
}
