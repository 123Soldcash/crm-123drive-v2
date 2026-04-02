import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { crmNotifications, properties } from "../../drizzle/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export const notificationsRouter = router({
  // List notifications (admin only) with optional filters
  list: adminProcedure
    .input(
      z.object({
        source: z.enum(["instantly", "autocalls", "all"]).default("all"),
        unreadOnly: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: any[] = [];
      if (input.source !== "all") {
        conditions.push(eq(crmNotifications.source, input.source));
      }
      if (input.unreadOnly) {
        conditions.push(eq(crmNotifications.isRead, 0));
      }

      const rows = await db
        .select({
          id: crmNotifications.id,
          propertyId: crmNotifications.propertyId,
          source: crmNotifications.source,
          campaignName: crmNotifications.campaignName,
          eventType: crmNotifications.eventType,
          messageText: crmNotifications.messageText,
          isRead: crmNotifications.isRead,
          readAt: crmNotifications.readAt,
          createdAt: crmNotifications.createdAt,
          // Property info for display
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state,
        })
        .from(crmNotifications)
        .leftJoin(properties, eq(crmNotifications.propertyId, properties.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(crmNotifications.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // Get unread count (for bell badge)
  unreadCount: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0 };

    const rows = await db
      .select({ id: crmNotifications.id })
      .from(crmNotifications)
      .where(eq(crmNotifications.isRead, 0));

    return { count: rows.length };
  }),

  // Mark a single notification as read
  markRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(crmNotifications)
        .set({ isRead: 1, readAt: new Date() })
        .where(eq(crmNotifications.id, input.id));

      return { success: true };
    }),

  // Mark all notifications as read
  markAllRead: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(crmNotifications)
      .set({ isRead: 1, readAt: new Date() })
      .where(eq(crmNotifications.isRead, 0));

    return { success: true };
  }),
});
