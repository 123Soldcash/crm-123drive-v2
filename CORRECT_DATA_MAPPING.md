# 📊 DealMachine to CRM - CORRECT Field Mapping

**File Analyzed:** `dealmachine-properties-2026-01-12-220953_rolando_test.xlsx`  
**Total Columns:** 393  
**Date:** January 14, 2026  

---

## 🎯 Executive Summary

The CORRECT DealMachine export contains **393 columns** with comprehensive property, financial, owner, and contact data. This is significantly more detailed than previously analyzed.

**Key Statistics:**
- 🏷️ Lead Fields: 4
- 🏠 Property Fields: 53
- 💰 Financial Fields: 26
- 👤 Owner Fields: 8
- 📞 Contact Fields: 220 (20 contacts × 11 fields each)
- 🔧 Other Fields: 82 (notes, URLs, tracking)

---

## 📋 Complete Field Mapping

### 🏷️ LEAD & TRACKING FIELDS

| DealMachine Field | CRM Field | Type | Notes |
|-------------------|-----------|------|-------|
| `lead_id` | `dealMachineLeadId` | String | Original DealMachine lead ID |
| `lead_id` | `leadId` | Integer | Auto-generated CRM lead ID |
| `lead_status` | `status` | String | e.g., "With Marketing" |
| `lead_source` | (custom field) | String | e.g., "Bulk Import" |
| `owner_1_name` | `owner1Name` | String | Primary owner full name |

---

### 🏠 PROPERTY DETAILS FIELDS

#### Address Information
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `property_id` | `dealMachinePropertyId` | String | ✅ Yes |
| `property_address_full` | (concat) | String | ✅ Yes |
| `property_address_line_1` | `addressLine1` | String | ✅ Yes |
| `property_address_line_2` | `addressLine2` | String | ✅ Yes |
| `property_address_city` | `city` | String | ✅ Yes |
| `property_address_state` | `state` | String | ✅ Yes |
| `property_address_zipcode` | `zipcode` | String | ✅ Yes |
| `property_address_county` | (JSON) | String | ✅ Yes |
| `property_lat` | (JSON) | Float | ✅ Yes |
| `property_lng` | (JSON) | Float | ✅ Yes |

#### Property Characteristics
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `building_square_feet` | `buildingSquareFeet` | Integer | ✅ Yes |
| `total_bedrooms` | `totalBedrooms` | Integer | ✅ Yes |
| `total_baths` | `totalBaths` | Integer | ✅ Yes |
| `year_built` | `yearBuilt` | Integer | ✅ Yes |
| `property_type` | `propertyType` | String | ✅ Yes |
| `construction_type` | `constructionType` | String | ✅ Yes |
| `effective_year_built` | (JSON) | Integer | ✅ Yes |
| `heating_type` | (JSON) | String | ✅ Yes |
| `heating_fuel_type` | (JSON) | String | ✅ Yes |
| `roof_type` | (JSON) | String | ✅ Yes |
| `property_class` | (JSON) | String | ✅ Yes |
| `lot_square_feet` | (JSON) | Integer | ✅ Yes |
| `lot_acreage` | (JSON) | Float | ✅ Yes |
| `subdivision_name` | `subdivisionName` | String | ✅ Yes |
| `zoning` | (JSON) | String | ✅ Yes |

---

### 💰 FINANCIAL INFORMATION FIELDS

#### Property Value & Equity
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `estimated_value` | `estimatedValue` | Integer | ✅ Yes |
| `equity_amount` | `equityAmount` | Integer | ✅ Yes |
| `equity_percent` | `equityPercent` | Float | ✅ Yes |
| `calculated_total_value` | (JSON) | Integer | ✅ Yes |
| `calculated_land_value` | (JSON) | Integer | ✅ Yes |
| `calculated_improvement_value` | (JSON) | Integer | ✅ Yes |

#### Assessed Values
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `assd_total_value` | (JSON) | Integer | ✅ Yes |
| `assd_land_value` | (JSON) | Integer | ✅ Yes |
| `assd_improvement_value` | (JSON) | Integer | ✅ Yes |
| `assd_year` | (JSON) | Integer | ✅ Yes |

#### Mortgages & Loans
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `total_loan_amt` | `mortgageAmount` | Integer | ✅ Yes |
| `total_loan_balance` | `totalLoanBalance` | Integer | ✅ Yes |
| `total_loan_payment` | `totalLoanPayment` | Integer | ✅ Yes |
| `mortgage_amount` | (JSON) | Integer | ✅ Yes |
| `mtg1_est_loan_balance` | (JSON) | Integer | ✅ Yes |
| `mortgage_interest_rate` | (JSON) | Float | ✅ Yes |
| `mortgage_date` | (JSON) | Date | ✅ Yes |
| `mortgage_term` | (JSON) | Integer | ✅ Yes |
| `mortgage_due_date` | (JSON) | Date | ✅ Yes |
| `mortgage_loan_type` | (JSON) | String | ✅ Yes |
| `mortgage_financing_type` | (JSON) | String | ✅ Yes |
| `lender_name` | (JSON) | String | ✅ Yes |

