import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as deskDb from "../db-desks";

export const desksRouter = router({
  /**
   * List all desks with their property counts
   */
  list: protectedProcedure.query(async () => {
    const [allDesks, counts] = await Promise.all([
      deskDb.listDesks(),
      deskDb.getDeskPropertyCounts(),
    ]);
    return allDesks.map((desk) => ({
      ...desk,
      propertyCount: counts[desk.name] || 0,
    }));
  }),

  /**
   * Create a new desk (admin only)
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check for duplicate name
      const existing = await deskDb.getDeskByName(input.name);
      if (existing) {
        throw new Error(`A desk named "${input.name}" already exists`);
      }
      return await deskDb.createDesk(input);
    }),

  /**
   * Update/rename a desk (admin only)
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      // If renaming, check for duplicate
      if (data.name) {
        const existing = await deskDb.getDeskByName(data.name);
        if (existing && existing.id !== id) {
          throw new Error(`A desk named "${data.name}" already exists`);
        }
      }
      return await deskDb.updateDesk(id, data);
    }),

  /**
   * Delete a desk with property transfer (admin only)
   */
  delete: adminProcedure
    .input(
      z.object({
        id: z.number(),
        transferToDeskId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      return await deskDb.deleteDesk(input.id, input.transferToDeskId);
    }),

  /**
   * Get property counts per desk
   */
  propertyCounts: protectedProcedure.query(async () => {
    return await deskDb.getDeskPropertyCounts();
  }),
});
