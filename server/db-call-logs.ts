import { getDb } from "./db";
import { callLogs } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Create a new call log entry
 */
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
  endedAt?: Date;
  startedAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const result = await db.insert(callLogs).values({
    ...data,
    callType: data.callType || "outbound",
  });

  return result;
}

/**
 * Update call log with end time and duration
 */
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
  if (!db) throw new Error("Database not initialized");
  const result = await db
    .update(callLogs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(callLogs.id, callLogId));

  return result;
}

/**
 * Get call logs for a property
 */
export async function getPropertyCallLogs(propertyId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const logs = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.propertyId, propertyId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);

  return logs;
}

/**
 * Get call logs for a contact
 */
export async function getContactCallLogs(contactId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const logs = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.contactId, contactId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);

  return logs;
}

/**
 * Get call logs for a user
 */
export async function getUserCallLogs(userId: number, limit = 50) {
  const logs = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.userId, userId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);

  return logs;
}

/**
 * Get recent calls for a contact (last 24 hours)
 */
export async function getRecentContactCalls(contactId: number) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const logs = await db
    .select()
    .from(callLogs)
    .where(
      and(
        eq(callLogs.contactId, contactId),
        // @ts-ignore - Drizzle doesn't have a gte operator in the type definitions
        callLogs.createdAt >= twentyFourHoursAgo
      )
    )
    .orderBy(desc(callLogs.createdAt));

  return logs;
}
