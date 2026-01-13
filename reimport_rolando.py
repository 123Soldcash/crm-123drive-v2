#!/usr/bin/env python3
"""
Complete Reimport Script for Rolando Excel Data
This script will:
1. Delete all existing contacts, phones, emails for Rolando properties
2. Reimport ALL 20 contacts per property with ALL phones and emails
3. Import property_flags as tags
4. Store lat/lng/county/dealMachineUrl properly
"""

import pandas as pd
import mysql.connector
import os
import json
from datetime import datetime

# Database connection
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'gateway01.us-east-1.prod.aws.tidbcloud.com'),
    'port': int(os.environ.get('DB_PORT', 4000)),
    'user': os.environ.get('DB_USER'),
    'password': os.environ.get('DB_PASSWORD'),
    'database': os.environ.get('DB_NAME'),
    'ssl_ca': '/etc/ssl/certs/ca-certificates.crt',
    'ssl_verify_cert': True
}

def get_db_connection():
    """Get database connection from environment"""
    # Read from .env file if exists
    env_path = '/home/ubuntu/crm-123drive-v2/.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value.strip('"').strip("'")
    
    # Parse DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if db_url:
        # Format: mysql://user:pass@host:port/database
        import re
        match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', db_url)
        if match:
            return mysql.connector.connect(
                host=match.group(3),
                port=int(match.group(4)),
                user=match.group(1),
                password=match.group(2),
                database=match.group(5),
                ssl_ca='/etc/ssl/certs/ca-certificates.crt',
                ssl_verify_cert=True
            )
    
    raise Exception("Could not parse DATABASE_URL")

def clean_phone(phone):
    """Clean phone number - remove .0 suffix and format"""
    if pd.isna(phone) or not phone:
        return None
    phone_str = str(phone).replace('.0', '').strip()
    if not phone_str or phone_str == 'nan':
        return None
    # Remove any non-digit characters except +
    cleaned = ''.join(c for c in phone_str if c.isdigit() or c == '+')
    return cleaned if cleaned else None

def clean_email(email):
    """Clean email address"""
    if pd.isna(email) or not email:
        return None
    email_str = str(email).strip().lower()
    if not email_str or email_str == 'nan' or '@' not in email_str:
        return None
    return email_str

