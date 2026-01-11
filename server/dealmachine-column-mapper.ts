/**
 * DealMachine Column Name Mapper
 * 
 * Converts actual DealMachine export column names to CRM database field names.
 * Handles variations like property_address_* prefix and other naming differences.
 */

export function mapDealMachineColumns(row: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {};

  // Helper to safely get value from row
  const get = (key: string) => row[key];

  // Property ID
  mapped.propertyId = get("property_id");
  mapped.leadId = get("lead_id");

  // Address fields
  mapped.addressLine1 = get("property_address_line_1");
  mapped.addressLine2 = get("property_address_line_2");
  mapped.city = get("property_address_city");
  mapped.state = get("property_address_state");
  mapped.zipcode = get("property_address_zipcode");
  mapped.county = get("property_address_county");
  mapped.latitude = get("property_lat");
  mapped.longitude = get("property_lng");

  // Owner 1
  mapped.owner1Name = get("owner_1_name");
  mapped.owner1Address = get("owner_1_address");
  mapped.owner1City = get("owner_1_city");
  mapped.owner1State = get("owner_1_state");
  mapped.owner1Zipcode = get("owner_1_zipcode");

  // Owner 2
  mapped.owner2Name = get("owner_2_name");
  mapped.owner2Address = get("owner_2_address");
  mapped.owner2City = get("owner_2_city");
  mapped.owner2State = get("owner_2_state");
  mapped.owner2Zipcode = get("owner_2_zipcode");

  // Mailing address
  mapped.mailingAddressLine1 = get("mailing_address_line_1");
  mapped.mailingAddressLine2 = get("mailing_address_line_2");
  mapped.mailingCity = get("mailing_city");
  mapped.mailingState = get("mailing_state");
  mapped.mailingZipcode = get("mailing_zipcode");

  // Property details
  mapped.propertyType = get("property_type");
  mapped.beds = get("beds");
  mapped.baths = get("baths");
  mapped.sqft = get("sqft");
  mapped.lotSqft = get("lot_sqft");
  mapped.yearBuilt = get("year_built");
  mapped.propertyCondition = get("property_condition");
  mapped.roofAge = get("roof_age");
  mapped.roofType = get("roof_type");
  mapped.acAge = get("ac_age");
  mapped.acType = get("ac_type");
  mapped.foundationType = get("foundation_type");
  mapped.pool = get("pool");
  mapped.garageType = get("garage_type");
  mapped.garageSpaces = get("garage_spaces");
  mapped.stories = get("stories");
  mapped.hoaFee = get("hoa_fee");

  // Financial info
  mapped.propertyTaxAmount = get("property_tax_amount");
  mapped.estimatedValue = get("estimated_value");
  mapped.equityAmount = get("equity_amount");
  mapped.equityPercent = get("equity_percent");
  mapped.daysOnMarket = get("days_on_market");
  mapped.lastSaleDate = get("last_sale_date");
  mapped.lastSalePrice = get("last_sale_price");
  mapped.occupancyStatus = get("occupancy_status");
  mapped.mlsStatus = get("mls_status");
  mapped.leaseType = get("lease_type");

  // Mortgage 1
  mapped.mtg1Lender = get("first_mortgage_lender");
  mapped.mtg1LoanAmt = get("first_mortgage_amount");
  mapped.mtg1EstLoanBalance = get("mtg1_est_loan_balance");
  mapped.mtg1EstPaymentAmount = get("mtg1_est_payment_amount");
  mapped.mtg1LoanType = get("first_mortgage_loan_type");
  mapped.mtg1TypeFinancing = get("first_mortgage_financing_type");
  mapped.mtg1EstInterestRate = get("first_mortgage_interest_rate");

  // Mortgage 2
  mapped.mtg2Lender = get("second_mortgage_lender");
  mapped.mtg2LoanAmt = get("second_mortgage_amount");
  mapped.mtg2EstLoanBalance = get("mtg2_est_loan_balance");
  mapped.mtg2EstPaymentAmount = get("mtg2_est_payment_amount");
  mapped.mtg2LoanType = get("second_mortgage_loan_type");
  mapped.mtg2TypeFinancing = get("second_mortgage_financing_type");
  mapped.mtg2EstInterestRate = get("second_mortgage_interest_rate");

  // Mortgage 3
  mapped.mtg3Lender = get("mtg3_lender");
  mapped.mtg3LoanAmt = get("mtg3_loan_amt");
  mapped.mtg3EstLoanBalance = get("mtg3_est_loan_balance");
  mapped.mtg3EstPaymentAmount = get("mtg3_est_payment_amount");
  mapped.mtg3LoanType = get("mtg3_loan_type");
  mapped.mtg3TypeFinancing = get("mtg3_type_financing");
  mapped.mtg3EstInterestRate = get("mtg3_est_interest_rate");

  // Mortgage 4
  mapped.mtg4Lender = get("mtg4_lender");
  mapped.mtg4LoanAmt = get("mtg4_loan_amt");
  mapped.mtg4EstLoanBalance = get("mtg4_est_loan_balance");
  mapped.mtg4EstPaymentAmount = get("mtg4_est_payment_amount");
  mapped.mtg4LoanType = get("mtg4_loan_type");
  mapped.mtg4TypeFinancing = get("mtg4_type_financing");
  mapped.mtg4EstInterestRate = get("mtg4_est_interest_rate");

  // HOA and references
  mapped.hoaFeeAmount = get("hoa_fee_amount");
  mapped.hoa1Name = get("h_o_a1_name");
  mapped.hoa1Type = get("h_o_a1_type");
  mapped.mail = get("mail");
  mapped.dealmachineUrl = get("dealmachine_url");

  // Notes
  mapped.notes1 = get("notes_1");
  mapped.notes2 = get("notes_2");
  mapped.notes3 = get("notes_3");
  mapped.notes4 = get("notes_4");
  mapped.notes5 = get("notes_5");

  // Facebook profiles
  mapped.facebookProfile1 = get("facebookprofile1");
  mapped.facebookProfile2 = get("facebookprofile2");
  mapped.facebookProfile3 = get("facebookprofile3");
  mapped.facebookProfile4 = get("facebookprofile4");

  // Research flags
  mapped.priority = get("priority");
  mapped.skiptraceTrue = get("skiptracetruepeoplesearch");
  mapped.calledTrue = get("calledtruepeoplesearch");
  mapped.doneWithFacebook = get("done_with_facebook");
  mapped.addressOfProperty = get("address_of_the_property");
  mapped.doneMailingOwners = get("donemailing_-_onwers");
  mapped.doneMailingRelatives = get("donemailingrelatives");
  mapped.emailOwnersInstantly = get("emailonwersinstantly.ai");
  mapped.idiSearch = get("idi_-_search");
  mapped.officialRecordsSearch = get("httpsofficialrecords.broward.orgacclaimwebsearchsearchtypename");
  mapped.countyTaxSearch = get("httpscounty-taxes.netbrowardbrowardproperty-tax");
  mapped.violationSearch = get("violationsearch");
  mapped.simpleSearch = get("httpsofficialrecords.broward.orgacclaimwebsearchsearchtypesimplesearch");
  mapped.permitSearch = get("httpsdpepp.broward.orgbcsdefault.aspxpossepresentationparcelpermitlistposseobjectid116746");
  mapped.skiptraceManus = get("skiptracemanus");
  mapped.calledManus = get("calledmanus");
  mapped.propertyFlags = get("property_flags");

  return mapped;
}

