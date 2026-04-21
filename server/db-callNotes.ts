/**
 * Call Notes Database Helpers
 * 
 * CRUD operations for call notes taken during phone calls.
 * Notes are linked to contacts and optionally to specific call logs.
 */
import { getDb } from "./db";
import { callNotes, callLogs, communicationLog, users } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
 * Get UNIFIED notes for a contact — merges callNotes + communicationLog entries
 * into a single chronological timeline. This is used by ContactNotesDialog.
 * Returns entries sorted newest first with a unified shape.
 */
export async function getUnifiedNotesForContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Get callNotes with call info
  const callNoteResults = await db
    .select({
      id: callNotes.id,
      content: callNotes.content,
      createdAt: callNotes.createdAt,
      userId: callNotes.userId,
      userName: users.name,
      callStatus: callLogs.status,
      callDuration: callLogs.duration,
      callToNumber: callLogs.toPhoneNumber,
    })
    .from(callNotes)
    .leftJoin(callLogs, eq(callNotes.callLogId, callLogs.id))
    .leftJoin(users, eq(callNotes.userId, users.id))
    .where(eq(callNotes.contactId, contactId))
    .orderBy(desc(callNotes.createdAt));

  // 2. Get communicationLog entries that have notes
  const commLogResults = await db
    .select({
      id: communicationLog.id,
      notes: communicationLog.notes,
      callResult: communicationLog.callResult,
      disposition: communicationLog.disposition,
      mood: communicationLog.mood,
      direction: communicationLog.direction,
      contactPhoneNumber: communicationLog.contactPhoneNumber,
      communicationDate: communicationLog.communicationDate,
      userId: communicationLog.userId,
      userName: users.name,
      propertyDetails: communicationLog.propertyDetails,
    })
    .from(communicationLog)
    .leftJoin(users, eq(communicationLog.userId, users.id))
    .where(eq(communicationLog.contactId, contactId))
    .orderBy(desc(communicationLog.communicationDate));

  // 3. Merge into unified shape
  type UnifiedNote = {
    id: number;
    source: "callNote" | "commLog";
    content: string;
    createdAt: Date;
    userId: number;
    userName: string | null;
    // Call-specific info
    callStatus: string | null;
    callDuration: number | null;
    callToNumber: string | null;
    // CommLog-specific info
    callResult: string | null;
    disposition: string | null;
    mood: string | null;
    direction: string | null;
    propertyDetails: string | null;
  };

  const unified: UnifiedNote[] = [];

  // Add callNotes
  for (const cn of callNoteResults) {
    unified.push({
      id: cn.id,
      source: "callNote",
      content: cn.content,
      createdAt: cn.createdAt,
      userId: cn.userId,
      userName: cn.userName,
      callStatus: cn.callStatus,
      callDuration: cn.callDuration,
      callToNumber: cn.callToNumber,
      callResult: null,
      disposition: null,
      mood: null,
      direction: null,
      propertyDetails: null,
    });
  }

  // Add communicationLog entries
  for (const cl of commLogResults) {
    // Build content from commLog fields
    const parts: string[] = [];
    if (cl.callResult) parts.push(`[${cl.callResult}]`);
    if (cl.disposition) parts.push(`Disposition: ${cl.disposition}`);
    if (cl.mood) parts.push(`Mood: ${cl.mood}`);
    // Extract the actual note text (after " - " prefix)
    if (cl.notes) {
      const dashIndex = cl.notes.indexOf(" - ");
      const noteText = dashIndex !== -1 ? cl.notes.substring(dashIndex + 3).trim() : cl.notes;
      if (noteText) parts.push(noteText);
    }
    // Parse propertyDetails JSON if present
    if (cl.propertyDetails) {
      try {
        const details = JSON.parse(cl.propertyDetails);
        const detailParts: string[] = [];
        if (details.bedBath) detailParts.push(`Bed/Bath: ${details.bedBath}`);
        if (details.sf) detailParts.push(`SF: ${details.sf}`);
        if (details.roofAge) detailParts.push(`Roof: ${details.roofAge}`);
        if (details.acAge) detailParts.push(`AC: ${details.acAge}`);
        if (details.overallCondition) detailParts.push(`Condition: ${details.overallCondition}`);
        if (details.reasonToSell) detailParts.push(`Reason: ${details.reasonToSell}`);
        if (details.howFastToSell) detailParts.push(`Timeline: ${details.howFastToSell}`);
        if (detailParts.length > 0) parts.push(`Property: ${detailParts.join(", ")}`);
      } catch {}
    }

    const content = parts.join(" | ") || "(No details)";

    unified.push({
      id: cl.id,
      source: "commLog",
      content,
      createdAt: cl.communicationDate,
      userId: cl.userId,
      userName: cl.userName,
      callStatus: null,
      callDuration: null,
      callToNumber: cl.contactPhoneNumber,
      callResult: cl.callResult,
      disposition: cl.disposition,
      mood: cl.mood,
      direction: cl.direction,
      propertyDetails: cl.propertyDetails,
    });
  }

  // Sort by date descending
  unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return unified;
}

/**
 * Delete a call note by ID
 */
export async function deleteCallNote(noteId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.contactId, contactId))
    .orderBy(desc(callLogs.startedAt));
  return results;
}

/**
 * Get the latest call note per contact for a given property.
 * Used by the contacts list to show the most recent note in the Notes column.
 * Returns a map of contactId -> { content, createdAt, userName }
 */
export async function getLatestCallNotesByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all call notes for this property, ordered newest first
  const results = await db
    .select({
      id: callNotes.id,
      contactId: callNotes.contactId,
      content: callNotes.content,
      createdAt: callNotes.createdAt,
      userId: callNotes.userId,
    })
    .from(callNotes)
    .where(eq(callNotes.propertyId, propertyId))
    .orderBy(desc(callNotes.createdAt));

  // Build a map: contactId -> latest note (first occurrence since ordered desc)
  const latestByContact: Record<number, { id: number; content: string; createdAt: Date; userId: number }> = {};
  for (const row of results) {
    if (!latestByContact[row.contactId]) {
      latestByContact[row.contactId] = {
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        userId: row.userId,
      };
    }
  }

  return latestByContact;
}
