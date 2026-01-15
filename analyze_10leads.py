#!/usr/bin/env python3
"""Analyze 10 leads Excel file to identify all data fields and values"""

import pandas as pd
import json

# Read the Excel file
excel_file = '/home/ubuntu/crm-123drive-v2/dealmachine-properties-2026-01-12-220953_rolando10leads.xlsx'
df = pd.read_excel(excel_file)

print("=" * 80)
print("10 LEADS EXCEL FILE ANALYSIS")
print("=" * 80)
print(f"\nTotal rows: {len(df)}")
print(f"Total columns: {len(df.columns)}")

# Show all column names
print("\n" + "=" * 80)
print("ALL COLUMNS")
print("=" * 80)
for i, col in enumerate(df.columns, 1):
    print(f"{i:3d}. {col}")

# Show property addresses (first 10)
print("\n" + "=" * 80)
print("PROPERTY ADDRESSES")
print("=" * 80)
for idx, row in df.head(10).iterrows():
    lead_id = row.get('lead_id', 'N/A')
    address = row.get('property_address', 'N/A')
    city = row.get('property_city', 'N/A')
    state = row.get('property_state', 'N/A')
    print(f"{lead_id}: {address}, {city}, {state}")

# Count contacts per property
print("\n" + "=" * 80)
print("CONTACTS PER PROPERTY")
print("=" * 80)
for idx, row in df.head(10).iterrows():
    lead_id = row.get('lead_id', 'N/A')
    contact_count = 0
    for i in range(1, 21):
        if pd.notna(row.get(f'contact_{i}_name')):
            contact_count += 1
    print(f"{lead_id}: {contact_count} contacts")

# Count phones and emails
print("\n" + "=" * 80)
print("PHONES AND EMAILS PER PROPERTY")
print("=" * 80)
for idx, row in df.head(10).iterrows():
    lead_id = row.get('lead_id', 'N/A')
    phone_count = 0
    email_count = 0
    for i in range(1, 21):
        for j in range(1, 4):
            if pd.notna(row.get(f'contact_{i}_phone{j}')):
                phone_count += 1
            if pd.notna(row.get(f'contact_{i}_email{j}')):
                email_count += 1
    print(f"{lead_id}: {phone_count} phones, {email_count} emails")

# Show property flags
print("\n" + "=" * 80)
print("PROPERTY FLAGS")
print("=" * 80)
for idx, row in df.head(10).iterrows():
    lead_id = row.get('lead_id', 'N/A')
    flags = row.get('property_flags', 'N/A')
    print(f"{lead_id}: {flags}")

# Show key property details
print("\n" + "=" * 80)
print("KEY PROPERTY DETAILS")
print("=" * 80)
key_fields = [
    'lead_id', 'property_address', 'property_city', 'property_state', 'property_zip',
    'property_bedrooms', 'property_bathrooms', 'property_sqft', 'property_lot_sqft',
    'property_year_built', 'property_assessed_value', 'property_estimated_value',
    'property_estimated_equity', 'property_mortgage_balance', 'property_last_sale_date',
    'property_last_sale_amount', 'property_owner_occupied', 'property_lat', 'property_lng'
]

for idx, row in df.head(10).iterrows():
    lead_id = row.get('lead_id', 'N/A')
    print(f"\n{lead_id}:")
    for field in key_fields:
        value = row.get(field, 'N/A')
        if pd.notna(value) and value != 'N/A' and value != '':
            print(f"  {field}: {value}")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
