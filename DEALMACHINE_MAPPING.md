# DealMachine to CRM Data Mapping Analysis

## Overview
DealMachine exports data in TWO separate CSV files:
1. **Contacts** - Individual people associated with properties
2. **Properties** - Property data with lead information

---

## 1. PROPERTIES TABLE MAPPING

### Basic Property Information
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `property_id` | `id` | number | Unique identifier |
| `property_address_full` | `address` | string | Full address |
| `property_address_line_1` | `addressLine1` | string | Street address |
| `property_address_city` | `city` | string | City |
| `property_address_state` | `state` | string | State code |
| `property_address_zipcode` | `zipCode` | string | ZIP code |
| `property_address_county` | `county` | string | County name |
| `property_lat` | `latitude` | decimal | Latitude |
| `property_lng` | `longitude` | decimal | Longitude |

### Owner Information
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `owner_1_name` | `ownerName` | string | Primary owner full name |
| `owner_1_firstname` | `ownerFirstName` | string | Primary owner first name |
| `owner_1_lastname` | `ownerLastName` | string | Primary owner last name |
| `owner_2_name` | `ownerName2` | string | Secondary owner (if exists) |
| `owner_address_full` | `ownerAddressFull` | string | Owner mailing address |
| `owner_location` | `ownerLocation` | string | Owner location type (Owner Occupied, etc) |
| `is_corporate_owner` | `isCorporateOwner` | boolean | Is corporate entity |
| `out_of_state_owner` | `outOfStateOwner` | boolean | Owner is out of state |

### Property Details
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `property_type` | `propertyType` | string | Single Family, Multi-Family, etc |
| `year_built` | `yearBuilt` | number | Year property was built |
| `effective_year_built` | `effectiveYearBuilt` | number | Effective year built |
| `total_bedrooms` | `bedrooms` | number | Number of bedrooms |
| `total_baths` | `bathrooms` | number | Number of bathrooms |
| `building_square_feet` | `squareFeet` | number | Total square footage |
| `units_count` | `unitsCount` | number | Number of units |
| `building_condition` | `buildingCondition` | string | Average, Good, Excellent, etc |
| `building_quality` | `buildingQuality` | string | Quality rating |

### Financial Information
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `estimated_value` | `estimatedValue` | currency | Property value estimate |
| `equity_amount` | `equityAmount` | currency | Equity amount |
| `equity_percent` | `equityPercent` | percentage | Equity percentage |
| `total_loan_amt` | `totalLoanAmount` | currency | Total loan amount |
| `total_loan_balance` | `totalLoanBalance` | currency | Current loan balance |
| `total_loan_payment` | `totalLoanPayment` | currency | Monthly loan payment |
| `sale_price` | `salePrice` | currency | Last sale price |
| `sale_date` | `saleDate` | date | Last sale date |
| `estimated_repair_cost` | `estimatedRepairCost` | currency | Estimated repairs needed |
| `tax_amt` | `taxAmount` | currency | Annual tax amount |

### Market Status
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `market_status` | `marketStatus` | string | Off Market, MLS Active, etc |
| `market_sub_status` | `marketSubStatus` | string | More specific market status |
| `lead_status` | `leadStatus` | string | New Prospect, Contacted, etc |
| `property_flags` | `propertyFlags` | string | Tags/flags from DealMachine |

### Lead Tracking
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `lead_id` | `leadId` | number | DealMachine lead ID |
| `lead_source` | `leadSource` | string | How lead was sourced |
| `assigned_to` | `assignedAgent` | string | Agent assigned in DealMachine |
| `tags` | `tags` | string | Comma-separated tags |
| `date_created` | `createdAt` | datetime | When lead was created |
| `recent_note` | `notes` | string | Most recent note |

