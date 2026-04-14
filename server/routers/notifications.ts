import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { crmNotifications, properties } from "../../drizzle/schema";
import { eq, desc, and, like, sql, count } from "drizzle-orm";

export const notificationsRouter = router({
  // List notifications (admin only) with optional filters + total count for pagination
  list: adminProcedure
    .input(
      z.object({
        source: z.enum(["instantly", "autocalls", "all"]).default("all"),
        unreadOnly: z.boolean().default(false),
        search: z.string().optional(),
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
      if (input.search) {
        const term = `%${input.search}%`;
        conditions.push(
          sql`(${crmNotifications.messageText} LIKE ${term} OR ${crmNotifications.campaignName} LIKE ${term} OR ${properties.addressLine1} LIKE ${term} OR CAST(${crmNotifications.propertyId} AS CHAR) LIKE ${term})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Total count
      const [totalRow] = await db
        .select({ total: count() })
        .from(crmNotifications)
        .leftJoin(properties, eq(crmNotifications.propertyId, properties.id))
        .where(whereClause);

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
        .where(whereClause)
        .orderBy(desc(crmNotifications.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { rows, total: totalRow?.total ?? 0 };
    }),

  // Get unread count (for bell badge) — also returns per-source counts
  unreadCount: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0, instantly: 0, autocalls: 0 };

    const rows = await db
      .select({ source: crmNotifications.source })
      .from(crmNotifications)
      .where(eq(crmNotifications.isRead, 0));

    const instantly = rows.filter((r) => r.source === "instantly").length;
    const autocalls = rows.filter((r) => r.source === "autocalls").length;

    return { count: rows.length, instantly, autocalls };
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

  // Mark all notifications as read (optionally by source)
  markAllRead: adminProcedure
    .input(z.object({ source: z.enum(["instantly", "autocalls", "all"]).default("all") }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: any[] = [eq(crmNotifications.isRead, 0)];
      if (input?.source && input.source !== "all") {
        conditions.push(eq(crmNotifications.source, input.source));
      }

      await db
        .update(crmNotifications)
        .set({ isRead: 1, readAt: new Date() })
        .where(and(...conditions));

      return { success: true };
    }),
});
