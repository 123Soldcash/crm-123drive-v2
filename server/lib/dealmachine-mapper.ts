/**
 * DealMachine Field Mapper
 * Maps DealMachine Excel columns (snake_case) to CRM database fields (camelCase)
 * File structure: 14 property fields + 14 contacts with 8 fields each (112 contact fields)
 * Total: 126 columns
 */

export interface DealMachineRow {
  [key: string]: any;
}

export interface MappedProperty {
  propertyId: string;
  leadId: string;
  addressFull: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  county?: string;
  lat?: number;
  lng?: number;
  ownerName?: string;
  dealMachineUrl?: string;
  propertyFlags?: string;
  propertyType?: string;
  totalBedrooms?: number;
  totalBaths?: number;
  buildingSquareFeet?: number;
  yearBuilt?: number;
  estimatedValue?: number;
  equityAmount?: number;
  equityPercent?: number;
  salePrice?: number;
  saleDate?: Date;
  taxAmount?: number;
  contacts: MappedContact[];
}

export interface MappedContact {
  name: string;
  flags?: string;
  phones: string[];
  emails: string[];
}

/**
 * Maps DealMachine row to CRM property format
 */
export function mapDealMachineRow(row: DealMachineRow): MappedProperty {
  const parseNumber = (val: any): number | undefined => {
    if (!val) return undefined;
    const num = parseInt(String(val), 10);
    return isNaN(num) ? undefined : num;
  };

  const parseFloat2 = (val: any): number | undefined => {
    if (!val) return undefined;
    const num = parseFloat(String(val));
    return isNaN(num) ? undefined : num;
  };

  const parseDate = (val: any): Date | undefined => {
    if (!val) return undefined;
    const date = new Date(String(val));
    return isNaN(date.getTime()) ? undefined : date;
  };

  const property: MappedProperty = {
    propertyId: String(row.property_id || ""),
    leadId: String(row.lead_id || ""),
    addressFull: row.property_address_full || "",
    addressLine1: row.property_address_line_1 || "",
    addressLine2: row.property_address_line_2,
    city: row.property_address_city || "",
    state: row.property_address_state || "",
    zipcode: row.property_address_zip_code || row.property_address_zipcode || "",
    county: row.property_address_county,
    lat: row.property_lat ? parseFloat2(row.property_lat) : undefined,
    lng: row.property_lng ? parseFloat2(row.property_lng) : undefined,
    ownerName: row.owner_1_name,
    dealMachineUrl: row.dealmachine_url,
    propertyFlags: row.property_flags,
    propertyType: row.property_type,
    totalBedrooms: parseNumber(row.property_bedrooms),
    totalBaths: parseNumber(row.property_bathrooms),
    buildingSquareFeet: parseNumber(row.property_square_feet),
    yearBuilt: parseNumber(row.property_year_built),
    estimatedValue: parseNumber(row.property_estimated_value),
    equityAmount: parseNumber(row.property_equity_amount),
    equityPercent: parseNumber(row.property_equity_percent),
    salePrice: parseNumber(row.property_sale_price),
    saleDate: parseDate(row.property_sale_date),
    taxAmount: parseNumber(row.property_tax_amount),
    contacts: [],
  };

  // Extract contacts (up to 14)
  for (let i = 1; i <= 14; i++) {
    const contactName = row[`contact_${i}_name`];
    if (contactName && contactName.trim()) {
      const contact: MappedContact = {
        name: contactName.trim(),
        flags: row[`contact_${i}_flags`],
        phones: [],
        emails: [],
      };

      // Extract phones (up to 3)
      for (let j = 1; j <= 3; j++) {
        const phone = row[`contact_${i}_phone_${j}`] || row[`contact_${i}_phone${j}`];
        if (phone && phone.trim()) {
          contact.phones.push(phone.trim());
        }
      }

      // Extract emails (up to 3)
      for (let j = 1; j <= 3; j++) {
        const email = row[`contact_${i}_email_${j}`] || row[`contact_${i}_email${j}`];
        if (email && email.trim()) {
          contact.emails.push(email.trim());
        }
      }

      property.contacts.push(contact);
    }
  }

  return property;
}

/**
 * Validates required fields for import
 */
export function validateProperty(property: MappedProperty): string[] {
  const errors: string[] = [];

  if (!property.addressLine1 || !property.addressLine1.trim()) {
    errors.push("Address Line 1 is required");
  }
  if (!property.city || !property.city.trim()) {
    errors.push("City is required");
  }
  if (!property.state || !property.state.trim()) {
    errors.push("State is required");
  }
  if (!property.zipcode || !property.zipcode.trim()) {
    errors.push("Zipcode is required");
  }

  return errors;
}

/**
 * Parses contact flags to determine relationship type
 * DealMachine flags: "DNC" (Do Not Call), "Litigator", "Deceased", etc.
 */
export function parseContactFlags(flags?: string | null): {
  isDNC: boolean;
  isLitigator: boolean;
  isDeceased: boolean;
} {
  if (!flags) {
    return {
      isDNC: false,
      isLitigator: false,
      isDeceased: false,
    };
  }
  const flagStr = String(flags).toLowerCase();
  return {
    isDNC: flagStr.includes("dnc"),
    isLitigator: flagStr.includes("litigator"),
    isDeceased: flagStr.includes("deceased"),
  };
}

/**
 * Converts DealMachine contact flags to CRM relationship type
 */
export function getRelationshipType(flags?: string | null): string {
  if (!flags) return "Contact";
  const flagStr = String(flags).toUpperCase();

  if (flagStr.includes("OWNER")) return "Owner";
  if (flagStr.includes("SPOUSE")) return "Spouse";
  if (flagStr.includes("TENANT")) return "Tenant";
  if (flagStr.includes("DECEASED")) return "Deceased";
  if (flagStr.includes("LITIGATOR")) return "Litigator";
  if (flagStr.includes("DECISION MAKER")) return "Decision Maker";
  if (flagStr.includes("CURRENT RESIDENT")) return "Current Resident";

  return "Contact"; // Default
}
