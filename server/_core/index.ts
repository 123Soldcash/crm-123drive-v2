import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
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
      const { properties, contacts } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
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

      // Check for duplicates by address
      const existingProperty = await database
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.addressLine1, addressLine1),
            eq(properties.city, city),
            eq(properties.state, state)
          )
        )
        .limit(1);

      if (existingProperty.length > 0) {
        // Property already exists - mark as DUPLICATED
        const existingId = existingProperty[0].id;
        const currentStatus = existingProperty[0].status || "";
        const statusTags = currentStatus.split(",").map(t => t.trim()).filter(t => t);
        
        if (!statusTags.includes("DUPLICATED")) {
          statusTags.push("DUPLICATED");
          await database
            .update(properties)
            .set({ status: statusTags.join(", ") })
            .where(eq(properties.id, existingId));
        }

        return res.status(200).json({
          success: true,
          message: "Property already exists - marked as DUPLICATED",
          isDuplicate: true,
          existingPropertyId: existingId,
          address: addressLine1,
        });
      }

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

      // If contact info provided, add contact
      if (data.Email || data.Phone) {
        const propertyId = (result as any).insertId || (result as any)[0]?.id;
        if (propertyId) {
          await database.insert(contacts).values({
            propertyId,
            name: ownerName,
            relationship: "Owner",
            phone1: data.Phone,
            email1: data.Email,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
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
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve static files and Vite
  serveStatic(app);
  await setupVite(app, server);

  const port = await findAvailablePort();
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
