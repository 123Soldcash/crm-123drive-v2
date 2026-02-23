import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { properties, contacts, contactPhones, contactEmails, contactAddresses, contactSocialMedia } from "../../drizzle/schema";
import { eq, and, or, sql } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%]/g, "").trim();
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parsePercent(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/%/g, "").trim();
    const num = Number(cleaned);
    return isNaN(num) ? null : Math.round(num);
  }
  const num = Number(value);
  if (num > 0 && num <= 1) return Math.round(num * 100);
  return isNaN(num) ? null : Math.round(num);
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    const utc_days = Math.floor(value - 25569);
    const d = new Date(utc_days * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function str(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

/** Normalize a string for comparison: trim, collapse multiple spaces, lowercase */
function normalizeForCompare(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

/** Map phone type from CSV to our enum */
function mapPhoneType(csvType: string | null): "Mobile" | "Landline" | "Wireless" | "Work" | "Home" | "Other" {
  if (!csvType) return "Mobile";
  const t = csvType.toLowerCase().trim();
  if (t === "wireless" || t === "cell" || t === "mobile") return "Wireless";
  if (t === "landline" || t === "land line" || t === "home") return "Landline";
  if (t === "work" || t === "business") return "Work";
  return "Mobile";
}

// ─── Extract embedded contacts from a DealMachine-style property row ─────────
// DealMachine CSV has contact_1_name through contact_10_name, each with
// phone1-3, phone1_type-3_type, email1-3, and flags

interface ExtractedContact {
  name: string;
  flags: string | null;
  phones: { number: string; type: string }[];
  emails: string[];
}

function extractEmbeddedContacts(raw: Record<string, any>): ExtractedContact[] {
  const result: ExtractedContact[] = [];
  for (let i = 1; i <= 10; i++) {
    const name = str(raw[`contact_${i}_name`]);
    if (!name) continue;

    const flags = str(raw[`contact_${i}_flags`]);
    const phones: { number: string; type: string }[] = [];
    const emails: string[] = [];

    // Extract up to 3 phones per contact
    for (let p = 1; p <= 3; p++) {
      const phone = str(raw[`contact_${i}_phone${p}`]);
      const phoneType = str(raw[`contact_${i}_phone${p}_type`]);
      if (phone) {
        phones.push({ number: phone.replace(/[^\d+]/g, ""), type: phoneType || "Mobile" });
      }
    }

    // Extract up to 3 emails per contact
    for (let e = 1; e <= 3; e++) {
      const email = str(raw[`contact_${i}_email${e}`]);
      if (email) {
        emails.push(email);
      }
    }

    result.push({ name, flags, phones, emails });
  }
  return result;
}

/** Extract Facebook profiles from the raw row */
function extractFacebookProfiles(raw: Record<string, any>): string[] {
  const profiles: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const fb = str(raw[`facebookprofile${i}`]);
    if (fb) profiles.push(fb);
  }
  return profiles;
}

// ─── Column Mapping ───────────────────────────────────────────────────────────

const PROPERTY_COLUMN_MAP: Record<string, string> = {
  // Address
  property_address_line_1: "addressLine1",
  address: "addressLine1",
  "address line 1": "addressLine1",
  address_line_1: "addressLine1",
  "street address": "addressLine1",
  street: "addressLine1",
  property_address_line_2: "addressLine2",
  "address line 2": "addressLine2",
  address_line_2: "addressLine2",
  property_address_city: "city",
  city: "city",
  property_address_state: "state",
  state: "state",
  property_address_zipcode: "zipcode",
  zipcode: "zipcode",
  zip: "zipcode",
  zip_code: "zipcode",
  "zip code": "zipcode",
  postal_code: "zipcode",
  subdivision_name: "subdivisionName",
  subdivision: "subdivisionName",

  // Owner
  owner_1_name: "owner1Name",
  "owner name": "owner1Name",
  owner1name: "owner1Name",
  owner_name: "owner1Name",
  owner: "owner1Name",
  owner_2_name: "owner2Name",
  owner2name: "owner2Name",
  owner_location: "ownerLocation",

  // Owner mailing address
  owner_address_full: "ownerAddressFull",
  owner_address_line_1: "ownerAddressLine1",
  owner_address_line_2: "ownerAddressLine2",
  owner_address_city: "ownerAddressCity",
  owner_address_state: "ownerAddressState",
  owner_address_zip: "ownerAddressZip",
  mailing_addresses: "mailingAddresses",

  // Financial
  estimated_value: "estimatedValue",
  "estimated value": "estimatedValue",
  value: "estimatedValue",
  equity_amount: "equityAmount",
  "equity amount": "equityAmount",
  equity: "equityAmount",
  equity_percent: "equityPercent",
  "equity percent": "equityPercent",
  "equity %": "equityPercent",
  mortgage_amount: "mortgageAmount",
  "mortgage amount": "mortgageAmount",
  mortgage: "mortgageAmount",
  total_loan_balance: "totalLoanBalance",
  "loan balance": "totalLoanBalance",
  sale_price: "salePrice",
  "sale price": "salePrice",
  sale_date: "saleDate",
  "sale date": "saleDate",
  tax_amt: "taxAmount",
  tax_amount: "taxAmount",
  "tax amount": "taxAmount",
  taxes: "taxAmount",
  tax_year: "taxYear",
  "tax year": "taxYear",
  tax_delinquent: "taxDelinquent",
  "tax delinquent": "taxDelinquent",
  tax_delinquent_year: "taxDelinquentYear",
  estimated_repair_cost: "estimatedRepairCost",
  "repair cost": "estimatedRepairCost",

  // Property details
  property_type: "propertyType",
  "property type": "propertyType",
  type: "propertyType",
  construction_type: "constructionType",
  "construction type": "constructionType",
  year_built: "yearBuilt",
  "year built": "yearBuilt",
  total_bedrooms: "totalBedrooms",
  bedrooms: "totalBedrooms",
  beds: "totalBedrooms",
  total_baths: "totalBaths",
  bathrooms: "totalBaths",
  baths: "totalBaths",
  building_square_feet: "buildingSquareFeet",
  sqft: "buildingSquareFeet",
  "square feet": "buildingSquareFeet",
  total_sqft: "buildingSquareFeet",

  // Identifiers
  apn_parcel_id: "apnParcelId",
  apn: "apnParcelId",
  "parcel id": "apnParcelId",
  parcel_id: "apnParcelId",
  property_id: "propertyId",
  lead_id: "leadId",

  // Status
  market_status: "marketStatus",
  "market status": "marketStatus",
  lead_status: "status",

  // DealMachine specific
  property_flags: "propertyFlags",
  tags: "tags",
  list_name: "listName",
  "list name": "listName",
};

const CONTACT_COLUMN_MAP: Record<string, string> = {
  // ─── Property identifiers for matching ─────────────────────────────────
  associated_property_address_line_1: "propertyAddress",
  associated_property_address_full: "propertyAddressFull",
  property_address_line_1: "propertyAddress",
  address: "propertyAddress",
  "address line 1": "propertyAddress",
  "property address": "propertyAddress",
  street: "propertyAddress",
  associated_property_address_city: "propertyCity",
  property_address_city: "propertyCity",
  city: "propertyCity",
  associated_property_address_state: "propertyState",
  property_address_state: "propertyState",
  state: "propertyState",
  associated_property_address_zipcode: "propertyZipcode",
  property_address_zipcode: "propertyZipcode",
  zipcode: "propertyZipcode",
  zip: "propertyZipcode",
  associated_property_apn_parcel_id: "apn",
  apn_parcel_id: "apn",
  apn: "apn",
  parcel_id: "apn",
  associated_property_id: "associatedPropertyId",
  lead_id: "leadId",

  // ─── Contact identity ─────────────────────────────────────────────────
  contact_id: "dealMachineContactId",
  first_name: "firstName",
  last_name: "lastName",
  middle_initial: "middleInitial",
  generational_suffix: "generationalSuffix",
  name: "name",
  contact_name: "name",
  "full name": "name",
  relationship: "relationship",
  age: "age",
  contact_flags: "flags",
  flags: "flags",
  notes: "notes",

  // ─── Demographics ─────────────────────────────────────────────────────
  gender: "gender",
  marital_status: "maritalStatus",
  net_asset_value: "netAssetValue",
  home_business: "homeBusiness",
  education_model: "educationModel",
  occupation_group: "occupationGroup",
  occupation_code: "occupationCode",
  business_owner: "businessOwner",

  // ─── Phones (DealMachine: phone_1 through phone_3 with metadata) ─────
  phone_1: "phone1",
  phone_1_type: "phone1Type",
  phone_1_do_not_call: "phone1Dnc",
  phone_1_carrier: "phone1Carrier",
  phone_1_prepaid_indicator: "phone1Prepaid",
  phone_1_activity_status: "phone1Activity",
  phone_1_usage_2_months: "phone1Usage2m",
  phone_1_usage_12_months: "phone1Usage12m",
  phone_2: "phone2",
  phone_2_type: "phone2Type",
  phone_2_do_not_call: "phone2Dnc",
  phone_2_carrier: "phone2Carrier",
  phone_2_prepaid_indicator: "phone2Prepaid",
  phone_2_activity_status: "phone2Activity",
  phone_2_usage_2_months: "phone2Usage2m",
  phone_2_usage_12_months: "phone2Usage12m",
  phone_3: "phone3",
  phone_3_type: "phone3Type",
  phone_3_do_not_call: "phone3Dnc",
  phone_3_carrier: "phone3Carrier",
  phone_3_prepaid_indicator: "phone3Prepaid",
  phone_3_activity_status: "phone3Activity",
  phone_3_usage_2_months: "phone3Usage2m",
  phone_3_usage_12_months: "phone3Usage12m",
  // Generic fallbacks
  phone: "phone1", phone1: "phone1", phone_number: "phone1",
  phone2: "phone2", phone3: "phone3",

  // ─── Emails (DealMachine: email_address_1 through email_address_3) ────
  email_address_1: "email1",
  email_address_2: "email2",
  email_address_3: "email3",
  email: "email1", email1: "email1", email_address: "email1",
  email2: "email2", email3: "email3",
  email4: "email4", email5: "email5", email6: "email6",
  email7: "email7", email8: "email8", email9: "email9", email10: "email10",

  // ─── Mailing addresses ────────────────────────────────────────────────
  primary_mailing_address: "mailingAddress",
  primary_mailing_city: "mailingCity",
  primary_mailing_state: "mailingState",
  primary_mailing_zip: "mailingZip",
  mailing_address: "mailingAddress",
  mailing_city: "mailingCity",
  mailing_state: "mailingState",
  mailing_zip: "mailingZip",
  mailing_zipcode: "mailingZip",
  current_mailing_address: "mailingAddress",
  current_mailing_city: "mailingCity",
  current_mailing_state: "mailingState",
  current_mailing_zip_code: "mailingZip",
  // Previous mailing address
  mailing_address_previous: "mailingAddressPrev",
  mailing_address_city_previous: "mailingCityPrev",
  mailing_address_state_previous: "mailingStatePrev",
  mailing_address_zip_previous: "mailingZipPrev",

  // ─── Facebook ─────────────────────────────────────────────────────────
  facebookprofile: "facebook", facebook: "facebook", "facebook profile": "facebook",
};

function mapColumns(row: any, columnMap: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const normalizedKey = rawKey.toLowerCase().trim();
    const mappedKey = columnMap[normalizedKey];
    if (mappedKey) {
      mapped[mappedKey] = value;
    }
  }
  return mapped;
}

// ─── Insert contacts helper ──────────────────────────────────────────────────

async function upsertPhoneForContact(
  dbInstance: any,
  contactId: number,
  phoneNumber: string,
  phoneType: string,
  isPrimary: number,
  metadata?: { dnc?: number; carrier?: string | null; isPrepaid?: number; activityStatus?: string | null; usage2Months?: string | null; usage12Months?: string | null }
): Promise<boolean> {
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
  if (!cleanNumber) return false;
  // Check if this phone already exists for this contact
  const existing = await dbInstance
    .select({ id: contactPhones.id })
    .from(contactPhones)
    .where(and(eq(contactPhones.contactId, contactId), eq(contactPhones.phoneNumber, cleanNumber)))
    .limit(1);
  if (existing.length > 0) {
    // Update metadata if provided
    if (metadata) {
      const updateData: any = { phoneType: mapPhoneType(phoneType) };
      if (metadata.dnc !== undefined) updateData.dnc = metadata.dnc;
      if (metadata.carrier) updateData.carrier = metadata.carrier;
      if (metadata.isPrepaid !== undefined) updateData.isPrepaid = metadata.isPrepaid;
      if (metadata.activityStatus) updateData.activityStatus = metadata.activityStatus;
      if (metadata.usage2Months) updateData.usage2Months = metadata.usage2Months;
      if (metadata.usage12Months) updateData.usage12Months = metadata.usage12Months;
      await dbInstance.update(contactPhones).set(updateData).where(eq(contactPhones.id, existing[0].id));
    }
    return false; // not new
  }
  await dbInstance.insert(contactPhones).values({
    contactId,
    phoneNumber: cleanNumber,
    phoneType: mapPhoneType(phoneType),
    isPrimary,
    ...(metadata || {}),
  } as any);
  return true; // new phone
}

async function upsertEmailForContact(
  dbInstance: any,
  contactId: number,
  email: string,
  isPrimary: number
): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await dbInstance
    .select({ id: contactEmails.id })
    .from(contactEmails)
    .where(and(eq(contactEmails.contactId, contactId), sql`LOWER(${contactEmails.email}) = ${normalizedEmail}`))
    .limit(1);
  if (existing.length > 0) return false;
  await dbInstance.insert(contactEmails).values({ contactId, email: normalizedEmail, isPrimary });
  return true;
}

