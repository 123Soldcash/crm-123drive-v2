import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  agents,
  agentPermissions,
  leadAssignments,
  leadTransferHistory,
  properties,
} from "../../drizzle/schema";
import { eq, and, or } from "drizzle-orm";

export const agentsRouter = router({
  // ============ AGENT CRUD ============

  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db.select().from(agents).where(eq(agents.status, "Active"));
  }),

  listAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db.select().from(agents);
  }),

  listExternal: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db
      .select()
      .from(agents)
      .where(
        or(
          eq(agents.agentType, "External"),
          eq(agents.agentType, "Birddog"),
          eq(agents.agentType, "Corretor")
        )
      );
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      const result = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id));
      return result[0] || null;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      const allAgents = await db.select().from(agents);
      return allAgents.filter(
        (a) =>
          a.name.toLowerCase().includes(input.query.toLowerCase()) ||
          a.email.toLowerCase().includes(input.query.toLowerCase())
      );
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        role: z
          .enum([
            "Birddog",
            "Acquisition Manager",
            "Disposition Manager",
            "Admin",
            "Manager",
            "Corretor",
            "Other",
          ])
          .optional(),
        agentType: z
          .enum(["Internal", "External", "Birddog", "Corretor"])
          .optional(),
        status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      const result = await db.insert(agents).values({
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: (input.role || "Birddog") as any,
        agentType: (input.agentType || "Internal") as any,
        status: (input.status || "Active") as any,
        notes: input.notes,
      } as any);
      return { id: Number((result as any).insertId), success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z
          .enum([
            "Birddog",
            "Acquisition Manager",
            "Disposition Manager",
            "Admin",
            "Manager",
            "Corretor",
            "Other",
          ])
          .optional(),
        agentType: z
          .enum(["Internal", "External", "Birddog", "Corretor"])
          .optional(),
        status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      const { id, ...updateData } = input;
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([, v]) => v !== undefined)
      );
      await db.update(agents).set(cleanData as any).where(eq(agents.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      await db.delete(agents).where(eq(agents.id, input.id));
      return { success: true };
    }),

  // ============ PERMISSIONS ============

  grantPermission: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        feature: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      const existing = await db
        .select()
        .from(agentPermissions)
        .where(
          and(
            eq(agentPermissions.agentId, input.agentId),
            eq(agentPermissions.feature, input.feature as any)
          )
        );

      if (existing.length > 0) {
        await db
          .update(agentPermissions)
          .set({ granted: 1 })
          .where(
            and(
              eq(agentPermissions.agentId, input.agentId),
              eq(agentPermissions.feature, input.feature as any)
            )
          );
      } else {
        await db.insert(agentPermissions).values({
          agentId: input.agentId,
          feature: input.feature,
          granted: 1,
        } as any);
      }
      return { success: true };
    }),

  revokePermission: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        feature: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      await db
        .update(agentPermissions)
        .set({ granted: 0 })
        .where(
          and(
            eq(agentPermissions.agentId, input.agentId),
            eq(agentPermissions.feature, input.feature as any)
          )
        );
      return { success: true };
    }),

  getPermissions: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      return db
        .select()
        .from(agentPermissions)
        .where(eq(agentPermissions.agentId, input.agentId));
    }),

  // ============ LEAD ASSIGNMENTS ============

  assignLead: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        agentId: z.number(),
        assignmentType: z
          .enum(["Exclusive", "Shared", "Temporary"])
          .optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(leadAssignments)
        .where(
          and(
            eq(leadAssignments.propertyId, input.propertyId),
            eq(leadAssignments.agentId, input.agentId)
          )
        );

      if (existing.length > 0) {
        await db
          .update(leadAssignments)
          .set({
            assignmentType: (input.assignmentType || "Shared") as any,
            expiresAt: input.expiresAt,
          })
          .where(
            and(
              eq(leadAssignments.propertyId, input.propertyId),
              eq(leadAssignments.agentId, input.agentId)
            )
          );
      } else {
        await db.insert(leadAssignments).values({
          propertyId: input.propertyId,
          agentId: input.agentId,
          assignmentType: (input.assignmentType || "Shared") as any,
          assignedBy: ctx.user?.id,
          expiresAt: input.expiresAt,
        } as any);
      }

      // Update property assigned agent
      await db
        .update(properties)
        .set({ assignedAgentId: input.agentId })
        .where(eq(properties.id, input.propertyId));

      return { success: true };
    }),

  getLeadAssignments: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      return db
        .select()
        .from(leadAssignments)
        .where(eq(leadAssignments.propertyId, input.propertyId));
    }),

  getAgentLeads: protectedProcedure
    .input(z.object({ agentId: z.number(), includeShared: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");

      const conditions = [eq(leadAssignments.agentId, input.agentId)];
      if (!input.includeShared) {
        conditions.push(eq(leadAssignments.assignmentType, "Exclusive"));
      }

      const assignments = await db
        .select()
        .from(leadAssignments)
        .where(and(...conditions));

      const propertyIds = assignments.map((a) => a.propertyId);
      if (propertyIds.length === 0) return [];

      return db
        .select()
        .from(properties)
        .where(or(...propertyIds.map((id) => eq(properties.id, id))));
    }),

  removeLeadAssignment: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        agentId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      await db
        .delete(leadAssignments)
        .where(
          and(
            eq(leadAssignments.propertyId, input.propertyId),
            eq(leadAssignments.agentId, input.agentId)
          )
        );
      return { success: true };
    }),

  // ============ LEAD TRANSFERS ============

  transferLead: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        toAgentId: z.number(),
        reason: z.string().optional(),
        fromAgentId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");

      // Record transfer
      await db.insert(leadTransferHistory).values({
        propertyId: input.propertyId,
        fromAgentId: input.fromAgentId,
        toAgentId: input.toAgentId,
        transferredBy: ctx.user?.id || 0,
        reason: input.reason,
        status: "Completed",
      } as any);

      // Remove old assignment if exists
      if (input.fromAgentId) {
        await db
          .delete(leadAssignments)
          .where(
            and(
              eq(leadAssignments.propertyId, input.propertyId),
              eq(leadAssignments.agentId, input.fromAgentId)
            )
          );
      }

      // Create new assignment
      await db.insert(leadAssignments).values({
        propertyId: input.propertyId,
        agentId: input.toAgentId,
        assignmentType: "Exclusive",
        assignedBy: ctx.user?.id,
      } as any);

      // Update property
      await db
        .update(properties)
        .set({ assignedAgentId: input.toAgentId })
        .where(eq(properties.id, input.propertyId));

      return { success: true };
    }),

  getTransferHistory: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      return db
        .select()
        .from(leadTransferHistory)
        .where(eq(leadTransferHistory.propertyId, input.propertyId));
    }),

  // ============ AGENT STATS ============

  getStats: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");

      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId));

      if (!agent.length) return null;

      const assignments = await db
        .select()
        .from(leadAssignments)
        .where(eq(leadAssignments.agentId, input.agentId));

      const propertyIds = assignments.map((a) => a.propertyId);
      let leads: any[] = [];
      if (propertyIds.length > 0) {
        leads = await db
          .select()
          .from(properties)
          .where(or(...propertyIds.map((id) => eq(properties.id, id))));
      }

      const hotLeads = leads.filter(
        (l) => l.leadTemperature === "HOT" || l.leadTemperature === "SUPER HOT"
      ).length;
      const warmLeads = leads.filter((l) => l.leadTemperature === "WARM").length;
      const coldLeads = leads.filter((l) => l.leadTemperature === "COLD").length;

      return {
        agent: agent[0],
        totalLeads: leads.length,
        hotLeads,
        warmLeads,
        coldLeads,
        leads,
      };
    }),
});
