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
  // Property identifiers for matching
  property_address_line_1: "propertyAddress",
  address: "propertyAddress",
  "address line 1": "propertyAddress",
  "property address": "propertyAddress",
  street: "propertyAddress",
  property_address_city: "propertyCity",
  city: "propertyCity",
  property_address_state: "propertyState",
  state: "propertyState",
  property_address_zipcode: "propertyZipcode",
  zipcode: "propertyZipcode",
  zip: "propertyZipcode",
  apn_parcel_id: "apn",
  apn: "apn",
  associated_property_apn_parcel_id: "apn",
  "associated property apn parcel id": "apn",
  associated_property_apn: "apn",
  property_apn: "apn",
  "property apn": "apn",
  parcel_id: "apn",
  "parcel id": "apn",
  lead_id: "leadId",
  "lead id": "leadId",

  // Contact fields
  name: "name",
  contact_name: "name",
  "contact name": "name",
  "full name": "name",
  first_name: "firstName",
  "first name": "firstName",
  last_name: "lastName",
  "last name": "lastName",
  relationship: "relationship",
  age: "age",
  flags: "flags",
  notes: "notes",

  // Phones (up to 10)
  phone: "phone1", phone1: "phone1", "phone 1": "phone1", phone_number: "phone1", "phone number": "phone1",
  phone1_type: "phone1Type", "phone 1 type": "phone1Type",
  phone2: "phone2", "phone 2": "phone2",
  phone2_type: "phone2Type", "phone 2 type": "phone2Type",
  phone3: "phone3", "phone 3": "phone3",
  phone3_type: "phone3Type", "phone 3 type": "phone3Type",
  phone4: "phone4", phone5: "phone5", phone6: "phone6",
  phone7: "phone7", phone8: "phone8", phone9: "phone9", phone10: "phone10",

  // Emails (up to 10)
  email: "email1", email1: "email1", "email 1": "email1", email_address: "email1", "email address": "email1",
  email2: "email2", "email 2": "email2",
  email3: "email3", "email 3": "email3",
  email4: "email4", email5: "email5", email6: "email6",
  email7: "email7", email8: "email8", email9: "email9", email10: "email10",

  // Mailing address
  mailing_address: "mailingAddress", "mailing address": "mailingAddress",
  mailing_city: "mailingCity", "mailing city": "mailingCity",
  mailing_state: "mailingState", "mailing state": "mailingState",
  mailing_zipcode: "mailingZipcode", "mailing zip": "mailingZipcode", mailing_zip: "mailingZipcode",

  // Facebook
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

