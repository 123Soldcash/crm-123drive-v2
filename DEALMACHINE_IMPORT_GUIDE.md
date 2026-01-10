# DealMachine to CRM Field Mapping Guide

**Last Updated:** January 10, 2026  
**Status:** Ready for Manual Excel Import  
**Contact Fields:** Up to 9 contacts per property  

---

## Overview

This guide provides a complete field mapping between DealMachine CSV columns and CRM database fields. Use this to prepare your Excel file for import into the CRM system.

### Key Information

- **Total CRM Fields:** 169 fields available for import
- **Contact Support:** Up to 9 contacts per property (contact_1 through contact_9)
- **Each Contact:** Name, Relationship, 3 Phone numbers, 3 Email addresses
- **Auto-Generated Fields:** LEAD ID (auto-incrementing from #270007), Entry Date/Time
- **Default Values:** Temperature = TBD, Desk = BIN, Status Tag = dealmachine_deep_search_chris_edsel_zach

---

## Property Fields Mapping

### LEAD ID & Tracking
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| leadId | lead_id | Integer | Auto-generated, starts from #270007 |
| dealMachineLeadId | lead_id | String | Original DealMachine lead ID for reference |
| dealMachinePropertyId | property_id | String | Original DealMachine property ID |

### Address Information
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| addressLine1 | property_address_line_1 | String | Street address (required) |
| addressLine2 | property_address_line_2 | String | Apartment/Suite number (optional) |
| city | property_address_city | String | City (required) |
| state | property_address_state | String | State code, 2 chars (required) |
| zipcode | property_address_zipcode | String | ZIP code (required) |
| subdivisionName | subdivision_name | String | Subdivision/Community name |

### Property Details
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| propertyType | property_type | String | e.g., "Single Family", "Multi-Family" |
| yearBuilt | year_built | Integer | Year property was built |
| buildingSquareFeet | building_square_feet | Integer | Total square footage |
| totalBedrooms | total_bedrooms | Integer | Number of bedrooms |
| totalBaths | total_baths | Integer | Number of bathrooms |
| constructionType | construction_type | String | e.g., "Wood Frame", "Concrete Block" |

### Financial Information
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| estimatedValue | estimated_value | Integer | Property estimated value |
| equityAmount | equity_amount | Integer | Equity in dollars |
| equityPercent | equity_percent | Integer | Equity percentage (0-100) |
| mortgageAmount | total_loan_amt | Integer | Total mortgage amount |
| totalLoanBalance | total_loan_balance | Integer | Current loan balance |
| totalLoanPayment | total_loan_payment | Integer | Monthly loan payment |
| estimatedRepairCost | estimated_repair_cost | Integer | Estimated repairs needed |
| salePrice | last_sale_price | Integer | Last sale price |
| saleDate | last_sale_date | Date | Last sale date |
| taxAmount | tax_amount | Integer | Annual tax amount |
| taxYear | tax_year | Integer | Tax year |

### Owner Information
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| owner1Name | owner_1_name | String | Primary owner name |
| owner2Name | owner_2_name | String | Secondary owner name (if applicable) |
| ownerLocation | owner_location | String | Owner's current location |

### Property Status & Tracking
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| status | lead_status | String | Original lead status from DealMachine |
| trackingStatus | (manual) | Enum | Not Visited, Off Market, Cash Buyer, etc. |
| leadTemperature | (auto) | Enum | Default: TBD (can be: SUPER HOT, HOT, WARM, COLD, DEAD) |
| ownerVerified | (manual) | Boolean | 0=No, 1=Yes |
| marketStatus | market_status | String | Market status information |

### Desk Management (Auto-Assigned)
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| deskName | (auto) | String | Auto-set to "BIN" for all imports |
| deskStatus | (auto) | Enum | Auto-set to "BIN" (new leads) |

### Additional Property Fields
| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| apnParcelId | apn_parcel_id | String | Assessor Parcel Number |
| taxDelinquent | tax_delinquent | String | Tax delinquency status |
| taxDelinquentYear | tax_delinquent_year | Integer | Year of tax delinquency |

---

## Contact Fields Mapping

Each property can have **up to 9 contacts** (contact_1 through contact_9). Each contact includes:

### Contact Structure (Repeat for contact_1 through contact_9)

| CRM Field | DealMachine Field | Type | Notes |
|-----------|------------------|------|-------|
| contact_N_name | contact_N_name | String | Contact full name |
| contact_N_relationship | contact_N_flags | String | Relationship to property (see values below) |
| contact_N_phone1 | contact_N_phone1 | String | First phone number |
| contact_N_phone1_type | contact_N_phone1_type | String | Phone type (Mobile, Home, Work, etc.) |
| contact_N_phone2 | contact_N_phone2 | String | Second phone number |
| contact_N_phone2_type | contact_N_phone2_type | String | Phone type |
| contact_N_phone3 | contact_N_phone3 | String | Third phone number |
| contact_N_phone3_type | contact_N_phone3_type | String | Phone type |
| contact_N_email1 | contact_N_email1 | String | First email address |
| contact_N_email2 | contact_N_email2 | String | Second email address |
| contact_N_email3 | contact_N_email3 | String | Third email address |

### Contact Relationship Values

Map the DealMachine contact flags to these CRM relationship values:

| DealMachine Flag | CRM Relationship Value | Description |
|------------------|----------------------|-------------|
| Owner | Owner | Property owner |
| Resident | Resident | Current resident |
| Likely | Likely Owner | Likely owner based on records |
| Family | Family | Family member |
| Potential | Potential Contact | Potential contact |
| Renting | Renting | Tenant/renting |
| Wireless | Wireless | Contact with wireless phone only |
| (other) | (use as-is) | Other relationship types |

### Contact Tracking Fields (Optional)

These fields can be set manually or left empty:

| CRM Field | Type | Notes |
|-----------|------|-------|
| currentResident | Boolean | 0=No, 1=Yes |
| contacted | Boolean | 0=No, 1=Yes |
| contactedDate | Date | Date of last contact |
| onBoard | Boolean | 0=No, 1=Yes |
| notOnBoard | Boolean | 0=No, 1=Yes |
| deceased | Boolean | 0=No, 1=Yes |
| isDecisionMaker | Boolean | 0=No, 1=Yes |
| dnc | Boolean | 0=No, 1=Yes (Do Not Call) |
| isLitigator | Boolean | 0=No, 1=Yes |

---

## Excel Import Template Structure

### Column Order (Recommended)

```
A: leadId (leave empty - auto-generated)
B: dealMachineLeadId
C: dealMachinePropertyId
D: addressLine1
E: addressLine2
F: city
G: state
H: zipcode
I: propertyType
J: yearBuilt
K: buildingSquareFeet
L: totalBedrooms
M: totalBaths
N: constructionType
O: estimatedValue
P: equityAmount
Q: equityPercent
R: mortgageAmount
S: totalLoanBalance
T: totalLoanPayment
U: estimatedRepairCost
V: salePrice
W: saleDate
X: taxAmount
Y: taxYear
Z: owner1Name
AA: owner2Name
AB: ownerLocation
AC: status
AD: marketStatus
AE: apnParcelId
AF: taxDelinquent
AG: taxDelinquentYear

(Then repeat for each contact 1-9:)
AH: contact_1_name
AI: contact_1_relationship
AJ: contact_1_phone1
AK: contact_1_phone1_type
AL: contact_1_phone2
AM: contact_1_phone2_type
AN: contact_1_phone3
AO: contact_1_phone3_type
AP: contact_1_email1
AQ: contact_1_email2
AR: contact_1_email3
AS: contact_1_currentResident
AT: contact_1_contacted
AU: contact_1_contactedDate
AV: contact_1_onBoard
AW: contact_1_notOnBoard

(Repeat for contact_2 through contact_9...)
```

---

## Import Validation Checklist

Before importing, verify:

- [ ] **Address Fields:** All properties have addressLine1, city, state, zipcode
- [ ] **Contact Names:** At least one contact per property (or leave blank for skip trace)
- [ ] **Phone Numbers:** Formatted consistently (e.g., (555) 123-4567 or 555-123-4567)
- [ ] **Email Addresses:** Valid email format (name@domain.com)
- [ ] **Numeric Fields:** No currency symbols ($), just numbers (e.g., 450000 not $450,000)
- [ ] **Dates:** ISO format (YYYY-MM-DD) or leave empty
- [ ] **Relationship Values:** Match the approved list above
- [ ] **No Duplicates:** Check for duplicate addresses before import

---

## Auto-Generated & Default Values

These fields are **automatically set** during import:

| Field | Auto Value | Notes |
|-------|-----------|-------|
| leadId | Auto-incrementing from #270007 | Unique identifier for each property |
| deskName | "BIN" | All imports go to BIN desk |
| deskStatus | "BIN" | New leads status |
| leadTemperature | "TBD" | Can be changed manually later |
| createdAt | Current timestamp | Import date/time |
| updatedAt | Current timestamp | Last update date/time |

---

## Status Tags

All imported properties are automatically tagged with:
- **dealmachine_deep_search_chris_edsel_zach**

This tag helps track which properties came from DealMachine import.

---

## Import Process Steps

1. **Prepare Excel File**
   - Use the template structure above
   - Fill in property and contact data
   - Validate using the checklist

2. **Upload to CRM**
   - Navigate to Import Properties page
   - Select Excel file
   - Preview data (first 5 rows shown)
   - Click "Import" to process

3. **Verify Import**
   - Check Properties list for new leads
   - Verify LEAD IDs are sequential
   - Check contact information in property detail view
   - Confirm status tag is applied

4. **Next Steps**
   - Assign properties to agents
   - Set lead temperature (HOT, WARM, COLD)
   - Add notes and deep search data
   - Schedule follow-up tasks

---

## Troubleshooting

### Issue: Properties not appearing after import
- **Check:** Verify all required fields (address, city, state, zipcode) are populated
- **Check:** Look for error messages in browser console
- **Check:** Ensure file format is Excel (.xlsx)

### Issue: Contacts not importing
- **Check:** Contact names must not be empty
- **Check:** Relationship field must match approved values
- **Check:** Phone numbers should be in standard format

### Issue: Duplicate properties
- **Check:** Verify addresses are unique (no duplicate rows)
- **Check:** If reimporting, clear old data first

### Issue: LEAD IDs not sequential
- **Check:** LEAD IDs auto-generate - don't manually enter them
- **Check:** Leave leadId column empty in Excel

---

## Support & Questions

For questions about field mapping or import process:
1. Review this guide's troubleshooting section
2. Check the CRM's Import Properties page for inline help
3. Verify data against the validation checklist above

---

## Field Mapping Reference (Complete List)

### All 169 CRM Fields

**Property Core (31 fields)**
- id, leadId, addressLine1, addressLine2, city, state, zipcode, subdivisionName, status, trackingStatus, leadTemperature, ownerVerified, assignedAgentId, marketStatus, ownerLocation, deskName, deskStatus, createdAt, updatedAt, dealMachinePropertyId, dealMachineLeadId, dealMachineRawData

**Property Details (6 fields)**
- buildingSquareFeet, totalBedrooms, totalBaths, yearBuilt, propertyType, constructionType

**Financial (10 fields)**
- estimatedValue, equityAmount, equityPercent, salePrice, saleDate, mortgageAmount, totalLoanBalance, totalLoanPayment, estimatedRepairCost, taxYear, taxAmount

**Owner (3 fields)**
- owner1Name, owner2Name, ownerLocation

**Additional (3 fields)**
- apnParcelId, taxDelinquent, taxDelinquentYear

**Contact Fields (per contact × 9 contacts = ~117 fields)**
- name, relationship, phone1, phone1Type, phone2, phone2Type, phone3, phone3Type, email1, email2, email3, currentResident, contacted, contactedDate, onBoard, notOnBoard, deceased, isDecisionMaker, dnc, isLitigator, hidden

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-10  
**Prepared for:** Manual Excel Import Workflow
