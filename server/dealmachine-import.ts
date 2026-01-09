/**
 * DealMachine CSV Import Utilities
 * Simple, robust CSV parsing and data transformation
 */

export interface DealMachinePropertyRow {
  [key: string]: string;
}

export interface ParsedProperty {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  owner1Name?: string;
  propertyType?: string;
  yearBuilt?: number;
  totalBedrooms?: number;
  totalBaths?: number;
  buildingSquareFeet?: number;
  estimatedValue?: number;
  equityPercent?: number;
  mortgageAmount?: number;
  taxAmount?: number;
  marketStatus?: string;
  dealMachinePropertyId?: string;
  dealMachineLeadId?: string;
  dealMachineRawData: string; // JSON string with all extra fields
}

export interface ParsedContact {
  name: string;
  phone?: string;
  phoneType?: string;
  dnc: boolean;
  email?: string;
  relationship: string;
  flags?: string;
  dealMachineRawData: string; // JSON string with all extra fields
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvContent: string): DealMachinePropertyRow[] {
  const lines = csvContent.split("\n").filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: DealMachinePropertyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: DealMachinePropertyRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Helper functions for parsing values
 */
function parseCurrency(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

function parsePercentage(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/%/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : Math.round(num);
}

function parseBoolean(value?: string): boolean {
  if (!value) return false;
  return value.toLowerCase() === "yes" || value === "1";
}

function parseInteger(value?: string): number | undefined {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Transform DealMachine property row to our schema
 */
export function transformProperty(row: DealMachinePropertyRow): ParsedProperty | null {
  // Required fields
  const addressLine1 = row["property_address_line_1"] || row["address_line_1"];
  const city = row["property_address_city"] || row["city"];
  let state = row["property_address_state"] || row["state"];
  let zipcode = row["property_address_zipcode"] || row["zipcode"];
  
  // Ensure state is max 2 characters (state abbreviation)
  if (state) {
    state = state.substring(0, 2).toUpperCase();
  }
  
  // Ensure zipcode is max 10 characters
  if (zipcode) {
    zipcode = zipcode.substring(0, 10);
  }

  if (!addressLine1 || !city || !state || !zipcode) {
    return null; // Skip invalid rows
  }

  // Store all raw data for reference
  const rawData = { ...row };
  
  // Helper to truncate strings to max length
  const truncate = (str: string | undefined, maxLen: number): string | undefined => {
    return str ? str.substring(0, maxLen) : str;
  };

  return {
    addressLine1: truncate(addressLine1, 255) || addressLine1,
    addressLine2: truncate(row["property_address_line_2"] || row["address_line_2"], 255),
    city: truncate(city, 100) || city,
    state,
    zipcode,
    owner1Name: truncate(row["owner_1_name"] || row["owner_name"], 255),
    propertyType: truncate(row["property_type"], 100),
    yearBuilt: parseInteger(row["year_built"]),
    totalBedrooms: parseInteger(row["total_bedrooms"]),
    totalBaths: parseInteger(row["total_baths"]),
    buildingSquareFeet: parseInteger(row["building_square_feet"]),
    estimatedValue: parseCurrency(row["estimated_value"]),
    equityPercent: parsePercentage(row["equity_percent"]),
    mortgageAmount: parseCurrency(row["total_loan_balance"]),
    taxAmount: parseCurrency(row["tax_amt"]),
    marketStatus: truncate(row["market_status"] || row["lead_status"], 100),
    dealMachinePropertyId: truncate(row["property_id"], 100),
    dealMachineLeadId: truncate(row["lead_id"], 100),
    dealMachineRawData: JSON.stringify(rawData),
  };
}

/**
 * Transform DealMachine contact row to our schema
 */
export function transformContact(row: DealMachinePropertyRow): ParsedContact | null {
  const firstName = row["first_name"] || "";
  const lastName = row["last_name"] || "";
  const name = `${firstName} ${lastName}`.trim();

  if (!name) {
    return null; // Skip if no name
  }

  // Store all raw data for reference
  const rawData = { ...row };

  return {
    name,
    phone: row["phone_1"] || row["phone"],
    phoneType: row["phone_1_type"] || "Mobile",
    dnc: parseBoolean(row["phone_1_do_not_call"]),
    email: row["email_address_1"] || row["email"],
    relationship: "Owner",
    flags: row["contact_flags"] || "",
    dealMachineRawData: JSON.stringify(rawData),
  };
}

/**
 * Validate parsed property for required fields
 */
export function validateProperty(prop: ParsedProperty): string[] {
  const errors: string[] = [];

  if (!prop.addressLine1) errors.push("Missing address");
  if (!prop.city) errors.push("Missing city");
  if (!prop.state) errors.push("Missing state");
  if (!prop.zipcode) errors.push("Missing zipcode");

  return errors;
}

/**
 * Create a unique key for duplicate detection
 */
export function getPropertyKey(prop: ParsedProperty): string {
  return `${prop.addressLine1}|${prop.city}|${prop.state}|${prop.zipcode}`.toLowerCase();
}
