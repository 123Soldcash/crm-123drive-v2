/**
 * Seed integrationSettings table with current env var values.
 * Run once: node scripts/seed-integrations.mjs
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

const settings = [
  // ─── Twilio ────────────────────────────────────────────────────────────
  {
    integration: "twilio",
    settingKey: "accountSid",
    settingValue: process.env.TWILIO_ACCOUNT_SID || "",
    label: "Account SID",
    description: "Your Twilio Account SID (starts with AC...)",
    isSecret: 0,
  },
  {
    integration: "twilio",
    settingKey: "authToken",
    settingValue: process.env.TWILIO_AUTH_TOKEN || "",
    label: "Auth Token",
    description: "Your Twilio Auth Token (used for REST API calls)",
    isSecret: 1,
  },
  {
    integration: "twilio",
    settingKey: "phoneNumber",
    settingValue: process.env.TWILIO_PHONE_NUMBER || "",
    label: "Default Phone Number",
    description: "Default Twilio phone number for outbound calls (e.g. +1234567890)",
    isSecret: 0,
  },
  {
    integration: "twilio",
    settingKey: "apiKey",
    settingValue: process.env.TWILIO_API_KEY || "",
    label: "API Key SID",
    description: "Twilio API Key SID (starts with SK...) — used for generating access tokens",
    isSecret: 0,
  },
  {
    integration: "twilio",
    settingKey: "apiSecret",
    settingValue: process.env.TWILIO_API_SECRET || "",
    label: "API Secret",
    description: "Twilio API Secret — paired with API Key for access tokens",
    isSecret: 1,
  },
  {
    integration: "twilio",
    settingKey: "twimlAppSid",
    settingValue: process.env.TWILIO_TWIML_APP_SID || "",
    label: "TwiML App SID",
    description: "TwiML Application SID (starts with AP...) — routes voice calls",
    isSecret: 0,
  },
  {
    integration: "twilio",
    settingKey: "webhookUrl",
    settingValue: "https://crmv3.manus.space/api/twilio/voice",
    label: "Voice Webhook URL",
    description: "URL configured in your TwiML App for incoming voice requests",
    isSecret: 0,
  },
  {
    integration: "twilio",
    settingKey: "statusCallbackUrl",
    settingValue: "https://crmv3.manus.space/api/twilio/status",
    label: "Status Callback URL",
    description: "URL for call status updates (ringing, answered, completed)",
    isSecret: 0,
  },

  // ─── Slack ─────────────────────────────────────────────────────────────
  {
    integration: "slack",
    settingKey: "botToken",
    settingValue: process.env.SLACK_BOT_TOKEN || "",
    label: "Bot Token",
    description: "Slack Bot User OAuth Token (starts with xoxb-...)",
    isSecret: 1,
  },
  {
    integration: "slack",
    settingKey: "signingSecret",
    settingValue: process.env.SLACK_SIGNING_SECRET || "",
    label: "Signing Secret",
    description: "Slack App Signing Secret — used to verify incoming webhook requests",
    isSecret: 1,
  },
  {
    integration: "slack",
    settingKey: "eventsUrl",
    settingValue: "https://crmv3.manus.space/api/oauth/slack/events",
    label: "Events Request URL",
    description: "URL to paste in Slack App → Event Subscriptions → Request URL",
    isSecret: 0,
  },
  {
    integration: "slack",
    settingKey: "instantlyChannel",
    settingValue: "#instantly",
    label: "Instantly Channel",
    description: "Slack channel where Instantly email replies are posted",
    isSecret: 0,
  },
  {
    integration: "slack",
    settingKey: "autocallsChannel",
    settingValue: "#autocalls-slack",
    label: "AutoCalls Channel",
    description: "Slack channel where AutoCalls results are posted",
    isSecret: 0,
  },

  // ─── Zapier ────────────────────────────────────────────────────────────
  {
    integration: "zapier",
    settingKey: "webhookToken",
    settingValue: process.env.ZAPIER_WEBHOOK_TOKEN || "",
    label: "Webhook Token",
    description: "Security token for authenticating Zapier webhook requests to the CRM",
    isSecret: 1,
  },
  {
    integration: "zapier",
    settingKey: "webhookUrl",
    settingValue: "https://crmv3.manus.space/api/webhook/submit-lead",
    label: "Submit Lead Webhook URL",
    description: "URL for Zapier to send new website leads (WordPress/Elementor forms)",
    isSecret: 0,
  },

  // ─── Instantly ─────────────────────────────────────────────────────────
  {
    integration: "instantly",
    settingKey: "apiKey",
    settingValue: "",
    label: "API Key",
    description: "Instantly.ai API Key — for future direct API integration",
    isSecret: 1,
  },
  {
    integration: "instantly",
    settingKey: "workspaceId",
    settingValue: "",
    label: "Workspace ID",
    description: "Your Instantly workspace identifier",
    isSecret: 0,
  },

  // ─── AutoCalls ─────────────────────────────────────────────────────────
  {
    integration: "autocalls",
    settingKey: "apiKey",
    settingValue: "",
    label: "API Key",
    description: "AutoCalls API Key — for future direct API integration",
    isSecret: 1,
  },
  {
    integration: "autocalls",
    settingKey: "campaignId",
    settingValue: "",
    label: "Default Campaign ID",
    description: "Default campaign ID for new lead uploads",
    isSecret: 0,
  },
];

console.log(`Seeding ${settings.length} integration settings...`);

for (const s of settings) {
  // Upsert: skip if already exists
  const [existing] = await conn.execute(
    "SELECT id FROM integrationSettings WHERE integration = ? AND settingKey = ?",
    [s.integration, s.settingKey]
  );
  if (existing.length > 0) {
    console.log(`  [SKIP] ${s.integration}.${s.settingKey} already exists`);
    continue;
  }
  await conn.execute(
    `INSERT INTO integrationSettings (integration, settingKey, settingValue, label, description, isSecret)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [s.integration, s.settingKey, s.settingValue, s.label, s.description, s.isSecret]
  );
  console.log(`  [OK] ${s.integration}.${s.settingKey}`);
}

console.log("Done!");
await conn.end();
