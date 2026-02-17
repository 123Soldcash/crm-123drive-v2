/**
 * Call Notes Database Helpers
 * 
 * CRUD operations for call notes taken during phone calls.
 * Notes are linked to contacts and optionally to specific call logs.
 */
import { getDb } from "./db";
import { callNotes, callLogs } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Create a new call note
 */
export async function createCallNote(params: {
  callLogId?: number;
  contactId: number;
  propertyId: number;
  userId: number;
  content: string;
}) {
  const db = getDb();
  const [result] = await db.insert(callNotes).values({
    callLogId: params.callLogId ?? null,
    contactId: params.contactId,
    propertyId: params.propertyId,
    userId: params.userId,
    content: params.content,
  });
  return { id: result.insertId };
}

/**
 * Get all call notes for a specific contact, ordered by newest first
 */
export async function getCallNotesByContact(contactId: number) {
  const db = getDb();
  const results = await db
    .select({
      id: callNotes.id,
      callLogId: callNotes.callLogId,
      contactId: callNotes.contactId,
      propertyId: callNotes.propertyId,
      userId: callNotes.userId,
      content: callNotes.content,
      createdAt: callNotes.createdAt,
    })
    .from(callNotes)
    .where(eq(callNotes.contactId, contactId))
    .orderBy(desc(callNotes.createdAt));
  return results;
}

/**
 * Get all call notes for a specific call log
 */
export async function getCallNotesByCallLog(callLogId: number) {
  const db = getDb();
  const results = await db
    .select({
      id: callNotes.id,
      callLogId: callNotes.callLogId,
      contactId: callNotes.contactId,
      propertyId: callNotes.propertyId,
      userId: callNotes.userId,
      content: callNotes.content,
      createdAt: callNotes.createdAt,
    })
    .from(callNotes)
    .where(eq(callNotes.callLogId, callLogId))
    .orderBy(desc(callNotes.createdAt));
  return results;
}

/**
 * Get call notes for a contact with associated call log info (for history view)
 */
export async function getCallNotesWithCallInfo(contactId: number) {
  const db = getDb();
  const results = await db
    .select({
      id: callNotes.id,
      callLogId: callNotes.callLogId,
      contactId: callNotes.contactId,
      propertyId: callNotes.propertyId,
      userId: callNotes.userId,
      content: callNotes.content,
      createdAt: callNotes.createdAt,
      // Call log info (may be null if note wasn't linked to a call)
      callStatus: callLogs.status,
      callDuration: callLogs.duration,
      callStartedAt: callLogs.startedAt,
      callToNumber: callLogs.toPhoneNumber,
    })
    .from(callNotes)
    .leftJoin(callLogs, eq(callNotes.callLogId, callLogs.id))
    .where(eq(callNotes.contactId, contactId))
    .orderBy(desc(callNotes.createdAt));
  return results;
}

/**
 * Delete a call note by ID
 */
export async function deleteCallNote(noteId: number, userId: number) {
  const db = getDb();
  // Only allow deletion by the user who created the note
  await db
    .delete(callNotes)
    .where(and(eq(callNotes.id, noteId), eq(callNotes.userId, userId)));
  return { success: true };
}

/**
 * Create a call log entry when a call is initiated
 */
export async function createCallLog(params: {
  propertyId: number;
  contactId: number;
  userId: number;
  toPhoneNumber: string;
  fromPhoneNumber: string;
  callType?: "outbound" | "inbound" | "missed";
  status: "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
  twilioCallSid?: string;
}) {
  const db = getDb();
  const [result] = await db.insert(callLogs).values({
    propertyId: params.propertyId,
    contactId: params.contactId,
    userId: params.userId,
    toPhoneNumber: params.toPhoneNumber,
    fromPhoneNumber: params.fromPhoneNumber,
    callType: params.callType ?? "outbound",
    status: params.status,
    twilioCallSid: params.twilioCallSid ?? null,
    startedAt: new Date(),
  });
  return { id: result.insertId };
}

/**
 * Update a call log entry (e.g., when call ends)
 */
export async function updateCallLog(callLogId: number, params: {
  status?: "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
  duration?: number;
  endedAt?: Date;
  notes?: string;
  errorMessage?: string;
}) {
  const db = getDb();
  const updateData: Record<string, any> = {};
  if (params.status !== undefined) updateData.status = params.status;
  if (params.duration !== undefined) updateData.duration = params.duration;
  if (params.endedAt !== undefined) updateData.endedAt = params.endedAt;
  if (params.notes !== undefined) updateData.notes = params.notes;
  if (params.errorMessage !== undefined) updateData.errorMessage = params.errorMessage;

  if (Object.keys(updateData).length > 0) {
    await db.update(callLogs).set(updateData).where(eq(callLogs.id, callLogId));
  }
  return { success: true };
}

/**
 * Get call logs for a specific contact
 */
export async function getCallLogsByContact(contactId: number) {
  const db = getDb();
  const results = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.contactId, contactId))
    .orderBy(desc(callLogs.startedAt));
  return results;
}
