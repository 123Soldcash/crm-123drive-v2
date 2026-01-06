#!/usr/bin/env python3
"""
Verify phone numbers using TrestleIQ Phone Validation API
"""
import requests
import json
import time

API_KEY = "zpozmDXsbc2QEpT3Yt8Ie8EbaOtvO2ZI88j6Bjrt"
BASE_URL = "https://api.trestleiq.com/3.0/phone_intel"

# Phone numbers from 1711 NW 55th Ave, Lauderhill lead
phones = [
    {"name": "Anthony Trotman", "relationship": "Owner", "phone": "9548394813"},
    {"name": "Andrea Eulene Trotman", "relationship": "Family", "phone": "7543082807"},
    {"name": "Andrea Eulene Trotman", "relationship": "Family", "phone": "3053353150"},
    {"name": "Andrea Eulene Trotman", "relationship": "Family", "phone": "9547142630"},
    {"name": "Michael Todd Trotman", "relationship": "Family", "phone": "5616356881"},
    {"name": "Michael Todd Trotman", "relationship": "Family", "phone": "9545935693"},
    {"name": "Michael Todd Trotman", "relationship": "Family", "phone": "9549550705"},
    {"name": "Mitchell Thomas Trotman", "relationship": "Family", "phone": "7544227299"},
]

results = []

for contact in phones:
    phone = contact["phone"]
    name = contact["name"]
    
    # Call TrestleIQ API with litigator check
    url = f"{BASE_URL}?phone={phone}&add_ons=litigator_checks"
    headers = {"x-api-key": API_KEY}
    
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        
        # Extract key info
        is_valid = data.get("is_valid", None)
        activity_score = data.get("activity_score", None)
        line_type = data.get("line_type", None)
        carrier = data.get("carrier", None)
        is_prepaid = data.get("is_prepaid", None)
        
        # Check litigator status
        add_ons = data.get("add_ons", {})
        litigator_checks = add_ons.get("litigator_checks", {})
        is_litigator = litigator_checks.get("phone.is_litigator_risk", False)
        
        # Determine if disconnected based on activity score
        is_disconnected = activity_score is not None and activity_score <= 30
        
        result = {
            "name": name,
            "phone": phone,
            "is_valid": is_valid,
            "activity_score": activity_score,
            "is_disconnected": is_disconnected,
            "is_litigator": is_litigator,
            "line_type": line_type,
            "carrier": carrier,
            "is_prepaid": is_prepaid
        }
        results.append(result)
        
        # Print result
        status = "❌ DISCONNECTED" if is_disconnected else "✅ ACTIVE"
        litigator_status = "⚠️ LITIGATOR" if is_litigator else "✓ Safe"
        print(f"{name} - {phone}: {status} (Score: {activity_score}) | {litigator_status} | {line_type}")
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
        
    except Exception as e:
        print(f"Error checking {phone}: {e}")
        results.append({
            "name": name,
            "phone": phone,
            "error": str(e)
        })

# Save results to JSON
with open("/home/ubuntu/crm-123drive-v2/trestle_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\n" + "="*60)
print("SUMMARY")
print("="*60)

disconnected = [r for r in results if r.get("is_disconnected")]
litigators = [r for r in results if r.get("is_litigator")]
active = [r for r in results if not r.get("is_disconnected") and not r.get("error")]

print(f"Total phones checked: {len(results)}")
print(f"Active phones: {len(active)}")
print(f"Disconnected phones: {len(disconnected)}")
print(f"Litigator risk phones: {len(litigators)}")

if disconnected:
    print("\n❌ DISCONNECTED NUMBERS:")
    for r in disconnected:
        print(f"  - {r['name']}: {r['phone']} (Score: {r['activity_score']})")

if litigators:
    print("\n⚠️ LITIGATOR RISK NUMBERS (DO NOT CALL):")
    for r in litigators:
        print(f"  - {r['name']}: {r['phone']}")

print("\nResults saved to trestle_results.json")