async function insertContactsForProperty(
  dbInstance: any,
  propertyId: number,
  embeddedContacts: ExtractedContact[],
  ownerAddress: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null,
  facebookProfiles: string[]
): Promise<{ contactsImported: number; contactsUpdated: number; phonesImported: number; emailsImported: number; addressesImported: number; socialsImported: number }> {
  let contactsImported = 0;
  let contactsUpdated = 0;
  let phonesImported = 0;
  let emailsImported = 0;
  let addressesImported = 0;
  let socialsImported = 0;

  for (let ci = 0; ci < embeddedContacts.length; ci++) {
    const c = embeddedContacts[ci];

    // Check if contact already exists for this property (by name)
    const existingContacts = await dbInstance
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.propertyId, propertyId),
          sql`LOWER(${contacts.name}) = ${c.name.toLowerCase()}`
        )
      )
      .limit(1);

    let contactId: number;

    if (existingContacts.length > 0) {
      // Contact exists — UPDATE it with new data and add missing phones/emails
      contactId = existingContacts[0].id;
      const updateData: any = {};
      if (c.flags) updateData.flags = c.flags;
      updateData.updatedAt = new Date();
      await dbInstance.update(contacts).set(updateData).where(eq(contacts.id, contactId));
      contactsUpdated++;
    } else {
      // Insert new contact
      const contactResult = await dbInstance.insert(contacts).values({
        propertyId,
        name: c.name,
        relationship: "Owner",
        flags: c.flags,
      } as any);
      contactId = contactResult[0].insertId;
      contactsImported++;
    }

    // Upsert all phones (add new ones, update metadata on existing)
    for (let pi = 0; pi < c.phones.length; pi++) {
      const p = c.phones[pi];
      if (p.number) {
        const isNew = await upsertPhoneForContact(dbInstance, contactId, p.number, p.type, pi === 0 ? 1 : 0);
        if (isNew) phonesImported++;
      }
    }

    // Upsert all emails
    for (let ei = 0; ei < c.emails.length; ei++) {
      const email = c.emails[ei];
      if (email) {
        const isNew = await upsertEmailForContact(dbInstance, contactId, email, ei === 0 ? 1 : 0);
        if (isNew) emailsImported++;
      }
    }

    // Insert owner mailing address for the first contact (likely owner)
    if (ci === 0 && ownerAddress && ownerAddress.line1 && ownerAddress.city && ownerAddress.state && ownerAddress.zip) {
      // Check if address already exists
      const existingAddr = await dbInstance
        .select({ id: contactAddresses.id })
        .from(contactAddresses)
        .where(and(eq(contactAddresses.contactId, contactId), sql`LOWER(${contactAddresses.addressLine1}) = ${ownerAddress.line1!.toLowerCase()}`))
        .limit(1);
      if (existingAddr.length === 0) {
        await dbInstance.insert(contactAddresses).values({
          contactId,
          addressLine1: ownerAddress.line1,
          addressLine2: ownerAddress.line2 || null,
          city: ownerAddress.city,
          state: ownerAddress.state.substring(0, 2).toUpperCase(),
          zipcode: ownerAddress.zip,
          addressType: "Mailing",
          isPrimary: 1,
        } as any);
        addressesImported++;
      }
    }

    // Assign Facebook profiles to contacts (distribute sequentially)
    if (facebookProfiles[ci]) {
      const existingSocial = await dbInstance
        .select({ id: contactSocialMedia.id })
        .from(contactSocialMedia)
        .where(and(eq(contactSocialMedia.contactId, contactId), eq(contactSocialMedia.platform, "Facebook")))
        .limit(1);
      if (existingSocial.length === 0) {
        await dbInstance.insert(contactSocialMedia).values({
          contactId,
          platform: "Facebook" as const,
          profileUrl: facebookProfiles[ci],
          contacted: 0,
        } as any);
        socialsImported++;
      }
    }
  }

  return { contactsImported, contactsUpdated, phonesImported, emailsImported, addressesImported, socialsImported };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const importPropertiesRouter = router({
  // ── Preview Properties ────────────────────────────────────────────────────
  previewProperties: protectedProcedure
    .input(z.object({ fileData: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Only admins can import");

      const XLSX = await import("xlsx");
      const buffer = Buffer.from(input.fileData, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (data.length === 0) throw new Error("File is empty");

      const rawColumns = Object.keys(data[0]);
      const detectedMappings: Record<string, string> = {};
      for (const col of rawColumns) {
        const norm = col.toLowerCase().trim();
        if (PROPERTY_COLUMN_MAP[norm]) {
          detectedMappings[col] = PROPERTY_COLUMN_MAP[norm];
        }
      }

      // Detect if file has embedded contacts
      const hasEmbeddedContacts = rawColumns.some((c) => /^contact_\d+_name$/i.test(c));

      const dbInstance = await getDb();
      if (!dbInstance) throw new Error("Database not available");

      const rows: any[] = [];
      for (let i = 0; i < data.length; i++) {
        const raw = data[i];
        const mapped = mapColumns(raw, PROPERTY_COLUMN_MAP);

        const addressLine1 = str(mapped.addressLine1);
        const city = str(mapped.city);
        const state = str(mapped.state);
        const zipcode = str(mapped.zipcode);
        const apn = str(mapped.apnParcelId);
        const propId = str(mapped.propertyId);

        // Check for duplicate
        let existingProperty: any = null;
        let matchType: string | null = null;

        if (propId) {
          const existing = await dbInstance.select().from(properties).where(eq(properties.propertyId, propId)).limit(1);
          if (existing.length > 0) { existingProperty = existing[0]; matchType = "propertyId"; }
        }

        if (!existingProperty && apn) {
          const existing = await dbInstance.select().from(properties).where(eq(properties.apnParcelId, apn)).limit(1);
          if (existing.length > 0) { existingProperty = existing[0]; matchType = "apn"; }
        }

        if (!existingProperty && addressLine1 && city) {
          const existing = await dbInstance
            .select().from(properties)
            .where(and(
              sql`LOWER(${properties.addressLine1}) = ${normalizeAddress(addressLine1)}`,
              sql`LOWER(${properties.city}) = ${normalizeAddress(city)}`
            ))
            .limit(1);
          if (existing.length > 0) { existingProperty = existing[0]; matchType = "address"; }
        }

        // Detect changes for duplicates
        const changes: any[] = [];
        if (existingProperty) {
          const COMPARE_FIELDS = [
            { key: "owner1Name", label: "Owner 1", parse: str },
            { key: "owner2Name", label: "Owner 2", parse: str },
            { key: "ownerLocation", label: "Owner Location", parse: str },
            { key: "estimatedValue", label: "Estimated Value", parse: parseNumber },
            { key: "equityAmount", label: "Equity Amount", parse: parseNumber },
            { key: "equityPercent", label: "Equity %", parse: parsePercent },
            { key: "mortgageAmount", label: "Mortgage", parse: parseNumber },
            { key: "totalLoanBalance", label: "Loan Balance", parse: parseNumber },
            { key: "salePrice", label: "Sale Price", parse: parseNumber },
            { key: "taxAmount", label: "Tax Amount", parse: parseNumber },
            { key: "taxYear", label: "Tax Year", parse: parseNumber },
            { key: "taxDelinquent", label: "Tax Delinquent", parse: str },
            { key: "estimatedRepairCost", label: "Repair Cost", parse: parseNumber },
            { key: "propertyType", label: "Property Type", parse: str },
            { key: "constructionType", label: "Construction", parse: str },
            { key: "yearBuilt", label: "Year Built", parse: parseNumber },
            { key: "totalBedrooms", label: "Bedrooms", parse: parseNumber },
            { key: "totalBaths", label: "Baths", parse: parseNumber },
            { key: "buildingSquareFeet", label: "Sqft", parse: parseNumber },
            { key: "marketStatus", label: "Market Status", parse: str },
          ];

          for (const f of COMPARE_FIELDS) {
            let newVal = f.parse(mapped[f.key]);
            if (f.key === "equityPercent") newVal = parsePercent(mapped[f.key]);
            const oldVal = existingProperty[f.key];
            if (newVal !== null && newVal !== undefined && newVal !== "") {
              const normalizedNew = normalizeForCompare(newVal);
              const normalizedOld = normalizeForCompare(oldVal);
              if (normalizedNew !== normalizedOld) {
                changes.push({ field: f.label, oldValue: oldVal, newValue: newVal });
              }
            }
          }
        }

        // Count embedded contacts for this row
        const embeddedContacts = hasEmbeddedContacts ? extractEmbeddedContacts(raw) : [];
        const totalPhones = embeddedContacts.reduce((sum, c) => sum + c.phones.length, 0);
        const totalEmails = embeddedContacts.reduce((sum, c) => sum + c.emails.length, 0);

        rows.push({
          rowIndex: i,
          address: addressLine1 || "N/A",
          city: city || "N/A",
          state: state || "N/A",
          zipcode: zipcode || "N/A",
          owner: str(mapped.owner1Name) || "N/A",
          apn: apn || null,
          isDuplicate: !!existingProperty,
          matchType,
          existingId: existingProperty?.id || null,
          existingLeadId: existingProperty?.leadId || null,
          changes,
          hasChanges: changes.length > 0,
          // Embedded contacts info
          contactCount: embeddedContacts.length,
          totalPhones,
          totalEmails,
          contactNames: embeddedContacts.map((c) => c.name),
          rawData: mapped,
        });
      }

      const newCount = rows.filter((r) => !r.isDuplicate).length;
      const duplicateCount = rows.filter((r) => r.isDuplicate).length;
      const updatableCount = rows.filter((r) => r.isDuplicate && r.hasChanges).length;
      const totalContactsDetected = rows.reduce((sum, r) => sum + r.contactCount, 0);

      return {
        totalRows: rows.length,
        newCount,
        duplicateCount,
        updatableCount,
        hasEmbeddedContacts,
        totalContactsDetected,
        detectedColumns: rawColumns,
        mappedColumns: detectedMappings,
        rows,
      };
    }),

  // ── Execute Properties Import ─────────────────────────────────────────────
  executeImport: protectedProcedure
    .input(
      z.object({
        fileData: z.string(),
        assignedAgentId: z.number().nullable(),
        newRows: z.array(z.number()),
        updateRows: z.array(z.object({ rowIndex: z.number(), existingId: z.number() })),
        importContacts: z.boolean().default(true), // Whether to also import embedded contacts
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Only admins can import");

      const XLSX = await import("xlsx");
      const buffer = Buffer.from(input.fileData, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      const dbInstance = await getDb();
      if (!dbInstance) throw new Error("Database not available");

      let insertedCount = 0;
      let updatedCount = 0;
      let contactStats = { contactsImported: 0, contactsUpdated: 0, phonesImported: 0, emailsImported: 0, addressesImported: 0, socialsImported: 0 };
      const errors: string[] = [];

      // Process new rows (INSERT)
      for (const rowIndex of input.newRows) {
        if (rowIndex >= data.length) continue;
        const raw = data[rowIndex];
        const mapped = mapColumns(raw, PROPERTY_COLUMN_MAP);

        try {
          const propertyData: any = {
            addressLine1: str(mapped.addressLine1) || "TBD",
            addressLine2: str(mapped.addressLine2),
            city: str(mapped.city) || "TBD",
            state: str(mapped.state) || "FL",
            zipcode: str(mapped.zipcode) || "00000",
            subdivisionName: str(mapped.subdivisionName),
            owner1Name: str(mapped.owner1Name),
            owner2Name: str(mapped.owner2Name),
            ownerLocation: str(mapped.ownerLocation),
            estimatedValue: parseNumber(mapped.estimatedValue),
            equityAmount: parseNumber(mapped.equityAmount),
            equityPercent: parsePercent(mapped.equityPercent),
            mortgageAmount: parseNumber(mapped.mortgageAmount),
            totalLoanBalance: parseNumber(mapped.totalLoanBalance),
            salePrice: parseNumber(mapped.salePrice),
            saleDate: parseDate(mapped.saleDate),
            taxAmount: parseNumber(mapped.taxAmount),
            taxYear: parseNumber(mapped.taxYear),
            taxDelinquent: str(mapped.taxDelinquent),
            taxDelinquentYear: parseNumber(mapped.taxDelinquentYear),
            estimatedRepairCost: parseNumber(mapped.estimatedRepairCost),
            propertyType: str(mapped.propertyType),
            constructionType: str(mapped.constructionType),
            yearBuilt: parseNumber(mapped.yearBuilt),
            totalBedrooms: parseNumber(mapped.totalBedrooms),
            totalBaths: parseNumber(mapped.totalBaths),
            buildingSquareFeet: parseNumber(mapped.buildingSquareFeet),
            apnParcelId: str(mapped.apnParcelId),
            propertyId: str(mapped.propertyId),
            marketStatus: str(mapped.marketStatus),
            status: str(mapped.status),
            listName: str(mapped.listName),
            assignedAgentId: input.assignedAgentId,
            leadTemperature: "TBD",
            deskStatus: "BIN",
            source: "Import",
            trackingStatus: "Not Visited",
            ownerVerified: 0,
            dealStage: "NEW_LEAD",
            entryDate: new Date(),
            stageChangedAt: new Date(),
            dealMachineRawData: JSON.stringify(raw),
          };

          const result = await dbInstance.insert(properties).values(propertyData);
          const propertyId = result[0].insertId;
          insertedCount++;

          // Import embedded contacts if enabled
          if (input.importContacts) {
            const embeddedContacts = extractEmbeddedContacts(raw);
            const facebookProfiles = extractFacebookProfiles(raw);
            const ownerAddress = {
              line1: str(mapped.ownerAddressLine1),
              line2: str(mapped.ownerAddressLine2),
              city: str(mapped.ownerAddressCity),
              state: str(mapped.ownerAddressState),
              zip: str(mapped.ownerAddressZip),
            };

            if (embeddedContacts.length > 0) {
              const stats = await insertContactsForProperty(dbInstance, propertyId, embeddedContacts, ownerAddress, facebookProfiles);
              contactStats.contactsImported += stats.contactsImported;
              contactStats.contactsUpdated += stats.contactsUpdated;
              contactStats.phonesImported += stats.phonesImported;
              contactStats.emailsImported += stats.emailsImported;
              contactStats.addressesImported += stats.addressesImported;
              contactStats.socialsImported += stats.socialsImported;
            }
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2}: ${error.message}`);
        }
      }

      // Process update rows (UPDATE property + import contacts if missing)
      for (const { rowIndex, existingId } of input.updateRows) {
        if (rowIndex >= data.length) continue;
        const raw = data[rowIndex];
        const mapped = mapColumns(raw, PROPERTY_COLUMN_MAP);

        try {
          const updateData: any = {};
          const setIfPresent = (field: string, value: any) => {
            if (value !== null && value !== undefined && value !== "") {
              updateData[field] = value;
            }
          };

          setIfPresent("owner1Name", str(mapped.owner1Name));
          setIfPresent("owner2Name", str(mapped.owner2Name));
          setIfPresent("ownerLocation", str(mapped.ownerLocation));
          setIfPresent("estimatedValue", parseNumber(mapped.estimatedValue));
          setIfPresent("equityAmount", parseNumber(mapped.equityAmount));
          setIfPresent("equityPercent", parsePercent(mapped.equityPercent));
          setIfPresent("mortgageAmount", parseNumber(mapped.mortgageAmount));
          setIfPresent("totalLoanBalance", parseNumber(mapped.totalLoanBalance));
          setIfPresent("salePrice", parseNumber(mapped.salePrice));
          setIfPresent("saleDate", parseDate(mapped.saleDate));
          setIfPresent("taxAmount", parseNumber(mapped.taxAmount));
          setIfPresent("taxYear", parseNumber(mapped.taxYear));
          setIfPresent("taxDelinquent", str(mapped.taxDelinquent));
          setIfPresent("taxDelinquentYear", parseNumber(mapped.taxDelinquentYear));
          setIfPresent("estimatedRepairCost", parseNumber(mapped.estimatedRepairCost));
          setIfPresent("propertyType", str(mapped.propertyType));
          setIfPresent("constructionType", str(mapped.constructionType));
          setIfPresent("yearBuilt", parseNumber(mapped.yearBuilt));
          setIfPresent("totalBedrooms", parseNumber(mapped.totalBedrooms));
          setIfPresent("totalBaths", parseNumber(mapped.totalBaths));
          setIfPresent("buildingSquareFeet", parseNumber(mapped.buildingSquareFeet));
          setIfPresent("marketStatus", str(mapped.marketStatus));

          if (Object.keys(updateData).length > 0) {
            updateData.updatedAt = new Date();
            await dbInstance.update(properties).set(updateData).where(eq(properties.id, existingId));
            updatedCount++;
          }

          // Also import contacts for updated properties if enabled
          if (input.importContacts) {
            const embeddedContacts = extractEmbeddedContacts(raw);
            const facebookProfiles = extractFacebookProfiles(raw);
            const ownerAddress = {
              line1: str(mapped.ownerAddressLine1),
              line2: str(mapped.ownerAddressLine2),
              city: str(mapped.ownerAddressCity),
              state: str(mapped.ownerAddressState),
              zip: str(mapped.ownerAddressZip),
            };

            if (embeddedContacts.length > 0) {
              const stats = await insertContactsForProperty(dbInstance, existingId, embeddedContacts, ownerAddress, facebookProfiles);
              contactStats.contactsImported += stats.contactsImported;
              contactStats.contactsUpdated += stats.contactsUpdated;
              contactStats.phonesImported += stats.phonesImported;
              contactStats.emailsImported += stats.emailsImported;
              contactStats.addressesImported += stats.addressesImported;
              contactStats.socialsImported += stats.socialsImported;
            }
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2} (update): ${error.message}`);
        }
      }

      return {
        insertedCount,
        updatedCount,
        ...contactStats,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      };
    }),

  // ── Preview Contacts (separate file) ──────────────────────────────────────
  previewContacts: protectedProcedure
    .input(z.object({ fileData: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Only admins can import");

      const XLSX = await import("xlsx");
      const buffer = Buffer.from(input.fileData, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (data.length === 0) throw new Error("File is empty");

      const rawColumns = Object.keys(data[0]);
      const dbInstance = await getDb();
      if (!dbInstance) throw new Error("Database not available");

      const rows: any[] = [];
      for (let i = 0; i < data.length; i++) {
        const raw = data[i];
        const mapped = mapColumns(raw, CONTACT_COLUMN_MAP);

        const firstName = str(mapped.firstName);
        const lastName = str(mapped.lastName);
        const contactName = str(mapped.name) || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null);
        const propertyAddress = str(mapped.propertyAddress) || str(mapped.propertyAddressFull);
        const propertyCity = str(mapped.propertyCity);
        const propertyState = str(mapped.propertyState);
        const apn = str(mapped.apn);
        const leadId = mapped.leadId ? parseNumber(mapped.leadId) : null;

        // Try to match to an existing property
        let matchedProperty: any = null;
        let matchMethod: string | null = null;

        if (!matchedProperty && leadId) {
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties).where(eq(properties.leadId, leadId)).limit(1);
          if (existing.length > 0) { matchedProperty = existing[0]; matchMethod = "leadId"; }
        }

        if (!matchedProperty && apn) {
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties).where(eq(properties.apnParcelId, apn)).limit(1);
          if (existing.length > 0) { matchedProperty = existing[0]; matchMethod = "apn"; }
        }

        if (!matchedProperty && propertyAddress && propertyCity) {
          // Try to extract just the street address from full address
          let searchAddr = propertyAddress;
          // If it's a full address like "123 Main St, Orlando, FL 32801", extract just the street
          if (propertyAddress.includes(",")) {
            searchAddr = propertyAddress.split(",")[0].trim();
          }
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties)
            .where(and(
              sql`LOWER(${properties.addressLine1}) = ${normalizeAddress(searchAddr)}`,
              sql`LOWER(${properties.city}) = ${normalizeAddress(propertyCity)}`
            ))
            .limit(1);
          if (existing.length > 0) { matchedProperty = existing[0]; matchMethod = "address"; }
        }

        // Collect ALL phones with full metadata
        const allPhones: { number: string; type: string; dnc: boolean; carrier: string | null; prepaid: boolean; activity: string | null; usage2m: string | null; usage12m: string | null }[] = [];
        for (let p = 1; p <= 10; p++) {
          const phone = str(mapped[`phone${p}`]);
          if (phone) {
            const dncVal = str(mapped[`phone${p}Dnc`]);
            const prepaidVal = str(mapped[`phone${p}Prepaid`]);
            allPhones.push({
              number: phone.replace(/[^\d+]/g, ""),
              type: str(mapped[`phone${p}Type`]) || "Mobile",
              dnc: dncVal ? dncVal.toLowerCase().includes("do not call") : false,
              carrier: str(mapped[`phone${p}Carrier`]),
              prepaid: prepaidVal ? prepaidVal.toLowerCase().includes("prepaid") : false,
              activity: str(mapped[`phone${p}Activity`]),
              usage2m: str(mapped[`phone${p}Usage2m`]),
              usage12m: str(mapped[`phone${p}Usage12m`]),
            });
          }
        }

        // Collect ALL emails
        const allEmails: string[] = [];
        for (let e = 1; e <= 10; e++) {
          const email = str(mapped[`email${e}`]);
          if (email) allEmails.push(email);
        }

        // Demographics
        const demographics = {
          gender: str(mapped.gender),
          maritalStatus: str(mapped.maritalStatus),
          netAssetValue: str(mapped.netAssetValue),
          homeBusiness: str(mapped.homeBusiness),
          occupationGroup: str(mapped.occupationGroup),
          businessOwner: str(mapped.businessOwner),
        };

        // Check if contact already exists in the database for this property
        let existingContact: any = null;
        let existingPhones: any[] = [];
        let existingEmails: any[] = [];
        let contactStatus: "new" | "update" | "up_to_date" = "new";
        let newPhones: typeof allPhones = [];
        let newEmails: string[] = [];
        let updatedFields: { field: string; oldValue: string; newValue: string }[] = [];

        if (matchedProperty && contactName && contactName !== "N/A") {
          const existingContactRows = await dbInstance
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.propertyId, matchedProperty.id),
                sql`LOWER(${contacts.name}) = ${(contactName as string).toLowerCase()}`
              )
            )
            .limit(1);

          if (existingContactRows.length > 0) {
            existingContact = existingContactRows[0];
            const cId = existingContact.id;

            // Load existing phones and emails
            existingPhones = await dbInstance.select().from(contactPhones).where(eq(contactPhones.contactId, cId));
            existingEmails = await dbInstance.select().from(contactEmails).where(eq(contactEmails.contactId, cId));

            // Find NEW phones (not already in DB)
            const existingPhoneNumbers = new Set(existingPhones.map((p: any) => p.phoneNumber));
            newPhones = allPhones.filter(p => !existingPhoneNumbers.has(p.number));

            // Find NEW emails (not already in DB)
            const existingEmailSet = new Set(existingEmails.map((e: any) => e.email?.toLowerCase()));
            newEmails = allEmails.filter(e => !existingEmailSet.has(e.toLowerCase()));

            // Compare demographics
            const demoFields: { key: string; label: string; csvVal: string | null; dbVal: any }[] = [
              { key: "gender", label: "Gender", csvVal: demographics.gender, dbVal: existingContact.gender },
              { key: "maritalStatus", label: "Marital Status", csvVal: demographics.maritalStatus, dbVal: existingContact.maritalStatus },
              { key: "netAssetValue", label: "Net Asset Value", csvVal: demographics.netAssetValue, dbVal: existingContact.netAssetValue },
              { key: "flags", label: "Flags", csvVal: str(mapped.flags), dbVal: existingContact.flags },
            ];
            for (const df of demoFields) {
              if (df.csvVal && normalizeForCompare(df.csvVal) !== normalizeForCompare(df.dbVal)) {
                updatedFields.push({ field: df.label, oldValue: df.dbVal || "(empty)", newValue: df.csvVal });
              }
            }

            if (newPhones.length === 0 && newEmails.length === 0 && updatedFields.length === 0) {
              contactStatus = "up_to_date";
            } else {
              contactStatus = "update";
            }
          }
        }

        rows.push({
          rowIndex: i,
          contactName: contactName || "N/A",
          firstName,
          lastName,
          middleInitial: str(mapped.middleInitial),
          generationalSuffix: str(mapped.generationalSuffix),
          dealMachineContactId: str(mapped.dealMachineContactId),
          relationship: str(mapped.relationship) || "N/A",
          flags: str(mapped.flags) || null,
          phones: allPhones,
          emails: allEmails,
          phoneCount: allPhones.length,
          emailCount: allEmails.length,
          demographics,
          mailingAddress: str(mapped.mailingAddress),
          mailingCity: str(mapped.mailingCity),
          mailingState: str(mapped.mailingState),
          mailingZip: str(mapped.mailingZip),
          propertyAddress: propertyAddress || "N/A",
          propertyCity: propertyCity || "N/A",
          apn: apn || null,
          matched: !!matchedProperty,
          matchMethod,
          matchedPropertyId: matchedProperty?.id || null,
          matchedPropertyAddress: matchedProperty ? `${matchedProperty.addressLine1}, ${matchedProperty.city}` : null,
          matchedLeadId: matchedProperty?.leadId || null,
          // Comparison data
          contactStatus,
          existingContactId: existingContact?.id || null,
          existingPhoneCount: existingPhones.length,
          existingEmailCount: existingEmails.length,
          newPhones,
          newEmails,
          updatedFields,
          rawData: mapped,
        });
      }

      const matchedCount = rows.filter((r) => r.matched).length;
      const unmatchedCount = rows.filter((r) => !r.matched).length;
      const newContactsCount = rows.filter((r) => r.contactStatus === "new" && r.matched).length;
      const updateContactsCount = rows.filter((r) => r.contactStatus === "update").length;
      const upToDateCount = rows.filter((r) => r.contactStatus === "up_to_date").length;

      return {
        totalRows: rows.length,
        matchedCount,
        unmatchedCount,
        newContactsCount,
        updateContactsCount,
        upToDateCount,
        detectedColumns: rawColumns,
        rows,
      };
    }),

  // ── Execute Contacts Import (separate file) ───────────────────────────────
  executeContactsImport: protectedProcedure
    .input(
      z.object({
        fileData: z.string(),
        contactRows: z.array(z.object({ rowIndex: z.number(), propertyId: z.number() })),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Only admins can import");

      const XLSX = await import("xlsx");
      const buffer = Buffer.from(input.fileData, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      const dbInstance = await getDb();
      if (!dbInstance) throw new Error("Database not available");

      let contactsCreated = 0;
      let contactsUpdated = 0;
      let phonesAdded = 0;
      let emailsAdded = 0;
      let addressesAdded = 0;
      let skippedUpToDate = 0;
      const errors: string[] = [];

      for (const { rowIndex, propertyId } of input.contactRows) {
        if (rowIndex >= data.length) continue;
        const raw = data[rowIndex];
        const mapped = mapColumns(raw, CONTACT_COLUMN_MAP);

        try {
          const firstName = str(mapped.firstName);
          const lastName = str(mapped.lastName);
          const contactName = str(mapped.name) || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || "Unknown");

          // Collect all phones with metadata
          const allPhones: { number: string; type: string; dnc: number; carrier: string | null; isPrepaid: number; activityStatus: string | null; usage2Months: string | null; usage12Months: string | null }[] = [];
          for (let p = 1; p <= 10; p++) {
            const phone = str(mapped[`phone${p}`]);
            if (phone) {
              const dncVal = str(mapped[`phone${p}Dnc`]);
              const prepaidVal = str(mapped[`phone${p}Prepaid`]);
              allPhones.push({
                number: phone.replace(/[^\d+]/g, ""),
                type: str(mapped[`phone${p}Type`]) || "Mobile",
                dnc: dncVal && dncVal.toLowerCase().includes("do not call") ? 1 : 0,
                carrier: str(mapped[`phone${p}Carrier`]),
                isPrepaid: prepaidVal && prepaidVal.toLowerCase().includes("prepaid") ? 1 : 0,
                activityStatus: str(mapped[`phone${p}Activity`]),
                usage2Months: str(mapped[`phone${p}Usage2m`]),
                usage12Months: str(mapped[`phone${p}Usage12m`]),
              });
            }
          }

          // Collect all emails
          const allEmails: string[] = [];
          for (let e = 1; e <= 10; e++) {
            const email = str(mapped[`email${e}`]);
            if (email) allEmails.push(email);
          }

          // Check if contact already exists
          const existingContacts = await dbInstance
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.propertyId, propertyId),
                sql`LOWER(${contacts.name}) = ${(contactName as string).toLowerCase()}`
              )
            )
            .limit(1);

          let contactId: number;

          if (existingContacts.length > 0) {
            // EXISTING contact — UPDATE demographics and upsert phones/emails
            contactId = existingContacts[0].id;

            // Update demographics
            const updateData: any = { updatedAt: new Date() };
            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;
            if (str(mapped.middleInitial)) updateData.middleInitial = str(mapped.middleInitial);
            if (str(mapped.generationalSuffix)) updateData.suffix = str(mapped.generationalSuffix);
            if (str(mapped.flags)) updateData.flags = str(mapped.flags);
            if (str(mapped.gender)) updateData.gender = str(mapped.gender);
            if (str(mapped.maritalStatus)) updateData.maritalStatus = str(mapped.maritalStatus);
            if (str(mapped.netAssetValue)) updateData.netAssetValue = str(mapped.netAssetValue);
            if (str(mapped.relationship)) updateData.relationship = str(mapped.relationship);
            if (parseNumber(mapped.age)) updateData.age = parseNumber(mapped.age);

            await dbInstance.update(contacts).set(updateData).where(eq(contacts.id, contactId));

            let hadChanges = false;

            // Upsert phones
            for (let pi = 0; pi < allPhones.length; pi++) {
              const p = allPhones[pi];
              const isNew = await upsertPhoneForContact(dbInstance, contactId, p.number, p.type, pi === 0 ? 1 : 0, {
                dnc: p.dnc,
                carrier: p.carrier,
                isPrepaid: p.isPrepaid,
                activityStatus: p.activityStatus,
                usage2Months: p.usage2Months,
                usage12Months: p.usage12Months,
              });
              if (isNew) { phonesAdded++; hadChanges = true; }
            }

            // Upsert emails
            for (let ei = 0; ei < allEmails.length; ei++) {
              const isNew = await upsertEmailForContact(dbInstance, contactId, allEmails[ei], ei === 0 ? 1 : 0);
              if (isNew) { emailsAdded++; hadChanges = true; }
            }

            if (hadChanges || Object.keys(updateData).length > 1) {
              contactsUpdated++;
            } else {
              skippedUpToDate++;
            }
          } else {
            // NEW contact — INSERT with all data
            const contactResult = await dbInstance.insert(contacts).values({
              propertyId,
              name: contactName as string,
              firstName,
              lastName,
              middleInitial: str(mapped.middleInitial),
              generationalSuffix: str(mapped.generationalSuffix),
              relationship: str(mapped.relationship) || "Owner",
              flags: str(mapped.flags),
              age: parseNumber(mapped.age),
              gender: str(mapped.gender),
              maritalStatus: str(mapped.maritalStatus),
              netAssetValue: str(mapped.netAssetValue),
              homeBusiness: str(mapped.homeBusiness),
              educationModel: str(mapped.educationModel),
              occupationGroup: str(mapped.occupationGroup),
              occupationCode: str(mapped.occupationCode),
              businessOwner: str(mapped.businessOwner),
              dealMachineContactId: str(mapped.dealMachineContactId),
            } as any);
            contactId = contactResult[0].insertId;
            contactsCreated++;

            // Insert all phones with full metadata
            for (let pi = 0; pi < allPhones.length; pi++) {
              const p = allPhones[pi];
              await dbInstance.insert(contactPhones).values({
                contactId,
                phoneNumber: p.number,
                phoneType: mapPhoneType(p.type),
                isPrimary: pi === 0 ? 1 : 0,
                dnc: p.dnc,
                carrier: p.carrier,
                isPrepaid: p.isPrepaid,
                activityStatus: p.activityStatus,
                usage2Months: p.usage2Months,
                usage12Months: p.usage12Months,
              } as any);
              phonesAdded++;
            }

            // Insert all emails
            for (let ei = 0; ei < allEmails.length; ei++) {
              await dbInstance.insert(contactEmails).values({
                contactId,
                email: allEmails[ei].toLowerCase().trim(),
                isPrimary: ei === 0 ? 1 : 0,
              });
              emailsAdded++;
            }
          }

          // Upsert mailing address (for both new and existing contacts)
          const mailingAddr = str(mapped.mailingAddress);
          const mailingCity = str(mapped.mailingCity);
          const mailingState = str(mapped.mailingState);
          const mailingZip = str(mapped.mailingZip);
          if (mailingAddr && mailingCity && mailingState && mailingZip) {
            const existingAddr = await dbInstance
              .select({ id: contactAddresses.id })
              .from(contactAddresses)
              .where(and(eq(contactAddresses.contactId, contactId), sql`LOWER(${contactAddresses.addressLine1}) = ${mailingAddr.toLowerCase()}`))
              .limit(1);
            if (existingAddr.length === 0) {
              await dbInstance.insert(contactAddresses).values({
                contactId,
                addressLine1: mailingAddr,
                city: mailingCity,
                state: mailingState.substring(0, 2).toUpperCase(),
                zipcode: mailingZip,
                addressType: "Mailing",
                isPrimary: 1,
              } as any);
              addressesAdded++;
            }
          }

          // Upsert previous address
          const prevAddr = str(mapped.mailingAddressPrev);
          const prevCity = str(mapped.mailingCityPrev);
          const prevState = str(mapped.mailingStatePrev);
          const prevZip = str(mapped.mailingZipPrev);
          if (prevAddr && prevCity && prevState && prevZip) {
            const existingPrev = await dbInstance
              .select({ id: contactAddresses.id })
              .from(contactAddresses)
              .where(and(eq(contactAddresses.contactId, contactId), sql`LOWER(${contactAddresses.addressLine1}) = ${prevAddr.toLowerCase()}`))
              .limit(1);
            if (existingPrev.length === 0) {
              await dbInstance.insert(contactAddresses).values({
                contactId,
                addressLine1: prevAddr,
                city: prevCity,
                state: prevState.substring(0, 2).toUpperCase(),
                zipcode: prevZip,
                addressType: "Previous",
                isPrimary: 0,
              } as any);
              addressesAdded++;
            }
          }

          // Upsert Facebook profile
          const facebook = str(mapped.facebook);
          if (facebook) {
            const existingSocial = await dbInstance
              .select({ id: contactSocialMedia.id })
              .from(contactSocialMedia)
              .where(and(eq(contactSocialMedia.contactId, contactId), eq(contactSocialMedia.platform, "Facebook")))
              .limit(1);
            if (existingSocial.length === 0) {
              await dbInstance.insert(contactSocialMedia).values({
                contactId,
                platform: "Facebook" as const,
                profileUrl: facebook,
                contacted: 0,
              } as any);
            }
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2}: ${error.message}`);
        }
      }

      return {
        contactsCreated,
        contactsUpdated,
        skippedUpToDate,
        phonesAdded,
        emailsAdded,
        addressesAdded,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      };
    }),
});
