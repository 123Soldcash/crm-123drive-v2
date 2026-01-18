import { getDb } from "./db";
import { buyers, buyerPreferences } from "../drizzle/schema";
import { eq, and, like, or } from "drizzle-orm";

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
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Insert the buyer
    const buyerResult = await db.insert(buyers).values({
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      status: input.status || "Active",
      notes: input.notes,
    });

    const buyerId = buyerResult.insertId;

    // 2. Insert preferences if provided
    if (input.preferences) {
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
    console.error("Error creating buyer:", error);
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
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let query = db.select().from(buyers);

    if (search) {
      const searchPattern = `%${search}%`;
      // @ts-ignore - Drizzle types can be tricky with or/like
      query = query.where(
        or(
          like(buyers.name, searchPattern),
          like(buyers.email, searchPattern),
          like(buyers.company, searchPattern),
          like(buyers.phone, searchPattern)
        )
      );
    }

    const result = await query;
    return result;
  } catch (error) {
    console.error("Error fetching buyers:", error);
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
