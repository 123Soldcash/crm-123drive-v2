#!/usr/bin/env python3.11
"""
DealMachine Consolidated Data Import Script - FIXED VERSION
============================================
This version works with the transformed CSV that has properly indexed columns:
- contact_N_phone_M_number, contact_N_phone_M_type, contact_N_phone_M_primary
- contact_N_email_M, contact_N_email_M_primary
"""

import pandas as pd
import mysql.connector
import os
import re
import json
from datetime import datetime
import sys

# Database connection
DB_CONFIG = {
    'host': 'gateway02.us-east-1.prod.aws.tidbcloud.com',
    'port': 4000,
    'user': '2HoMEWBM6m36fKT.7b334260735d',
    'password': 'M7RP8J9kv2sCxT8PX0yf',
    'database': 'RDbAfwHQBDqo37pina3pDu',
    'ssl_ca': '/etc/ssl/certs/ca-certificates.crt',
    'ssl_verify_cert': True,
}

def clean_currency(value):
    """Convert currency string to integer"""
    if pd.isna(value) or value == '':
        return None
    cleaned = re.sub(r'[$,\s]', '', str(value))
    try:
        return int(float(cleaned))
    except:
        return None

def clean_phone(phone):
    """Clean phone number to digits only"""
    if pd.isna(phone) or phone == '':
        return None
    cleaned = re.sub(r'\D', '', str(phone))
    if 'e' in str(phone).lower() or '.' in str(phone):
        try:
            cleaned = str(int(float(phone)))
        except:
            pass
    if len(cleaned) >= 10:
        return cleaned[-10:]
    return None

def normalize_address(address):
    """Normalize address for comparison"""
    if pd.isna(address) or address == '':
        return ''
    addr = str(address).lower().strip()
    addr = re.sub(r'\s+', ' ', addr)
    addr = addr.replace(' street', ' st').replace(' avenue', ' ave')
    addr = addr.replace(' road', ' rd').replace(' drive', ' dr')
    addr = addr.replace(' boulevard', ' blvd').replace(' lane', ' ln')
    addr = addr.replace(' court', ' ct').replace(' place', ' pl')
    return addr

def get_existing_properties(cursor):
    """Get all existing properties with their identifiers"""
    cursor.execute("""
        SELECT id, leadId, apnParcelId, propertyId, 
               LOWER(CONCAT(addressLine1, ', ', city, ', ', state, ' ', zipcode)) as full_address
        FROM properties
    """)
    properties = {}
    for row in cursor.fetchall():
        prop_id, lead_id, apn, dm_prop_id, full_addr = row
        properties[prop_id] = {
            'id': prop_id,
            'leadId': lead_id,
            'apnParcelId': apn,
            'propertyId': dm_prop_id,
            'fullAddress': full_addr
        }
    return properties

def find_matching_property(row, existing_properties):
    """Find matching property using multiple strategies"""
    apn = str(row.get('apn_parcel_id', '')).strip() if pd.notna(row.get('apn_parcel_id')) else ''
    dm_prop_id = str(row.get('property_id', '')).strip() if pd.notna(row.get('property_id')) else ''
    csv_address = normalize_address(f"{row.get('property_address_full', '')}")
    
    for prop_id, prop in existing_properties.items():
        # Strategy 1: Match by APN
        if apn and prop['apnParcelId'] and prop['apnParcelId'] == apn:
            return prop_id, 'APN'
        # Strategy 2: Match by DealMachine property_id
        if dm_prop_id and prop['propertyId'] and str(prop['propertyId']) == dm_prop_id:
            return prop_id, 'property_id'
        # Strategy 3: Match by address
        if csv_address and prop['fullAddress'] and csv_address in prop['fullAddress']:
            return prop_id, 'address'
    
    return None, None

def get_existing_contacts(cursor, property_id):
    """Get existing contacts for a property"""
    cursor.execute("""
        SELECT id, name FROM contacts WHERE propertyId = %s
    """, (property_id,))
    return {row[1].lower() if row[1] else '': row[0] for row in cursor.fetchall()}

def insert_contact(cursor, property_id, contact_data):
    """Insert a new contact and return its ID"""
    cursor.execute("""
        INSERT INTO contacts (propertyId, name, flags, currentAddress, createdAt, updatedAt)
        VALUES (%s, %s, %s, %s, NOW(), NOW())
    """, (
        property_id,
        contact_data.get('name'),
        contact_data.get('flags'),
        contact_data.get('mailing_address')
    ))
    return cursor.lastrowid