def main():
    print("=" * 80)
    print("ROLANDO EXCEL COMPLETE REIMPORT")
    print("=" * 80)
    
    # Load Excel file
    file_path = '/home/ubuntu/crm-123drive-v2/dealmachine-properties-2026-01-12-220953_rolando.xlsx'
    print(f"\n📂 Loading Excel file: {file_path}")
    df = pd.read_excel(file_path)
    print(f"   Found {len(df)} properties in Excel")
    
    # Connect to database
    print(f"\n🔌 Connecting to database...")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    print("   Connected successfully!")
    
    # Step 1: Get all property IDs with dealMachinePropertyId
    print(f"\n🔍 Finding existing Rolando properties...")
    cursor.execute("SELECT id, dealMachinePropertyId FROM properties WHERE dealMachinePropertyId IS NOT NULL")
    existing_props = {str(row['dealMachinePropertyId']): row['id'] for row in cursor.fetchall()}
    print(f"   Found {len(existing_props)} existing Rolando properties in database")
    
    # Step 2: Delete existing contacts, phones, emails for these properties
    if existing_props:
        prop_ids = list(existing_props.values())
        print(f"\n🗑️  Cleaning existing contact data...")
        
        # Get contact IDs for these properties
        format_strings = ','.join(['%s'] * len(prop_ids))
        cursor.execute(f"SELECT id FROM contacts WHERE propertyId IN ({format_strings})", prop_ids)
        contact_ids = [row['id'] for row in cursor.fetchall()]
        
        if contact_ids:
            contact_format = ','.join(['%s'] * len(contact_ids))
            
            # Delete phones
            cursor.execute(f"DELETE FROM contactPhones WHERE contactId IN ({contact_format})", contact_ids)
            phones_deleted = cursor.rowcount
            print(f"   Deleted {phones_deleted} phone records")
            
            # Delete emails
            cursor.execute(f"DELETE FROM contactEmails WHERE contactId IN ({contact_format})", contact_ids)
            emails_deleted = cursor.rowcount
            print(f"   Deleted {emails_deleted} email records")
            
            # Delete contacts
            cursor.execute(f"DELETE FROM contacts WHERE propertyId IN ({format_strings})", prop_ids)
            contacts_deleted = cursor.rowcount
            print(f"   Deleted {contacts_deleted} contact records")
        
        conn.commit()
    
    # Step 3: Import all contacts from Excel
    print(f"\n📥 Importing contacts from Excel...")
    
    total_contacts = 0
    total_phones = 0
    total_emails = 0
    properties_updated = 0
    
    for idx, row in df.iterrows():
        property_id_dm = str(row.get('property_id', ''))
        
        if property_id_dm not in existing_props:
            continue
        
        property_id = existing_props[property_id_dm]
        properties_updated += 1
        
        # Update property with flags as tags
        property_flags = row.get('property_flags', '')
        if pd.notna(property_flags) and property_flags:
            flags_list = [f.strip() for f in str(property_flags).split(',') if f.strip()]
            tags_json = json.dumps(flags_list)
            cursor.execute("UPDATE properties SET tags = %s WHERE id = %s", (tags_json, property_id))
        
        # Update property with lat/lng/county
        lat = row.get('property_lat')
        lng = row.get('property_lng')
        county = row.get('property_address_county')
        dm_url = row.get('dealmachine_url')
        
        raw_data = {}
        if pd.notna(lat):
            raw_data['lat'] = float(lat)
        if pd.notna(lng):
            raw_data['lng'] = float(lng)
        if pd.notna(county):
            raw_data['county'] = str(county)
        if pd.notna(dm_url):
            raw_data['dealMachineUrl'] = str(dm_url)
        
        if raw_data:
            cursor.execute("UPDATE properties SET dealMachineRawData = %s WHERE id = %s", 
                          (json.dumps(raw_data), property_id))
        
        # Import ALL 20 contacts
        for contact_num in range(1, 21):
            name_col = f'contact_{contact_num}_name'
            flags_col = f'contact_{contact_num}_flags'
            
            if name_col not in df.columns:
                continue
            
            contact_name = row.get(name_col)
            if pd.isna(contact_name) or not str(contact_name).strip():
                continue
            
            contact_name = str(contact_name).strip()
            contact_flags = str(row.get(flags_col, '')) if pd.notna(row.get(flags_col)) else ''
            
            # Determine relationship from flags
            relationship = 'Other'
            if 'Likely Owner' in contact_flags:
                relationship = 'Owner'
            elif 'Resident' in contact_flags:
                relationship = 'Resident'
            elif 'Relative' in contact_flags:
                relationship = 'Relative'
            
            # Insert contact
            cursor.execute("""
                INSERT INTO contacts (propertyId, name, relationship, createdAt, updatedAt)
                VALUES (%s, %s, %s, NOW(), NOW())
            """, (property_id, contact_name, relationship))
            contact_id = cursor.lastrowid
            total_contacts += 1
            
            # Import all 3 phones
            for phone_num in range(1, 4):
                phone_col = f'contact_{contact_num}_phone{phone_num}'
                if phone_col in df.columns:
                    phone = clean_phone(row.get(phone_col))
                    if phone:
                        cursor.execute("""
                            INSERT INTO contactPhones (contactId, phoneNumber, createdAt)
                            VALUES (%s, %s, NOW())
                        """, (contact_id, phone))
                        total_phones += 1
            
            # Import all 3 emails
            for email_num in range(1, 4):
                email_col = f'contact_{contact_num}_email{email_num}'
                if email_col in df.columns:
                    email = clean_email(row.get(email_col))
                    if email:
                        cursor.execute("""
                            INSERT INTO contactEmails (contactId, email, createdAt)
                            VALUES (%s, %s, NOW())
                        """, (contact_id, email))
                        total_emails += 1
        
        # Progress update every 50 properties
        if (idx + 1) % 50 == 0:
            print(f"   Processed {idx + 1}/{len(df)} properties...")
            conn.commit()
    
    # Final commit
    conn.commit()
    
    # Step 4: Verify counts
    print(f"\n✅ IMPORT COMPLETE!")
    print("=" * 80)
    print(f"   Properties updated: {properties_updated}")
    print(f"   Contacts imported: {total_contacts}")
    print(f"   Phones imported: {total_phones}")
    print(f"   Emails imported: {total_emails}")
    
    # Verify in database
    print(f"\n🔍 Verifying database counts...")
    cursor.execute("SELECT COUNT(*) as cnt FROM contacts")
    db_contacts = cursor.fetchone()['cnt']
    cursor.execute("SELECT COUNT(*) as cnt FROM contactPhones")
    db_phones = cursor.fetchone()['cnt']
    cursor.execute("SELECT COUNT(*) as cnt FROM contactEmails")
    db_emails = cursor.fetchone()['cnt']
    
    print(f"   Database contacts: {db_contacts}")
    print(f"   Database phones: {db_phones}")
    print(f"   Database emails: {db_emails}")
    
    # Close connection
    cursor.close()
    conn.close()
    
    print(f"\n🎉 Reimport completed successfully!")

if __name__ == '__main__':
    main()
