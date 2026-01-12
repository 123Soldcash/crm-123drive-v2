/**
 * DealMachine Field Mapper
 * Maps all 328 DealMachine columns to CRM database fields
 * Handles type conversions and stores unmapped fields in JSON
 */

export interface DealMachineRow {
  [key: string]: any;
}

export interface MappedProperty {
  // Address
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zipcode: string;
  
  // Basic info
  leadId?: number | null;
  propertyId?: string | null;
  dealMachinePropertyId?: string | null;
  dealMachineLeadId?: string | null;
  
  // Owner info
  owner1Name?: string | null;
  owner2Name?: string | null;
  
  // Property details
  propertyType?: string | null;
  totalBedrooms?: number | null;
  totalBaths?: number | null;
  buildingSquareFeet?: number | null;
  yearBuilt?: number | null;
  constructionType?: string | null;
  
  // Financial
  estimatedValue?: number | null;
  equityAmount?: number | null;
  equityPercent?: number | null;
  salePrice?: number | null;
  saleDate?: Date | null;
  mortgageAmount?: number | null;
  totalLoanBalance?: number | null;
  totalLoanPayment?: number | null;
  estimatedRepairCost?: number | null;
  taxYear?: number | null;
  taxAmount?: number | null;
  
  // Additional
  subdivisionName?: string | null;
  status?: string | null;
  marketStatus?: string | null;
  ownerLocation?: string | null;
  apnParcelId?: string | null;
  taxDelinquent?: string | null;
  taxDelinquentYear?: number | null;
  
  // DealMachine raw data (for unmapped fields)
  dealMachineRawData?: string | null;
}

export interface MappedContact {
  name: string;
  flags?: string | null;
  phone1?: string | null;
  phone1Type?: string | null;
  phone2?: string | null;
  phone2Type?: string | null;
  phone3?: string | null;
  phone3Type?: string | null;
  email1?: string | null;
  email2?: string | null;
  email3?: string | null;
}

/**
 * Helper to safely get value from row (handles both naming formats)
 */