def insert_phone(cursor, contact_id, phone, phone_type='Mobile', is_primary=0):
    """Insert a phone number for a contact"""
    if not phone:
        return
    cursor.execute("""
        INSERT INTO contactPhones (contactId, phoneNumber, phoneType, isPrimary, createdAt)
        VALUES (%s, %s, %s, %s, NOW())
        ON DUPLICATE KEY UPDATE phoneNumber = phoneNumber
    """, (contact_id, phone, phone_type, is_primary))

def insert_email(cursor, contact_id, email, is_primary=0):
    """Insert an email for a contact"""
    if not email or pd.isna(email):
        return
    cursor.execute("""
        INSERT INTO contactEmails (contactId, email, isPrimary, createdAt)
        VALUES (%s, %s, %s, NOW())
        ON DUPLICATE KEY UPDATE email = email
    """, (contact_id, str(email).strip().lower(), is_primary))

def update_property(cursor, property_id, updates):
    """Update property fields"""
    if not updates:
        return
    
    set_clauses = []
    values = []
    for field, value in updates.items():
        if value is not None:
            set_clauses.append(f"{field} = %s")
            values.append(value)
    
    if set_clauses:
        values.append(property_id)
        cursor.execute(f"""
            UPDATE properties SET {', '.join(set_clauses)} WHERE id = %s
        """, values)

