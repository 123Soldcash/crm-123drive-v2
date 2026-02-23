import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { properties, contacts, contactPhones, contactEmails, contactAddresses } from "../../drizzle/schema";
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
    // Excel serial date
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

// Normalize address for comparison (lowercase, remove extra spaces, remove dots, etc.)
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Column Mapping ───────────────────────────────────────────────────────────
// Maps various common column names to our internal field names
// Supports DealMachine format and generic CSV/Excel formats

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
  phone: "phone1",
  phone1: "phone1",
  "phone 1": "phone1",
  phone_number: "phone1",
  "phone number": "phone1",
  phone2: "phone2",
  "phone 2": "phone2",
  phone3: "phone3",
  "phone 3": "phone3",
  email: "email1",
  email1: "email1",
  "email 1": "email1",
  email_address: "email1",
  "email address": "email1",
  email2: "email2",
  "email 2": "email2",
  email3: "email3",
  "email 3": "email3",
  mailing_address: "mailingAddress",
  "mailing address": "mailingAddress",
  mailing_city: "mailingCity",
  "mailing city": "mailingCity",
  mailing_state: "mailingState",
  "mailing state": "mailingState",
  mailing_zipcode: "mailingZipcode",
  "mailing zip": "mailingZipcode",
  mailing_zip: "mailingZipcode",
  flags: "flags",
  notes: "notes",
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

// ─── Router ───────────────────────────────────────────────────────────────────