### Contact Information (Embedded)
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `contact_1_name` | `primaryContactName` | string | Primary contact name |
| `contact_1_phone1` | `primaryContactPhone` | string | Primary contact phone |
| `contact_1_email1` | `primaryContactEmail` | string | Primary contact email |
| `contact_2_name` | `secondaryContactName` | string | Secondary contact name |
| `contact_2_phone1` | `secondaryContactPhone` | string | Secondary contact phone |
| `contact_2_email1` | `secondaryContactEmail` | string | Secondary contact email |

---

## 2. CONTACTS TABLE MAPPING

### Contact Information
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `contact_id` | `id` | number | Unique contact identifier |
| `first_name` | `firstName` | string | Contact first name |
| `last_name` | `lastName` | string | Contact last name |
| `middle_initial` | `middleInitial` | string | Middle initial |
| `generational_suffix` | `suffix` | string | Jr, Sr, III, etc |
| `gender` | `gender` | string | M, F, or Unknown |
| `marital_status` | `maritalStatus` | string | Single, Married, etc |

### Contact Addresses
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `primary_mailing_address` | `mailingAddress` | string | Current mailing address |
| `primary_mailing_city` | `mailingCity` | string | Mailing city |
| `primary_mailing_state` | `mailingState` | string | Mailing state |
| `primary_mailing_zip` | `mailingZip` | string | Mailing ZIP |
| `mailing_address_previous` | `previousAddress` | string | Previous address |
| `mailing_address_city_previous` | `previousCity` | string | Previous city |
| `mailing_address_state_previous` | `previousState` | string | Previous state |
| `mailing_address_zip_previous` | `previousZip` | string | Previous ZIP |

### Contact Communication
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `email_address_1` | `email` | string | Primary email |
| `email_address_2` | `email2` | string | Secondary email |
| `email_address_3` | `email3` | string | Tertiary email |
| `phone_1` | `phone` | string | Primary phone |
| `phone_1_type` | `phoneType` | string | Mobile, Home, Business |
| `phone_1_do_not_call` | `doNotCall` | boolean | DNC flag |
| `phone_2` | `phone2` | string | Secondary phone |
| `phone_2_type` | `phone2Type` | string | Phone type |
| `phone_3` | `phone3` | string | Tertiary phone |
| `phone_3_type` | `phone3Type` | string | Phone type |

### Contact Demographics
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `education_model` | `education` | string | Education level |
| `occupation_group` | `occupationGroup` | string | Occupation category |
| `occupation_code` | `occupationCode` | string | Specific occupation code |
| `business_owner` | `isBusinessOwner` | boolean | Is business owner |
| `net_asset_value` | `netAssetValue` | string | Asset range |
| `home_business` | `homeBasedBusiness` | string | Home business indicator |

### Property Association
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `associated_property_id` | `propertyId` | number | Link to property |
| `associated_property_address_full` | `propertyAddress` | string | Associated property address |
| `contact_flags` | `contactFlags` | string | Likely Owner, Family, Resident, etc |

### Phone Activity Data
| DealMachine Field | CRM Field | Type | Notes |
|---|---|---|---|
| `phone_1_activity_status` | `phoneActivityStatus` | string | Active, Inactive |
| `phone_1_carrier` | `phoneCarrier` | string | Phone carrier name |
| `phone_1_prepaid_indicator` | `isPrepaid` | boolean | Is prepaid phone |
| `phone_1_usage_2_months` | `phoneUsage2Months` | string | Usage in last 2 months |
| `phone_1_usage_12_months` | `phoneUsage12Months` | string | Usage in last 12 months |

---

## 3. RELATIONSHIP MAPPING

### How to Link Data:
1. **Properties → Contacts**: Use `associated_property_id` in contacts CSV
2. **Properties → Leads**: `lead_id` in properties CSV
3. **Multiple Contacts per Property**: One property can have multiple contacts

### Example:
```
Property ID: 230158805
├── Contact 1: Eltodaco Arias (contact_id: 1501419689150)
│   ├── Phone: (multiple phones available)
│   ├── Email: eltodaco@yahoo.com
│   └── Flags: Likely Owner, Family, Resident
└── Contact 2: (if exists)
```

---

## 4. DATA TRANSFORMATION RULES