def main():
    # Check command line argument
    if len(sys.argv) < 2:
        print("Usage: python3.11 import_consolidated_data_FIXED.py <csv_file>")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    
    # Load CSV
    print(f"Loading CSV from {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} rows")
    
    # Connect to database
    print("Connecting to database...")
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Get existing properties
    print("Loading existing properties...")
    existing_properties = get_existing_properties(cursor)
    print(f"Found {len(existing_properties)} existing properties")
    
    # Statistics
    stats = {
        'matched_apn': 0,
        'matched_property_id': 0,
        'matched_address': 0,
        'not_matched': 0,
        'contacts_added': 0,
        'phones_added': 0,
        'emails_added': 0,
        'properties_updated': 0,
        'unmatched_data': []
    }
    
    # Process each row
    for idx, row in df.iterrows():
        apn = str(row.get('apn_parcel_id', '')).strip() if pd.notna(row.get('apn_parcel_id')) else ''
        address = row.get('property_address_full', '')
        
        # Find matching property
        property_id, match_type = find_matching_property(row, existing_properties)
        
        if property_id:
            if match_type == 'APN':
                stats['matched_apn'] += 1
            elif match_type == 'property_id':
                stats['matched_property_id'] += 1
            else:
                stats['matched_address'] += 1
            
            print(f"[{idx+1}/{len(df)}] Matched: {address} (via {match_type})")
            
            # Update property fields
            updates = {}
            if apn and not existing_properties[property_id].get('apnParcelId'):
                updates['apnParcelId'] = apn
            if clean_currency(row.get('estimated_value')):
                updates['estimatedValue'] = clean_currency(row.get('estimated_value'))
            if clean_currency(row.get('equity_amount')):
                updates['equityAmount'] = clean_currency(row.get('equity_amount'))
            if pd.notna(row.get('year_built')):
                try:
                    updates['yearBuilt'] = int(row.get('year_built'))
                except:
                    pass
            if pd.notna(row.get('bedrooms')):
                try:
                    updates['totalBedrooms'] = int(row.get('bedrooms'))
                except:
                    pass
            if pd.notna(row.get('bathrooms')):
                try:
                    updates['totalBaths'] = int(float(row.get('bathrooms')))
                except:
                    pass
            if pd.notna(row.get('property_type')):
                updates['propertyType'] = str(row.get('property_type'))
            if pd.notna(row.get('market_status')):
                updates['marketStatus'] = str(row.get('market_status'))
            if clean_currency(row.get('estimated_repair_cost')):
                updates['estimatedRepairCost'] = clean_currency(row.get('estimated_repair_cost'))
            if pd.notna(row.get('owner_1_name')):
                updates['owner1Name'] = str(row.get('owner_1_name'))
            if pd.notna(row.get('owner_2_name')):
                updates['owner2Name'] = str(row.get('owner_2_name'))
            
            dm_prop_id = str(row.get('property_id', '')).strip() if pd.notna(row.get('property_id')) else ''
            if dm_prop_id and not existing_properties[property_id].get('propertyId'):
                updates['propertyId'] = dm_prop_id
            
            if updates:
                update_property(cursor, property_id, updates)
                stats['properties_updated'] += 1
            
            # Get existing contacts for this property
            existing_contacts = get_existing_contacts(cursor, property_id)
            
            # Process contacts (up to 15) - NEW FORMAT
            for i in range(1, 16):
                contact_name = row.get(f'contact_{i}_full_name')
                if pd.isna(contact_name) or not contact_name:
                    continue
                
                contact_name = str(contact_name).strip()
                contact_name_lower = contact_name.lower()
                
                # Check if contact already exists
                if contact_name_lower in existing_contacts:
                    contact_id = existing_contacts[contact_name_lower]
                else:
                    # Create new contact
                    contact_data = {
                        'name': contact_name,
                        'flags': row.get(f'contact_{i}_flags') if pd.notna(row.get(f'contact_{i}_flags')) else None,
                        'mailing_address': row.get(f'contact_{i}_mailing_address') if pd.notna(row.get(f'contact_{i}_mailing_address')) else None,
                    }
                    contact_id = insert_contact(cursor, property_id, contact_data)
                    stats['contacts_added'] += 1
                    existing_contacts[contact_name_lower] = contact_id
                
                # Add phones - NEW FORMAT: contact_N_phone_M_number, contact_N_phone_M_type, contact_N_phone_M_primary
                for j in range(1, 6):  # Up to 5 phones per contact
                    phone_col = f'contact_{i}_phone_{j}_number'
                    type_col = f'contact_{i}_phone_{j}_type'
                    primary_col = f'contact_{i}_phone_{j}_primary'
                    
                    if phone_col not in row.index:
                        break
                    
                    phone_number = row.get(phone_col)
                    if pd.notna(phone_number) and phone_number:
                        cleaned_phone = clean_phone(phone_number)
                        if cleaned_phone:
                            phone_type = row.get(type_col) if pd.notna(row.get(type_col)) else 'Mobile'
                            is_primary = int(row.get(primary_col)) if pd.notna(row.get(primary_col)) else 0
                            insert_phone(cursor, contact_id, cleaned_phone, phone_type, is_primary)
                            stats['phones_added'] += 1
                
                # Add emails - NEW FORMAT: contact_N_email_M, contact_N_email_M_primary
                for j in range(1, 6):  # Up to 5 emails per contact
                    email_col = f'contact_{i}_email_{j}'
                    primary_col = f'contact_{i}_email_{j}_primary'
                    
                    if email_col not in row.index:
                        break
                    
                    email = row.get(email_col)
                    if pd.notna(email) and email and '@' in str(email):
                        is_primary = int(row.get(primary_col)) if pd.notna(row.get(primary_col)) else 0
                        insert_email(cursor, contact_id, email, is_primary)
                        stats['emails_added'] += 1
        
        else:
            stats['not_matched'] += 1
            print(f"[{idx+1}/{len(df)}] NOT MATCHED: {address} (APN: {apn})")
            
            # Store unmatched data
            unmatched_info = {
                'apn': apn,
                'address': address,
                'property_id': str(row.get('property_id', '')) if pd.notna(row.get('property_id')) else '',
                'contacts': []
            }
            for i in range(1, 16):
                contact_name = row.get(f'contact_{i}_full_name')
                if pd.notna(contact_name) and contact_name:
                    unmatched_info['contacts'].append({
                        'name': str(contact_name),
                    })
            stats['unmatched_data'].append(unmatched_info)
    
    # Commit changes
    conn.commit()
    
    # Print summary
    print("\n" + "="*60)
    print("IMPORT SUMMARY")
    print("="*60)
    print(f"Total rows in CSV: {len(df)}")
    print(f"Matched by APN: {stats['matched_apn']}")
    print(f"Matched by property_id: {stats['matched_property_id']}")
    print(f"Matched by address: {stats['matched_address']}")
    print(f"NOT MATCHED: {stats['not_matched']}")
    print(f"Properties updated: {stats['properties_updated']}")
    print(f"Contacts added: {stats['contacts_added']}")
    print(f"Phones added: {stats['phones_added']}")
    print(f"Emails added: {stats['emails_added']}")
    
    # Save unmatched data
    if stats['unmatched_data']:
        unmatched_file = '/home/ubuntu/crm-123drive-v2/unmatched_import_data.json'
        with open(unmatched_file, 'w') as f:
            json.dump(stats['unmatched_data'], f, indent=2)
        print(f"Unmatched data saved to: {unmatched_file}")
    
    print("Import completed!")
    
    # Close connection
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
