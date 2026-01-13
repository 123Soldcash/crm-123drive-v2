import pandas as pd
import json

# Load the Excel file
file_path = '/home/ubuntu/crm-123drive-v2/dealmachine-properties-2026-01-12-220953_rolando.xlsx'
df = pd.read_excel(file_path)

print("=" * 80)
print("EXCEL FILE ANALYSIS - DealMachine Rolando Properties")
print("=" * 80)

# Basic info
print(f"\n📊 BASIC INFO:")
print(f"   Total rows: {len(df)}")
print(f"   Total columns: {len(df.columns)}")

# Column names
print(f"\n📋 ALL COLUMN NAMES ({len(df.columns)} columns):")
for i, col in enumerate(df.columns):
    print(f"   {i+1}. {col}")

# Check for contact-related columns
print(f"\n📞 CONTACT-RELATED COLUMNS:")
contact_cols = [col for col in df.columns if 'contact' in col.lower() or 'phone' in col.lower() or 'email' in col.lower()]
for col in contact_cols:
    non_null = df[col].notna().sum()
    print(f"   {col}: {non_null} non-null values")

# Check for property address columns
print(f"\n🏠 ADDRESS-RELATED COLUMNS:")
address_cols = [col for col in df.columns if 'address' in col.lower() or 'city' in col.lower() or 'state' in col.lower() or 'zip' in col.lower()]
for col in address_cols:
    non_null = df[col].notna().sum()
    print(f"   {col}: {non_null} non-null values")

# Check for owner columns
print(f"\n👤 OWNER-RELATED COLUMNS:")
owner_cols = [col for col in df.columns if 'owner' in col.lower()]
for col in owner_cols:
    non_null = df[col].notna().sum()
    print(f"   {col}: {non_null} non-null values")

# Check for value/financial columns
print(f"\n💰 FINANCIAL-RELATED COLUMNS:")
financial_cols = [col for col in df.columns if 'value' in col.lower() or 'price' in col.lower() or 'equity' in col.lower() or 'mortgage' in col.lower() or 'tax' in col.lower()]
for col in financial_cols:
    non_null = df[col].notna().sum()
    print(f"   {col}: {non_null} non-null values")

# Sample data from first 3 rows
print(f"\n📝 SAMPLE DATA (First 3 rows):")
print("-" * 80)
for idx in range(min(3, len(df))):
    print(f"\n--- Row {idx + 1} ---")
    row = df.iloc[idx]
    for col in df.columns[:30]:  # First 30 columns
        val = row[col]
        if pd.notna(val) and str(val).strip():
            print(f"   {col}: {val}")

# Count contacts per property
print(f"\n📊 CONTACT STATISTICS:")
contact_name_cols = [col for col in df.columns if col.startswith('contact_') and col.endswith('_name')]
print(f"   Number of contact name columns: {len(contact_name_cols)}")
print(f"   Contact columns found: {contact_name_cols[:5]}...")

# Count properties with contacts
props_with_contacts = 0
total_contacts = 0
for idx, row in df.iterrows():
    for col in contact_name_cols:
        if pd.notna(row[col]) and str(row[col]).strip():
            total_contacts += 1
            props_with_contacts += 1
            break

print(f"   Properties with at least 1 contact: {props_with_contacts}")

# Count total contacts
total_contacts = 0
for col in contact_name_cols:
    total_contacts += df[col].notna().sum()
print(f"   Total contacts in Excel: {total_contacts}")

# Count phones
phone_cols = [col for col in df.columns if col.startswith('contact_') and 'phone' in col.lower()]
print(f"   Phone columns found: {len(phone_cols)}")
total_phones = 0
for col in phone_cols:
    total_phones += df[col].notna().sum()
print(f"   Total phones in Excel: {total_phones}")

# Count emails
email_cols = [col for col in df.columns if col.startswith('contact_') and 'email' in col.lower()]
print(f"   Email columns found: {len(email_cols)}")
total_emails = 0
for col in email_cols:
    total_emails += df[col].notna().sum()
print(f"   Total emails in Excel: {total_emails}")

# Save detailed analysis to file
print(f"\n💾 Saving detailed column analysis to file...")
with open('/home/ubuntu/crm-123drive-v2/excel_analysis.txt', 'w') as f:
    f.write("EXCEL FILE DETAILED ANALYSIS\n")
    f.write("=" * 80 + "\n\n")
    
    f.write(f"Total rows: {len(df)}\n")
    f.write(f"Total columns: {len(df.columns)}\n\n")
    
    f.write("ALL COLUMNS:\n")
    for i, col in enumerate(df.columns):
        non_null = df[col].notna().sum()
        f.write(f"{i+1}. {col} ({non_null} values)\n")
    
    f.write("\n\nSAMPLE DATA (First 5 rows, all columns):\n")
    f.write("-" * 80 + "\n")
    for idx in range(min(5, len(df))):
        f.write(f"\n--- Row {idx + 1} ---\n")
        row = df.iloc[idx]
        for col in df.columns:
            val = row[col]
            if pd.notna(val) and str(val).strip():
                f.write(f"   {col}: {val}\n")

print("Analysis complete!")
