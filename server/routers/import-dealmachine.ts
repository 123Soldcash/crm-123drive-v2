import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { properties, contacts, contactPhones, contactEmails } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { makeRequest } from "../_core/map";

export const importDealMachineRouter = router({
  uploadDealMachine: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // Base64 encoded Excel file
        assignedAgentId: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only admin can import properties
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can import properties');
      }

      const XLSX = await import('xlsx');
      
      // Decode base64 to buffer
      const buffer = Buffer.from(input.fileData, 'base64');
      
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      const dbInstance = await getDb();
      if (!dbInstance) throw new Error('Database not available');
      
      let propertiesCount = 0;
      let contactsCount = 0;
      let phonesCount = 0;
      let emailsCount = 0;
      
      // PHASE 1: Import all properties and contacts
      for (const row of data) {
        try {
          // Extract property data
          const leadId = row.lead_id ? String(row.lead_id) : null;
          const propertyId = row.property_id ? String(row.property_id) : null;
          
          // Skip if duplicate
          if (propertyId) {
            const existing = await dbInstance
              .select({ id: properties.id })
              .from(properties)
              .where(eq(properties.propertyId, propertyId))
              .limit(1);
            
            if (existing.length > 0) {
              continue; // Skip duplicate
            }
          }
          
          // Prepare dealMachineRawData
          const rawData: any = {
            property_id: propertyId,
            property_lat: row.property_lat,
            property_lng: row.property_lng,
            property_address_county: row.property_address_county,
            property_flags: row.property_flags,
            dealmachine_url: row.dealmachine_url,
          };
          
          // Insert property
          const propertyData: any = {
            propertyId,
            leadId,
            addressLine1: row.property_address_line_1 || 'TBD',
            addressLine2: row.property_address_line_2 || null,
            city: row.property_address_city || 'TBD',
            state: row.property_address_state || 'FL',
            zipcode: row.property_address_zipcode || '00000',
            owner1Name: row.owner_1_name || null,
            dealMachinePropertyId: propertyId,
            dealMachineLeadId: leadId,
            dealMachineRawData: JSON.stringify(rawData),
            assignedAgentId: input.assignedAgentId,
          };
          
          await dbInstance.insert(properties).values(propertyData);
          propertiesCount++;
          
          // Get inserted property ID
          const [insertedProperty] = await dbInstance
            .select({ id: properties.id })
            .from(properties)
            .where(eq(properties.propertyId, propertyId!))
            .limit(1);
          
          if (!insertedProperty) continue;
          
          const insertedPropertyId = insertedProperty.id;
          
          // PHASE 1: Import contacts (1-20)
          for (let i = 1; i <= 20; i++) {
            const contactName = row[`contact_${i}_name`];
            if (!contactName) continue;
            
            const contactFlags = row[`contact_${i}_flags`] || null;
            
            // Insert contact
            const contactData: any = {
              propertyId: insertedPropertyId,
              name: contactName,
              flags: contactFlags,
            };
            
            await dbInstance.insert(contacts).values(contactData);
            contactsCount++;
            
            // Get all contacts for this property and find the last one
            const allContacts = await dbInstance
              .select({ id: contacts.id })
              .from(contacts)
              .where(eq(contacts.propertyId, insertedPropertyId));
            
            const insertedContact = allContacts[allContacts.length - 1];
            
            if (!insertedContact) continue;
            
            const insertedContactId = insertedContact.id;
            
            // Import phones (phone1, phone2, phone3)
            for (let p = 1; p <= 3; p++) {
              const phoneNumber = row[`contact_${i}_phone${p}`];
              if (phoneNumber && String(phoneNumber).trim()) {
                await dbInstance.insert(contactPhones).values({
                  contactId: insertedContactId,
                  phoneNumber: String(phoneNumber).trim(),
                  phoneType: p === 1 ? 'Mobile' : p === 2 ? 'Home' : 'Work',
                } as any);
                phonesCount++;
              }
            }
            
            // Import emails (email1, email2, email3)
            for (let e = 1; e <= 3; e++) {
              const email = row[`contact_${i}_email${e}`];
              if (email && String(email).trim()) {
                await dbInstance.insert(contactEmails).values({
                  contactId: insertedContactId,
                  email: String(email).trim(),
                } as any);
                emailsCount++;
              }
            }
          }
          
        } catch (error) {
          console.error('Error importing row:', error);
          // Continue with next row
        }
      }
      
      // PHASE 2: Enrich addresses using Google Maps
      const propertiesWithGPS = await dbInstance
        .select()
        .from(properties)
        .where(eq(properties.addressLine1, 'TBD'));
      
      for (const property of propertiesWithGPS) {
        try {
          if (!property.dealMachineRawData) continue;
          
          const rawData = JSON.parse(property.dealMachineRawData);
          const lat = rawData.property_lat;
          const lng = rawData.property_lng;
          
          if (!lat || !lng) continue;
          
          // Call Google Maps Geocoding API
          const response: any = await makeRequest(
            `/maps/api/geocode/json?latlng=${lat},${lng}`,
            { method: 'GET' }
          );
          
          if (response?.results && response.results.length > 0) {
            const result = response.results[0];
            const addressComponents = result.address_components;
            
            let streetNumber = '';
            let route = '';
            let city = '';
            let state = '';
            let zipcode = '';
            
            for (const component of addressComponents) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name;
              }
              if (component.types.includes('route')) {
                route = component.long_name;
              }
              if (component.types.includes('locality')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
              if (component.types.includes('postal_code')) {
                zipcode = component.long_name;
              }
            }
            
            const addressLine1 = `${streetNumber} ${route}`.trim();
            
            if (addressLine1) {
              await dbInstance
                .update(properties)
                .set({
                  addressLine1,
                  city: city || 'TBD',
                  state: state || 'FL',
                  zipcode: zipcode || '00000',
                })
                .where(eq(properties.id, property.id));
            }
          }
        } catch (error) {
          console.error('Error enriching address:', error);
          // Continue with next property
        }
      }
      
      return {
        propertiesCount,
        contactsCount,
        phonesCount,
        emailsCount,
      };
    }),
});
