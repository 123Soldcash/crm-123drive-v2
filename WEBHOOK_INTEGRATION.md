# WordPress/Elementor Webhook Integration Guide

## Overview

This guide explains how to integrate your WordPress/Elementor form with the CRM database using webhooks. When a lead submits a form on your WordPress site, the data will automatically be added to your CRM.

## Webhook Endpoint

**URL:** `https://your-crm-domain.com/api/trpc/webhook.submitLead`

**Method:** POST

**Content-Type:** application/json

## Supported Fields

The webhook accepts the following fields (all optional):

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "Fort Lauderdale",
  "state": "FL",
  "zipcode": "33312",
  "propertyType": "Single Family Home",
  "estimatedValue": 275000,
  "bedrooms": 3,
  "bathrooms": 2,
  "squareFeet": 1272,
  "ownerName": "John Doe",
  "ownerLocation": "Broward County",
  "marketStatus": "Off Market",
  "leadTemperature": "HOT",
  "notes": "Additional notes about the lead",
  "source": "Website Contact Form",
  "formName": "Property Inquiry Form"
}
```

### Valid Values for Enums

**marketStatus** (trackingStatus):
- Not Visited
- Off Market
- Cash Buyer
- Free And Clear
- High Equity
- Senior Owner
- Tired Landlord
- Absentee Owner
- Corporate Owner
- Empty Nester
- Interested
- Not Interested
- Follow Up

**leadTemperature**:
- SUPER HOT
- HOT
- WARM
- COLD
- TBD
- DEAD

## Integration Steps

### Step 1: Get Your CRM URL

Find your CRM's public URL. It should look like:
```
https://3000-xxxxx.sg1.manus.computer
```

### Step 2: Configure Elementor Form

1. Open your Elementor form
2. Go to **Form Settings** → **After Submit** → **Webhooks**
3. Click **Add Webhook**
4. Fill in the following:
   - **Webhook Name:** CRM Lead Submission
   - **Webhook URL:** `https://your-crm-domain.com/api/trpc/webhook.submitLead`
   - **Request Method:** POST
   - **Data to Send:** Select the form fields to map

### Step 3: Map Form Fields

In the webhook configuration, map your Elementor form fields to the CRM fields:

| Elementor Field | CRM Field | Required |
|---|---|---|
| First Name | firstName | No |
| Last Name | lastName | No |
| Email | email | No |
| Phone | phone | No |
| Property Address | address | No |
| City | city | No |
| State | state | No |
| Zip Code | zipcode | No |
| Property Type | propertyType | No |
| Estimated Value | estimatedValue | No |
| Bedrooms | bedrooms | No |
| Bathrooms | bathrooms | No |
| Square Feet | squareFeet | No |
| Owner Name | ownerName | No |
| Owner Location | ownerLocation | No |
| Market Status | marketStatus | No |
| Lead Temperature | leadTemperature | No |

### Step 4: Test the Integration

1. Submit a test form on your WordPress site
2. Go to your CRM and check the Properties list
3. The new lead should appear with status "BIN" (new lead)
4. Contact information will be automatically added if email/phone provided

## Response Format

The webhook will return a JSON response:

**Success:**
```json
{
  "success": true,
  "message": "Lead successfully added to CRM",
  "ownerName": "John Doe",
  "address": "123 Main St"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error adding lead to CRM",
  "error": "Error message details"
}
```

## Example Webhook Request

```bash
curl -X POST https://your-crm-domain.com/api/trpc/webhook.submitLead \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "Fort Lauderdale",
    "state": "FL",
    "zipcode": "33312",
    "propertyType": "Single Family Home",
    "estimatedValue": 275000,
    "bedrooms": 3,
    "bathrooms": 2,
    "squareFeet": 1272,
    "marketStatus": "Off Market",
    "leadTemperature": "HOT",
    "source": "Website Contact Form"
  }'
```

## Features

✅ **Automatic Lead Creation** - New properties added instantly to CRM  
✅ **Contact Information** - Email and phone automatically linked to property  
✅ **Desk Management** - New leads start in BIN status (ready for assignment)  
✅ **Field Validation** - Invalid enum values are converted to defaults  
✅ **Error Handling** - Detailed error messages for debugging  
✅ **Source Tracking** - Leads tagged with source (e.g., "WordPress Form - Website Contact")

## Troubleshooting

### Webhook not triggering
- Check that the webhook URL is correct
- Verify the CRM is accessible from your WordPress server
- Check WordPress error logs: `/wp-content/debug.log`

### Leads not appearing in CRM
- Check the webhook response in Elementor logs
- Verify all required fields are being sent
- Check that field names match exactly (case-sensitive)

### Invalid field values
- Verify `marketStatus` is one of the valid values
- Verify `leadTemperature` is one of the valid values
- Check that numeric fields (bedrooms, bathrooms, estimatedValue) are numbers, not strings

## Support

For issues or questions about the webhook integration, check the CRM logs or contact support.

## Advanced: Using with Other Form Plugins

This webhook endpoint works with any form plugin that supports HTTP POST webhooks:

- **WPForms** - Use Webhooks addon
- **Gravity Forms** - Use Webhooks addon
- **Formidable Forms** - Use Zapier integration
- **Contact Form 7** - Use Flamingo + Webhooks addon
- **Ninja Forms** - Use Webhooks addon

The endpoint accepts JSON POST requests, so any plugin that can send JSON webhooks will work.
