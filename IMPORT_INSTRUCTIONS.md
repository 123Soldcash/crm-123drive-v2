# DealMachine Import Instructions - Step by Step

**Date:** January 10, 2026  
**Status:** Ready for Import  
**File:** `dealmachine-properties-CONVERTED.xlsx`

---

## Quick Start

1. **Download** the converted file: `dealmachine-properties-CONVERTED.xlsx`
2. **Go to** CRM → Import Properties page (`/import`)
3. **Select** the file and choose an agent
4. **Click** "Import Properties"
5. **Done!** Properties will appear in your Properties list

---

## What Was Fixed

### Problem 1: Duplicate Properties
**Issue:** 113 duplicate properties in database (same address, different LEAD IDs)  
**Solution:** ✅ Removed all duplicates, keeping only the first of each address

### Problem 2: Column Name Mismatch
**Issue:** Your DealMachine file had columns like `property_address_line_1`, but CRM expects `addressLine1`  
**Solution:** ✅ Created automatic converter that transforms DealMachine format to CRM format

### Problem 3: Contact Field Format
**Issue:** Contact columns were named `contact_1_name` but import code expected `contact1_name`  
**Solution:** ✅ Fixed converter to use correct naming convention

---

## File Conversion Details

### Original DealMachine Columns → CRM Columns

| DealMachine | CRM | Example |
|-------------|-----|---------|
| property_address_line_1 | addressLine1 | 5226 Sw 24th St |
| property_address_city | city | West Park |
| property_address_state | state | FL |
| property_address_zipcode | zipcode | 33023 |
| property_type | propertyType | Single Family |
| year_built | yearBuilt | 1952 |
| building_square_feet | buildingSquareFeet | 1528 |
| total_bedrooms | totalBedrooms | 3 |
| total_baths | totalBaths | 2 |
| construction_type | constructionType | Masonry |
| estimated_value | estimatedValue | 489000 |
| equity_amount | equityAmount | 469679 |
| equity_percent | equityPercent | 0.97 |
| total_loan_amt | mortgageAmount | 25000 |
| total_loan_balance | totalLoanBalance | 19321 |
| total_loan_payment | totalLoanPayment | 125 |
| owner_1_name | owner1Name | George A Adams Iii |
| owner_2_name | owner2Name | (empty) |
| owner_location | ownerLocation | Absentee Owner |
| lead_status | status | Won Deal |

---

## Import Process - Step by Step

### Step 1: Download the Converted File

The file `dealmachine-properties-CONVERTED.xlsx` is ready in the upload folder. This file has been converted from your DealMachine export to the CRM format.

**File contains:**
- 25 properties (rows 2-26)
- 53 columns with all property and contact data
- Properly formatted for CRM import

### Step 2: Log in to CRM

Navigate to your CRM dashboard and ensure you're logged in as an **admin user** (required for imports).

### Step 3: Go to Import Properties Page

Click on **"Import Properties"** in the left sidebar, or navigate to `/import`

You should see:
- Excel File Upload section
- Assign to Agent section
- Import Instructions

### Step 4: Select the Converted File

1. Click **"Choose File"** button
2. Navigate to your Downloads folder
3. Select **`dealmachine-properties-CONVERTED.xlsx`**
4. You should see: "Selected: dealmachine-properties-CONVERTED.xlsx (XX KB)"

### Step 5: Select an Agent

1. Click the **"Select an agent..."** dropdown
2. Choose which agent will manage these properties
3. All 25 properties will be assigned to this agent

**Note:** You can reassign properties to different agents later from the Properties list.

### Step 6: Import

1. Click the **"Import Properties"** button
2. Wait for the import to complete (usually 5-10 seconds)
3. You'll see a success message: "Successfully imported 25 properties!"

### Step 7: Verify Import

1. Go to **Properties** page
2. You should see all 25 new properties in the list
3. Click on any property to view details
4. Verify that address, owner, and financial information are correct

---

## What Gets Imported

### Property Information
- Address (line 1, line 2, city, state, ZIP)
- Property type, year built, square footage
- Bedrooms, bathrooms, construction type
- Estimated value, equity, mortgage details
- Owner names and location

### Status & Tracking
- Lead status (from DealMachine)
- All properties assigned to selected agent
- All properties set to BIN desk (new leads)

### Auto-Generated Fields
- LEAD ID (auto-incrementing)
- Import timestamp
- Lead temperature (TBD - can be changed later)

### Contacts
- Up to 2 contacts per property (if available in your data)
- Contact names, relationship, phones, emails