export const importPropertiesRouter = router({
  // ── Preview Properties ────────────────────────────────────────────────────
  // Parses file, maps columns, detects duplicates, returns preview data
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

      // Detect columns
      const rawColumns = Object.keys(data[0]);
      const detectedMappings: Record<string, string> = {};
      for (const col of rawColumns) {
        const norm = col.toLowerCase().trim();
        if (PROPERTY_COLUMN_MAP[norm]) {
          detectedMappings[col] = PROPERTY_COLUMN_MAP[norm];
        }
      }

      const dbInstance = await getDb();
      if (!dbInstance) throw new Error("Database not available");

      // Process rows and check for duplicates
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
          const existing = await dbInstance
            .select()
            .from(properties)
            .where(eq(properties.propertyId, propId))
            .limit(1);
          if (existing.length > 0) {
            existingProperty = existing[0];
            matchType = "propertyId";
          }
        }

        if (!existingProperty && apn) {
          const existing = await dbInstance
            .select()
            .from(properties)
            .where(eq(properties.apnParcelId, apn))
            .limit(1);
          if (existing.length > 0) {
            existingProperty = existing[0];
            matchType = "apn";
          }
        }

        if (!existingProperty && addressLine1 && city && state) {
          const existing = await dbInstance
            .select()
            .from(properties)
            .where(
              and(
                sql`LOWER(${properties.addressLine1}) = ${normalizeAddress(addressLine1)}`,
                sql`LOWER(${properties.city}) = ${normalizeAddress(city)}`,
                eq(properties.state, state.toUpperCase().substring(0, 2))
              )
            )
            .limit(1);
          if (existing.length > 0) {
            existingProperty = existing[0];
            matchType = "address";
          }
        }

        // Build changes list for duplicates
        let changes: { field: string; oldValue: any; newValue: any }[] = [];
        if (existingProperty) {
          const fieldsToCompare = [
            { key: "owner1Name", label: "Owner 1" },
            { key: "owner2Name", label: "Owner 2" },
            { key: "estimatedValue", label: "Estimated Value" },
            { key: "equityAmount", label: "Equity Amount" },
            { key: "equityPercent", label: "Equity %" },
            { key: "mortgageAmount", label: "Mortgage" },
            { key: "totalLoanBalance", label: "Loan Balance" },
            { key: "taxAmount", label: "Tax Amount" },
            { key: "taxYear", label: "Tax Year" },
            { key: "taxDelinquent", label: "Tax Delinquent" },
            { key: "propertyType", label: "Property Type" },
            { key: "yearBuilt", label: "Year Built" },
            { key: "totalBedrooms", label: "Bedrooms" },
            { key: "totalBaths", label: "Baths" },
            { key: "buildingSquareFeet", label: "Sqft" },
            { key: "marketStatus", label: "Market Status" },
            { key: "ownerLocation", label: "Owner Location" },
            { key: "salePrice", label: "Sale Price" },
          ];

          for (const f of fieldsToCompare) {
            let newVal: any = mapped[f.key];
            // Parse numbers for comparison
            if (["estimatedValue", "equityAmount", "mortgageAmount", "totalLoanBalance", "taxAmount", "salePrice", "buildingSquareFeet", "yearBuilt", "totalBedrooms", "totalBaths", "taxYear", "estimatedRepairCost"].includes(f.key)) {
              newVal = parseNumber(newVal);
            }
            if (f.key === "equityPercent") {
              newVal = parsePercent(newVal);
            }
            const oldVal = existingProperty[f.key];
            if (newVal !== null && newVal !== undefined && newVal !== "" && String(newVal) !== String(oldVal ?? "")) {
              changes.push({ field: f.label, oldValue: oldVal, newValue: newVal });
            }
          }
        }

        rows.push({
          rowIndex: i,
          address: addressLine1 || "N/A",
          city: city || "N/A",
          state: state || "N/A",
          zipcode: zipcode || "N/A",
          owner: str(mapped.owner1Name) || "N/A",
          isDuplicate: !!existingProperty,
          matchType,
          existingId: existingProperty?.id || null,
          existingLeadId: existingProperty?.leadId || null,
          changes,
          hasChanges: changes.length > 0,
          rawData: mapped,
        });
      }

      const newCount = rows.filter((r) => !r.isDuplicate).length;
      const duplicateCount = rows.filter((r) => r.isDuplicate).length;
      const updatableCount = rows.filter((r) => r.isDuplicate && r.hasChanges).length;

      return {
        totalRows: rows.length,
        newCount,
        duplicateCount,
        updatableCount,
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
        // Array of row indices to import as new
        newRows: z.array(z.number()),
        // Array of { rowIndex, existingId } to update
        updateRows: z.array(z.object({ rowIndex: z.number(), existingId: z.number() })),
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
          };

          // Store raw data as JSON for reference
          propertyData.dealMachineRawData = JSON.stringify(raw);

          await dbInstance.insert(properties).values(propertyData);
          insertedCount++;
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2}: ${error.message}`);
        }
      }

      // Process update rows (UPDATE)
      for (const { rowIndex, existingId } of input.updateRows) {
        if (rowIndex >= data.length) continue;
        const raw = data[rowIndex];
        const mapped = mapColumns(raw, PROPERTY_COLUMN_MAP);

        try {
          // Only update non-null fields from the import
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
            await dbInstance
              .update(properties)
              .set(updateData)
              .where(eq(properties.id, existingId));
            updatedCount++;
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2} (update): ${error.message}`);
        }
      }

      return {
        insertedCount,
        updatedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      };
    }),

  // ── Preview Contacts ──────────────────────────────────────────────────────
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

        // Match by leadId first
        if (!matchedProperty && leadId) {
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties)
            .where(eq(properties.leadId, leadId))
            .limit(1);
          if (existing.length > 0) {
            matchedProperty = existing[0];
            matchMethod = "leadId";
          }
        }

        // Match by APN
        if (!matchedProperty && apn) {
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties)
            .where(eq(properties.apnParcelId, apn))
            .limit(1);
          if (existing.length > 0) {
            matchedProperty = existing[0];
            matchMethod = "apn";
          }
        }

        // Match by address
        if (!matchedProperty && propertyAddress && propertyCity) {
          const existing = await dbInstance
            .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, leadId: properties.leadId })
            .from(properties)
            .where(
              and(
                sql`LOWER(${properties.addressLine1}) = ${normalizeAddress(propertyAddress)}`,
                sql`LOWER(${properties.city}) = ${normalizeAddress(propertyCity)}`
              )
            )
            .limit(1);
          if (existing.length > 0) {
            matchedProperty = existing[0];
            matchMethod = "address";
          }
        }

        rows.push({
          rowIndex: i,
          contactName: contactName || "N/A",
          relationship: str(mapped.relationship) || "N/A",
          phone1: str(mapped.phone1) || null,
          email1: str(mapped.email1) || null,
          propertyAddress: propertyAddress || "N/A",
          propertyCity: propertyCity || "N/A",
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

  // ── Execute Contacts Import ───────────────────────────────────────────────
  executeContactsImport: protectedProcedure
    .input(
      z.object({
        fileData: z.string(),
        // Array of { rowIndex, propertyId } to import
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
      const errors: string[] = [];

      for (const { rowIndex, propertyId } of input.contactRows) {
        if (rowIndex >= data.length) continue;
        const raw = data[rowIndex];
        const mapped = mapColumns(raw, CONTACT_COLUMN_MAP);

        try {
          const contactName = str(mapped.name) || (str(mapped.firstName) && str(mapped.lastName) ? `${str(mapped.firstName)} ${str(mapped.lastName)}` : "Unknown");

          // Insert contact
          const contactResult = await dbInstance.insert(contacts).values({
            propertyId,
            name: contactName,
            relationship: str(mapped.relationship) || "Owner",
            flags: str(mapped.flags),
          } as any);
          const contactId = contactResult[0].insertId;
          contactsImported++;

          // Insert phones
          for (const phoneKey of ["phone1", "phone2", "phone3"]) {
            const phone = str(mapped[phoneKey]);
            if (phone) {
              await dbInstance.insert(contactPhones).values({
                contactId,
                phoneNumber: phone.replace(/[^\d+]/g, ""),
                phoneType: "Mobile",
                isPrimary: phoneKey === "phone1" ? 1 : 0,
              } as any);
              phonesImported++;
            }
          }

          // Insert emails
          for (const emailKey of ["email1", "email2", "email3"]) {
            const email = str(mapped[emailKey]);
            if (email) {
              await dbInstance.insert(contactEmails).values({
                contactId,
                email,
                isPrimary: emailKey === "email1" ? 1 : 0,
              });
              emailsImported++;
            }
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
          }
        } catch (error: any) {
          errors.push(`Row ${rowIndex + 2}: ${error.message}`);
        }
      }

      return {
        contactsImported,
        phonesImported,
        emailsImported,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      };
    }),
});