function getValue(row: DealMachineRow, ...keys: string[]): any {
  for (const key of keys) {
    if (key in row && row[key] !== null && row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

/**
 * Parse date safely
 */
function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parse number safely
 */
function parseNumber(value: any): number | null {
  if (!value && value !== 0) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse boolean safely
 */
function parseBoolean(value: any): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase();
  return str === "true" || str === "1" || str === "yes";
}

/**
 * Map a DealMachine row to CRM property and contacts
 */
export function mapDealMachineRow(row: DealMachineRow): {
  property: MappedProperty;
  contacts: MappedContact[];
  unmappedFields: Record<string, any>;
} {
  const unmappedFields: Record<string, any> = {};
  const mappedKeys = new Set<string>();

  // Helper to track mapped fields
  const track = (...keys: string[]) => keys.forEach(k => mappedKeys.add(k.toLowerCase()));

  // Required address fields
  const addressLine1 = getValue(row, "addressLine1", "property_address_line_1", "Address");
  const city = getValue(row, "city", "property_address_city", "City");
  const state = getValue(row, "state", "property_address_state", "State");
  const zipcode = getValue(row, "zipcode", "property_address_zipcode", "Zipcode");

  track("addressLine1", "property_address_line_1", "Address", "city", "property_address_city", "City", "state", "property_address_state", "State", "zipcode", "property_address_zipcode", "Zipcode");

  if (!addressLine1 || !city || !state || !zipcode) {
    throw new Error("Missing required fields: addressLine1, city, state, zipcode");
  }

  // Basic info
  const propertyId = getValue(row, "propertyId", "property_id", "dealMachinePropertyId");
  const leadId = parseNumber(getValue(row, "leadId", "lead_id"));
  const dealMachinePropertyId = getValue(row, "dealMachinePropertyId", "property_id");
  const dealMachineLeadId = getValue(row, "dealMachineLeadId", "lead_id");

  track("propertyId", "property_id", "dealMachinePropertyId", "leadId", "lead_id", "dealMachineLeadId");

  // Owner info
  const owner1Name = getValue(row, "owner1Name", "owner_1_name");
  const owner2Name = getValue(row, "owner2Name", "owner_2_name");

  track("owner1Name", "owner_1_name", "owner2Name", "owner_2_name");

  // Property details
  const propertyType = getValue(row, "propertyType", "property_type");
  const totalBedrooms = parseNumber(getValue(row, "totalBedrooms", "beds", "total_bedrooms"));
  const totalBaths = parseNumber(getValue(row, "totalBaths", "baths", "total_baths"));
  const buildingSquareFeet = parseNumber(getValue(row, "buildingSquareFeet", "sqft", "building_square_feet"));
  const yearBuilt = parseNumber(getValue(row, "yearBuilt", "year_built"));
  const constructionType = getValue(row, "constructionType", "construction_type");

  track("propertyType", "property_type", "totalBedrooms", "beds", "total_bedrooms", "totalBaths", "baths", "total_baths", "buildingSquareFeet", "sqft", "building_square_feet", "yearBuilt", "year_built", "constructionType", "construction_type");

  // Financial
  const estimatedValue = parseNumber(getValue(row, "estimatedValue", "estimated_value"));
  const equityAmount = parseNumber(getValue(row, "equityAmount", "equity_amount"));
  const equityPercent = parseNumber(getValue(row, "equityPercent", "equity_percent"));
  const salePrice = parseNumber(getValue(row, "salePrice", "sale_price"));
  const saleDate = parseDate(getValue(row, "saleDate", "sale_date"));
  const mortgageAmount = parseNumber(getValue(row, "mortgageAmount", "mortgage_amount", "total_loan_amt"));
  const totalLoanBalance = parseNumber(getValue(row, "totalLoanBalance", "total_loan_balance", "mtg1EstLoanBalance"));
  const totalLoanPayment = parseNumber(getValue(row, "totalLoanPayment", "total_loan_payment", "mtg1EstPaymentAmount"));
  const taxYear = parseNumber(getValue(row, "taxYear", "tax_year"));
  const taxAmount = parseNumber(getValue(row, "taxAmount", "tax_amt", "tax_amount"));

  track("estimatedValue", "estimated_value", "equityAmount", "equity_amount", "equityPercent", "equity_percent", "salePrice", "sale_price", "saleDate", "sale_date", "mortgageAmount", "mortgage_amount", "total_loan_amt", "totalLoanBalance", "total_loan_balance", "mtg1EstLoanBalance", "totalLoanPayment", "total_loan_payment", "mtg1EstPaymentAmount", "taxYear", "tax_year", "taxAmount", "tax_amt", "tax_amount");

  // Additional
  const subdivisionName = getValue(row, "subdivisionName", "subdivision_name");
  const status = getValue(row, "status", "lead_status", "market_status");
  const marketStatus = getValue(row, "marketStatus", "market_status");
  const ownerLocation = getValue(row, "ownerLocation", "owner_location");
  const apnParcelId = getValue(row, "apnParcelId", "apn_parcel_id");
  const taxDelinquent = getValue(row, "taxDelinquent", "tax_delinquent");
  const taxDelinquentYear = parseNumber(getValue(row, "taxDelinquentYear", "tax_delinquent_year"));

  track("subdivisionName", "subdivision_name", "status", "lead_status", "market_status", "marketStatus", "ownerLocation", "owner_location", "apnParcelId", "apn_parcel_id", "taxDelinquent", "tax_delinquent", "taxDelinquentYear", "tax_delinquent_year");

  // Address line 2
  const addressLine2 = getValue(row, "addressLine2", "property_address_line_2");
  track("addressLine2", "property_address_line_2");

  // Build property object
  const property: MappedProperty = {
    addressLine1: String(addressLine1).trim(),
    addressLine2: addressLine2 ? String(addressLine2).trim() : null,
    city: String(city).trim(),
    state: String(state).trim(),
    zipcode: String(zipcode).trim(),
    leadId: leadId,
    propertyId: propertyId ? String(propertyId) : null,
    dealMachinePropertyId: dealMachinePropertyId ? String(dealMachinePropertyId) : null,
    dealMachineLeadId: dealMachineLeadId ? String(dealMachineLeadId) : null,
    owner1Name: owner1Name ? String(owner1Name).trim() : null,
    owner2Name: owner2Name ? String(owner2Name).trim() : null,
    propertyType: propertyType ? String(propertyType).trim() : null,
    totalBedrooms: totalBedrooms,
    totalBaths: totalBaths,
    buildingSquareFeet: buildingSquareFeet,
    yearBuilt: yearBuilt,
    constructionType: constructionType ? String(constructionType).trim() : null,
    estimatedValue: estimatedValue,
    equityAmount: equityAmount,
    equityPercent: equityPercent,
    salePrice: salePrice,
    saleDate: saleDate,
    mortgageAmount: mortgageAmount,
    totalLoanBalance: totalLoanBalance,
    totalLoanPayment: totalLoanPayment,
    taxYear: taxYear,
    taxAmount: taxAmount,
    subdivisionName: subdivisionName ? String(subdivisionName).trim() : null,
    status: status ? String(status).trim() : null,
    marketStatus: marketStatus ? String(marketStatus).trim() : null,
    ownerLocation: ownerLocation ? String(ownerLocation).trim() : null,
    apnParcelId: apnParcelId ? String(apnParcelId).trim() : null,
    taxDelinquent: taxDelinquent ? String(taxDelinquent).trim() : null,
    taxDelinquentYear: taxDelinquentYear,
  };

  // Extract contacts (1-14)
  const contacts: MappedContact[] = [];
  for (let i = 1; i <= 14; i++) {
    const contactName = getValue(row, `contact_${i}_name`, `contact${i}_name`);
    if (!contactName) continue;

    track(`contact_${i}_name`, `contact${i}_name`);

    const contact: MappedContact = {
      name: String(contactName).trim(),
      flags: getValue(row, `contact_${i}_flags`, `contact${i}_flags`),
      phone1: getValue(row, `contact_${i}_phone1`, `contact${i}_phone1`),
      phone1Type: getValue(row, `contact_${i}_phone1_type`, `contact${i}_phone1Type`),
      phone2: getValue(row, `contact_${i}_phone2`, `contact${i}_phone2`),
      phone2Type: getValue(row, `contact_${i}_phone2_type`, `contact${i}_phone2Type`),
      phone3: getValue(row, `contact_${i}_phone3`, `contact${i}_phone3`),
      phone3Type: getValue(row, `contact_${i}_phone3_type`, `contact${i}_phone3Type`),
      email1: getValue(row, `contact_${i}_email1`, `contact${i}_email1`),
      email2: getValue(row, `contact_${i}_email2`, `contact${i}_email2`),
      email3: getValue(row, `contact_${i}_email3`, `contact${i}_email3`),
    };

    track(`contact_${i}_flags`, `contact${i}_flags`, `contact_${i}_phone1`, `contact${i}_phone1`, `contact_${i}_phone1_type`, `contact${i}_phone1Type`, `contact_${i}_phone2`, `contact${i}_phone2`, `contact_${i}_phone2_type`, `contact${i}_phone2Type`, `contact_${i}_phone3`, `contact${i}_phone3`, `contact_${i}_phone3_type`, `contact${i}_phone3Type`, `contact_${i}_email1`, `contact${i}_email1`, `contact_${i}_email2`, `contact${i}_email2`, `contact_${i}_email3`, `contact${i}_email3`);

    contacts.push(contact);
  }

  // Collect unmapped fields
  for (const [key, value] of Object.entries(row)) {
    if (!mappedKeys.has(key.toLowerCase()) && value !== null && value !== undefined && value !== "") {
      unmappedFields[key] = value;
    }
  }

  // Store unmapped fields as JSON
  if (Object.keys(unmappedFields).length > 0) {
    property.dealMachineRawData = JSON.stringify(unmappedFields);
  }

  return { property, contacts, unmappedFields };
}

/**
 * Validate mapped property has required fields
 */
export function validateProperty(property: MappedProperty): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!property.addressLine1 || !property.addressLine1.trim()) {
    errors.push("addressLine1 is required");
  }
  if (!property.city || !property.city.trim()) {
    errors.push("city is required");
  }
  if (!property.state || !property.state.trim()) {
    errors.push("state is required");
  }
  if (!property.zipcode || !property.zipcode.trim()) {
    errors.push("zipcode is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
