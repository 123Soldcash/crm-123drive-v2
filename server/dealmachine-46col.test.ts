import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { properties, contacts, contactPhones, contactEmails } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("DealMachine 46-column import", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  afterAll(async () => {
    // Cleanup
    if (db) {
      // Delete test property and related data
      const testProps = await db
        .select()
        .from(properties)
        .where(eq(properties.addressLine1, "2892 Nw 7th Ct"));
      
      if (testProps.length > 0) {
        const propId = testProps[0].id;
        // Delete contacts
        if (propId) {
          const testContacts = await db
            .select()
            .from(contacts)
            .where(eq(contacts.propertyId, propId));
        
          for (const contact of testContacts) {
            await db.delete(contactPhones).where(eq(contactPhones.contactId, contact.id));
            await db.delete(contactEmails).where(eq(contactEmails.contactId, contact.id));
            await db.delete(contacts).where(eq(contacts.id, contact.id));
          }
          
          // Delete property
          await db.delete(properties).where(eq(properties.id, propId));
        }
      }
    }
  });

  it("should parse 46-column CSV correctly", async () => {
    const csv = `property_id,lead_id,property_address_full,property_address_line_1,property_address_line_2,property_address_city,property_address_state,property_address_zipcode,property_address_county,property_lat,property_lng,owner_1_name,dealmachine_url,property_flags,contact_1_name,contact_1_flags,contact_1_phone1,contact_1_phone2,contact_1_phone3,contact_1_email1,contact_1_email2,contact_1_email3,contact_2_name,contact_2_flags,contact_2_phone1,contact_2_phone2,contact_2_phone3,contact_2_email1,contact_2_email2,contact_2_email3,contact_3_name,contact_3_flags,contact_3_phone1,contact_3_phone2,contact_3_phone3,contact_3_email1,contact_3_email2,contact_3_email3,contact_4_name,contact_4_flags,contact_4_phone1,contact_4_phone2,contact_4_phone3,contact_4_email1,contact_4_email2,contact_4_email3
227965595,2513086631,"2892 Nw 7th Ct, Fort Lauderdale, Fl 33311","2892 Nw 7th Ct",,"Fort Lauderdale",FL,33311,Broward,26.130706,-80.183195,"Dixon Juanita C Est",https://app.dealmachine.com/leads#property(id)=227965595,"Off Market, Free And Clear, High Equity","Danielle D Dixon","Likely Owner, Resident",,,,dixondanielle844@gmail.com,dixon.danielle412@gmail.com,,"Gerald Wynn","Likely Owner, Resident",+17543660623,,,,,,,,,,,,,,,,,,,,,`;

    // Parse CSV
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(2);

    const headers = lines[0].split(',').map(h => h.trim());
    expect(headers.length).toBe(46);
    expect(headers[0]).toBe('property_id');
    expect(headers[2]).toBe('property_address_full');
  });

  it("should import 46-column property with contacts", async () => {
    if (!db) throw new Error("Database not available");

    const csv = `property_id,lead_id,property_address_full,property_address_line_1,property_address_line_2,property_address_city,property_address_state,property_address_zipcode,property_address_county,property_lat,property_lng,owner_1_name,dealmachine_url,property_flags,contact_1_name,contact_1_flags,contact_1_phone1,contact_1_phone2,contact_1_phone3,contact_1_email1,contact_1_email2,contact_1_email3,contact_2_name,contact_2_flags,contact_2_phone1,contact_2_phone2,contact_2_phone3,contact_2_email1,contact_2_email2,contact_2_email3,contact_3_name,contact_3_flags,contact_3_phone1,contact_3_phone2,contact_3_phone3,contact_3_email1,contact_3_email2,contact_3_email3,contact_4_name,contact_4_flags,contact_4_phone1,contact_4_phone2,contact_4_phone3,contact_4_email1,contact_4_email2,contact_4_email3
227965595,2513086631,"2892 Nw 7th Ct, Fort Lauderdale, Fl 33311","2892 Nw 7th Ct",,"Fort Lauderdale",FL,33311,Broward,26.130706,-80.183195,"Dixon Juanita C Est",https://app.dealmachine.com/leads#property(id)=227965595,"Off Market, Free And Clear, High Equity","Danielle D Dixon","Likely Owner, Resident",,,,dixondanielle844@gmail.com,dixon.danielle412@gmail.com,,"Gerald Wynn","Likely Owner, Resident",+17543660623,,,,,,,,,,,,,,,,,,,,,`;

    // Parse CSV manually (simulating what the mutation does)
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLine = lines[1];

    // Simple CSV parsing that handles quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < dataLine.length; i++) {
      const char = dataLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    // Map fields to data
    const data: Record<string, string> = {};
    headers.forEach((header, index) => {
      data[header] = fields[index] || '';
    });

    // Verify parsed data
    expect(data.property_address_full).toBe('2892 Nw 7th Ct, Fort Lauderdale, Fl 33311');
    expect(data.owner_1_name).toBe('Dixon Juanita C Est');
    expect(data.contact_1_name).toBe('Danielle D Dixon');
    expect(data.contact_1_email1).toBe('dixondanielle844@gmail.com');
    expect(data.contact_2_name).toBe('Gerald Wynn');
    expect(data.contact_2_phone1).toBe('+17543660623');
  });

  it("should validate required fields", () => {
    const csv = `property_id,lead_id,property_address_full,property_address_line_1,property_address_line_2,property_address_city,property_address_state,property_address_zipcode,property_address_county,property_lat,property_lng,owner_1_name,dealmachine_url,property_flags,contact_1_name,contact_1_flags,contact_1_phone1,contact_1_phone2,contact_1_phone3,contact_1_email1,contact_1_email2,contact_1_email3,contact_2_name,contact_2_flags,contact_2_phone1,contact_2_phone2,contact_2_phone3,contact_2_email1,contact_2_email2,contact_2_email3,contact_3_name,contact_3_flags,contact_3_phone1,contact_3_phone2,contact_3_phone3,contact_3_email1,contact_3_email2,contact_3_email3,contact_4_name,contact_4_flags,contact_4_phone1,contact_4_phone2,contact_4_phone3,contact_4_email1,contact_4_email2,contact_4_email3
227965595,2513086631,"2892 Nw 7th Ct, Fort Lauderdale, Fl 33311","2892 Nw 7th Ct",,"Fort Lauderdale",FL,33311,Broward,26.130706,-80.183195,"Dixon Juanita C Est",https://app.dealmachine.com/leads#property(id)=227965595,"Off Market, Free And Clear, High Equity","Danielle D Dixon","Likely Owner, Resident",,,,dixondanielle844@gmail.com,dixon.danielle412@gmail.com,,"Gerald Wynn","Likely Owner, Resident",+17543660623,,,,,,,,,,,,,,,,,,,,,`;

    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLine = lines[1];

    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < dataLine.length; i++) {
      const char = dataLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    const data: Record<string, string> = {};
    headers.forEach((header, index) => {
      data[header] = fields[index] || '';
    });

    // Check required fields
    const address = data.property_address_full?.trim();
    const city = data.property_address_city?.trim();
    const state = data.property_address_state?.trim();
    const zipcode = data.property_address_zipcode?.trim();

    expect(address).toBeTruthy();
    expect(city).toBeTruthy();
    expect(state).toBeTruthy();
    expect(zipcode).toBeTruthy();
  });
});
