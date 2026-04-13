/**
 * Seed integrationSettings table with Supabase DNC fields.
 * Run once: node scripts/seed-supabase-dnc.mjs
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

const settings = [
  {
    integration: "supabase_dnc",
    settingKey: "supabaseUrl",
    settingValue: "",
    label: "Supabase URL",
    description: "Your Supabase project URL (e.g., https://mkzlmcugwnzinedpmmgj.supabase.co)",
    isSecret: 0,
  },
  {
    integration: "supabase_dnc",
    settingKey: "supabaseAnonKey",
    settingValue: "",
    label: "Supabase API Key (anon)",
    description: "Your Supabase anon/public API key — used for authentication in REST calls",
    isSecret: 1,
  },
  {
    integration: "supabase_dnc",
    settingKey: "rpcFunctionName",
    settingValue: "check_dnc",
    label: "RPC Function Name",
    description: "Name of the Supabase RPC function to call (default: check_dnc). The function receives { p_number: string } and returns [true] or [false].",
    isSecret: 0,
  },
];

console.log(`Seeding ${settings.length} Supabase DNC integration settings...`);

for (const s of settings) {
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
