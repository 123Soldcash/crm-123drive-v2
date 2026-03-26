import { getDb } from "./db";
import { buyers, buyerPreferences } from "../drizzle/schema";
import { eq, or, inArray } from "drizzle-orm";

/**
 * Interface for a single buyer row parsed from Excel
 */
export interface BuyerImportRow {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: "Active" | "Inactive" | "Verified" | "Blacklisted";
  notes?: string;
  // Preferences
  preferredStates?: string;    // comma-separated
  preferredCities?: string;    // comma-separated
  preferredZipcodes?: string;  // comma-separated
  propertyTypes?: string;      // comma-separated
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minPrice?: number;
  maxPrice?: number;
  maxRepairCost?: number;
}

/**
 * Validation result for a single row
 */
export interface RowValidation {
  row: number;
  data: BuyerImportRow;
  valid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

/**
 * Import result summary
 */
export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}

const VALID_STATUSES = ["Active", "Inactive", "Verified", "Blacklisted"];

/**
 * Validate a single buyer row
 */
function validateRow(row: BuyerImportRow, rowIndex: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!row.name || row.name.trim() === "") {
    errors.push("Name is required");
  }
  if (!row.email || row.email.trim() === "") {
    errors.push("Email is required");
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email.trim())) {
      errors.push(`Invalid email format: "${row.email}"`);
    }
  }

  // Status validation
  if (row.status && !VALID_STATUSES.includes(row.status)) {
    warnings.push(`Invalid status "${row.status}" — will default to "Active". Valid: ${VALID_STATUSES.join(", ")}`);
  }

  // Numeric validations
  if (row.minBeds !== undefined && row.minBeds !== null && isNaN(Number(row.minBeds))) {
    warnings.push("Min Beds must be a number — will be ignored");
  }
  if (row.maxBeds !== undefined && row.maxBeds !== null && isNaN(Number(row.maxBeds))) {
    warnings.push("Max Beds must be a number — will be ignored");
  }
  if (row.minBaths !== undefined && row.minBaths !== null && isNaN(Number(row.minBaths))) {
    warnings.push("Min Baths must be a number — will be ignored");
  }
  if (row.maxBaths !== undefined && row.maxBaths !== null && isNaN(Number(row.maxBaths))) {
    warnings.push("Max Baths must be a number — will be ignored");
  }
  if (row.minPrice !== undefined && row.minPrice !== null && isNaN(Number(row.minPrice))) {
    warnings.push("Min Price must be a number — will be ignored");
  }
  if (row.maxPrice !== undefined && row.maxPrice !== null && isNaN(Number(row.maxPrice))) {
    warnings.push("Max Price must be a number — will be ignored");
  }
  if (row.maxRepairCost !== undefined && row.maxRepairCost !== null && isNaN(Number(row.maxRepairCost))) {
    warnings.push("Max Repair Cost must be a number — will be ignored");
  }

  return { errors, warnings };
}

/**
 * Validate all rows and check for duplicates against existing database
 */
export async function validateBuyerImport(rows: BuyerImportRow[]): Promise<RowValidation[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get existing emails for duplicate check
  const existingBuyers = await db.select({ email: buyers.email }).from(buyers);
  const existingEmails = new Set(existingBuyers.map(b => b.email.toLowerCase()));

  // Also check for duplicates within the import file itself
  const seenEmails = new Set<string>();

  const validations: RowValidation[] = rows.map((row, index) => {
    const { errors, warnings } = validateRow(row, index + 2); // +2 for header row + 1-indexed
    const email = row.email?.trim().toLowerCase() || "";

    let isDuplicate = false;
    if (email) {
      if (existingEmails.has(email)) {
        isDuplicate = true;
        warnings.push(`Email "${row.email}" already exists in database — will be skipped`);
      } else if (seenEmails.has(email)) {
        isDuplicate = true;
        warnings.push(`Duplicate email "${row.email}" within this file — only first occurrence will be imported`);
      }
      seenEmails.add(email);
    }

    return {
      row: index + 2, // Excel row number (1-indexed + header)
      data: row,
      valid: errors.length === 0,
      errors,
      warnings,
      isDuplicate,
    };
  });

  return validations;
}

/**
 * Parse comma-separated string into array, trimming whitespace
 */
