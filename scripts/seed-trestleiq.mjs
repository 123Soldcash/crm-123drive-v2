import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  const settings = [
    {
      integration: "trestleiq",
      settingKey: "api_key",
      settingValue: "",
      label: "API Key",
      description: "TrestleIQ API Key — used for Phone Validation and Litigator checks (get it from developer.trestleiq.com)",
      isSecret: 1,
    },
    {
      integration: "trestleiq",
      settingKey: "base_url",
      settingValue: "https://api.trestleiq.com",
      label: "API Base URL",
      description: "TrestleIQ API base URL (default: https://api.trestleiq.com)",
      isSecret: 0,
    },
    {
      integration: "trestleiq",
      settingKey: "enable_litigator_checks",
      settingValue: "true",
      label: "Enable Litigator Checks",
      description: "Enable TCPA litigator risk checks as add-on (additional charges may apply)",
      isSecret: 0,
    },
  ];

  for (const s of settings) {
    const [rows] = await conn.execute(
      "SELECT id FROM integrationSettings WHERE integration = ? AND settingKey = ?",
      [s.integration, s.settingKey]
    );
    if (rows.length > 0) {
      console.log(`  [SKIP] ${s.integration}.${s.settingKey} already exists`);
      continue;
    }

    await conn.execute(
      `INSERT INTO integrationSettings (integration, settingKey, settingValue, label, description, isSecret, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [s.integration, s.settingKey, s.settingValue, s.label, s.description, s.isSecret]
    );
    console.log(`  [ADD] ${s.integration}.${s.settingKey}`);
  }

  await conn.end();
  console.log("\nDone! TrestleIQ integration settings seeded.");
}

main().catch(console.error);
