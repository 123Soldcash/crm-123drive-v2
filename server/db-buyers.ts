import { getDb } from "./db";
import { buyers, buyerPreferences } from "../drizzle/schema";
import { eq, and, like, or, sql } from "drizzle-orm";

/**
 * Types for Buyer Management
 */
export interface CreateBuyerInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: "Active" | "Inactive" | "Verified" | "Blacklisted";
  notes?: string;
  preferences?: {
    states?: string[];
    cities?: string[];
    zipcodes?: string[];
    propertyTypes?: string[];
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    maxBaths?: number;
    minPrice?: number;
    maxPrice?: number;
    maxRepairCost?: number;
  };
}

/**
 * Create a new buyer with optional preferences
 */
export async function createBuyer(input: CreateBuyerInput) {
  console.log("[Buyers] Attempting to create buyer:", JSON.stringify(input));
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Buyers] Database connection failed");
      throw new Error("Database not available");
    }

    // 1. Insert the buyer
    console.log("[Buyers] Inserting into 'buyers' table...");
    const buyerResult = await db.insert(buyers).values({
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      status: input.status || "Active",
      notes: input.notes,
    });

    const buyerId = buyerResult.insertId;
    console.log("[Buyers] Buyer inserted successfully, ID:", buyerId);

    // 2. Insert preferences if provided
    if (input.preferences) {
      console.log("[Buyers] Inserting preferences for buyer ID:", buyerId);
      await db.insert(buyerPreferences).values({
        buyerId,
        states: input.preferences.states ? JSON.stringify(input.preferences.states) : null,
        cities: input.preferences.cities ? JSON.stringify(input.preferences.cities) : null,
        zipcodes: input.preferences.zipcodes ? JSON.stringify(input.preferences.zipcodes) : null,
        propertyTypes: input.preferences.propertyTypes ? JSON.stringify(input.preferences.propertyTypes) : null,
        minBeds: input.preferences.minBeds,
        maxBeds: input.preferences.maxBeds,
        minBaths: input.preferences.minBaths?.toString(),
        maxBaths: input.preferences.maxBaths?.toString(),
        minPrice: input.preferences.minPrice,
        maxPrice: input.preferences.maxPrice,
        maxRepairCost: input.preferences.maxRepairCost,
      });
    }

    return {
      success: true,
      message: "Buyer created successfully",
      buyerId,
    };
  } catch (error) {
    console.error("[Buyers] CRITICAL ERROR creating buyer:", error);
    return {
      success: false,
      message: "Error creating buyer",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all buyers with optional search/filter
 */
export async function getAllBuyers(search?: string) {
  console.log("[Buyers] Fetching all buyers, search:", search);
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Buyers] Database connection failed during fetch");
      throw new Error("Database not available");
    }

    let query = db.select().from(buyers);

    if (search && search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      query = query.where(
        or(
          like(buyers.name, searchPattern),
          like(buyers.email, searchPattern),
          sql`${buyers.company} LIKE ${searchPattern}`,
          sql`${buyers.phone} LIKE ${searchPattern}`
        )
      );
    }

    const result = await query;
    console.log(`[Buyers] Successfully fetched ${result.length} buyers`);
    return result;
  } catch (error) {
    console.error("[Buyers] CRITICAL ERROR fetching buyers:", error);
    return [];
  }
}

/**
 * Get a single buyer with their preferences
 */
export async function getBuyerById(id: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const buyer = await db
      .select()
      .from(buyers)
      .where(eq(buyers.id, id))
      .then((rows) => rows[0]);

    if (!buyer) return null;

    const preferences = await db
      .select()
      .from(buyerPreferences)
      .where(eq(buyerPreferences.buyerId, id))
      .then((rows) => rows[0]);

    // Parse JSON fields in preferences
    const parsedPreferences = preferences ? {
      ...preferences,
      states: preferences.states ? JSON.parse(preferences.states) : [],
      cities: preferences.cities ? JSON.parse(preferences.cities) : [],
      zipcodes: preferences.zipcodes ? JSON.parse(preferences.zipcodes) : [],
      propertyTypes: preferences.propertyTypes ? JSON.parse(preferences.propertyTypes) : [],
    } : null;

    return {
      ...buyer,
      preferences: parsedPreferences,
    };
  } catch (error) {
    console.error("Error fetching buyer by ID:", error);
    return null;
  }
}

/**
 * Update a buyer and their preferences
 */