function parseCommaSeparated(value?: string): string[] | null {
  if (!value || value.trim() === "") return null;
  return value.split(",").map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Import validated buyers into the database in batch
 */
export async function importBuyersBatch(rows: BuyerImportRow[], skipDuplicates: boolean = true): Promise<ImportResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // First validate
  const validations = await validateBuyerImport(rows);

  const result: ImportResult = {
    success: true,
    totalRows: rows.length,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  for (const validation of validations) {
    // Skip invalid rows
    if (!validation.valid) {
      result.errors.push({
        row: validation.row,
        message: validation.errors.join("; "),
      });
      result.skipped++;
      continue;
    }

    // Skip duplicates if requested
    if (validation.isDuplicate && skipDuplicates) {
      result.duplicates++;
      result.skipped++;
      continue;
    }

    try {
      const row = validation.data;
      const status = VALID_STATUSES.includes(row.status || "") ? row.status : "Active";

      // Insert buyer
      const buyerResult = await db.insert(buyers).values({
        name: row.name.trim(),
        email: row.email.trim(),
        phone: row.phone?.trim() || null,
        company: row.company?.trim() || null,
        status: status as any,
        notes: row.notes?.trim() || null,
      });

      const buyerId = (buyerResult as any)[0]?.insertId;

      // Insert preferences if any preference field is provided
      const states = parseCommaSeparated(row.preferredStates);
      const cities = parseCommaSeparated(row.preferredCities);
      const zipcodes = parseCommaSeparated(row.preferredZipcodes);
      const propertyTypes = parseCommaSeparated(row.propertyTypes);
      const minBeds = !isNaN(Number(row.minBeds)) ? Number(row.minBeds) : null;
      const maxBeds = !isNaN(Number(row.maxBeds)) ? Number(row.maxBeds) : null;
      const minBaths = !isNaN(Number(row.minBaths)) ? Number(row.minBaths) : null;
      const maxBaths = !isNaN(Number(row.maxBaths)) ? Number(row.maxBaths) : null;
      const minPrice = !isNaN(Number(row.minPrice)) ? Number(row.minPrice) : null;
      const maxPrice = !isNaN(Number(row.maxPrice)) ? Number(row.maxPrice) : null;
      const maxRepairCost = !isNaN(Number(row.maxRepairCost)) ? Number(row.maxRepairCost) : null;

      const hasPreferences = states || cities || zipcodes || propertyTypes ||
        minBeds !== null || maxBeds !== null || minBaths !== null || maxBaths !== null ||
        minPrice !== null || maxPrice !== null || maxRepairCost !== null;

      if (hasPreferences && buyerId) {
        await db.insert(buyerPreferences).values({
          buyerId,
          states: states ? JSON.stringify(states) : null,
          cities: cities ? JSON.stringify(cities) : null,
          zipcodes: zipcodes ? JSON.stringify(zipcodes) : null,
          propertyTypes: propertyTypes ? JSON.stringify(propertyTypes) : null,
          minBeds,
          maxBeds,
          minBaths: minBaths?.toString() ?? null,
          maxBaths: maxBaths?.toString() ?? null,
          minPrice,
          maxPrice,
          maxRepairCost,
        });
      }

      result.imported++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      // Check for duplicate key error
      if (errMsg.includes("Duplicate entry") || errMsg.includes("ER_DUP_ENTRY")) {
        result.duplicates++;
        result.skipped++;
      } else {
        result.errors.push({
          row: validation.row,
          message: errMsg,
        });
        result.skipped++;
      }
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Generate the expected column headers for the Excel template
 */
export function getTemplateColumns(): { key: string; label: string; required: boolean; description: string }[] {
  return [
    { key: "name", label: "Name", required: true, description: "Full name of the buyer (required)" },
    { key: "email", label: "Email", required: true, description: "Email address (required, must be unique)" },
    { key: "phone", label: "Phone", required: false, description: "Phone number" },
    { key: "company", label: "Company", required: false, description: "Company name" },
    { key: "status", label: "Status", required: false, description: "Active, Inactive, Verified, or Blacklisted (defaults to Active)" },
    { key: "notes", label: "Notes", required: false, description: "Additional notes about the buyer" },
    { key: "preferredStates", label: "Preferred States", required: false, description: "Comma-separated state codes (e.g., FL, TX, CA)" },
    { key: "preferredCities", label: "Preferred Cities", required: false, description: "Comma-separated city names (e.g., Miami, Fort Lauderdale)" },
    { key: "preferredZipcodes", label: "Preferred Zipcodes", required: false, description: "Comma-separated zip codes (e.g., 33063, 33023)" },
    { key: "propertyTypes", label: "Property Types", required: false, description: "Comma-separated types (e.g., Single Family, Multi-Family, Condo)" },
    { key: "minBeds", label: "Min Beds", required: false, description: "Minimum number of bedrooms" },
    { key: "maxBeds", label: "Max Beds", required: false, description: "Maximum number of bedrooms" },
    { key: "minBaths", label: "Min Baths", required: false, description: "Minimum number of bathrooms" },
    { key: "maxBaths", label: "Max Baths", required: false, description: "Maximum number of bathrooms" },
    { key: "minPrice", label: "Min Price", required: false, description: "Minimum property price (numbers only, no $ or commas)" },
    { key: "maxPrice", label: "Max Price", required: false, description: "Maximum property price (numbers only, no $ or commas)" },
    { key: "maxRepairCost", label: "Max Repair Cost", required: false, description: "Maximum acceptable repair cost (numbers only)" },
  ];
}
