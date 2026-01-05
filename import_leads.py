#!/usr/bin/env python3
"""
Script to import lead data from Excel files into the CRM database.
"""
import mysql.connector
import os
from datetime import datetime
import json

# Database connection
db_url = os.environ.get('DATABASE_URL', '')
# Parse DATABASE_URL: mysql://user:pass@host:port/database
if db_url.startswith('mysql://'):
    db_url = db_url[8:]
    user_pass, host_db = db_url.split('@')
    user, password = user_pass.split(':')
    host_port, database = host_db.split('/')
    if ':' in host_port:
        host, port = host_port.split(':')
        port = int(port)
    else:
        host = host_port
        port = 3306
else:
    # Fallback to individual env vars
    host = os.environ.get('DB_HOST', 'localhost')
    port = int(os.environ.get('DB_PORT', 3306))
    user = os.environ.get('DB_USER', 'root')
    password = os.environ.get('DB_PASSWORD', '')
    database = os.environ.get('DB_NAME', 'crm')

print(f"Connecting to database at {host}:{port}/{database}")

conn = mysql.connector.connect(
    host=host,
    port=port,
    user=user,
    password=password,
    database=database,
    ssl_disabled=False
)
cursor = conn.cursor(dictionary=True)

# Lead 1: Margate Property
margate_lead = {
    'address': '5771 NW 24th Ct',
    'city': 'Margate',
    'state': 'FL',
    'zip': '33063',
    'propertyType': 'Single Family Home',
    'yearBuilt': 1959,
    'bedrooms': 3,
    'bathrooms': 1,
    'squareFeet': 920,
    'lotSize': '7,218 sq. ft.',
    'ownerName': 'Florence M. Giroux',
    'ownerPhone': '(561) 699-2623',
    'ownerPhone2': '(954) 972-1885',
    'ownerEmail': 'f******x@yahoo.com',
    'ownerAddress': '5771 NW 24th Ct, Margate, FL 33063',
    'occupancy': 'Owner-Occupied',
    'estimatedValue': 335530,
    'taxAmount': 5489,
    'taxStatus': 'Current and Paid',
    'codeViolations': False,
    'probateStatus': 'No Probate Case Found',
    'leadTemperature': 'warm',
    'status': 'new_prospect',
    'notes': '''KEY FINDINGS:
1. Florence M. Giroux (age 84) is current owner and active resident
2. No probate case or deceased owner identified
3. Property is owner-occupied and well-maintained
4. Current market value estimated at $335,530
5. Property taxes current and paid ($5,489 in 2024)
6. No code violations or enforcement actions found
7. Property is off-market and not currently for sale
8. Secondary owner listed (possibly spouse)

RECOMMENDED NEXT STEPS:
1. Contact Florence M. Giroux at (561) 699-2623 or (954) 972-1885
2. Obtain certified deed from Broward County Official Records
3. Search for mortgage and lien information in official records'''
}

# Lead 2: Miramar Property
miramar_lead = {
    'address': '6717 Arbor Dr',
    'city': 'Miramar',
    'state': 'FL',
    'zip': '33023',
    'propertyType': 'Single Family Home',
    'yearBuilt': 1965,
    'bedrooms': 3,
    'bathrooms': 2,
    'squareFeet': 1544,
    'lotSize': '6,505 sq. ft.',
    'ownerName': 'Len D. Sumlar',
    'ownerPhone': '',
    'ownerAddress': 'Miami-Dade County (Employer)',
    'occupancy': 'Tenant-Occupied',
    'estimatedValue': 459014,
    'taxAmount': 4750,
    'taxStatus': 'Current and Paid',
    'codeViolations': False,
    'probateStatus': 'No Probate Case Found',
    'leadTemperature': 'warm',
    'status': 'new_prospect',
    'notes': '''KEY FINDINGS:
1. Property is currently owned by Len D. Sumlar (purchased 2019 for $200,000)
2. No probate case has been identified for this property
3. Current market value estimated at $459,014 - $544,857 (significant appreciation since 1994)
4. Property is off-market and not currently for sale
5. Current residents include Davion Hudson (age 36) and family members
6. Property has no code violations or enforcement actions
7. Property taxes are current and paid
8. Last recorded sale was February 2, 1994 for $85,000
9. Property appreciation of 440-540% since 1994 sale

RECOMMENDED NEXT STEPS:
1. Contact Len D. Sumlar through Miami-Dade County Medical Examiner's office
2. Contact Davion Hudson at (954) 966-0140 to verify resident status
3. Conduct title search to verify clear ownership'''
}

# Miramar contacts
miramar_contacts = [
    {'name': 'Len D. Sumlar', 'relationship': 'Current Owner', 'phone': '', 'notes': 'Manager, Morgue Bureau Operations, Medical Examiner'},
    {'name': 'Davion Hudson', 'relationship': 'Current Resident', 'phone': '(954) 966-0140', 'notes': 'Democratic Party voter; born November 1989'},
    {'name': 'Frona S. Hudson', 'relationship': 'Resident/Family', 'phone': '(954) 986-8378', 'notes': 'Born November 1961; family member'},
    {'name': 'Donovan Hudson', 'relationship': 'Resident/Family', 'phone': '(954) 986-8378', 'notes': 'Family member; living at property'},
]