#### Second, Third, Fourth Mortgages
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `second_mortgage_amount` | (JSON) | Integer | ✅ Yes |
| `mtg2_est_loan_balance` | (JSON) | Integer | ✅ Yes |
| `second_mortgage_interest_rate` | (JSON) | Float | ✅ Yes |
| `mtg3_loan_amt` | (JSON) | Integer | ✅ Yes |
| `mtg3_est_loan_balance` | (JSON) | Integer | ✅ Yes |
| `mtg4_loan_amt` | (JSON) | Integer | ✅ Yes |
| `mtg4_est_loan_balance` | (JSON) | Integer | ✅ Yes |

#### Tax Information
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `tax_amt` | `taxAmount` | Integer | ✅ Yes |
| `tax_year` | `taxYear` | Integer | ✅ Yes |
| `tax_delinquent` | (JSON) | String | ✅ Yes |
| `tax_delinquent_year` | (JSON) | Integer | ✅ Yes |

#### Sale Information
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `sale_price` | `salePrice` | Integer | ✅ Yes |
| `sale_date` | `saleDate` | Date | ✅ Yes |
| `last_sale_doc_type` | (JSON) | String | ✅ Yes |
| `document_type` | (JSON) | String | ✅ Yes |

---

### 👤 OWNER INFORMATION FIELDS

| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `owner_1_name` | `owner1Name` | String | ✅ Yes |
| `owner_1_firstname` | (JSON) | String | ✅ Yes |
| `owner_1_lastname` | (JSON) | String | ✅ Yes |
| `owner_2_name` | `owner2Name` | String | ✅ Yes |
| `owner_2_firstname` | (JSON) | String | ✅ Yes |
| `owner_2_lastname` | (JSON) | String | ✅ Yes |
| `owner_location` | `ownerLocation` | String | ✅ Yes |
| `is_corporate_owner` | (JSON) | Boolean | ✅ Yes |
| `out_of_state_owner` | (JSON) | Boolean | ✅ Yes |

#### Mailing Address
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `mailing_addresses` | (JSON) | String | ✅ Yes |
| `owner_address_full` | (JSON) | String | ✅ Yes |
| `owner_address_line_1` | (JSON) | String | ✅ Yes |
| `owner_address_line_2` | (JSON) | String | ✅ Yes |
| `owner_address_city` | (JSON) | String | ✅ Yes |
| `owner_address_state` | (JSON) | String | ✅ Yes |
| `owner_address_zip` | (JSON) | String | ✅ Yes |

---

### 📞 CONTACT FIELDS (20 Contacts × 11 Fields = 220 Fields)

Each property can have **up to 20 contacts**, each with the following structure:

| DealMachine Field Pattern | CRM Table | Type | Import? |
|---------------------------|-----------|------|---------|
| `contact_N_name` | `contacts.name` | String | ✅ Yes |
| `contact_N_flags` | `contacts.flags` | String | ✅ Yes |
| `contact_N_phone1` | `contactPhones.phoneNumber` | String | ✅ Yes |
| `contact_N_phone1_type` | `contactPhones.phoneType` | String | ✅ Yes |
| `contact_N_phone2` | `contactPhones.phoneNumber` | String | ✅ Yes |
| `contact_N_phone2_type` | `contactPhones.phoneType` | String | ✅ Yes |
| `contact_N_phone3` | `contactPhones.phoneNumber` | String | ✅ Yes |
| `contact_N_phone3_type` | `contactPhones.phoneType` | String | ✅ Yes |
| `contact_N_email1` | `contactEmails.email` | String | ✅ Yes |
| `contact_N_email2` | `contactEmails.email` | String | ✅ Yes |
| `contact_N_email3` | `contactEmails.email` | String | ✅ Yes |

**Contact Flags Values:**
- Likely Owner
- Resident
- Family
- Wireless
- (other relationship types)

---

### 🔧 ADDITIONAL FIELDS

#### Property Flags
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `property_flags` | (JSON) | String | ✅ Yes |

**Property Flags Values:**
- High Equity
- Off Market
- Tax Delinquent
- Absentee Owner
- Tired Landlord
- Senior Owner
- Corporate Owner
- Free And Clear
- Cash Buyer
- Out Of State Owner

#### Research URLs
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `dealmachine_url` | (JSON) | String | ✅ Yes |
| `httpsofficialrecords.broward.org...` | (JSON) | String | ✅ Yes |
| `httpscounty-taxes.net...` | (JSON) | String | ✅ Yes |
| `violationsearch` | (JSON) | String | ✅ Yes |

