import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  users,
  leadAssignments,
  leadTransferHistory,
  properties,
  propertyAgents,
} from "../../drizzle/schema";
import { eq, and, or, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Unified agents router — now queries the `users` table.
 * "Agents" are simply users whose role is "agent".
 * Admin users are excluded from agent lists unless explicitly requested.
 */
export const agentsRouter = router({
  // ============ AGENT (USER) CRUD ============

  /** List active agents (non-admin users with status Active) */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        notes: users.notes,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(and(eq(users.role, "agent"), eq(users.status, "Active")));
  }),

  /** List all agents regardless of status */
  listAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        notes: users.notes,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(eq(users.role, "agent"));
  }),

  /** List all users (agents + admins) — admin only */
  listAllUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        notes: users.notes,
        twilioPhone: users.twilioPhone,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(users.name);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db
        .select({
          id: users.id,
          openId: users.openId,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          status: users.status,
          notes: users.notes,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .where(eq(users.id, input.id));
      return result[0] || null;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          status: users.status,
        })
        .from(users);
      return allUsers.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(input.query.toLowerCase())) ||
          (u.email && u.email.toLowerCase().includes(input.query.toLowerCase()))
      );
    }),

  /** Update a user (admin only) */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().nullable(),
        role: z.enum(["agent", "admin"]).optional(),
        status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
        notes: z.string().optional().nullable(),
        twilioPhone: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updateData } = input;
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(cleanData).length > 0) {
        await db.update(users).set(cleanData as any).where(eq(users.id, id));
      }
      return { success: true };
    }),

  /** Delete a user (admin only) */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Prevent deleting yourself
      if (ctx.user?.id === input.id) {
        throw new Error("Cannot delete your own account");
      }

      // 1. Remove property agent assignments
      await db.delete(propertyAgents).where(eq(propertyAgents.agentId, input.id));

      // 2. Remove lead assignments
      await db.delete(leadAssignments).where(eq(leadAssignments.agentId, input.id));

      // 3. Clear assignedAgentId on properties assigned to this user
      await db
        .update(properties)
        .set({ assignedAgentId: null })
        .where(eq(properties.assignedAgentId, input.id));

      // 4. Delete from users table
      await db.delete(users).where(eq(users.id, input.id));

      return { success: true };
    }),

  /** Reassign all properties from one user to another (admin only) */
  reassignProperties: adminProcedure
    .input(z.object({ fromUserId: z.number(), toUserId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Update propertyAgents assignments
      await db
        .update(propertyAgents)
        .set({ agentId: input.toUserId })
        .where(eq(propertyAgents.agentId, input.fromUserId));

      // Update lead assignments
      await db
        .update(leadAssignments)
        .set({ agentId: input.toUserId })
        .where(eq(leadAssignments.agentId, input.fromUserId));

      // Update properties assignedAgentId
      await db
        .update(properties)
        .set({ assignedAgentId: input.toUserId })
        .where(eq(properties.assignedAgentId, input.fromUserId));

      return { success: true };
    }),

  /** Admin resets a user's password */
  resetPassword: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify user exists
      const targetUser = await db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId));

      if (targetUser.length === 0) {
        throw new Error("Usuário não encontrado");
      }

      // Hash the new password
      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      // Update the password
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, input.userId));

      return { success: true, userName: targetUser[0].name };
    }),

  // ============ LEAD ASSIGNMENTS ============

  assignLead: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        agentId: z.number(),
        assignmentType: z.enum(["Exclusive", "Shared", "Temporary"]).optional(),
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
    .input(z.object({ propertyId: z.number(), agentId: z.number() }))
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

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, input.agentId));

      if (!user.length) return null;

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
        agent: user[0],
        totalLeads: leads.length,
        hotLeads,
        warmLeads,
        coldLeads,
        leads,
      };
    }),
});
