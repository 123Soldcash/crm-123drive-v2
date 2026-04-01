import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { sectionNotes, sectionNoteAttachments } from "../drizzle/schema";

// ─── Get all notes for a property+section ──────────────────────────────────
export async function getSectionNotes(propertyId: number, section: string) {
  const db = await getDb();
  if (!db) return [];

  const notes = await db
    .select()
    .from(sectionNotes)
    .where(and(eq(sectionNotes.propertyId, propertyId), eq(sectionNotes.section, section)))
    .orderBy(sectionNotes.createdAt);

  // Attach files to each note
  const notesWithAttachments = await Promise.all(
    notes.map(async (note) => {
      const attachments = await db
        .select()
        .from(sectionNoteAttachments)
        .where(eq(sectionNoteAttachments.sectionNoteId, note.id));
      return { ...note, attachments };
    })
  );

  return notesWithAttachments;
}

// ─── Get all notes for a property (all sections) ───────────────────────────
export async function getAllSectionNotes(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const notes = await db
    .select()
    .from(sectionNotes)
    .where(eq(sectionNotes.propertyId, propertyId))
    .orderBy(sectionNotes.section, sectionNotes.createdAt);

  const notesWithAttachments = await Promise.all(
    notes.map(async (note) => {
      const attachments = await db
        .select()
        .from(sectionNoteAttachments)
        .where(eq(sectionNoteAttachments.sectionNoteId, note.id));
      return { ...note, attachments };
    })
  );

  return notesWithAttachments;
}

// ─── Create a new section note ─────────────────────────────────────────────
export async function createSectionNote(data: {
  propertyId: number;
  section: string;
  text: string;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(sectionNotes).values({
    propertyId: data.propertyId,
    section: data.section,
    text: data.text,
    createdBy: data.createdBy,
  });

  const noteId = (result as any).insertId as number;

  const [note] = await db.select().from(sectionNotes).where(eq(sectionNotes.id, noteId));
  return { ...note, attachments: [] };
}

// ─── Update a section note ─────────────────────────────────────────────────
export async function updateSectionNote(noteId: number, text: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(sectionNotes).set({ text }).where(eq(sectionNotes.id, noteId));
  const [note] = await db.select().from(sectionNotes).where(eq(sectionNotes.id, noteId));
  const attachments = await db
    .select()
    .from(sectionNoteAttachments)
    .where(eq(sectionNoteAttachments.sectionNoteId, noteId));
  return { ...note, attachments };
}

// ─── Delete a section note (cascades to attachments) ──────────────────────
export async function deleteSectionNote(noteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(sectionNoteAttachments).where(eq(sectionNoteAttachments.sectionNoteId, noteId));
  await db.delete(sectionNotes).where(eq(sectionNotes.id, noteId));
  return { success: true };
}

// ─── Add attachment to a section note ─────────────────────────────────────
export async function addSectionNoteAttachment(data: {
  sectionNoteId: number;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSize?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(sectionNoteAttachments).values(data);
  const attachmentId = (result as any).insertId as number;
  const [attachment] = await db
    .select()
    .from(sectionNoteAttachments)
    .where(eq(sectionNoteAttachments.id, attachmentId));
  return attachment;
}

// ─── Delete an attachment ──────────────────────────────────────────────────
export async function deleteSectionNoteAttachment(attachmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(sectionNoteAttachments).where(eq(sectionNoteAttachments.id, attachmentId));
  return { success: true };
}