def insert_property(lead):
    """Insert or update a property in the database."""
    # Check if property already exists
    cursor.execute(
        "SELECT id FROM properties WHERE address = %s AND city = %s",
        (lead['address'], lead['city'])
    )
    existing = cursor.fetchone()
    
    now = datetime.now()
    
    if existing:
        property_id = existing['id']
        print(f"Property already exists with ID {property_id}, updating...")
        cursor.execute("""
            UPDATE properties SET
                state = %s,
                zip = %s,
                property_type = %s,
                year_built = %s,
                bedrooms = %s,
                bathrooms = %s,
                square_feet = %s,
                owner_name = %s,
                estimated_value = %s,
                tax_amount = %s,
                lead_temperature = %s,
                status = %s,
                updated_at = %s
            WHERE id = %s
        """, (
            lead['state'],
            lead['zip'],
            lead['propertyType'],
            lead['yearBuilt'],
            lead['bedrooms'],
            lead['bathrooms'],
            lead['squareFeet'],
            lead['ownerName'],
            lead['estimatedValue'],
            lead['taxAmount'],
            lead['leadTemperature'],
            lead['status'],
            now,
            property_id
        ))
    else:
        print(f"Creating new property: {lead['address']}, {lead['city']}")
        cursor.execute("""
            INSERT INTO properties (
                address, city, state, zip, property_type, year_built,
                bedrooms, bathrooms, square_feet, owner_name,
                estimated_value, tax_amount, lead_temperature, status,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            lead['address'],
            lead['city'],
            lead['state'],
            lead['zip'],
            lead['propertyType'],
            lead['yearBuilt'],
            lead['bedrooms'],
            lead['bathrooms'],
            lead['squareFeet'],
            lead['ownerName'],
            lead['estimatedValue'],
            lead['taxAmount'],
            lead['leadTemperature'],
            lead['status'],
            now,
            now
        ))
        property_id = cursor.lastrowid
    
    return property_id

def insert_deep_search(property_id, lead):
    """Insert or update deep search data for a property."""
    cursor.execute(
        "SELECT id FROM property_deep_search WHERE property_id = %s",
        (property_id,)
    )
    existing = cursor.fetchone()
    
    now = datetime.now()
    
    # Prepare deep search data
    occupancy = lead.get('occupancy', '')
    has_code_violation = lead.get('codeViolations', False)
    zillow_estimate = lead.get('estimatedValue', 0)
    research_notes = lead.get('notes', '')
    
    if existing:
        print(f"Updating deep search for property {property_id}")
        cursor.execute("""
            UPDATE property_deep_search SET
                occupancy = %s,
                has_code_violation = %s,
                zillow_estimate = %s,
                research_notes = %s,
                updated_at = %s
            WHERE property_id = %s
        """, (
            occupancy,
            has_code_violation,
            zillow_estimate,
            research_notes,
            now,
            property_id
        ))
    else:
        print(f"Creating deep search for property {property_id}")
        cursor.execute("""
            INSERT INTO property_deep_search (
                property_id, occupancy, has_code_violation,
                zillow_estimate, research_notes, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            property_id,
            occupancy,
            has_code_violation,
            zillow_estimate,
            research_notes,
            now,
            now
        ))

def insert_contact(property_id, contact):
    """Insert a contact for a property."""
    # Check if contact already exists
    cursor.execute(
        "SELECT id FROM property_contacts WHERE property_id = %s AND name = %s",
        (property_id, contact['name'])
    )
    existing = cursor.fetchone()
    
    now = datetime.now()
    
    if existing:
        print(f"Contact {contact['name']} already exists, updating...")
        cursor.execute("""
            UPDATE property_contacts SET
                relationship = %s,
                phone1 = %s,
                notes = %s,
                updated_at = %s
            WHERE id = %s
        """, (
            contact.get('relationship', ''),
            contact.get('phone', ''),
            contact.get('notes', ''),
            now,
            existing['id']
        ))
    else:
        print(f"Creating contact: {contact['name']}")
        cursor.execute("""
            INSERT INTO property_contacts (
                property_id, name, relationship, phone1, notes,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            property_id,
            contact['name'],
            contact.get('relationship', ''),
            contact.get('phone', ''),
            contact.get('notes', ''),
            now,
            now
        ))

# Import Margate lead
print("\n=== Importing Margate Lead ===")
margate_id = insert_property(margate_lead)
insert_deep_search(margate_id, margate_lead)
# Add owner as contact
insert_contact(margate_id, {
    'name': margate_lead['ownerName'],
    'relationship': 'Owner',
    'phone': margate_lead['ownerPhone'],
    'notes': f"Age 84. Secondary phone: {margate_lead['ownerPhone2']}. Email: {margate_lead['ownerEmail']}"
})
print(f"Margate lead imported with ID: {margate_id}")

# Import Miramar lead
print("\n=== Importing Miramar Lead ===")
miramar_id = insert_property(miramar_lead)
insert_deep_search(miramar_id, miramar_lead)
# Add all contacts
for contact in miramar_contacts:
    insert_contact(miramar_id, contact)
print(f"Miramar lead imported with ID: {miramar_id}")

conn.commit()
cursor.close()
conn.close()

print("\n=== Import Complete ===")
print(f"Margate Property ID: {margate_id}")
print(f"Miramar Property ID: {miramar_id}")
