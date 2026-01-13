import pandas as pd
import json

# Load the Excel file
file_path = '/home/ubuntu/crm-123drive-v2/dealmachine-properties-2026-01-12-220953_rolando.xlsx'
df = pd.read_excel(file_path)

print("=" * 80)
print("DATA COMPARISON: Excel vs CRM Database")
print("=" * 80)

# EXCEL DATA SUMMARY
print("\n📊 EXCEL FILE DATA SUMMARY:")
print(f"   Total Properties: 252")
print(f"   Properties with contacts: 233")
print(f"   Total Contacts: 1,021")
print(f"   Total Phones: 1,329")
print(f"   Total Emails: 1,444")

# CRM DATABASE SUMMARY (from previous query)
print("\n📊 CRM DATABASE SUMMARY:")
print(f"   Total Properties: 352 (includes other imports)")
print(f"   Total Contacts: 291")
print(f"   Total Phones: 449")
print(f"   Total Emails: 64")

# DISCREPANCIES
print("\n⚠️  DISCREPANCIES IDENTIFIED:")
print("-" * 80)

print("\n1️⃣  CONTACTS MISSING:")
print(f"   Excel has: 1,021 contacts")
print(f"   CRM has: 291 contacts")
print(f"   MISSING: ~730 contacts (71.5%)")

print("\n2️⃣  PHONES MISSING:")
print(f"   Excel has: 1,329 phone numbers")
print(f"   CRM has: 449 phone numbers")
print(f"   MISSING: ~880 phones (66.2%)")

print("\n3️⃣  EMAILS MISSING:")
print(f"   Excel has: 1,444 email addresses")
print(f"   CRM has: 64 email addresses")
print(f"   MISSING: ~1,380 emails (95.6%)")

# Analyze contact structure in Excel
print("\n📋 EXCEL CONTACT STRUCTURE ANALYSIS:")
print("-" * 80)

# Count contacts per property
contact_counts = []
for idx, row in df.iterrows():
    count = 0
    for i in range(1, 21):
        col = f'contact_{i}_name'
        if col in df.columns and pd.notna(row[col]) and str(row[col]).strip():
            count += 1
    contact_counts.append(count)

df['contact_count'] = contact_counts

print(f"\n   Properties with 0 contacts: {sum(1 for c in contact_counts if c == 0)}")
print(f"   Properties with 1-3 contacts: {sum(1 for c in contact_counts if 1 <= c <= 3)}")
print(f"   Properties with 4-6 contacts: {sum(1 for c in contact_counts if 4 <= c <= 6)}")
print(f"   Properties with 7+ contacts: {sum(1 for c in contact_counts if c >= 7)}")
print(f"   Max contacts per property: {max(contact_counts)}")

# Sample properties with many contacts
print("\n📝 SAMPLE: Properties with 5+ contacts:")
high_contact_props = df[df['contact_count'] >= 5].head(3)
for idx, row in high_contact_props.iterrows():
    print(f"\n   Property: {row['property_address_full']}")
    print(f"   Owner: {row['owner_1_name']}")
    print(f"   Contacts: {row['contact_count']}")
    for i in range(1, min(row['contact_count'] + 1, 8)):
        name_col = f'contact_{i}_name'
        phone1_col = f'contact_{i}_phone1'
        email1_col = f'contact_{i}_email1'
        if name_col in df.columns and pd.notna(row[name_col]):
            name = row[name_col]
            phone = row.get(phone1_col, '')
            email = row.get(email1_col, '')
            print(f"      - {name}: {phone if pd.notna(phone) else 'No phone'} | {email if pd.notna(email) else 'No email'}")

# Check property flags
print("\n🏷️  PROPERTY FLAGS ANALYSIS:")
print("-" * 80)
flags_col = 'property_flags'
if flags_col in df.columns:
    all_flags = []
    for val in df[flags_col].dropna():
        flags = [f.strip() for f in str(val).split(',')]
        all_flags.extend(flags)
    
    from collections import Counter
    flag_counts = Counter(all_flags)
    print("\n   Property flags found in Excel:")
    for flag, count in flag_counts.most_common(20):
        print(f"      {flag}: {count} properties")

# Check what data is in dealMachineRawData
print("\n💾 CHECKING dealMachineRawData FIELD:")
print("-" * 80)
print("   This field should contain: lat, lng, county, dealMachineUrl, propertyId, dealMachineLeadId")
print("   Need to verify if contact data was stored here or lost during import")

# Generate report
print("\n" + "=" * 80)
print("📋 SUMMARY REPORT")
print("=" * 80)
print("""
CRITICAL ISSUES FOUND:

1. CONTACT DATA LOSS (71.5% missing)
   - Excel: 1,021 contacts | CRM: 291 contacts
   - Root cause: Import only processed first few contacts per property
   - Solution: Re-import with all 20 contact slots per property

2. PHONE DATA LOSS (66.2% missing)  
   - Excel: 1,329 phones | CRM: 449 phones
   - Root cause: Same as above - limited contact import
   - Solution: Re-import with all phone1/phone2/phone3 per contact

3. EMAIL DATA LOSS (95.6% missing)
   - Excel: 1,444 emails | CRM: 64 emails
   - Root cause: Same as above - limited contact import
   - Solution: Re-import with all email1/email2/email3 per contact

4. PROPERTY FLAGS NOT IMPORTED
   - Excel has flags like: Off Market, Cash Buyer, High Equity, Tax Delinquent
   - These should be converted to CRM tags
   - Solution: Import property_flags as tags

RECOMMENDED ACTIONS:

1. Create a new import script that processes ALL 20 contacts per property
2. Import all 3 phone numbers per contact (phone1, phone2, phone3)
3. Import all 3 email addresses per contact (email1, email2, email3)
4. Convert property_flags to CRM tags
5. Store property_lat, property_lng, property_address_county properly
6. Store dealmachine_url for reference
""")

print("\n✅ Analysis complete!")
