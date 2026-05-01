/**
 * Seed drip campaign templates and steps into the database.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

function parseDayOffset(dayStr) {
  if (!dayStr) return 0;
  // Extract the first number from strings like "Day 3", "Day 1 · AM", "Day 730"
  const match = String(dayStr).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseTimeOfDay(dayStr) {
  if (!dayStr) return null;
  const s = String(dayStr).toUpperCase();
  if (s.includes("AM")) return "AM";
  if (s.includes("PM")) return "PM";
  return null;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("✅ Connected to database");

  const campaigns = JSON.parse(readFileSync("/home/ubuntu/drip-campaigns-data.json", "utf-8"));

  for (const campaign of campaigns) {
    // Check if already exists
    const [existing] = await conn.execute(
      "SELECT id FROM dripCampaignTemplates WHERE slug = ?",
      [campaign.id]
    );
    if (existing.length > 0) {
      console.log(`⚠️  Template "${campaign.id}" already exists, skipping...`);
      continue;
    }

    // Find max day
    const maxDay = Math.max(...campaign.steps.map(s => parseDayOffset(s.day)));

    // Insert template
    const [result] = await conn.execute(
      `INSERT INTO dripCampaignTemplates (slug, name, description, totalSteps, totalDays, createdAt)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [campaign.id, campaign.name, campaign.description, campaign.steps.length, maxDay]
    );
    const templateId = result.insertId;
    console.log(`✅ Created template: ${campaign.name} (id: ${templateId}, ${campaign.steps.length} steps, ${maxDay} days)`);

    // Insert steps
    for (const step of campaign.steps) {
      const dayOffset = parseDayOffset(step.day);
      const timeOfDay = parseTimeOfDay(step.day);
      const channel = step.channel || "SMS Only";

      await conn.execute(
        `INSERT INTO dripCampaignTemplateSteps 
          (templateId, sortOrder, templateName, channel, category, emailSubject, messageBody, phase, dayOffset, timeOfDay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          templateId,
          step.sortOrder,
          step.templateName,
          channel,
          step.category,
          step.emailSubject || null,
          step.messageBody,
          step.phase,
          dayOffset,
          timeOfDay
        ]
      );
    }
    console.log(`   ✅ Inserted ${campaign.steps.length} steps`);
  }

  await conn.end();
  console.log("\n🎉 Done seeding drip campaigns!");
}

main().catch(console.error);
