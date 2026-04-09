/**
 * Integration Config Helper
 * Reads settings from the integrationSettings DB table with env var fallback.
 * Used by Twilio, Slack, Zapier, etc. to get their credentials at runtime.
 */
import { getDb } from "./db";
import { integrationSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";

// Cache settings for 60 seconds to avoid hitting DB on every request
let cache: Record<string, Record<string, string>> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get all settings for a specific integration.
 * Returns a key-value map: { accountSid: "AC...", authToken: "xxx", ... }
 */
export async function getIntegrationConfig(integration: string): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && cache[integration]) {
    return cache[integration];
  }

  try {
    const db = await getDb();
    if (!db) return getEnvFallback(integration);

    const rows = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.integration, integration));

    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.settingKey] = row.settingValue ?? "";
    }

    // Update cache
    cache[integration] = config;
    cacheTimestamp = now;

    return config;
  } catch (err) {
    console.error(`[IntegrationConfig] Failed to read ${integration} from DB, using env fallback:`, err);
    return getEnvFallback(integration);
  }
}

/**
 * Clear the cache (call after updating settings via the UI)
 */
export function clearIntegrationCache() {
  cache = {};
  cacheTimestamp = 0;
}

/**
 * Env var fallback for when DB is unavailable
 */
function getEnvFallback(integration: string): Record<string, string> {
  switch (integration) {
    case "twilio":
      return {
        accountSid: ENV.twilioAccountSid,
        authToken: ENV.twilioAuthToken,
        phoneNumber: ENV.twilioPhoneNumber,
        apiKey: ENV.twilioApiKey,
        apiSecret: ENV.twilioApiSecret,
        twimlAppSid: ENV.twilioTwimlAppSid,
        messagingServiceSid: ENV.twilioMessagingServiceSid,
      };
    case "slack":
      return {
        botToken: ENV.slackBotToken,
        signingSecret: ENV.slackSigningSecret,
      };
    case "zapier":
      return {
        webhookToken: ENV.zapierWebhookToken,
      };
    default:
      return {};
  }
}