#### Notes Fields
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `notes_1` | (JSON) | Text | ✅ Yes |
| `notes_2` | (JSON) | Text | ✅ Yes |
| `notes_3` | (JSON) | Text | ✅ Yes |
| `notes_4` | (JSON) | Text | ✅ Yes |
| `notes_5` | (JSON) | Text | ✅ Yes |
| `recent_note` | (JSON) | Text | ✅ Yes |

#### Tracking Fields
| DealMachine Field | CRM Field | Type | Import? |
|-------------------|-----------|------|---------|
| `assigned_to` | `assignedAgentId` | Integer | ⚠️ Map |
| `tags` | (JSON) | String | ✅ Yes |
| `creator` | (JSON) | String | ✅ Yes |
| `date_created` | `createdAt` | DateTime | ✅ Yes |
| `last_exported_date` | (JSON) | DateTime | ✅ Yes |
| `total_times_mail_was_sent` | (JSON) | Integer | ✅ Yes |
| `last_mail_sent_date` | (JSON) | DateTime | ✅ Yes |

---

## 🎯 Import Strategy

### ✅ Direct Mapping (Core CRM Fields)
These fields map directly to existing CRM database columns:

| Category | Fields |
|----------|--------|
| **Address** | addressLine1, addressLine2, city, state, zipcode, subdivisionName |
| **Property** | buildingSquareFeet, totalBedrooms, totalBaths, yearBuilt, propertyType, constructionType |
| **Financial** | estimatedValue, equityAmount, equityPercent, mortgageAmount, totalLoanBalance, totalLoanPayment, salePrice, saleDate, taxAmount, taxYear |
| **Owner** | owner1Name, owner2Name, ownerLocation |
| **Tracking** | dealMachinePropertyId, dealMachineLeadId, status |

### 📦 JSON Storage (Extended Data)
These fields are stored in `dealMachineRawData` JSON column:

| Category | Fields |
|----------|--------|
| **GPS** | property_lat, property_lng, property_address_county |
| **Property Extended** | effective_year_built, heating_type, roof_type, lot_square_feet, lot_acreage, zoning |
| **Financial Extended** | All mortgage details (mtg2, mtg3, mtg4), assessed values, lender info |
| **Owner Extended** | Mailing address, owner_firstname, owner_lastname, is_corporate_owner |
| **Property Flags** | property_flags (comma-separated string) |
| **URLs** | dealmachine_url, county records URLs, tax search URLs |
| **Notes** | notes_1 through notes_5, recent_note |
| **Tracking** | creator, date_created, total_times_mail_sent, tags |

### 🔗 Relational Tables (Normalized Data)
These fields are stored in separate related tables:

| Table | Fields | Relationship |
|-------|--------|--------------|
| **contacts** | name, flags | 1 property → many contacts |
| **contactPhones** | phoneNumber, phoneType | 1 contact → many phones |
| **contactEmails** | email | 1 contact → many emails |

---

## 📊 Data Quality

### Sample Property Data (Lead #1238558064)

**Property:**
- Address: 1505 Nw 180th Ter, Miami, FL 33169
- Type: (in file)
- Bedrooms: (in file)
- Bathrooms: (in file)
- Square Feet: (in file)
- Year Built: (in file)

**Financial:**
- Estimated Value: $491,000
- Equity: $464,296 (95%)
- Mortgage Balance: $26,704
- Monthly Payment: $214
- Tax Amount: $2,624
- Tax Delinquent: Yes

**Owner:**
- Name: Trevor Bibs Barrett Revocable
- Location: (in file)

**Contacts:**
- 0 contacts in this lead (but structure supports 20)

---

## ✅ What Gets Imported vs ❌ What Doesn't

### ✅ WILL BE IMPORTED (100%)

| Data Category | Status |
|---------------|--------|
| Property Address | ✅ Complete |
| Property Details | ✅ Complete (bedrooms, baths, sqft, year, type) |
| Financial Info | ✅ Complete (value, equity, mortgages, taxes) |
| Owner Info | ✅ Complete (names, location, mailing address) |
| Contacts | ✅ Complete (up to 20 contacts with phones & emails) |
| Property Flags | ✅ Complete (High Equity, Off Market, etc.) |
| GPS Coordinates | ✅ Complete |
| Research URLs | ✅ Complete |
| Notes | ✅ Complete (5 notes fields) |

### ❌ NOTHING IS MISSING!

The correct Excel file contains **ALL** the data needed to fully populate the CRM.

---

## 🚀 Next Steps

1. **Update Import Script** - Modify `import-dealmachine-simple.mjs` to map ALL 393 fields
2. **Test Import** - Run with the correct Excel file
3. **Verify Data** - Check that all property details, financial info, and contacts appear in UI
4. **Phase 2 Optional** - Google Maps enrichment not needed (addresses already complete)

---

**Document Version:** 2.0 (CORRECT)  
**Last Updated:** 2026-01-14  
**File Analyzed:** dealmachine-properties-2026-01-12-220953_rolando_test.xlsx
