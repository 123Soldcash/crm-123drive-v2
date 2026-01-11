# Database Field Mapping - Excel Import Guide

## ⚠️ CRITICAL: Column Headers Must Match EXACTLY

Your Excel column headers **MUST** match these names exactly (case-sensitive). If they don't match, the import will fail.

---

## PROPERTIES TABLE - 45 Fields

These are the exact column headers to use in your Excel file:

| # | Field Name | Type | Description | Example |
|---|---|---|---|---|
| 1 | id | Auto | Auto-generated (leave empty) | - |
| 2 | leadId | Number | LEAD ID from DealMachine | 270001 |
| 3 | addressLine1 | Text | Street address | 519 Ne 8th Ave |
| 4 | addressLine2 | Text | Apt/Suite number (optional) | Apt 5 |
| 5 | city | Text | City name | Deerfield Beach |
| 6 | state | Text | 2-letter state code | FL |
| 7 | zipcode | Text | Zip code | 33441 |
| 8 | subdivisionName | Text | Subdivision name (optional) | Coral Ridge |
| 9 | status | Text | Property status | Active |
| 10 | trackingStatus | Enum | Lead tracking status | Not Visited, Off Market, Cash Buyer, Free And Clear, High Equity, Senior Owner, Tired Landlord, Absentee Owner, Corporate Owner, Empty Nester, Interested, Not Interested, Follow Up |
| 11 | leadTemperature | Enum | Lead quality | SUPER HOT, HOT, WARM, COLD, TBD, DEAD |
| 12 | ownerVerified | Number | Owner verified? (0=No, 1=Yes) | 0 |
| 13 | assignedAgentId | Number | Agent ID (leave empty to assign later) | 1440266 |
| 14 | marketStatus | Text | Market status | On Market |
| 15 | ownerLocation | Text | Owner location | In State |
| 16 | estimatedValue | Number | Property value in dollars | 654000 |
| 17 | equityAmount | Number | Equity in dollars | 647442 |
| 18 | equityPercent | Number | Equity percentage (0-100) | 99 |
| 19 | salePrice | Number | Last sale price | 500000 |
| 20 | saleDate | DateTime | Last sale date (YYYY-MM-DD) | 2020-01-15 |
| 21 | mortgageAmount | Number | Mortgage amount | 65000 |
| 22 | totalLoanBalance | Number | Total loan balance | 65000 |
| 23 | totalLoanPayment | Number | Monthly payment | 350 |
| 24 | estimatedRepairCost | Number | Repair estimate | 50000 |
| 25 | taxYear | Number | Tax year | 2024 |
| 26 | taxAmount | Number | Annual tax | 2699 |
| 27 | owner1Name | Text | Primary owner name | George B Becker |
| 28 | owner2Name | Text | Secondary owner name (optional) | Jane Becker |
| 29 | buildingSquareFeet | Number | Square footage | 1192 |
| 30 | totalBedrooms | Number | Number of bedrooms | 2 |
| 31 | totalBaths | Number | Number of bathrooms | 1 |
| 32 | yearBuilt | Number | Year built | 1950 |
| 33 | propertyType | Text | Property type | Single Family |
| 34 | constructionType | Text | Construction type | Wood Frame |
| 35 | apnParcelId | Text | APN/Parcel ID | 123-45-6789 |
| 36 | taxDelinquent | Text | Tax delinquent status | No |
| 37 | taxDelinquentYear | Number | Year delinquent | 2023 |
| 38 | propertyId | Text | **UNIQUE** DealMachine Property ID (prevents duplicates) | DM-123456 |
| 39 | dealMachinePropertyId | Text | DealMachine Property ID | 570986 |
| 40 | dealMachineLeadId | Text | DealMachine Lead ID | 270001 |
| 41 | dealMachineRawData | Text | JSON raw data (optional) | {} |
| 42 | deskName | Text | Desk assignment | Sales |
| 43 | deskStatus | Enum | Desk status | BIN, ACTIVE, ARCHIVED |
| 44 | createdAt | DateTime | Auto-generated | - |
| 45 | updatedAt | DateTime | Auto-generated | - |

---

## CONTACTS TABLE - For Multiple Contacts Per Property

For each contact, add columns with these exact names, numbered 1-9:

