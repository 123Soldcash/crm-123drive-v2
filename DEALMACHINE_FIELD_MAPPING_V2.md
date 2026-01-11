# DealMachine Field Mapping V2 (328 Columns)

This document maps the exact DealMachine export column names to CRM database fields.

## Property Fields (Columns 1-174)

| # | DealMachine Column | CRM Field | Type | Notes |
|---|---|---|---|---|
| 1 | property_id | propertyId | STRING | Unique identifier for duplicate prevention |
| 2 | address_line_1 | addressLine1 | STRING | Required |
| 3 | address_line_2 | addressLine2 | STRING | Optional |
| 4 | city | city | STRING | Required |
| 5 | state | state | STRING | Required |
| 6 | zipcode | zipcode | STRING | Required |
| 7 | county | county | STRING | Optional |
| 8 | country | country | STRING | Optional |
| 9 | latitude | latitude | FLOAT | Optional |
| 10 | longitude | longitude | FLOAT | Optional |
| 11 | owner_1_name | owner1Name | STRING | Primary owner |
| 12 | owner_1_address | owner1Address | STRING | Optional |
| 13 | owner_1_city | owner1City | STRING | Optional |
| 14 | owner_1_state | owner1State | STRING | Optional |
| 15 | owner_1_zipcode | owner1Zipcode | STRING | Optional |
| 16 | owner_2_name | owner2Name | STRING | Secondary owner |
| 17 | owner_2_address | owner2Address | STRING | Optional |
| 18 | owner_2_city | owner2City | STRING | Optional |
| 19 | owner_2_state | owner2State | STRING | Optional |
| 20 | owner_2_zipcode | owner2Zipcode | STRING | Optional |
| 21 | mailing_address_line_1 | mailingAddressLine1 | STRING | Optional |
| 22 | mailing_address_line_2 | mailingAddressLine2 | STRING | Optional |
| 23 | mailing_city | mailingCity | STRING | Optional |
| 24 | mailing_state | mailingState | STRING | Optional |
| 25 | mailing_zipcode | mailingZipcode | STRING | Optional |
| 26 | property_type | propertyType | ENUM | Residential, Commercial, Land, etc. |
| 27 | beds | beds | INT | Number of bedrooms |
| 28 | baths | baths | INT | Number of bathrooms |
| 29 | sqft | sqft | INT | Square footage |
| 30 | lot_sqft | lotSqft | INT | Lot size |
| 31 | year_built | yearBuilt | INT | Year property was built |
| 32 | property_condition | propertyCondition | STRING | Excellent, Good, Fair, Poor |
| 33 | roof_age | roofAge | INT | Age in years |
| 34 | roof_type | roofType | STRING | Shingle, Metal, Tile, etc. |
| 35 | ac_age | acAge | INT | Age in years |
| 36 | ac_type | acType | STRING | Central, Window, None, etc. |
| 37 | foundation_type | foundationType | STRING | Concrete, Pier, Slab, etc. |
| 38 | pool | pool | BOOLEAN | Has pool |
| 39 | garage_type | garageType | STRING | Attached, Detached, Carport, None |
| 40 | garage_spaces | garageSpaces | INT | Number of spaces |
| 41 | stories | stories | INT | Number of stories |
| 42 | hoa_fee | hoaFee | FLOAT | Monthly HOA fee |
| 43 | property_tax_amount | propertyTaxAmount | FLOAT | Annual property tax |
| 44 | estimated_value | estimatedValue | FLOAT | Zestimate or similar |
| 45 | equity_amount | equityAmount | FLOAT | Estimated equity |
| 46 | equity_percent | equityPercent | FLOAT | Percentage of equity |
| 47 | days_on_market | daysOnMarket | INT | Days listed |
| 48 | last_sale_date | lastSaleDate | DATE | Last sale date |
| 49 | last_sale_price | lastSalePrice | FLOAT | Last sale price |
| 50 | occupancy_status | occupancyStatus | ENUM | Owner-Occupied, Tenant-Occupied, Vacant |
| 51 | mls_status | mlsStatus | ENUM | Active, Sold, Expired, etc. |
| 52 | lease_type | leaseType | ENUM | Lease, Rent, Own, etc. |
| 53 | mortgage_1_lender | mtg1Lender | STRING | First mortgage lender |
| 54 | mortgage_1_loan_amt | mtg1LoanAmt | FLOAT | First mortgage loan amount |
| 55 | mortgage_1_est_loan_balance | mtg1EstLoanBalance | FLOAT | Estimated balance |
| 56 | mortgage_1_est_payment_amount | mtg1EstPaymentAmount | FLOAT | Estimated monthly payment |
| 57 | mortgage_1_loan_type | mtg1LoanType | STRING | Conventional, FHA, VA, etc. |
| 58 | mortgage_1_type_financing | mtg1TypeFinancing | STRING | Fixed, ARM, etc. |
| 59 | mortgage_1_est_interest_rate | mtg1EstInterestRate | FLOAT | Interest rate |
| 60 | mortgage_2_lender | mtg2Lender | STRING | Second mortgage lender |
| 61 | mortgage_2_loan_amt | mtg2LoanAmt | FLOAT | Second mortgage loan amount |
| 62 | mortgage_2_est_loan_balance | mtg2EstLoanBalance | FLOAT | Estimated balance |
| 63 | mortgage_2_est_payment_amount | mtg2EstPaymentAmount | FLOAT | Estimated monthly payment |
| 64 | mortgage_2_loan_type | mtg2LoanType | STRING | Conventional, FHA, VA, etc. |
| 65 | mortgage_2_type_financing | mtg2TypeFinancing | STRING | Fixed, ARM, etc. |
| 66 | mortgage_2_est_interest_rate | mtg2EstInterestRate | FLOAT | Interest rate |
| 67 | mortgage_3_lender | mtg3Lender | STRING | Third mortgage lender |
| 68 | mortgage_3_loan_amt | mtg3LoanAmt | FLOAT | Third mortgage loan amount |
| 69 | mortgage_3_est_loan_balance | mtg3EstLoanBalance | FLOAT | Estimated balance |
| 70 | mortgage_3_est_payment_amount | mtg3EstPaymentAmount | FLOAT | Estimated monthly payment |
| 71 | mortgage_3_loan_type | mtg3LoanType | STRING | Conventional, FHA, VA, etc. |
| 72 | mortgage_3_type_financing | mtg3TypeFinancing | STRING | Fixed, ARM, etc. |
| 73 | mortgage_3_est_interest_rate | mtg3EstInterestRate | FLOAT | Interest rate |
| 74 | mortgage_4_lender | mtg4Lender | STRING | Fourth mortgage lender |
| 75 | mortgage_4_loan_amt | mtg4LoanAmt | FLOAT | Fourth mortgage loan amount |
| 76 | mortgage_4_est_loan_balance | mtg4EstLoanBalance | FLOAT | Estimated balance |
| 77 | mortgage_4_est_payment_amount | mtg4EstPaymentAmount | FLOAT | Estimated monthly payment |
| 78 | mortgage_4_loan_type | mtg4LoanType | STRING | Conventional, FHA, VA, etc. |
| 79 | mortgage_4_type_financing | mtg4TypeFinancing | STRING | Fixed, ARM, etc. |
| 80 | mortgage_4_est_interest_rate | mtg4EstInterestRate | FLOAT | Interest rate |
| 81 | hoa_fee_amount | hoaFeeAmount | FLOAT | Monthly HOA fee |
| 82 | h_o_a1_name | hoa1Name | STRING | HOA name |
| 83 | h_o_a1_type | hoa1Type | STRING | HOA type |
| 84 | mail | mail | STRING | Mailing address |
| 85 | dealmachine_url | dealmachineUrl | STRING | Link to property in DealMachine |
| 86 | notes_1 | notes1 | TEXT | Research notes |
| 87 | facebookprofile1 | facebookProfile1 | STRING | Facebook URL |
| 88 | priority | priority | STRING | High, Medium, Low |
| 89 | skiptracetruepeoplesearch | skiptraceTrue | BOOLEAN | Skiptrace status |
| 90 | calledtruepeoplesearch | calledTrue | BOOLEAN | Called status |
| 91 | done_with_facebook | doneWithFacebook | BOOLEAN | Facebook research done |
| 92 | address_of_the_property | addressOfProperty | STRING | Full address |
| 93 | donemailing_-_onwers | doneMailingOwners | BOOLEAN | Mailing done |
| 94 | donemailingrelatives | doneMailingRelatives | BOOLEAN | Mailing relatives done |
| 95 | emailonwersinstantly.ai | emailOwnersInstantly | BOOLEAN | Email status |
| 96 | idi_-_search | idiSearch | BOOLEAN | IDI search done |
| 97 | httpsofficialrecords.broward.orgacclaimwebsearchsearchtypename | officialRecordsSearch | BOOLEAN | Records search done |
| 98 | httpscounty-taxes.netbrowardbrowardproperty-tax | countyTaxSearch | BOOLEAN | Tax search done |
| 99 | violationsearch | violationSearch | BOOLEAN | Violation search done |
| 100 | httpsofficialrecords.broward.orgacclaimwebsearchsearchtypesimplesearch | simpleSearch | BOOLEAN | Simple search done |
| 101 | httpsdpepp.broward.orgbcsdefault.aspxpossepresentationparcelpermitlistposseobjectid116746 | permitSearch | BOOLEAN | Permit search done |
| 102 | notes2 | notes2 | TEXT | Additional notes |
| 103 | notes3 | notes3 | TEXT | Additional notes |
| 104 | notes4 | notes4 | TEXT | Additional notes |
| 105 | notes5 | notes5 | TEXT | Additional notes |
| 106 | facebookprofile2 | facebookProfile2 | STRING | Facebook URL |
| 107 | facebookprofile3 | facebookProfile3 | STRING | Facebook URL |
| 108 | facebookprofile4 | facebookProfile4 | STRING | Facebook URL |
| 109 | skiptracemanus | skiptraceManus | BOOLEAN | Manus skiptrace done |
| 110 | calledmanus | calledManus | BOOLEAN | Manus called |
| 111 | property_flags | propertyFlags | STRING | Flags/tags |
| 112-174 | (reserved) | (reserved) | - | For future use |