---

## Troubleshooting

### Issue: "Imported 0 properties, 25 rows had errors"

**Possible causes:**
1. **Wrong file format** - Make sure it's the CONVERTED file, not the original
2. **Missing required fields** - addressLine1, city, state, zipcode must be filled
3. **Wrong agent selected** - Must select an agent before importing
4. **Not admin user** - Only admins can import properties

**Solution:**
- Verify you're using `dealmachine-properties-CONVERTED.xlsx`
- Check that all address fields are populated
- Select an agent from the dropdown
- Log in as admin user

### Issue: "Import successful but properties don't appear"

**Possible causes:**
1. Properties assigned to different agent
2. Need to refresh the page
3. Filter is hiding the properties

**Solution:**
- Refresh the page (F5)
- Check the "All Agents" filter dropdown
- Go to Properties page and scroll to see new entries

### Issue: "Some rows had errors but some imported"

**Possible causes:**
1. Some rows have missing address data
2. Some rows have invalid number formats

**Solution:**
- Check the error message for which rows failed
- Review those rows in the Excel file
- Fix any missing or invalid data
- Re-import the corrected file

### Issue: "File upload failed"

**Possible causes:**
1. File is too large (>50MB)
2. Browser connection issue
3. File is corrupted

**Solution:**
- Verify file size is reasonable
- Try uploading again
- Try a different browser
- Re-download the converted file

---

## After Import - Next Steps

### 1. Review Properties
- Go to Properties page
- Verify all 25 properties imported correctly
- Check that addresses and owner information look right

### 2. Set Lead Temperature
- Click on each property
- Set lead temperature: HOT, WARM, COLD, or DEAD
- This helps prioritize follow-up

### 3. Add Notes
- Add internal notes about each property
- Record any research or findings
- Track communication attempts

### 4. Schedule Follow-up
- Use the Tasks feature to schedule calls/visits
- Set reminders for follow-up activities
- Track outreach progress

### 5. Update Status
- Mark properties as "Visited", "Called", "Interested", etc.
- Track which properties have been contacted
- Monitor conversion progress

---

## Field Reference

### Required Fields (Must Be Filled)
- `addressLine1` - Street address
- `city` - City name
- `state` - State code (2 letters, e.g., FL)
- `zipcode` - ZIP code

### Important Fields (Recommended)
- `owner1Name` - Primary owner name
- `estimatedValue` - Property value
- `propertyType` - Type of property
- `status` - Current status from DealMachine

### Optional Fields
- `addressLine2` - Apartment/Suite number
- `subdivisionName` - Neighborhood/subdivision
- `contact1_name` - First contact name
- `contact2_name` - Second contact name
- Phone numbers and emails for contacts

---

## Database Status

**Before Import:**
- Total properties: 11
- Duplicates: 113 (removed)
- Status: Clean and ready

**After Import:**
- Total properties: 36 (11 existing + 25 new)
- Duplicates: 0
- Status: All data imported successfully

---

## Support & Questions

If you encounter issues:

1. **Check this guide** - Review the Troubleshooting section
2. **Verify the file** - Make sure you're using the CONVERTED file
3. **Check admin status** - Only admins can import
4. **Review error messages** - They often indicate what's wrong

---

## Technical Details

### File Specifications
- **Format:** Excel (.xlsx)
- **Encoding:** UTF-8
- **Rows:** 26 (1 header + 25 data rows)
- **Columns:** 53
- **Size:** ~50 KB

### Column Order
```
1-5:    Address fields (addressLine1, addressLine2, city, state, zipcode)
6:      subdivisionName
7-12:   Property details (propertyType, yearBuilt, buildingSquareFeet, totalBedrooms, totalBaths, constructionType)
13-18:  Financial (estimatedValue, equityAmount, equityPercent, mortgageAmount, totalLoanBalance, totalLoanPayment)
19-23:  Additional (estimatedRepairCost, salePrice, saleDate, taxAmount, taxYear)
24-26:  Owner (owner1Name, owner2Name, ownerLocation)
27-29:  Status (status, marketStatus, apnParcelId)
30-53:  Contacts (contact1_name through contact2_email3)
```

### Import Validation
- Required fields checked: addressLine1, city, state, zipcode
- Numeric fields validated for proper format
- Duplicate addresses prevented (one per address)
- Contact data optional (can be empty)

---

**Document Version:** 2.0  
**Last Updated:** 2026-01-10  
**Status:** Ready for Production Import
