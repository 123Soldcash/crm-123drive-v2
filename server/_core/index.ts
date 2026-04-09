import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerTwilioWebhooks } from "../twilio-webhooks";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sql } from "drizzle-orm";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Self-healing database migration check
  try {
    console.log("[Database] Running self-healing migration check...");
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      // Check if buyers table exists by trying a simple query
      try {
        await db.execute(sql`SELECT 1 FROM buyers LIMIT 1`);
        console.log("[Database] 'buyers' table exists.");
      } catch (e) {
        console.log("[Database] 'buyers' table missing, creating tables...");
        // Create buyers table
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS buyers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(320) NOT NULL UNIQUE,
            phone VARCHAR(20),
            company VARCHAR(255),
            status ENUM('Active', 'Inactive', 'Verified', 'Blacklisted') DEFAULT 'Active',
            notes TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        // Create buyerPreferences table
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS buyerPreferences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            buyerId INT NOT NULL,
            states TEXT,
            cities TEXT,
            zipcodes TEXT,
            propertyTypes TEXT,
            minBeds INT,
            maxBeds INT,
            minBaths DECIMAL(3,1),
            maxBaths DECIMAL(3,1),
            minPrice INT,
            maxPrice INT,
            maxRepairCost INT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        console.log("[Database] Tables created successfully.");
      }
    }
  } catch (error) {
    console.error("[Database] Self-healing migration failed:", error);
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Twilio voice webhooks under /api/twilio/*
  // CRITICAL: Must be registered BEFORE Vite/static middleware so Express
  // matches these routes before the catch-all SPA handler.
  // Do NOT use /api/oauth/twilio/* — the platform only forwards the exact
  // /api/oauth/callback path, not nested paths under /api/oauth/.
  registerTwilioWebhooks(app);

  // ─── Zapier 2-Step Webhook ──────────────────────────────────────────────
  // Uses /api/oauth/ prefix because the Manus deployment platform only
  // forwards /api/oauth/* and /api/trpc/* to Express.

  // Token validation middleware for Zapier webhooks
  const { ENV } = await import("./env");
  const validateZapierToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = ENV.zapierWebhookToken;
    
    // If no token is configured, skip validation (dev mode)
    if (!token) {
      return next();
    }

    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // Check query parameter (?token=xxx)
    const queryToken = req.query.token as string | undefined;

    if (headerToken === token || queryToken === token) {
      return next();
    }

    console.warn(`[Zapier Webhook] Unauthorized request from ${req.ip} - invalid or missing token`);
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API token. Include your token as 'Authorization: Bearer <token>' header or '?token=<token>' query parameter.",
    });
  };

  // Keep legacy endpoint working (redirects to step1)
  app.post("/api/oauth/webhook/zapier", validateZapierToken, async (req, res, next) => {
    req.url = "/api/oauth/webhook/zapier/step1";
    next();
  });

  // ─── STEP 1: Create property with address + phone + email ─────────────
  app.post("/api/oauth/webhook/zapier/step1", validateZapierToken, async (req, res) => {
    try {
      const { getDb } = await import("../db");
      const { properties, contacts, contactPhones, contactEmails, propertyTags } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const database = await getDb();
      if (!database) {
        return res.status(500).json({ success: false, message: "Database not available" });
      }

      const data = req.body;
      console.log("[Zapier Step 1] Received:", JSON.stringify(data));

      const phone = String(data.Phone || data.phone || "").trim();
      const email = String(data.Email || data.email || "").trim();
      const address = String(data.Address || data.address || data.AddressLine1 || "").trim();
      const firstName = String(data.FirstName || data.firstName || data.first_name || data["First name"] || "").trim();
      const lastName = String(data.LastName || data.lastName || data.last_name || data["Last name"] || "").trim();
      const contactName = `${firstName} ${lastName}`.trim() || "Website Lead";

      if (!phone && !email) {
        return res.status(400).json({ success: false, message: "Phone or Email is required" });
      }

      // Check for duplicate by phone number
      if (phone) {
        const existingPhones = await database
          .select({ contactId: contactPhones.contactId, phoneNumber: contactPhones.phoneNumber })
          .from(contactPhones);
        
        const normalizedPhone = phone.replace(/[^\d+]/g, "");
        const duplicate = existingPhones.find((p: any) => 
          p.phoneNumber.replace(/[^\d+]/g, "") === normalizedPhone
        );
        
        if (duplicate) {
          // Find the property linked to this contact
          const contact = await database
            .select({ propertyId: contacts.propertyId })
            .from(contacts)
            .where(eq(contacts.id, duplicate.contactId))
            .limit(1);
          
          return res.status(200).json({
            success: true,
            message: "Lead already exists in CRM (matched by phone)",
            duplicate: true,
            propertyId: contact[0]?.propertyId || null,
            phone: normalizedPhone,
          });
        }
      }

      // Insert new property
      const result = await database.insert(properties).values({
        addressLine1: address,
        city: "TBD",
        state: "",
        zipcode: "",
        owner1Name: contactName,
        propertyType: "Unknown",
        trackingStatus: "Not Visited",
        leadTemperature: "TBD",
        leadSource: "Website",
        deskName: "NEW_LEAD",
        deskStatus: "BIN",
        status: "Website Lead - Step 1",
      });

      const propertyId = (result as any)[0]?.insertId;
      if (!propertyId) {
        return res.status(500).json({ success: false, message: "Failed to create property" });
      }

      // Create contact with phone and email
      const contactResult = await database.insert(contacts).values({
        propertyId,
        name: contactName,
        relationship: "Owner",
      });

      const contactId = (contactResult as any)[0]?.insertId;

      if (contactId) {
        if (phone) {
          await database.insert(contactPhones).values({
            contactId,
            phoneNumber: phone,
            phoneType: "Mobile",
            isPrimary: 1,
          });
        }
        if (email) {
          await database.insert(contactEmails).values({
            contactId,
            email,
            isPrimary: 1,
          });
        }
      }

      // Add "Website Lead" tag
      await database.insert(propertyTags).values({
        propertyId,
        tag: "Website Lead",
        createdBy: 1,
      }).onDuplicateKeyUpdate({ set: { tag: "Website Lead" } });

      console.log(`[Zapier Step 1] Created property #${propertyId} with phone: ${phone}`);

      return res.status(200).json({
        success: true,
        message: "Lead created in CRM (Step 1)",
        propertyId,
        phone,
        email,
        address,
      });
    } catch (error) {
      console.error("[Zapier Step 1] Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error creating lead in CRM",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ─── STEP 2: Find property by phone and update with detailed data ─────
  app.post("/api/oauth/webhook/zapier/step2", validateZapierToken, async (req, res) => {
    try {
      const { getDb } = await import("../db");
      const { properties, contacts, contactPhones, contactEmails, notes, propertyDeepSearch, deepSearchOverview } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const database = await getDb();
      if (!database) {
        return res.status(500).json({ success: false, message: "Database not available" });
      }

      const data = req.body;
      console.log("[Zapier Step 2] Received:", JSON.stringify(data));

      const phone = String(data.Phone || data.phone || "").trim();
      if (!phone) {
        return res.status(400).json({ success: false, message: "Phone is required to match the lead" });
      }

      // Find the property by phone number
      const allPhones = await database
        .select({ contactId: contactPhones.contactId, phoneNumber: contactPhones.phoneNumber })
        .from(contactPhones);

      const normalizedPhone = phone.replace(/[^\d+]/g, "");
      const matchedPhone = allPhones.find((p: any) =>
        p.phoneNumber.replace(/[^\d+]/g, "") === normalizedPhone
      );

      if (!matchedPhone) {
        return res.status(404).json({
          success: false,
          message: `No lead found with phone: ${phone}. Make sure Step 1 ran first.`,
        });
      }

      // Get the property ID from the contact
      const contact = await database
        .select({ id: contacts.id, propertyId: contacts.propertyId, name: contacts.name })
        .from(contacts)
        .where(eq(contacts.id, matchedPhone.contactId))
        .limit(1);

      if (!contact.length) {
        return res.status(404).json({ success: false, message: "Contact found but no linked property" });
      }

      const propertyId = contact[0].propertyId;

      // Update property with detailed address info
      const address = String(data.Address || data.address || "").trim();
      const city = String(data.City || data.city || "").trim();
      const state = String(data.State || data.state || "").trim();
      const zipcode = String(data.Zipcode || data.zipcode || data.Zip || data.zip || data["ZIP Code"] || data.zip_code || "").trim();
      const firstName = String(data.FirstName || data.firstName || data.first_name || data["First name"] || "").trim();
      const lastName = String(data.LastName || data.lastName || data.last_name || data["Last name"] || "").trim();
      const email = String(data.Email || data.email || "").trim();
      const ownerName = `${firstName} ${lastName}`.trim() || contact[0].name || "Website Lead";

      // Build update object — only update fields that have values
      const updateFields: Record<string, any> = {
        status: "Website Lead - Complete",
      };
      if (address) updateFields.addressLine1 = address;
      if (city) updateFields.city = city;
      if (state) updateFields.state = state.substring(0, 2).toUpperCase();
      if (zipcode) updateFields.zipcode = zipcode;
      if (ownerName && ownerName !== "Website Lead") updateFields.owner1Name = ownerName;

      await database.update(properties).set(updateFields).where(eq(properties.id, propertyId));

      // Update contact name if we have first/last name
      if (ownerName && ownerName !== "Website Lead") {
        await database.update(contacts).set({ name: ownerName }).where(eq(contacts.id, contact[0].id));
      }

      // Update email if provided and different
      if (email) {
        const existingEmails = await database
          .select({ id: contactEmails.id })
          .from(contactEmails)
          .where(eq(contactEmails.contactId, contact[0].id));
        
        if (existingEmails.length > 0) {
          await database.update(contactEmails).set({ email }).where(eq(contactEmails.id, existingEmails[0].id));
        } else {
          await database.insert(contactEmails).values({
            contactId: contact[0].id,
            email,
            isPrimary: 1,
          });
        }
      }

      // Build qualifying questions note from Step 2 extra fields
      const qualifyingFields = [
        { key: "owned_property", label: "Owned Property", aliases: ["ownedProperty", "owned property", "OwnedProperty"] },
        { key: "condition_property", label: "Property Condition", aliases: ["conditionProperty", "condition property", "ConditionProperty", "condition"] },
        { key: "repairs_need", label: "Repairs Needed", aliases: ["repairsNeed", "repairs need", "RepairsNeed", "repairs"] },
        { key: "living_house", label: "Living in House", aliases: ["livingHouse", "living house", "LivingHouse", "living"] },
        { key: "listed_realtor", label: "Listed with Realtor", aliases: ["listedRealtor", "listed realtor", "ListedRealtor", "listed"] },
        { key: "sell_fast", label: "Want to Sell Fast", aliases: ["sellFast", "sell fast", "SellFast"] },
        { key: "lowest_price", label: "Lowest Acceptable Price", aliases: ["lowestPrice", "lowest price", "LowestPrice", "lowest_price"] },
        { key: "time_call", label: "Best Time to Call", aliases: ["timeCall", "time call", "TimeCall", "time_call"] },
      ];

      const noteLines: string[] = [];
      noteLines.push("=== Website Form - Step 2 (Qualifying Questions) ===");
      noteLines.push(`Date: ${new Date().toLocaleDateString("en-US")} ${new Date().toLocaleTimeString("en-US")}`);
      noteLines.push(`Name: ${ownerName}`);
      if (phone) noteLines.push(`Phone: ${phone}`);
      if (email) noteLines.push(`Email: ${email}`);
      if (address || city || state || zipcode) {
        noteLines.push(`Address: ${[address, city, state, zipcode].filter(Boolean).join(", ")}`);
      }
      noteLines.push("");

      // Track which keys were already captured by known qualifying fields
      const capturedKeys = new Set<string>();

      for (const field of qualifyingFields) {
        let value = data[field.key];
        let usedKey = field.key;
        if (!value) {
          for (const alias of field.aliases) {
            if (data[alias]) { value = data[alias]; usedKey = alias; break; }
          }
        }
        if (value) {
          noteLines.push(`${field.label}: ${value}`);
          // Mark all aliases as captured so they don't appear in the raw dump
          capturedKeys.add(field.key);
          field.aliases.forEach(a => capturedKeys.add(a));
          capturedKeys.add(usedKey);
        }
      }

      // ── Raw Data Dump: save every remaining webhook field that wasn't already captured ──
      // This ensures ZERO data loss regardless of field naming
      const knownBaseKeys = new Set([
        "Phone", "phone", "Email", "email",
        "FirstName", "firstName", "first_name", "First name",
        "LastName", "lastName", "last_name", "Last name",
        "Address", "address", "City", "city", "State", "state",
        "Zipcode", "zipcode", "Zip", "zip", "ZIP Code", "zip_code",
      ]);
      const extraFields: string[] = [];
      for (const [key, val] of Object.entries(data)) {
        if (!knownBaseKeys.has(key) && !capturedKeys.has(key) && val !== undefined && val !== null && String(val).trim() !== "") {
          extraFields.push(`  ${key}: ${val}`);
        }
      }
      if (extraFields.length > 0) {
        noteLines.push("");
        noteLines.push("--- Additional Fields (Raw) ---");
        noteLines.push(...extraFields);
      }

      // Always insert note — every Step 2 call is logged, no data lost
      await database.insert(notes).values({
        propertyId,
        userId: 1, // System user
        content: noteLines.join("\n"),
        noteType: "general",
      });

      // ─── Extract qualifying field values (shared by both deep search tables) ─────
      const getFieldValue = (key: string, aliases: string[]): string => {
        let value = data[key];
        if (!value) {
          for (const alias of aliases) {
            if (data[alias]) { value = data[alias]; break; }
          }
        }
        return String(value || "").trim();
      };

      const livingInHouse = getFieldValue("living_house", ["livingHouse", "living house", "LivingHouse", "living"]);
      const conditionProperty = getFieldValue("condition_property", ["conditionProperty", "condition property", "ConditionProperty", "condition"]);
      const repairsNeeded = getFieldValue("repairs_need", ["repairsNeed", "repairs need", "RepairsNeed", "repairs"]);
      const listedRealtor = getFieldValue("listed_realtor", ["listedRealtor", "listed realtor", "ListedRealtor", "listed"]);
      const sellFast = getFieldValue("sell_fast", ["sellFast", "sell fast", "SellFast"]);
      const lowestPrice = getFieldValue("lowest_price", ["lowestPrice", "lowest price", "LowestPrice", "lowest_price"]);
      const ownedProperty = getFieldValue("owned_property", ["ownedProperty", "owned property", "OwnedProperty"]);
      const bestTimeToCall = getFieldValue("time_call", ["timeCall", "time call", "TimeCall", "time_call"]);

      // ─── Map qualifying answers to Deep Search fields ─────
      try {
        // Map "Living in House" answer to occupancy enum
        let occupancy: "Owner-Occupied" | "Tenant-Occupied" | "Vacant" | "Abandoned" | null = null;
        const livingLower = livingInHouse.toLowerCase();
        if (livingLower.includes("tenant")) {
          occupancy = "Tenant-Occupied";
        } else if (livingLower.includes("yes") && !livingLower.includes("tenant")) {
          occupancy = "Owner-Occupied";
        } else if (livingLower.includes("no") || livingLower.includes("vacant")) {
          occupancy = "Vacant";
        } else if (livingLower.includes("abandon")) {
          occupancy = "Abandoned";
        }

        // Map "Listed with Realtor" to MLS status
        let mlsStatus: "Listed" | "Not Listed" | null = null;
        const listedLower = listedRealtor.toLowerCase();
        if (listedLower.includes("yes")) {
          mlsStatus = "Listed";
        } else if (listedLower.includes("no")) {
          mlsStatus = "Not Listed";
        }

        // Map repairs needed
        const hasRepairs = repairsNeeded.length > 0 && !repairsNeeded.toLowerCase().includes("no") && !repairsNeeded.toLowerCase().includes("none");

        // Build overview notes from all qualifying answers
        const overviewParts: string[] = [];
        overviewParts.push(`[Website Form - ${new Date().toLocaleDateString("en-US")}]`);
        if (ownedProperty) overviewParts.push(`Owned since: ${ownedProperty}`);
        if (conditionProperty) overviewParts.push(`Condition: ${conditionProperty}`);
        if (repairsNeeded) overviewParts.push(`Repairs: ${repairsNeeded}`);
        if (livingInHouse) overviewParts.push(`Living in house: ${livingInHouse}`);
        if (listedRealtor) overviewParts.push(`Listed with realtor: ${listedRealtor}`);
        if (sellFast) overviewParts.push(`Wants to sell fast: ${sellFast}`);
        if (lowestPrice) overviewParts.push(`Lowest acceptable price: ${lowestPrice}`);
        if (bestTimeToCall) overviewParts.push(`Best time to call: ${bestTimeToCall}`);

        // Build the deep search record
        const deepSearchData: Record<string, any> = {
          propertyId,
        };
        if (occupancy) deepSearchData.occupancy = occupancy;
        if (mlsStatus) deepSearchData.mlsStatus = mlsStatus;
        if (hasRepairs) {
          deepSearchData.needsRepairs = 1;
          deepSearchData.repairNotes = repairsNeeded;
        }
        if (conditionProperty) {
          deepSearchData.propertyCondition = JSON.stringify({ rating: conditionProperty, tags: [] });
        }
        if (overviewParts.length > 1) {
          deepSearchData.overviewNotes = overviewParts.join("\n");
        }

        // Check if deep search record already exists
        const existingDeepSearch = await database
          .select({ id: propertyDeepSearch.id })
          .from(propertyDeepSearch)
          .where(eq(propertyDeepSearch.propertyId, propertyId))
          .limit(1);

        if (existingDeepSearch.length > 0) {
          // Update existing record — append to overviewNotes
          const existing = await database
            .select({ overviewNotes: propertyDeepSearch.overviewNotes })
            .from(propertyDeepSearch)
            .where(eq(propertyDeepSearch.propertyId, propertyId))
            .limit(1);
          
          const existingNotes = existing[0]?.overviewNotes || "";
          if (existingNotes && deepSearchData.overviewNotes) {
            deepSearchData.overviewNotes = existingNotes + "\n\n" + deepSearchData.overviewNotes;
          }
          
          delete deepSearchData.propertyId; // Don't update the unique key
          await database.update(propertyDeepSearch)
            .set(deepSearchData)
            .where(eq(propertyDeepSearch.propertyId, propertyId));
          console.log(`[Zapier Step 2] Updated deep search for property #${propertyId}`);
        } else {
          // Insert new record
          await database.insert(propertyDeepSearch).values(deepSearchData as any);
          console.log(`[Zapier Step 2] Created deep search for property #${propertyId}`);
        }
      } catch (deepSearchError) {
        // Don't fail the whole request if deep search update fails
        console.error(`[Zapier Step 2] Deep search update failed for property #${propertyId}:`, deepSearchError);
      }

      // ── Also update deepSearchOverview table (used by the Overview UI tab) ──
      try {
        // Map occupancy to Overview enum values (spaces instead of hyphens)
        let overviewOccupancy: "Vacant" | "Owner Occupied" | "Tenant Occupied" | "Squatter Occupied" | "Unknown" | null = null;
        if (livingInHouse) {
          const ll = livingInHouse.toLowerCase();
          if (ll.includes("tenant")) overviewOccupancy = "Tenant Occupied";
          else if (ll.includes("yes") && !ll.includes("tenant")) overviewOccupancy = "Owner Occupied";
          else if (ll.includes("no") || ll.includes("vacant")) overviewOccupancy = "Vacant";
          else if (ll.includes("squatter")) overviewOccupancy = "Squatter Occupied";
          else overviewOccupancy = "Unknown";
        }

        // Map condition to overview conditionRating enum
        let overviewCondition: "Excellent" | "Good" | "Fair" | "Average" | "Poor" | null = null;
        if (conditionProperty) {
          const cl = conditionProperty.toLowerCase();
          if (cl.includes("excellent")) overviewCondition = "Excellent";
          else if (cl.includes("good")) overviewCondition = "Good";
          else if (cl.includes("fair")) overviewCondition = "Fair";
          else if (cl.includes("average")) overviewCondition = "Average";
          else if (cl.includes("poor") || cl.includes("bad")) overviewCondition = "Poor";
        }

        // Build overview data
        const overviewData: Record<string, any> = { propertyId };
        if (overviewOccupancy) overviewData.occupancy = overviewOccupancy;
        if (overviewCondition) overviewData.conditionRating = overviewCondition;

        // Build general notes for overview
        const overviewNotesParts: string[] = [];
        overviewNotesParts.push(`[Website Form - ${new Date().toLocaleDateString("en-US")}]`);
        if (ownedProperty) overviewNotesParts.push(`Owned since: ${ownedProperty}`);
        if (conditionProperty) overviewNotesParts.push(`Condition: ${conditionProperty}`);
        if (repairsNeeded) overviewNotesParts.push(`Repairs: ${repairsNeeded}`);
        if (livingInHouse) overviewNotesParts.push(`Living in house: ${livingInHouse}`);
        if (listedRealtor) overviewNotesParts.push(`Listed with realtor: ${listedRealtor}`);
        if (sellFast) overviewNotesParts.push(`Wants to sell fast: ${sellFast}`);
        if (lowestPrice) overviewNotesParts.push(`Lowest acceptable price: ${lowestPrice}`);
        if (bestTimeToCall) overviewNotesParts.push(`Best time to call: ${bestTimeToCall}`);
        if (overviewNotesParts.length > 1) {
          overviewData.generalNotes = overviewNotesParts.join("\n");
        }

        // Check if overview record exists
        const existingOverview = await database
          .select({ id: deepSearchOverview.id })
          .from(deepSearchOverview)
          .where(eq(deepSearchOverview.propertyId, propertyId))
          .limit(1);

        if (existingOverview.length > 0) {
          const existingOv = await database
            .select({ generalNotes: deepSearchOverview.generalNotes })
            .from(deepSearchOverview)
            .where(eq(deepSearchOverview.propertyId, propertyId))
            .limit(1);
          const existingGN = existingOv[0]?.generalNotes || "";
          if (existingGN && overviewData.generalNotes) {
            overviewData.generalNotes = existingGN + "\n\n" + overviewData.generalNotes;
          }
          delete overviewData.propertyId;
          await database.update(deepSearchOverview)
            .set(overviewData)
            .where(eq(deepSearchOverview.propertyId, propertyId));
          console.log(`[Zapier Step 2] Updated deep search overview for property #${propertyId}`);
        } else {
          await database.insert(deepSearchOverview).values(overviewData as any);
          console.log(`[Zapier Step 2] Created deep search overview for property #${propertyId}`);
        }
      } catch (overviewError) {
        console.error(`[Zapier Step 2] Deep search overview update failed for property #${propertyId}:`, overviewError);
      }

      console.log(`[Zapier Step 2] Updated property #${propertyId} with detailed data for phone: ${phone}`);

      return res.status(200).json({
        success: true,
        message: "Lead updated with detailed data (Step 2)",
        propertyId,
        ownerName,
        address: `${address}, ${city}, ${state} ${zipcode}`.trim(),
        fieldsUpdated: Object.keys(updateFields),
        qualifyingDataSaved: noteLines.length > 4,
      });
    } catch (error) {
      console.error("[Zapier Step 2] Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error updating lead in CRM",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  // ─── Slack Events API ────────────────────────────────────────────────────────
  // Handles Slack url_verification challenge and incoming message events
  // from #instantly and #autocalls-slack channels.
  app.post("/api/oauth/slack/events", express.json(), async (req, res) => {
    try {
      const body = req.body;

      // ── Step 1: Slack URL Verification (one-time handshake) ──
      // Slack sends this when you first configure the Events API Request URL.
      // Must respond with the challenge value immediately.
      if (body.type === "url_verification") {
        console.log("[Slack] URL verification challenge received");
        return res.status(200).json({ challenge: body.challenge });
      }

      // ── Step 2: Acknowledge receipt immediately (Slack requires < 3s response) ──
      res.status(200).send();

      // ── Step 3: Process the event asynchronously ──
      const event = body.event;
      if (!event || event.type !== "message" || event.subtype) {
        // Ignore non-message events and bot messages (subtype = bot_message, etc.)
        return;
      }

      const messageText: string = event.text || "";
      const channelId: string = event.channel || "";
      const slackUserId: string = event.user || "";
      const ts: string = event.ts || "";

      console.log(`[Slack] Message received from channel ${channelId}: ${messageText.substring(0, 100)}`);

      // ── Step 4: Determine source from channel ──
      // Map channel IDs to sources — populated once bot is configured
      const { getDb } = await import("../db");
      const { ENV } = await import("./env");
      const database = await getDb();
      if (!database) {
        console.error("[Slack] Database not available");
        return;
      }

      // Determine source from channel name via Slack API
      let source: "instantly" | "autocalls" | null = null;
      const botToken = ENV.slackBotToken;
      if (botToken) {
        try {
          const channelInfoRes = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
            headers: { Authorization: `Bearer ${botToken}` },
          });
          const channelInfo = await channelInfoRes.json() as any;
          const channelName: string = channelInfo?.channel?.name || "";
          if (channelName === "instantly") source = "instantly";
          else if (channelName === "autocalls-slack") source = "autocalls";
          else {
            console.log(`[Slack] Ignoring message from unregistered channel: ${channelName}`);
            return;
          }
          console.log(`[Slack] Source identified: ${source} (channel: #${channelName})`);
        } catch (err) {
          console.error("[Slack] Failed to resolve channel name:", err);
          return;
        }
      } else {
        console.warn("[Slack] SLACK_BOT_TOKEN not configured — cannot process events");
        return;
      }

      // ── Step 5: Extract property_id and campaign (REQUIRED — if either missing, ignore) ──
      const propertyIdMatch = messageText.match(/property[_\s-]?id[:\s#]*([\d]+)/i);
      const campaignMatch = messageText.match(/campaign[:\s]+([^\n]+)/i);

      if (!propertyIdMatch || !campaignMatch) {
        console.log(`[Slack] Message ignored — missing property_id or campaign. Text: ${messageText.substring(0, 80)}`);
        return;
      }

      const propertyId = parseInt(propertyIdMatch[1]);
      const campaignName = campaignMatch[1].trim();

      // ── Step 6: Verify property exists ──
      const { properties, contacts, contactPhones, notes } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const property = await database
        .select({ id: properties.id, addressLine1: properties.addressLine1, city: properties.city, state: properties.state })
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property.length) {
        console.log(`[Slack] Property #${propertyId} not found — ignoring message`);
        // Optionally notify Slack that property was not found
        if (botToken) {
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: channelId,
              thread_ts: ts,
              text: `⚠️ *CRM:* Property #${propertyId} not found in the database. No update was made.`,
            }),
          });
        }
        return;
      }

      const prop = property[0];
      const propAddress = [prop.addressLine1, prop.city, prop.state].filter(Boolean).join(", ");

      // ── Step 7: Save message as General Note ──
      const noteContent = [
        `=== ${source === "instantly" ? "Instantly" : "Autocalls"} Update ===`,
        `Date: ${new Date().toLocaleDateString("en-US")} ${new Date().toLocaleTimeString("en-US")}`,
        `Campaign: ${campaignName}`,
        `Property: #${propertyId} — ${propAddress}`,
        "",
        messageText,
      ].join("\n");

      await database.insert(notes).values({
        propertyId,
        userId: 1,
        content: noteContent,
        noteType: "general",
      });

      console.log(`[Slack] Note saved for property #${propertyId}`);

      // ── Step 8: Create internal CRM notification ──
      try {
        const { crmNotifications } = await import("../../drizzle/schema");
        await database.insert(crmNotifications).values({
          propertyId,
          source,
          campaignName,
          eventType: "message",
          messageText: messageText.substring(0, 1000),
          rawPayload: JSON.stringify(body),
          isRead: 0,
        });
        console.log(`[Slack] Internal notification created for property #${propertyId}`);
      } catch (notifErr) {
        console.error("[Slack] Failed to create internal notification:", notifErr);
      }

      // ── Step 9: Post confirmation back to Slack ──
      if (botToken) {
        try {
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: channelId,
              thread_ts: ts,
              text: `✅ *CRM Updated* — Property *#${propertyId}* (${propAddress})\n📣 Campaign: ${campaignName}\n📝 Note saved to General Notes.`,
            }),
          });
          console.log(`[Slack] Confirmation sent back to Slack for property #${propertyId}`);
        } catch (slackErr) {
          console.error("[Slack] Failed to send confirmation:", slackErr);
        }
      }

    } catch (error) {
      console.error("[Slack Events] Error:", error);
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start the automated follow-up scheduler
    import("../db-automated-followups").then(({ startFollowUpScheduler }) => {
      startFollowUpScheduler();
    }).catch((err) => {
      console.error("[FollowUp Scheduler] Failed to start:", err);
    });
  });
}

startServer().catch(console.error);
