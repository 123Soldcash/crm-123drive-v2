/**
 * Import 38 Preprobate/Foreclosure leads into CRM database.
 * Desk: Desk_Deep_Search (id=7)
 * Agent: Christopher Russo (user id=19080008)
 * Campaign: PREPROBATE_LEADS_CONSOLIDADO_FULL_UPDATED_macro-ChrisV1-YELLOWFORECLOSURE
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import XLSX from 'xlsx';

const DESK_NAME = "Desk_Deep_Search";
const AGENT_USER_ID = 19080008;
const CAMPAIGN_NAME = "PREPROBATE_LEADS_CONSOLIDADO_FULL_UPDATED_macro-ChrisV1-YELLOWFORECLOSURE";
const LEAD_ID_START = 2000000580;

const STATE_MAP = { "FLORIDA": "FL", "FL": "FL" };

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }
  
  console.log("Connecting to database...");
  const conn = await mysql.createConnection(dbUrl);
  console.log("Connected!");

  // Read Excel
  const wb = XLSX.readFile("/home/ubuntu/upload/PREPROBATE_LEADS_CONSOLIDADO_FULL_UPDATED_macro-ChrisV1-YELLOWFORECLOSURE.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`Total rows to import: ${rows.length}`);

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ownerName = (r["Nome Proprietário"] || "").toString().trim();
    const address = (r["Endereço Imóvel"] || "").toString().trim();
    const city = (r["Cidade Imóvel"] || "").toString().trim();
    const stateRaw = (r["Estado"] || "").toString().trim();
    const state = STATE_MAP[stateRaw.toUpperCase()] || stateRaw.substring(0, 2).toUpperCase() || "FL";
    const zipcode = (r["CEP Corresp."] || "").toString().trim();
    const marketValue = r["Valor Mercado ($)"] ? parseInt(r["Valor Mercado ($)"]) : null;
    const mailingAddr = (r["Endereço Corresp."] || "").toString().trim();
    const mailingCity = (r["Cidade Corresp."] || "").toString().trim();
    const tagsStr = (r["TAGS"] || r["TAGS "] || "").toString().trim();
    const notesStr = (r["NOTES"] || "").toString().trim();

    if (!address || !city) {
      errors.push(`Row ${i + 2}: Missing address or city`);
      skipped++;
      continue;
    }

    // Check duplicate
    const [dupes] = await conn.execute(
      "SELECT id FROM properties WHERE UPPER(addressLine1) = ? AND UPPER(city) = ? LIMIT 1",
      [address.toUpperCase(), city.toUpperCase()]
    );
    if (dupes.length > 0) {
      console.log(`  SKIP Row ${i + 2}: Duplicate '${address}, ${city}' (id=${dupes[0].id})`);
      skipped++;
      continue;
    }

    const leadId = LEAD_ID_START + imported;

    // Insert property
    const [propResult] = await conn.execute(`
      INSERT INTO properties (
        leadId, addressLine1, city, state, zipcode,
        owner1Name, estimatedValue,
        source, listName, deskName, deskStatus,
        dealStage, leadTemperature,
        assignedAgentId, campaignName,
        entryDate, stageChangedAt, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        'Import', ?, ?, 'BIN',
        'NEW_LEAD', 'WARM',
        ?, ?,
        NOW(), NOW(), NOW(), NOW()
      )
    `, [
      leadId, address, city, state, zipcode || '',
      ownerName, marketValue,
      CAMPAIGN_NAME, DESK_NAME,
      AGENT_USER_ID, CAMPAIGN_NAME
    ]);

    const propertyId = propResult.insertId;
    console.log(`  Row ${i + 2}: property id=${propertyId}, leadId=${leadId}, '${address}, ${city}'`);

    // Insert notes
    if (notesStr) {
      await conn.execute(
        "INSERT INTO notes (propertyId, userId, content, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())",
        [propertyId, AGENT_USER_ID, notesStr]
      );
    }

    // Insert tags
    if (tagsStr) {
      const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
      for (const tag of tags) {
        await conn.execute(
          "INSERT INTO propertyTags (propertyId, tag, createdBy, createdAt) VALUES (?, ?, ?, NOW())",
          [propertyId, tag, AGENT_USER_ID]
        );
      }
    }

    // Insert property agent assignment
    await conn.execute(
      "INSERT INTO propertyAgents (propertyId, agentId, assignedAt) VALUES (?, ?, NOW())",
      [propertyId, AGENT_USER_ID]
    );

    // Insert contacts (up to 5)
    for (let cn = 1; cn <= 5; cn++) {
      const contactName = r[`Contato_${cn}_Nome`];
      const contactFlags = r[`Contato_${cn}_Flags`];

      if (!contactName) continue;

      const nameStr = contactName.toString().trim();
      const flagsStr = contactFlags ? contactFlags.toString().trim() : "";
      const nameParts = nameStr.split(" ");
      const firstName = nameParts[0] || nameStr;
      const lastName = nameParts.slice(1).join(" ") || "";

      // Mailing address for contact 1
      let contactAddress = null;
      if (cn === 1 && mailingAddr) {
        contactAddress = `${mailingAddr}, ${mailingCity}, ${state} ${zipcode}`.trim();
      }

      const [contactResult] = await conn.execute(`
        INSERT INTO contacts (
          propertyId, name, firstName, lastName,
          flags, currentAddress,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [propertyId, nameStr, firstName, lastName, flagsStr, contactAddress]);

      const contactId = contactResult.insertId;

      // Insert phones (up to 3)
      for (let pn = 1; pn <= 3; pn++) {
        let phoneVal = r[`Contato_${cn}_Phone${pn}`];
        if (!phoneVal) continue;
        let phoneStr = phoneVal.toString().trim();
        if (phoneStr.length === 10) phoneStr = `+1${phoneStr}`;
        else if (phoneStr.length === 11 && phoneStr.startsWith("1")) phoneStr = `+${phoneStr}`;
        else if (!phoneStr.startsWith("+")) phoneStr = `+1${phoneStr}`;

        await conn.execute(
          "INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, dnc, createdAt) VALUES (?, ?, 'Mobile', ?, 0, NOW())",
          [contactId, phoneStr, pn === 1 ? 1 : 0]
        );
      }

      // Insert emails (up to 3)
      for (let en = 1; en <= 3; en++) {
        const emailVal = r[`Contato_${cn}_Email${en}`];
        if (!emailVal) continue;
        const emailStr = emailVal.toString().trim();

        await conn.execute(
          "INSERT INTO contactEmails (contactId, email, isPrimary, createdAt) VALUES (?, ?, ?, NOW())",
          [contactId, emailStr, en === 1 ? 1 : 0]
        );
      }
    }

    imported++;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("IMPORT COMPLETE");
  console.log(`${"=".repeat(60)}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) errors.forEach(e => console.log(`  - ${e}`));

  await conn.end();
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
