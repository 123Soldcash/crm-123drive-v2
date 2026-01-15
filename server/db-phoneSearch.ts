import { getDb } from "./db";
import { properties, contactPhones } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { normalizePhoneNumber } from "./utils/phoneNormalization";

export interface PhoneDuplicateResult {
  propertyId: number;
  address: string;
  owner: string | null;
  leadTemperature: string | null;
  deskStatus: string | null;
  phoneNumber: string;
  phoneType: string | null;
  createdAt: Date;
}

/**
 * Search for leads that have a specific phone number
 * Returns all properties associated with that phone number
 */
export async function searchLeadsByPhone(phoneNumber: string): Promise<PhoneDuplicateResult[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize the search phone number
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  // Search for exact match or with/without country code
  const results = await db
    .select({
      propertyId: properties.id,
      address: sql<string>`CONCAT_WS(', ', ${properties.addressLine1}, ${properties.city}, ${properties.state}, ${properties.zipcode})`,
      owner: properties.owner1Name,
      leadTemperature: properties.leadTemperature,
      deskStatus: properties.deskStatus,
      phoneNumber: contactPhones.phoneNumber,
      phoneType: contactPhones.phoneType,
      createdAt: properties.createdAt,
    })
    .from(contactPhones)
    .innerJoin(properties, eq(contactPhones.contactId, properties.id))
    .where(
      sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${contactPhones.phoneNumber}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ${`%${normalizedPhone}%`}`
    )
    .limit(10);

  return results.map(r => ({
    propertyId: r.propertyId,
    address: r.address,
    owner: r.owner,
    leadTemperature: r.leadTemperature,
    deskStatus: r.deskStatus,
    phoneNumber: r.phoneNumber,
    phoneType: r.phoneType,
    createdAt: r.createdAt,
  }));
}
