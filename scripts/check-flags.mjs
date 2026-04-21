import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Count contacts by flags
const [flagCounts] = await db.execute(sql`
  SELECT 
    SUM(isDecisionMaker = 1) as decisionMakers,
    SUM(isLitigator = 1) as litigators,
    SUM(deceased = 1) as deceased,
    SUM(dnc = 1) as dnc,
    SUM(contactType = 'phone') as phoneContacts,
    SUM(contactType = 'email') as emailContacts,
    SUM(contactType IS NULL) as noType,
    COUNT(*) as total
  FROM contacts
`);
console.log("Flag counts:", JSON.stringify(flagCounts, null, 2));

// Sample some decision makers
const [decisionMakers] = await db.execute(sql`
  SELECT id, name, phoneNumber, email, contactType, isDecisionMaker, isLitigator, deceased, dnc
  FROM contacts 
  WHERE isDecisionMaker = 1 
  LIMIT 5
`);
console.log("\nSample decision makers:", JSON.stringify(decisionMakers, null, 2));

// Sample some litigators
const [litigators] = await db.execute(sql`
  SELECT id, name, phoneNumber, email, contactType, isDecisionMaker, isLitigator, deceased, dnc
  FROM contacts 
  WHERE isLitigator = 1 
  LIMIT 5
`);
console.log("\nSample litigators:", JSON.stringify(litigators, null, 2));

// Check filtering field names: does the frontend use contact.litigator or contact.isLitigator?
const [sample] = await db.execute(sql`
  SELECT id, name, phoneNumber, email, contactType, isDecisionMaker, isLitigator, deceased, dnc, hidden
  FROM contacts 
  LIMIT 3
`);
console.log("\nSample contacts (all fields):", JSON.stringify(sample, null, 2));

await connection.end();
process.exit(0);
