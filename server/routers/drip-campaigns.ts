import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  dripCampaignTemplates,
  dripCampaignTemplateSteps,
  propertyDripCampaigns,
  propertyDripSteps,
  properties,
  contacts,
} from "../../drizzle/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Replace template variables {{name}}, {{address}}, {{agent}}, {{city}} */
function resolveVariables(
  template: string,
  vars: { name: string; address: string; agent: string; city: string }
): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{address\}\}/g, vars.address)
    .replace(/\{\{agent\}\}/g, vars.agent)
    .replace(/\{\{city\}\}/g, vars.city);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export const dripCampaignsRouter = router({
  /** List all available drip campaign templates */
  listTemplates: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const templates = await db
      .select()
      .from(dripCampaignTemplates)
      .orderBy(asc(dripCampaignTemplates.id));
    return templates;
  }),

  /** Get template details with all steps */
  getTemplateSteps: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const steps = await db
        .select()
        .from(dripCampaignTemplateSteps)
        .where(eq(dripCampaignTemplateSteps.templateId, input.templateId))
        .orderBy(asc(dripCampaignTemplateSteps.sortOrder));
      return steps;
    }),

  /** Launch a drip campaign on a property */
  launch: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        templateId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;

      // Check if property already has an active drip campaign of this type
      const [existing] = await db
        .select()
        .from(propertyDripCampaigns)
        .where(
          and(
            eq(propertyDripCampaigns.propertyId, input.propertyId),
            eq(propertyDripCampaigns.templateId, input.templateId),
            eq(propertyDripCampaigns.status, "active")
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This property already has an active campaign of this type.",
        });
      }

      // Get property info for variable resolution
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Get primary contact name
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.propertyId, input.propertyId))
        .limit(1);

      const vars = {
        name: contact?.name || property.owner1Name || "there",
        address: property.addressLine1,
        agent: ctx.user.name || "Agent",
        city: property.city,
      };

      // Get template steps
      const steps = await db
        .select()
        .from(dripCampaignTemplateSteps)
        .where(eq(dripCampaignTemplateSteps.templateId, input.templateId))
        .orderBy(asc(dripCampaignTemplateSteps.sortOrder));

      if (steps.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template has no steps" });
      }

      // Create the campaign
      const [campaignResult] = await db.insert(propertyDripCampaigns).values({
        propertyId: input.propertyId,
        templateId: input.templateId,
        status: "active",
        currentStepOrder: 0,
        launchedByUserId: ctx.user.id,
      });

      const campaignId = campaignResult.insertId;

      // Create all step entries with scheduled dates
      const now = new Date();
      const stepValues = steps.map((step: any) => ({
        campaignId,
        stepId: step.id,
        sortOrder: step.sortOrder,
        status: "pending" as const,
        scheduledFor: new Date(now.getTime() + step.dayOffset * 24 * 60 * 60 * 1000),
        channel: step.channel,
        messageBody: resolveVariables(step.messageBody, vars),
        emailSubject: step.emailSubject ? resolveVariables(step.emailSubject, vars) : null,
        phase: step.phase,
      }));

      for (const sv of stepValues) {
        await db.insert(propertyDripSteps).values(sv);
      }

      return { campaignId, stepsCreated: steps.length };
    }),

  /** Get active drip campaigns for a property */
  getByProperty: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const campaigns = await db
        .select({
          id: propertyDripCampaigns.id,
          templateId: propertyDripCampaigns.templateId,
          status: propertyDripCampaigns.status,
          currentStepOrder: propertyDripCampaigns.currentStepOrder,
          startedAt: propertyDripCampaigns.startedAt,
          cancelledAt: propertyDripCampaigns.cancelledAt,
          cancelReason: propertyDripCampaigns.cancelReason,
          completedAt: propertyDripCampaigns.completedAt,
          templateName: dripCampaignTemplates.name,
          templateSlug: dripCampaignTemplates.slug,
          totalSteps: dripCampaignTemplates.totalSteps,
          totalDays: dripCampaignTemplates.totalDays,
        })
        .from(propertyDripCampaigns)
        .innerJoin(
          dripCampaignTemplates,
          eq(propertyDripCampaigns.templateId, dripCampaignTemplates.id)
        )
        .where(eq(propertyDripCampaigns.propertyId, input.propertyId))
        .orderBy(desc(propertyDripCampaigns.createdAt));
      return campaigns;
    }),

  /** Get all steps for a specific active campaign (for the detail view) */
  getCampaignSteps: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const steps = await db
        .select()
        .from(propertyDripSteps)
        .where(eq(propertyDripSteps.campaignId, input.campaignId))
        .orderBy(asc(propertyDripSteps.sortOrder));
      return steps;
    }),

  /** Cancel a drip campaign manually */
  cancel: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;

      // Update campaign status
      await db
        .update(propertyDripCampaigns)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: "manual",
        })
        .where(eq(propertyDripCampaigns.id, input.campaignId));

      // Cancel all pending steps
      await db
        .update(propertyDripSteps)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(propertyDripSteps.campaignId, input.campaignId),
            eq(propertyDripSteps.status, "pending")
          )
        );

      return { success: true };
    }),

  /** Get all active drip campaigns across all properties (for the scheduler) */
  listActive: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const campaigns = await db
      .select({
        id: propertyDripCampaigns.id,
        propertyId: propertyDripCampaigns.propertyId,
        templateName: dripCampaignTemplates.name,
        status: propertyDripCampaigns.status,
        startedAt: propertyDripCampaigns.startedAt,
        currentStepOrder: propertyDripCampaigns.currentStepOrder,
        totalSteps: dripCampaignTemplates.totalSteps,
      })
      .from(propertyDripCampaigns)
      .innerJoin(
        dripCampaignTemplates,
        eq(propertyDripCampaigns.templateId, dripCampaignTemplates.id)
      )
      .where(eq(propertyDripCampaigns.status, "active"))
      .orderBy(desc(propertyDripCampaigns.startedAt));
    return campaigns;
  }),
});
