import { router, adminProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import * as inviteDb from "../db-invites";
import { TRPCError } from "@trpc/server";

export const invitesRouter = router({
  /** Admin creates an invite link */
  create: adminProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        role: z.enum(["agent", "admin"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const invite = await inviteDb.createInvite(
        input.role,
        ctx.user.id,
        input.email
      );
      return {
        success: true,
        token: invite.token,
        role: invite.role,
        expiresAt: invite.expiresAt,
      };
    }),

  /** Admin lists pending invites */
  listPending: adminProcedure.query(async () => {
    const pending = await inviteDb.getPendingInvites();
    return pending.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }),

  /** Public: validate invite token */
  validate: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const valid = await inviteDb.isInviteValid(input.token);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite is expired, already used, or invalid",
        });
      }
      const invite = await inviteDb.getInviteByToken(input.token);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }
      return { email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
    }),

  /** Public: accept invite and create account */
  accept: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1, "Name is required"),
        phone: z.string().optional(),
        password: z.string().min(6, "Password must be at least 6 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const valid = await inviteDb.isInviteValid(input.token);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite is expired, already used, or invalid",
        });
      }
      try {
        const result = await inviteDb.acceptInvite(
          input.token,
          input.name,
          input.phone || null,
          input.password
        );
        return { success: true, userId: result.userId, role: result.role };
      } catch (error: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to create account",
        });
      }
    }),

  /** Admin cancels an invite */
  cancel: adminProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const invite = await inviteDb.getInviteByToken(input.token);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }
      if (invite.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending invites can be cancelled" });
      }
      await inviteDb.cancelInvite(input.token);
      return { success: true };
    }),
});
