import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getSectionNotes,
  getAllSectionNotes,
  createSectionNote,
  updateSectionNote,
  deleteSectionNote,
  addSectionNoteAttachment,
  deleteSectionNoteAttachment,
} from "../db-sectionNotes";
import { storagePut } from "../storage";

const SECTION_NAMES = [
  "property_basics",
  "condition",
  "occupancy",
  "seller_situation",
  "legal_title",
  "probate_family_tree",
] as const;

export const sectionNotesRouter = router({
  // Get all notes for a specific section of a property
  getBySection: protectedProcedure
    .input(z.object({
      propertyId: z.number(),
      section: z.string(),
    }))
    .query(async ({ input }) => {
      return getSectionNotes(input.propertyId, input.section);
    }),

  // Get all notes for a property (all sections)
  getAll: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      return getAllSectionNotes(input.propertyId);
    }),

  // Create a new note
  create: protectedProcedure
    .input(z.object({
      propertyId: z.number(),
      section: z.string(),
      text: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return createSectionNote({
        propertyId: input.propertyId,
        section: input.section,
        text: input.text,
        createdBy: ctx.user.id,
      });
    }),

  // Update note text
  update: protectedProcedure
    .input(z.object({
      noteId: z.number(),
      text: z.string(),
    }))
    .mutation(async ({ input }) => {
      return updateSectionNote(input.noteId, input.text);
    }),

  // Delete a note
  delete: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ input }) => {
      return deleteSectionNote(input.noteId);
    }),

  // Upload attachment (base64 encoded file)
  uploadAttachment: protectedProcedure
    .input(z.object({
      noteId: z.number(),
      fileName: z.string(),
      mimeType: z.string(),
      fileData: z.string(), // base64 encoded
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.fileData, "base64");
      const suffix = Date.now().toString(36);
      const ext = input.fileName.split(".").pop() || "bin";
      const fileKey = `section-notes/${input.noteId}/${suffix}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      return addSectionNoteAttachment({
        sectionNoteId: input.noteId,
        fileName: input.fileName,
        fileKey,
        fileUrl: url,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
    }),

  // Delete attachment
  deleteAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.number() }))
    .mutation(async ({ input }) => {
      return deleteSectionNoteAttachment(input.attachmentId);
    }),
});