## Contact Fields (Columns 175-328)

Each contact follows this pattern for 14 contacts (contact_1 through contact_14):

### Contact 1-14 Pattern (11 fields each):
- `contact_N_name` → `contact{N}Name`
- `contact_N_flags` → `contact{N}Flags`
- `contact_N_phone1` → `contact{N}Phone1`
- `contact_N_phone1_type` → `contact{N}Phone1Type`
- `contact_N_phone2` → `contact{N}Phone2`
- `contact_N_phone2_type` → `contact{N}Phone2Type`
- `contact_N_phone3` → `contact{N}Phone3`
- `contact_N_phone3_type` → `contact{N}Phone3Type`
- `contact_N_email1` → `contact{N}Email1`
- `contact_N_email2` → `contact{N}Email2`
- `contact_N_email3` → `contact{N}Email3`

**Example for Contact 1 (Columns 175-185):**

| # | DealMachine Column | CRM Field | Type | Notes |
|---|---|---|---|---|
| 175 | contact_1_name | contact1Name | STRING | Contact name |
| 176 | contact_1_flags | contact1Flags | STRING | Contact flags/tags |
| 177 | contact_1_phone1 | contact1Phone1 | STRING | Primary phone |
| 178 | contact_1_phone1_type | contact1Phone1Type | ENUM | Mobile, Home, Work, Other |
| 179 | contact_1_phone2 | contact1Phone2 | STRING | Secondary phone |
| 180 | contact_1_phone2_type | contact1Phone2Type | ENUM | Mobile, Home, Work, Other |
| 181 | contact_1_phone3 | contact1Phone3 | STRING | Tertiary phone |
| 182 | contact_1_phone3_type | contact1Phone3Type | ENUM | Mobile, Home, Work, Other |
| 183 | contact_1_email1 | contact1Email1 | STRING | Primary email |
| 184 | contact_1_email2 | contact1Email2 | STRING | Secondary email |
| 185 | contact_1_email3 | contact1Email3 | STRING | Tertiary email |