| # | Field Name | Type | Description | Example |
|---|---|---|---|---|
| 1 | contact1Name | Text | Contact name | John Smith |
| 2 | contact1Relationship | Text | Relationship to owner | Owner, Son, Daughter, Spouse, Heir, Attorney, etc. |
| 3 | contact1Age | Number | Age | 45 |
| 4 | contact1Deceased | Number | Deceased? (0=No, 1=Yes) | 0 |
| 5 | contact1CurrentAddress | Text | Current address | 123 Main St |
| 6 | contact1Flags | Text | Flags | Likely Owner, Family, Resident |
| 7 | contact1IsDecisionMaker | Number | Decision maker? (0=No, 1=Yes) | 1 |
| 8 | contact1Dnc | Number | Do Not Call? (0=No, 1=Yes) | 0 |
| 9 | contact1IsLitigator | Number | Litigator? (0=No, 1=Yes) | 0 |
| 10 | contact1Hidden | Number | Hidden? (0=No, 1=Yes) | 0 |
| 11 | contact1Phone1 | Text | Phone number | 555-1234 |
| 12 | contact1Phone1Type | Text | Phone type | Mobile, Home, Work |
| 13 | contact1Phone2 | Text | Second phone | 555-5678 |
| 14 | contact1Phone2Type | Text | Phone type | Mobile, Home, Work |
| 15 | contact1Phone3 | Text | Third phone | 555-9999 |
| 16 | contact1Phone3Type | Text | Phone type | Mobile, Home, Work |
| 17 | contact1Email1 | Text | Email address | john@example.com |
| 18 | contact1Email2 | Text | Second email | john.work@example.com |
| 19 | contact1Email3 | Text | Third email | - |
| 20 | contact1CurrentResident | Number | Current resident? (0=No, 1=Yes) | 1 |
| 21 | contact1Contacted | Number | Already contacted? (0=No, 1=Yes) | 0 |
| 22 | contact1OnBoard | Number | On board? (0=No, 1=Yes) | 0 |
| 23 | contact1NotOnBoard | Number | Not on board? (0=No, 1=Yes) | 0 |

**Repeat for contact2, contact3, ... contact9** (just replace "contact1" with "contact2", etc.)

---

## Excel Column Order (Recommended)

```
addressLine1, city, state, zipcode, propertyId, dealMachinePropertyId, dealMachineLeadId,
owner1Name, owner2Name, propertyType, yearBuilt, buildingSquareFeet, totalBedrooms, totalBaths,
estimatedValue, equityAmount, equityPercent, mortgageAmount, taxAmount, taxYear,
leadTemperature, trackingStatus, deskStatus,
contact1Name, contact1Relationship, contact1Phone1, contact1Email1,
contact2Name, contact2Relationship, contact2Phone1, contact2Email1,
... (up to contact9)
```

---

## Important Notes

1. **propertyId is UNIQUE** - Use this to prevent duplicate imports. If you import the same file twice, properties with the same propertyId will be skipped.

2. **Column names are case-sensitive** - `addressLine1` is NOT the same as `AddressLine1` or `addressline1`

3. **Optional fields** - Leave empty if you don't have data:
   - addressLine2
   - subdivisionName
   - owner2Name
   - assignedAgentId (assign later via Bulk Assign Agents)
   - All contact fields

4. **Enum values** - Use EXACT values from the table above. No variations.

5. **Numbers** - Don't include currency symbols or commas (e.g., use `654000` not `$654,000`)

6. **Dates** - Use format `YYYY-MM-DD` (e.g., `2020-01-15`)

7. **Contacts** - You can have up to 9 contacts per property. Just add columns contact1Name, contact2Name, etc.

---

## Validation Checklist Before Import

- [ ] All required columns present: addressLine1, city, state, zipcode, propertyId
- [ ] Column names match EXACTLY (case-sensitive)
- [ ] No duplicate propertyId values
- [ ] Enum values match exactly (WARM not Warm, HOT not Hot)
- [ ] Numbers don't have currency symbols or commas
- [ ] Dates are in YYYY-MM-DD format
- [ ] State codes are 2 letters (FL, CA, TX, etc.)
- [ ] Zipcode format is correct
- [ ] No empty addressLine1 or city values

---

## Common Import Errors & Solutions

| Error | Cause | Solution |
|---|---|---|
| "Imported 0 properties, 25 rows had errors" | Column names don't match | Check spelling and case sensitivity |
| "Property already exists" | Duplicate propertyId | Change propertyId or delete existing property |
| "Invalid enum value" | Wrong value for leadTemperature, trackingStatus, etc. | Use exact values from table above |
| "Invalid state code" | State not 2 letters | Use 2-letter state codes (FL, CA, TX) |
| "Missing required field" | addressLine1, city, state, or zipcode empty | Fill in all required fields |

