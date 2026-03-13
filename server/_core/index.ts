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
  const validateZapierToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { ENV } = require("./env");
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
        owner1Name: "Website Lead",
        propertyType: "Unknown",
        trackingStatus: "Not Visited",
        leadTemperature: "TBD",
        leadSource: "Website",
        deskName: "BIN",
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
        name: "Website Lead",
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
      const { properties, contacts, contactPhones, contactEmails, notes } = await import("../../drizzle/schema");
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
        { key: "accept", label: "Accepted Terms", aliases: ["Accept"] },
      ];

      const noteLines: string[] = [];
      noteLines.push("=== Website Form - Step 2 (Qualifying Questions) ===");
      noteLines.push(`Date: ${new Date().toLocaleDateString("en-US")}`);
      noteLines.push(`Name: ${ownerName}`);
      if (address) noteLines.push(`Address: ${address}, ${city}, ${state} ${zipcode}`);
      noteLines.push("");

      for (const field of qualifyingFields) {
        let value = data[field.key];
        if (!value) {
          for (const alias of field.aliases) {
            if (data[alias]) { value = data[alias]; break; }
          }
        }
        if (value) {
          noteLines.push(`${field.label}: ${value}`);
        }
      }

      // Only insert note if we have qualifying data
      if (noteLines.length > 4) {
        await database.insert(notes).values({
          propertyId,
          userId: 1, // System user
          content: noteLines.join("\n"),
          noteType: "general",
        });
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
  });
}

startServer().catch(console.error);