**Contacts 2-14 follow the same pattern:**
- Contact 2: Columns 186-196
- Contact 3: Columns 197-207
- Contact 4: Columns 208-218
- Contact 5: Columns 219-229
- Contact 6: Columns 230-240
- Contact 7: Columns 241-251
- Contact 8: Columns 252-262
- Contact 9: Columns 263-273
- Contact 10: Columns 274-284
- Contact 11: Columns 285-295
- Contact 12: Columns 296-306
- Contact 13: Columns 307-317
- Contact 14: Columns 318-328

## Import Strategy

1. **Read DealMachine Excel file** with exact column names (snake_case)
2. **Transform to CRM format** (convert snake_case to camelCase)
3. **Validate required fields**: addressLine1, city, state, zipcode
4. **Check for duplicates** using propertyId
5. **Import property** with all 111 fields
6. **Import contacts** (1-14) with all phone and email data
7. **Auto-assign** to BIN desk with TBD temperature
8. **Add status tag**: "dealmachine_deep_search_chris_edsel_zach"

## Notes

- All DealMachine column names are in **snake_case** (e.g., `property_id`, `address_line_1`)
- CRM database fields are in **camelCase** (e.g., `propertyId`, `addressLine1`)
- Import system must handle both formats transparently
- Contacts can be 1-14 per property (not just 9)
- Each contact has 3 phone numbers and 3 email addresses
- Phone types: Mobile, Home, Work, Other
- Contact flags can indicate relationship type or status