### Important Conversions:

1. **Currency Fields**
   - DealMachine: `"$268,000"` → CRM: `268000` (number)
   - Remove `$` and commas

2. **Percentage Fields**
   - DealMachine: `"82.00%"` → CRM: `82.00` (decimal)
   - Remove `%` symbol

3. **Dates**
   - DealMachine: `"2026-01-06 19:39:33"` → CRM: ISO format or timestamp
   - Parse datetime properly

4. **Flags/Tags**
   - DealMachine: `"Likely Owner, Family, Resident"` → CRM: Array or separate fields
   - Consider splitting into individual boolean fields

5. **Phone Numbers**
   - DealMachine: Multiple phone fields → CRM: Array of phone objects
   - Include type (Mobile, Home, Business) and DNC flag

6. **Empty Values**
   - DealMachine: Empty strings `""` → CRM: `null` or appropriate default
   - Handle gracefully

---

## 5. IMPLEMENTATION STRATEGY

### Phase 1: Property Import
1. Create `importFromDealMachine` tRPC procedure
2. Parse properties CSV
3. Transform data according to mapping
4. Insert into `properties` table
5. Handle duplicates (check by address)

### Phase 2: Contact Import
1. Parse contacts CSV
2. Link to properties via `associated_property_id`
3. Create contacts with relationship to property
4. Handle multiple contacts per property

### Phase 3: UI Implementation
1. Create "Import from DealMachine" page
2. Allow file upload (CSV)
3. Show preview of data to be imported
4. Confirm and import
5. Show results (X properties imported, Y contacts created)

### Phase 4: Automation (Future)
1. Set up scheduled imports
2. Detect new/updated properties
3. Sync changes automatically

---

## 6. CURRENT CRM SCHEMA vs DealMachine

### What We Already Have:
- ✅ Properties table with most fields
- ✅ Contacts table (but needs expansion)
- ✅ Phone numbers (but structure might differ)
- ✅ Addresses
- ✅ Owner information

### What We Need to Add:
- ❓ Phone activity status
- ❓ Phone carrier information
- ❓ Education level
- ❓ Occupation information
- ❓ Net asset value
- ❓ Contact flags (Likely Owner, Family, Resident, etc)
- ❓ Previous address tracking
- ❓ Multiple email support
- ❓ Multiple phone support with types

---

## 7. NEXT STEPS

1. **Confirm Schema**: Do we need all these fields or just core ones?
2. **Prioritize**: Which fields are most important to import?
3. **Handle Duplicates**: How do we detect if a property already exists?
4. **Validation**: What validation rules should we apply?
5. **Error Handling**: How to handle invalid data?

---

## Example Data from Export

### Property Example:
```json
{
  "property_id": 230158805,
  "property_address_full": "7513 N Hale Ave, Tampa, Fl 33614",
  "owner_1_name": "Eltodaco Arias",
  "estimated_value": "$268,000",
  "equity_amount": "$217,281",
  "equity_percent": "82.00%",
  "property_type": "Single Family",
  "year_built": 1940,
  "total_bedrooms": 1,
  "total_baths": 1,
  "building_square_feet": 520,
  "market_status": "Off Market",
  "lead_status": "New Prospect"
}
```

### Contact Example:
```json
{
  "contact_id": 1501419689150,
  "first_name": "Eltodaco",
  "last_name": "Arias",
  "email_address_1": "eltodaco@yahoo.com",
  "phone_1": "",
  "contact_flags": "Likely Owner, Family, Resident",
  "associated_property_id": 230158805
}
```

---

## Summary

✅ **DealMachine data is RICH and DETAILED**
- Lots of demographic information
- Multiple contact methods
- Comprehensive property details
- Phone activity tracking

⚠️ **Mapping Complexity**: Medium
- Clear field names
- Some data transformation needed (currency, percentages)
- Need to handle relationships properly

🎯 **Recommendation**: 
Start with core fields (address, owner, value, contacts, phones) and expand later as needed.