async function insertContactsForProperty(
  dbInstance: any,
  propertyId: number,
  embeddedContacts: ExtractedContact[],
  ownerAddress: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null,
  facebookProfiles: string[]
): Promise<{ contactsImported: number; phonesImported: number; emailsImported: number; addressesImported: number; socialsImported: number }> {
  let contactsImported = 0;
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

    if (existingContacts.length > 0) {
      // Contact already exists, skip to avoid duplicates
      continue;
    }

    // Insert contact
    const contactResult = await dbInstance.insert(contacts).values({
      propertyId,
      name: c.name,
      email: c.emails[0] || "",
      relationship: "Owner",
      flags: c.flags,
    } as any);
    const contactId = contactResult[0].insertId;
    contactsImported++;

    // Insert all phones
    for (let pi = 0; pi < c.phones.length; pi++) {
      const p = c.phones[pi];
      if (p.number) {
        await dbInstance.insert(contactPhones).values({
          contactId,
          phoneNumber: p.number,
          phoneType: mapPhoneType(p.type),
          isPrimary: pi === 0 ? 1 : 0,
        } as any);
        phonesImported++;
      }
    }

    // Insert all emails
    for (let ei = 0; ei < c.emails.length; ei++) {
      const email = c.emails[ei];
      if (email) {
        await dbInstance.insert(contactEmails).values({
          contactId,
          email,
          isPrimary: ei === 0 ? 1 : 0,
        });
        emailsImported++;
      }
    }

    // Insert owner mailing address for the first contact (likely owner)
    if (ci === 0 && ownerAddress && ownerAddress.line1 && ownerAddress.city && ownerAddress.state && ownerAddress.zip) {
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

    // Assign Facebook profiles to contacts (distribute sequentially)
    if (facebookProfiles[ci]) {
      await dbInstance.insert(contactSocialMedia).values({
        contactId,
        platform: "Facebook" as const,
        profileUrl: facebookProfiles[ci],
        contacted: 0,
      } as any);
      socialsImported++;
    }
  }

  return { contactsImported, phonesImported, emailsImported, addressesImported, socialsImported };
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
      let contactStats = { contactsImported: 0, phonesImported: 0, emailsImported: 0, addressesImported: 0, socialsImported: 0 };
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

        const contactName = str(mapped.name) || (str(mapped.firstName) && str(mapped.lastName) ? `${str(mapped.firstName)} ${str(mapped.lastName)}` : null);
        const propertyAddress = str(mapped.propertyAddress);
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
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties)
            .where(and(
              sql`LOWER(${properties.addressLine1}) = ${normalizeAddress(propertyAddress)}`,
              sql`LOWER(${properties.city}) = ${normalizeAddress(propertyCity)}`
            ))
            .limit(1);
          if (existing.length > 0) { matchedProperty = existing[0]; matchMethod = "address"; }
        }

        // Collect ALL phones and emails from the row
        const allPhones: { number: string; type: string }[] = [];
        const allEmails: string[] = [];
        for (let p = 1; p <= 10; p++) {
          const phone = str(mapped[`phone${p}`]);
          const phoneType = str(mapped[`phone${p}Type`]);
          if (phone) allPhones.push({ number: phone.replace(/[^\d+]/g, ""), type: phoneType || "Mobile" });
        }
        for (let e = 1; e <= 10; e++) {
          const email = str(mapped[`email${e}`]);
          if (email) allEmails.push(email);
        }

        rows.push({
          rowIndex: i,
          contactName: contactName || "N/A",
          relationship: str(mapped.relationship) || "N/A",
          flags: str(mapped.flags) || null,
          phones: allPhones,
          emails: allEmails,
          phoneCount: allPhones.length,
          emailCount: allEmails.length,
          propertyAddress: propertyAddress || "N/A",
          propertyCity: propertyCity || "N/A",
          apn: apn || null,
          matched: !!matchedProperty,
          matchMethod,
          matchedPropertyId: matchedProperty?.id || null,
          matchedPropertyAddress: matchedProperty ? `${matchedProperty.addressLine1}, ${matchedProperty.city}` : null,
          matchedLeadId: matchedProperty?.leadId || null,
          rawData: mapped,
        });
      }

      const matchedCount = rows.filter((r) => r.matched).length;
      const unmatchedCount = rows.filter((r) => !r.matched).length;

      return {
        totalRows: rows.length,
        matchedCount,
        unmatchedCount,
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

      let contactsImported = 0;
      let phonesImported = 0;
      let emailsImported = 0;
      let addressesImported = 0;
      const errors: string[] = [];

      for (const { rowIndex, propertyId } of input.contactRows) {
        if (rowIndex >= data.length) continue;
        const raw = data[rowIndex];
        const mapped = mapColumns(raw, CONTACT_COLUMN_MAP);

        try {
          const contactName = str(mapped.name) || (str(mapped.firstName) && str(mapped.lastName) ? `${str(mapped.firstName)} ${str(mapped.lastName)}` : "Unknown");

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

          if (existingContacts.length > 0) {
            // Skip duplicate contact
            continue;
          }

          // Collect all emails
          const allEmails: string[] = [];
          for (let e = 1; e <= 10; e++) {
            const email = str(mapped[`email${e}`]);
            if (email) allEmails.push(email);
          }

          // Insert contact
          const contactResult = await dbInstance.insert(contacts).values({
            propertyId,
            name: contactName as string,
            email: allEmails[0] || "",
            relationship: str(mapped.relationship) || "Owner",
            flags: str(mapped.flags),
            age: parseNumber(mapped.age),
          } as any);
          const contactId = contactResult[0].insertId;
          contactsImported++;

          // Insert ALL phones (up to 10)
          for (let p = 1; p <= 10; p++) {
            const phone = str(mapped[`phone${p}`]);
            const phoneType = str(mapped[`phone${p}Type`]);
            if (phone) {
              await dbInstance.insert(contactPhones).values({
                contactId,
                phoneNumber: phone.replace(/[^\d+]/g, ""),
                phoneType: mapPhoneType(phoneType),
                isPrimary: p === 1 ? 1 : 0,
              } as any);
              phonesImported++;
            }
          }

          // Insert ALL emails (up to 10)
          for (let e = 0; e < allEmails.length; e++) {
            await dbInstance.insert(contactEmails).values({
              contactId,
              email: allEmails[e],
              isPrimary: e === 0 ? 1 : 0,
            });
            emailsImported++;
          }

          // Insert mailing address if present
          const mailingAddr = str(mapped.mailingAddress);
          const mailingCity = str(mapped.mailingCity);
          const mailingState = str(mapped.mailingState);
          const mailingZip = str(mapped.mailingZipcode);
          if (mailingAddr && mailingCity && mailingState && mailingZip) {
            await dbInstance.insert(contactAddresses).values({
              contactId,
              addressLine1: mailingAddr,
              city: mailingCity,
              state: mailingState.substring(0, 2).toUpperCase(),
              zipcode: mailingZip,
              addressType: "Mailing",
              isPrimary: 1,
            } as any);
            addressesImported++;
          }

          // Insert Facebook profile if present
          const facebook = str(mapped.facebook);
          if (facebook) {
            await dbInstance.insert(contactSocialMedia).values({
              contactId,
              platform: "Facebook" as const,
              profileUrl: facebook,
              contacted: 0,
            } as any);
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2}: ${error.message}`);
        }
      }

      return {
        contactsImported,
        phonesImported,
        emailsImported,
        addressesImported,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      };
    }),
});
