import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
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

  // REST webhook endpoint for Zapier (must be before tRPC middleware)
  app.post("/api/webhook/zapier", async (req, res) => {
    try {
      const { getDb } = await import("../db");
      const { properties, contacts, contactPhones, contactEmails } = await import("../../drizzle/schema");
      
      const database = await getDb();
      if (!database) {
        return res.status(500).json({ success: false, message: "Database not available" });
      }

      // Map Zapier field names (capitalized) to our schema
      const data = req.body;
      const ownerName = data.OwnerName || data.FullName || data.Name || `${data.FirstName || ""} ${data.LastName || ""}`.trim() || "Unknown";
      const addressLine1 = data.Address || data.AddressLine1 || "";
      const city = data.City || "Unknown";
      const state = data.State || "";
      const zipcode = data.Zipcode || data.Zip || "";

      // Insert the new property
      const result = await database.insert(properties).values({
        addressLine1,
        city,
        state,
        zipcode,
        owner1Name: ownerName,
        propertyType: data.PropertyType || "Unknown",
        totalBedrooms: data.Bedrooms ? parseInt(data.Bedrooms) : undefined,
        totalBaths: data.Bathrooms ? parseInt(data.Bathrooms) : undefined,
        buildingSquareFeet: data.SquareFeet ? parseInt(data.SquareFeet) : undefined,
        estimatedValue: data.EstimatedValue ? parseInt(data.EstimatedValue) : undefined,
        trackingStatus: "Not Visited",
        leadTemperature: "TBD",
        deskName: "BIN",
        deskStatus: "BIN",
        status: "Zapier Import",
      });

      // If contact info provided, add contact with relational data
      if (data.Email || data.Phone) {
        const propertyId = (result as any).insertId || (result as any)[0]?.id;
        if (propertyId) {
          // Insert contact into contacts table
          const contactResult = await database.insert(contacts).values({
            propertyId,
            name: ownerName,
            relationship: "Owner",
          });
          
          const contactId = (contactResult as any).insertId || (contactResult as any)[0]?.id;
          
          if (contactId) {
            // Insert phone if provided
            if (data.Phone && String(data.Phone).trim()) {
              await database.insert(contactPhones).values({
                contactId,
                phoneNumber: String(data.Phone).trim(),
                phoneType: "Mobile",
                isPrimary: 1,
              });
            }
            
            // Insert email if provided
            if (data.Email && String(data.Email).trim()) {
              await database.insert(contactEmails).values({
                contactId,
                email: String(data.Email).trim(),
                isPrimary: 1,
              });
            }
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Lead successfully added to CRM",
        ownerName,
        address: addressLine1,
      });
    } catch (error) {
      console.error("Zapier webhook error:", error);
      return res.status(500).json({
        success: false,
        message: "Error adding lead to CRM",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  // ─── Twilio Voice TwiML Webhook ──────────────────────────────────────────
  // When a browser-based call is initiated via Device.connect(), Twilio sends
  // a POST to the TwiML App's Voice URL. This endpoint returns TwiML XML
  // instructing Twilio to dial the requested phone number.
  app.post("/api/twilio/voice", async (req, res) => {
    try {
      const { buildTwimlResponse } = await import("../twilio");
      const twiml = buildTwimlResponse(req.body.To);
      res.type("text/xml");
      res.send(twiml);
    } catch (error) {
      console.error("[Twilio Voice Webhook] Error:", error);
      const twilio = await import("twilio");
      const VoiceResponse = twilio.default.twiml.VoiceResponse;
      const fallback = new VoiceResponse();
      fallback.say("An error occurred. Please try again later.");
      res.type("text/xml");
      res.send(fallback.toString());
    }
  });

  // Twilio connect endpoint — used by REST API calls to bridge to destination
  app.all("/api/twilio/connect", async (req, res) => {
    try {
      const to = req.query.to as string || req.body?.To;
      const { buildConnectTwiml } = await import("../twilio");
      const twiml = buildConnectTwiml(to);
      console.log("[Twilio Connect] Bridging call to:", to);
      res.type("text/xml");
      res.send(twiml);
    } catch (error) {
      console.error("[Twilio Connect] Error:", error);
      const twilio = await import("twilio");
      const VoiceResponse = twilio.default.twiml.VoiceResponse;
      const fallback = new VoiceResponse();
      fallback.say("An error occurred connecting your call.");
      res.type("text/xml");
      res.send(fallback.toString());
    }
  });

  // Twilio call status callback — logs status changes for debugging
  app.post("/api/twilio/voice/status", async (req, res) => {
    console.log("[Twilio Status]", req.body?.CallStatus, req.body?.CallSid);
    res.sendStatus(200);
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