export async function updateBuyer(id: number, input: Partial<CreateBuyerInput>) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Update buyer basic info
    const buyerUpdate: any = {};
    if (input.name) buyerUpdate.name = input.name;
    if (input.email) buyerUpdate.email = input.email;
    if (input.phone !== undefined) buyerUpdate.phone = input.phone;
    if (input.company !== undefined) buyerUpdate.company = input.company;
    if (input.status) buyerUpdate.status = input.status;
    if (input.notes !== undefined) buyerUpdate.notes = input.notes;
    buyerUpdate.updatedAt = new Date();

    if (Object.keys(buyerUpdate).length > 1) {
      await db.update(buyers).set(buyerUpdate).where(eq(buyers.id, id));
    }

    // 2. Update preferences if provided
    if (input.preferences) {
      const prefUpdate: any = {
        states: input.preferences.states ? JSON.stringify(input.preferences.states) : null,
        cities: input.preferences.cities ? JSON.stringify(input.preferences.cities) : null,
        zipcodes: input.preferences.zipcodes ? JSON.stringify(input.preferences.zipcodes) : null,
        propertyTypes: input.preferences.propertyTypes ? JSON.stringify(input.preferences.propertyTypes) : null,
        minBeds: input.preferences.minBeds,
        maxBeds: input.preferences.maxBeds,
        minBaths: input.preferences.minBaths?.toString(),
        maxBaths: input.preferences.maxBaths?.toString(),
        minPrice: input.preferences.minPrice,
        maxPrice: input.preferences.maxPrice,
        maxRepairCost: input.preferences.maxRepairCost,
        updatedAt: new Date(),
      };

      // Check if preferences exist
      const existingPref = await db
        .select()
        .from(buyerPreferences)
        .where(eq(buyerPreferences.buyerId, id))
        .then((rows) => rows[0]);

      if (existingPref) {
        await db.update(buyerPreferences).set(prefUpdate).where(eq(buyerPreferences.buyerId, id));
      } else {
        await db.insert(buyerPreferences).values({
          buyerId: id,
          ...prefUpdate,
        });
      }
    }

    return { success: true, message: "Buyer updated successfully" };
  } catch (error) {
    console.error("Error updating buyer:", error);
    return {
      success: false,
      message: "Error updating buyer",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a buyer and their preferences
 */
export async function deleteBuyer(id: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Delete preferences first (foreign key relationship)
    await db.delete(buyerPreferences).where(eq(buyerPreferences.buyerId, id));
    
    // Delete buyer
    await db.delete(buyers).where(eq(buyers.id, id));

    return { success: true, message: "Buyer deleted successfully" };
  } catch (error) {
    console.error("Error deleting buyer:", error);
    return {
      success: false,
      message: "Error deleting buyer",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Find buyers whose preferences match a specific property
 */
export async function getMatchingBuyers(propertyId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Get property details
    const { properties } = await import("../drizzle/schema");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .then((rows) => rows[0]);

    if (!property) return [];

    // 2. Get all buyers with preferences
    const allBuyers = await db.select().from(buyers);
    const allPreferences = await db.select().from(buyerPreferences);

    // 3. Filter buyers based on property details
    const matches = allBuyers.filter((buyer) => {
      const pref = allPreferences.find((p) => p.buyerId === buyer.id);
      if (!pref) return false;

      // Parse JSON fields
      const states = pref.states ? JSON.parse(pref.states) : [];
      const cities = pref.cities ? JSON.parse(pref.cities) : [];
      const propertyTypes = pref.propertyTypes ? JSON.parse(pref.propertyTypes) : [];

      // Location match (State)
      if (states.length > 0 && !states.includes(property.state)) return false;

      // Location match (City) - Optional, more specific
      if (cities.length > 0 && !cities.includes(property.city)) return false;

      // Property Type match
      if (propertyTypes.length > 0 && property.propertyType && !propertyTypes.includes(property.propertyType)) return false;

      // Beds/Baths match
      if (pref.minBeds && property.totalBedrooms && property.totalBedrooms < pref.minBeds) return false;
      if (pref.maxBeds && property.totalBedrooms && property.totalBedrooms > pref.maxBeds) return false;
      
      const minBaths = pref.minBaths ? parseFloat(pref.minBaths) : null;
      const maxBaths = pref.maxBaths ? parseFloat(pref.maxBaths) : null;
      if (minBaths && property.totalBaths && property.totalBaths < minBaths) return false;
      if (maxBaths && property.totalBaths && property.totalBaths > maxBaths) return false;

      // Price match (Estimated Value)
      if (pref.minPrice && property.estimatedValue && property.estimatedValue < pref.minPrice) return false;
      if (pref.maxPrice && property.estimatedValue && property.estimatedValue > pref.maxPrice) return false;

      return true;
    });

    return matches;
  } catch (error) {
    console.error("Error matching buyers:", error);
    return [];
  }
}
