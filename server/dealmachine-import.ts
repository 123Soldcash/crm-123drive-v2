/**
 * DealMachine CSV Import Utilities - Consolidated Format
 * Handles properties with embedded contacts (contact_1 through contact_14)
 * Following dealmachine-properties-MAP.xlsx field mappings
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
  equityAmount?: number;
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

export interface PropertyWithContacts {
  property: ParsedProperty;
  contacts: ParsedContact[];
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
 * Map contact flags to relationship field
 * Multiple flags can be present (e.g., "Owner, Resident, Likely")
 * Priority: Owner > Resident > Family > Potential > Renting > Likely > Other
 */
function mapFlagsToRelationship(flags?: string): string {
  if (!flags) return "Owner"; // Default to Owner

  const flagList = flags
    .split(",")
    .map(f => f.trim().toLowerCase())
    .filter(f => f);

  // Priority order
  const priorities = [
    "owner",
    "resident",
    "family",
    "potential",
    "renting",
    "likely",
  ];

  for (const priority of priorities) {
    if (flagList.includes(priority)) {
      // Capitalize first letter
      return priority.charAt(0).toUpperCase() + priority.slice(1);
    }
  }

  return "Owner"; // Default fallback
}

/**
 * Transform DealMachine property row to our schema
 * Following dealmachine-properties-MAP.xlsx field mappings
 */
export function transformProperty(row: DealMachinePropertyRow): ParsedProperty | null {
  // Required fields (from MAP: PROPERTY ADDRESS section)
  const addressLine1 = row["property_address_line_1"];
  const city = row["property_address_city"];
  let state = row["property_address_state"];
  let zipcode = row["property_address_zipcode"];

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
    addressLine2: truncate(row["property_address_line_2"], 255),
    city: truncate(city, 100) || city,
    state,
    zipcode,
    owner1Name: truncate(row["owner_1_name"], 255),
    propertyType: truncate(row["property_type"], 100),
    yearBuilt: parseInteger(row["year_built"]),
    totalBedrooms: parseInteger(row["total_bedrooms"]),
    totalBaths: parseInteger(row["total_baths"]),
    buildingSquareFeet: parseInteger(row["building_square_feet"]),
    estimatedValue: parseCurrency(row["estimated_value"]),
    equityAmount: parseCurrency(row["equity_amount"]),
    equityPercent: parsePercentage(row["equity_percent"]),
    mortgageAmount: parseCurrency(row["total_loan_amt"]), // MAP: "Mortgage" field
    taxAmount: parseCurrency(row["tax_amt"]),
    marketStatus: truncate(row["lead_status"], 100), // MAP: "Add on the notes of the lead"
    dealMachinePropertyId: truncate(row["property_id"], 100),
    dealMachineLeadId: truncate(row["lead_id"], 100),
    dealMachineRawData: JSON.stringify(rawData),
  };
}

/**
 * Extract all contacts from a property row (contact_1 through contact_14)
 * Each contact can have up to 3 phones and 3 emails
 */
export function extractContactsFromProperty(
  row: DealMachinePropertyRow
): ParsedContact[] {
  const contacts: ParsedContact[] = [];

  // Check each contact slot (contact_1 through contact_14)
  for (let contactNum = 1; contactNum <= 14; contactNum++) {
    const contactNameField = `contact_${contactNum}_name`;
    const contactName = row[contactNameField]?.trim();

    if (!contactName) {
      continue; // Skip empty contact slots
    }

    // Get contact flags for relationship mapping
    const contactFlagsField = `contact_${contactNum}_flags`;
    const contactFlags = row[contactFlagsField]?.trim();
    const relationship = mapFlagsToRelationship(contactFlags);

    // Get primary phone (contact_N_phone1)
    const phone1Field = `contact_${contactNum}_phone1`;
    const phone1 = row[phone1Field]?.trim();
    const phone1TypeField = `contact_${contactNum}_phone1_type`;
    const phone1Type = row[phone1TypeField]?.trim() || "Mobile";

    // Get primary email (contact_N_email1)
    const email1Field = `contact_${contactNum}_email1`;
    const email1 = row[email1Field]?.trim();

    // Store all raw contact data
    const rawData: any = {};
    for (let phoneNum = 1; phoneNum <= 3; phoneNum++) {
      const phoneField = `contact_${contactNum}_phone${phoneNum}`;
      const phoneTypeField = `contact_${contactNum}_phone${phoneNum}_type`;
      if (row[phoneField]) {
        rawData[phoneField] = row[phoneField];
        rawData[phoneTypeField] = row[phoneTypeField];
      }
    }
    for (let emailNum = 1; emailNum <= 3; emailNum++) {
      const emailField = `contact_${contactNum}_email${emailNum}`;
      if (row[emailField]) {
        rawData[emailField] = row[emailField];
      }
    }

    // Create contact record with primary phone and email
    const contact: ParsedContact = {
      name: contactName,
      phone: phone1,
      phoneType: phone1Type,
      dnc: false, // Default to false, can be updated later
      email: email1,
      relationship,
      flags: contactFlags,
      dealMachineRawData: JSON.stringify(rawData),
    };

    contacts.push(contact);
  }

  return contacts;
}

/**
 * Transform property row with all embedded contacts
 */
export function transformPropertyWithContacts(
  row: DealMachinePropertyRow
): PropertyWithContacts | null {
  const property = transformProperty(row);
  if (!property) {
    return null;
  }

  const contacts = extractContactsFromProperty(row);

  return {
    property,
    contacts,
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
