/**
 * Integrations Router — CRUD for integrationSettings table
 * Admin-only: read, update, test connections
 */
import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { integrationSettings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { clearIntegrationCache } from "../integrationConfig";

export const integrationsRouter = router({
  /**
   * List all settings, grouped by integration name
   */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    const rows = await db!
      .select()
      .from(integrationSettings)
      .orderBy(integrationSettings.integration, integrationSettings.id);

    // Group by integration
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!grouped[row.integration]) grouped[row.integration] = [];
      grouped[row.integration].push(row);
    }
    return grouped;
  }),

  /**
   * Get settings for a specific integration
   */
  byIntegration: adminProcedure
    .input(z.object({ integration: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      return db!
        .select()
        .from(integrationSettings)
        .where(eq(integrationSettings.integration, input.integration));
    }),

  /**
   * Update a single setting value
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        settingValue: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db!
        .update(integrationSettings)
        .set({
          settingValue: input.settingValue,
          updatedBy: ctx.user.id,
        })
        .where(eq(integrationSettings.id, input.id));
      clearIntegrationCache();
      return { success: true };
    }),

  /**
   * Bulk update multiple settings at once (for saving an entire integration card)
   */
  bulkUpdate: adminProcedure
    .input(
      z.object({
        settings: z.array(
          z.object({
            id: z.number(),
            settingValue: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      for (const s of input.settings) {
        await db!
          .update(integrationSettings)
          .set({
            settingValue: s.settingValue,
            updatedBy: ctx.user.id,
          })
          .where(eq(integrationSettings.id, s.id));
      }
      clearIntegrationCache();
      return { success: true, count: input.settings.length };
    }),

  /**
   * Add a new setting to an integration
   */
  create: adminProcedure
    .input(
      z.object({
        integration: z.string(),
        settingKey: z.string(),
        settingValue: z.string().optional(),
        label: z.string(),
        description: z.string().optional(),
        isSecret: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const result = await db!.insert(integrationSettings).values({
        integration: input.integration,
        settingKey: input.settingKey,
        settingValue: input.settingValue ?? "",
        label: input.label,
        description: input.description ?? "",
        isSecret: input.isSecret ? 1 : 0,
        updatedBy: ctx.user.id,
      });
      clearIntegrationCache();
      return { success: true, id: result[0].insertId };
    }),

  /**
   * Delete a setting
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db!
        .delete(integrationSettings)
        .where(eq(integrationSettings.id, input.id));
      clearIntegrationCache();
      return { success: true };
    }),

  /**
   * Test Twilio connection
   */
  testTwilio: adminProcedure.mutation(async () => {
    const db = await getDb();
    const rows = await db!
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.integration, "twilio"));

    const config: Record<string, string> = {};
    for (const r of rows) config[r.settingKey] = r.settingValue ?? "";

    if (!config.accountSid || !config.authToken) {
      return { success: false, message: "Account SID and Auth Token are required" };
    }

    try {
      // Simple REST API test: fetch account info
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`;
      const response = await fetch(url, {
        headers: {
          Authorization: "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected! Account: ${data.friendly_name} (${data.status})`,
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          message: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        };
      }
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }),

  /**
   * Test Slack connection
   */
  testSlack: adminProcedure.mutation(async () => {
    const db = await getDb();
    const rows = await db!
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.integration, "slack"));

    const config: Record<string, string> = {};
    for (const r of rows) config[r.settingKey] = r.settingValue ?? "";

    if (!config.botToken) {
      return { success: false, message: "Bot Token is required" };
    }

    try {
      const response = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.botToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.ok) {
        return {
          success: true,
          message: `Connected! Bot: ${data.user} in workspace ${data.team}`,
        };
      } else {
        return { success: false, message: `Slack error: ${data.error}` };
      }
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }),
});