/**
 * Extract contacts from DealMachine row
 * Handles contact_N_* columns (1-14)
 */
export function extractDealMachineContacts(row: Record<string, any>) {
  const contacts = [];

  for (let i = 1; i <= 14; i++) {
    const name = row[`contact_${i}_name`];
    if (!name || !name.toString().trim()) continue;

    contacts.push({
      name: name.toString().trim(),
      flags: row[`contact_${i}_flags`],
      phone1: row[`contact_${i}_phone1`],
      phone1Type: row[`contact_${i}_phone1_type`],
      phone2: row[`contact_${i}_phone2`],
      phone2Type: row[`contact_${i}_phone2_type`],
      phone3: row[`contact_${i}_phone3`],
      phone3Type: row[`contact_${i}_phone3_type`],
      email1: row[`contact_${i}_email1`],
      email2: row[`contact_${i}_email2`],
      email3: row[`contact_${i}_email3`],
    });
  }

  return contacts;
}

/**
 * Convert string values to appropriate types
 */
export function convertTypes(mapped: Record<string, any>): Record<string, any> {
  const converted = { ...mapped };

  // Convert numbers
  const numberFields = [
    "beds", "baths", "sqft", "lotSqft", "yearBuilt", "roofAge", "acAge",
    "garageSpaces", "stories", "hoaFee", "propertyTaxAmount", "estimatedValue",
    "equityAmount", "equityPercent", "daysOnMarket", "lastSalePrice",
    "mtg1LoanAmt", "mtg1EstLoanBalance", "mtg1EstPaymentAmount", "mtg1EstInterestRate",
    "mtg2LoanAmt", "mtg2EstLoanBalance", "mtg2EstPaymentAmount", "mtg2EstInterestRate",
    "mtg3LoanAmt", "mtg3EstLoanBalance", "mtg3EstPaymentAmount", "mtg3EstInterestRate",
    "mtg4LoanAmt", "mtg4EstLoanBalance", "mtg4EstPaymentAmount", "mtg4EstInterestRate",
    "hoaFeeAmount", "latitude", "longitude",
  ];

  numberFields.forEach((field) => {
    if (converted[field] !== null && converted[field] !== undefined && converted[field] !== "") {
      converted[field] = Number(converted[field]);
    }
  });

  // Convert booleans
  const booleanFields = [
    "pool", "skiptraceTrue", "calledTrue", "doneWithFacebook",
    "doneMailingOwners", "doneMailingRelatives", "emailOwnersInstantly",
    "idiSearch", "officialRecordsSearch", "countyTaxSearch", "violationSearch",
    "simpleSearch", "permitSearch", "skiptraceManus", "calledManus",
  ];

  booleanFields.forEach((field) => {
    if (converted[field] !== null && converted[field] !== undefined && converted[field] !== "") {
      const val = String(converted[field]).toLowerCase();
      converted[field] = val === "true" || val === "1" || val === "yes";
    }
  });

  return converted;
}
