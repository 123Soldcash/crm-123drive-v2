import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { properties, visits, photos, notes, users, skiptracingLogs, outreachLogs, communicationLog } from "../drizzle/schema";
import { eq, sql, and } from "drizzle-orm";
import * as communication from "./communication";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  properties: router({
    statusCounts: protectedProcedure.query(async () => {
      // Get all properties and count status tags
      const allProperties = await db.getProperties({});
      const counts: Record<string, number> = {};

      allProperties.forEach((property) => {
        if (property.status) {
          // Split status string by comma and count each tag
          const tags = property.status.split(',').map(t => t.trim());
          tags.forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
          });
        }
      });

      return counts;
    }),
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            ownerLocation: z.string().optional(),
            minEquity: z.number().optional(),
            maxEquity: z.number().optional(),
            trackingStatus: z.string().optional(),
            leadTemperature: z.enum(["SUPER HOT", "HOT", "WARM", "COLD", "DEAD"]).optional(),
            ownerVerified: z.boolean().optional(),
            visited: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        return await db.getPropertiesWithAgents({
          ...input,
          userId: ctx.user?.id,
          userRole: ctx.user?.role,
        });
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          status: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updatePropertyStatus(input.propertyId, input.status);
        return { success: true };
      }),
    updateLeadTemperature: protectedProcedure
      .input(z.object({ propertyId: z.number(), temperature: z.enum(["SUPER HOT", "HOT", "WARM", "COLD", "DEAD", "TBD"]) }))
      .mutation(async ({ input }) => {
        await db.updateLeadTemperature(input.propertyId, input.temperature);
        return { success: true };
      }),
    reassignProperty: protectedProcedure
      .input(z.object({ propertyId: z.number(), assignedAgentId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can reassign properties
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can reassign properties');
        }
        await db.reassignProperty(input.propertyId, input.assignedAgentId, ctx.user?.id);
        return { success: true };
      }),
    bulkReassignProperties: protectedProcedure
      .input(z.object({ propertyIds: z.array(z.number()), assignedAgentId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can reassign properties
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can reassign properties');
        }
        await db.bulkReassignProperties(input.propertyIds, input.assignedAgentId, ctx.user?.id);
        return { success: true };
      }),
       getZillowUrl: protectedProcedure
      .input(
        z.object({
          address: z.string(),
          city: z.string(),
          state: z.string(),
          zipcode: z.string(),
        })
      )
      .query(({ input }) => {
        return { url: db.generateZillowUrl(input.address, input.city, input.state, input.zipcode) };
      }),
    toggleOwnerVerified: protectedProcedure
      .input(z.object({ propertyId: z.number(), verified: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.toggleOwnerVerified(input.propertyId, input.verified);
        return { success: true };
      }),
    getTags: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropertyTags(input.propertyId);
      }),
    getAllTags: protectedProcedure
      .query(async () => {
        return await db.getAllUniqueTags();
      }),

    getActivities: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");

        const activities: Array<{
          id: string;
          type: string;
          timestamp: Date;
          user: string;
          details: string;
          metadata?: any;
        }> = [];

        // Get visits (check-ins)
        const propertyVisits = await dbInstance
          .select()
          .from(visits)
          .where(eq(visits.propertyId, input.propertyId));
        
        for (const visit of propertyVisits) {
          const user = await dbInstance
            .select()
            .from(users)
            .where(eq(users.id, visit.userId))
            .limit(1);
          
          activities.push({
            id: `visit-${visit.id}`,
            type: 'check-in',
            timestamp: visit.checkInTime,
            user: user[0]?.name || 'Unknown User',
            details: `Checked in at property`,
            metadata: {
              latitude: visit.latitude,
              longitude: visit.longitude,
            },
          });
        }

        // Get notes
        const propertyNotes = await dbInstance
          .select()
          .from(notes)
          .where(eq(notes.propertyId, input.propertyId));
        
        for (const note of propertyNotes) {
          const user = await dbInstance
            .select()
            .from(users)
            .where(eq(users.id, note.userId))
            .limit(1);
          
          activities.push({
            id: `note-${note.id}`,
            type: 'note',
            timestamp: note.createdAt,
            user: user[0]?.name || 'Unknown User',
            details: note.content,
            metadata: null,
          });
        }

        // Get photos
        const propertyPhotos = await dbInstance
          .select()
          .from(photos)
          .where(eq(photos.propertyId, input.propertyId));
        
        for (const photo of propertyPhotos) {
          const user = await dbInstance
            .select()
            .from(users)
            .where(eq(users.id, photo.userId))
            .limit(1);
          
          activities.push({
            id: `photo-${photo.id}`,
            type: 'photo',
            timestamp: photo.createdAt,
            user: user[0]?.name || 'Unknown User',
            details: photo.caption || 'Uploaded photo',
            metadata: {
              url: photo.fileUrl,
            },
          });
        }

        // Sort by timestamp descending (most recent first)
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return activities;
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new Error("Database not available");

      // Build agent filter condition
      const agentFilter = ctx.user?.role !== 'admin' && ctx.user?.id
        ? eq(properties.assignedAgentId, ctx.user.id)
        : undefined;

      // Count by lead temperature
      const hotCount = await dbInstance
        .select({ count: sql<number>`count(*)` })
        .from(properties)
        .where(agentFilter ? and(eq(properties.leadTemperature, "HOT"), agentFilter) : eq(properties.leadTemperature, "HOT"));
      const warmCount = await dbInstance
        .select({ count: sql<number>`count(*)` })
        .from(properties)
        .where(agentFilter ? and(eq(properties.leadTemperature, "WARM"), agentFilter) : eq(properties.leadTemperature, "WARM"));
      const coldCount = await dbInstance
        .select({ count: sql<number>`count(*)` })
        .from(properties)
        .where(agentFilter ? and(eq(properties.leadTemperature, "COLD"), agentFilter) : eq(properties.leadTemperature, "COLD"));
      const deadCount = await dbInstance
        .select({ count: sql<number>`count(*)` })
        .from(properties)
        .where(agentFilter ? and(eq(properties.leadTemperature, "DEAD"), agentFilter) : eq(properties.leadTemperature, "DEAD"));

      // Count owner verified
      const ownerVerifiedCount = await dbInstance
        .select({ count: sql<number>`count(*)` })
        .from(properties)
        .where(agentFilter ? and(eq(properties.ownerVerified, 1), agentFilter) : eq(properties.ownerVerified, 1));

      // Count visited properties
      const visitedCount = await dbInstance
        .select({ count: sql<number>`count(distinct ${properties.id})` })
        .from(properties)
        .innerJoin(visits, eq(visits.propertyId, properties.id))
        .where(agentFilter || undefined);

      return {
        hot: Number(hotCount[0]?.count || 0),
        warm: Number(warmCount[0]?.count || 0),
        cold: Number(coldCount[0]?.count || 0),
        dead: Number(deadCount[0]?.count || 0),
        ownerVerified: Number(ownerVerifiedCount[0]?.count || 0),
        visited: Number(visitedCount[0]?.count || 0),
      };
    }),
    addTag: protectedProcedure
      .input(z.object({ propertyId: z.number(), tag: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.addPropertyTag(input.propertyId, input.tag, ctx.user.id);
        return { success: true };
      }),
    removeTag: protectedProcedure
      .input(z.object({ tagId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removePropertyTag(input.tagId);
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropertyById(input.id);
      }),

    updateProperty: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          ownerVerified: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        await dbInstance
          .update(properties)
          .set({ ownerVerified: input.ownerVerified })
          .where(eq(properties.id, input.id));
        return { success: true };
      }),

    forMap: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPropertiesForMap({
        userId: ctx.user?.id,
        userRole: ctx.user?.role,
      });
    }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPropertyStats({
        userId: ctx.user?.id,
        userRole: ctx.user?.role,
      });
    }),

    // Property Agents (many-to-many)
    getAgents: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropertyAgents(input.propertyId);
      }),

    addAgent: protectedProcedure
      .input(z.object({ propertyId: z.number(), agentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can assign agents
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can assign agents to properties');
        }
        return await db.addPropertyAgent(input.propertyId, input.agentId, ctx.user?.id);
      }),

    removeAgent: protectedProcedure
      .input(z.object({ propertyId: z.number(), agentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can remove agents
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can remove agents from properties');
        }
        return await db.removePropertyAgent(input.propertyId, input.agentId);
      }),

    bulkAddAgent: protectedProcedure
      .input(z.object({ propertyIds: z.array(z.number()), agentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can bulk assign agents
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can assign agents to properties');
        }
        let successCount = 0;
        for (const propertyId of input.propertyIds) {
          const result = await db.addPropertyAgent(propertyId, input.agentId, ctx.user?.id);
          if (result.success) successCount++;
        }
        return { success: true, count: successCount };
      }),

    // Lead Transfer procedures
    transferLead: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        toAgentId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }
        // Any agent can transfer their own leads
        const result = await db.createLeadTransfer({
          propertyId: input.propertyId,
          fromAgentId: ctx.user.id,
          toAgentId: input.toAgentId,
          reason: input.reason,
        });
        return { success: true, transferId: result.id };
      }),

    getTransferHistory: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLeadTransfersByPropertyId(input.propertyId);
      }),

    getPendingTransfers: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user?.id) return [];
        return await db.getPendingTransfersForAgent(ctx.user.id);
      }),

    deleteProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can delete properties
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can delete properties');
        }
        return await db.deleteProperty(input.propertyId);
      }),

    bulkDeleteProperties: protectedProcedure
      .input(z.object({ propertyIds: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can delete properties
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can delete properties');
        }
        let deletedCount = 0;
        for (const propertyId of input.propertyIds) {
          const result = await db.deleteProperty(propertyId);
          if (result.success) deletedCount++;
        }
        return { success: true, count: deletedCount };
      }),

    getDeepSearch: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropertyDeepSearch(input.propertyId);
      }),

    updateDeepSearch: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          mlsStatus: z.enum(["Listed", "Not Listed", "Fail", "Expired", "Sold", "Off Market"]).optional(),
          occupancy: z.enum([
            "Owner-Occupied",
            "Abandoned",
            "Partially Occupied",
            "Relatives",
            "Second Home",
            "Squatters",
            "Vacant",
            "Tenant-Occupied",
          ]).optional(),
          annualRent: z.number().nullable().optional(),
          monthlyRent: z.number().nullable().optional(),
          leaseType: z.enum(["Annual", "Month to Month"]).optional(),
          overviewNotes: z.string().optional(),
          issues: z.string().optional(),
          propertyCondition: z.string().optional(), // JSON object with rating and tags
          propertyType: z.string().optional(), // JSON object with type and tags
          probateFinds: z.string().optional(),
          probateNotes: z.string().optional(),
          familyTree: z.string().optional(),
          familyTreeNotes: z.string().optional(),
          zillowEstimate: z.number().nullable().optional(),
          dealMachineEstimate: z.number().nullable().optional(),
          ourEstimate: z.number().nullable().optional(),
          estimateNotes: z.string().optional(),
          recordsChecked: z.string().optional(),
          recordsCheckedNotes: z.string().optional(),
          recordDetails: z.string().optional(),
          recordDetailsFindings: z.string().optional(),
          deedType: z.string().optional(),
          delinquentTax2025: z.number().nullable().optional(),
          delinquentTax2024: z.number().nullable().optional(),
          delinquentTax2023: z.number().nullable().optional(),
          delinquentTax2022: z.number().nullable().optional(),
          delinquentTax2021: z.number().nullable().optional(),
          delinquentTax2020: z.number().nullable().optional(),
          delinquentTaxTotal: z.number().optional(),
          hasMortgage: z.number().optional(),
          mortgageAmount: z.number().nullable().optional(),
          equityPercent: z.number().nullable().optional(),
          mortgageNotes: z.string().optional(),
          needsRepairs: z.number().optional(),
          repairTypes: z.string().optional(),
          estimatedRepairCost: z.number().nullable().optional(),
          repairNotes: z.string().optional(),
          hasCodeViolation: z.number().optional(),
          codeViolationNotes: z.string().optional(),
          hasLiens: z.number().optional(),
          liensNotes: z.string().optional(),
          skiptracingDone: z.string().optional(),
          skiptracingNotes: z.string().optional(),
          outreachDone: z.string().optional(),
          tasks: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.updatePropertyDeepSearch(input);
      }),
  }),

  users: router({
    listAgents: protectedProcedure.query(async () => {
      return await db.listAgents();
    }),
    getAgentStatistics: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can view agent statistics
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can view agent statistics');
      }
      return await db.getAgentStatistics();
    }),
    updateAgent: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Only admin can update agent details
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can update agent details');
        }

        const dbInstance = await getDb();
        if (!dbInstance) throw new Error('Database not available');

        // Build update object with only provided fields
        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.email !== undefined) updateData.email = input.email;
        if (input.phone !== undefined) updateData.phone = input.phone;

        // Update user
        await dbInstance
          .update(users)
          .set(updateData)
          .where(eq(users.id, input.userId));

        return { success: true };
      }),
    deleteAgent: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can delete agents
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can delete agents');
        }
        
        // Prevent deleting yourself
        if (ctx.user?.id === input.userId) {
          throw new Error('Cannot delete your own account');
        }
        
        return await db.deleteAgent(input.userId);
      }),
    reassignAgentProperties: protectedProcedure
      .input(z.object({ fromAgentId: z.number(), toAgentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can reassign properties
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can reassign agent properties');
        }
        
        return await db.reassignAgentProperties(input.fromAgentId, input.toAgentId);
      }),
  }),

  contacts: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getContactsByPropertyId(input.propertyId);
      }),

    updateContact: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          isDecisionMaker: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        const { contacts } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        await dbInstance
          .update(contacts)
          .set({ isDecisionMaker: input.isDecisionMaker })
          .where(eq(contacts.id, input.id));
        return { success: true };
      }),

    toggleHidden: protectedProcedure
      .input(z.object({ id: z.number(), hidden: z.number() }))
      .mutation(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        const { contacts } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        await dbInstance
          .update(contacts)
          .set({ hidden: input.hidden })
          .where(eq(contacts.id, input.id));
        return { success: true };
      }),
  }),

  visits: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getVisitsByPropertyId(input.propertyId);
      }),

    recent: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getRecentVisits(input?.limit);
      }),

    checkIn: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await db.createVisit({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
          notes: input.notes,
        });
      }),
  }),

  savedSearches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSavedSearchesByUserId(ctx.user.id);
    }),
    listWithCounts: protectedProcedure.query(async ({ ctx }) => {
      const searches = await db.getSavedSearchesByUserId(ctx.user.id);
      
      // Calculate property count for each saved search
      const searchesWithCounts = await Promise.all(
        searches.map(async (search) => {
          try {
            const filters = JSON.parse(search.filters);
            const properties = await db.getProperties({
              search: filters.search || undefined,
              ownerLocation: filters.ownerLocation || undefined,
              minEquity: filters.minEquity > 0 ? filters.minEquity : undefined,
              trackingStatus: filters.marketStatus || undefined,
            });

            // Filter by status tags on the server side
            let filteredCount = properties.length;
            if (filters.statusTags && filters.statusTags.length > 0) {
              const filtered = properties.filter((property) => {
                if (!property.status) return false;
                const propertyTags = property.status.split(",").map((t: string) => t.trim());
                return filters.statusTags.every((tag: string) => propertyTags.includes(tag));
              });
              filteredCount = filtered.length;
            }

            return {
              ...search,
              propertyCount: filteredCount,
            };
          } catch (error) {
            return {
              ...search,
              propertyCount: 0,
            };
          }
        })
      );

      return searchesWithCounts;
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          filters: z.string(), // JSON string of filter configuration
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await db.createSavedSearch({
          userId: ctx.user.id,
          name: input.name,
          filters: input.filters,
        });
        return result;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSavedSearch(input.id);
        return { success: true };
      }),
    rename: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateSavedSearch(input.id, input.name);
        return { success: true };
      }),
  }),

  photos: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPhotosByPropertyId(input.propertyId);
      }),

    uploadBulk: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          visitId: z.number().optional(),
          noteId: z.number().optional(),
          photos: z.array(
            z.object({
              fileData: z.string(),
              caption: z.string().optional(),
            })
          ),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        const uploadedPhotos = [];

        for (const photo of input.photos) {
          const base64Data = photo.fileData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");

          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileKey = `properties/${input.propertyId}/photos/${timestamp}-${randomSuffix}.jpg`;

          const { url } = await storagePut(fileKey, buffer, "image/jpeg");

          const result = await db.createPhoto({
            propertyId: input.propertyId,
            visitId: input.visitId,
            noteId: input.noteId,
            userId: ctx.user.id,
            fileKey,
            fileUrl: url,
            caption: photo.caption,
            latitude: input.latitude,
            longitude: input.longitude,
          });

          uploadedPhotos.push(result);
        }

        return { photos: uploadedPhotos, count: uploadedPhotos.length };
      }),

    upload: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          visitId: z.number().optional(),
          noteId: z.number().optional(),
          fileData: z.string(), // base64 encoded image
          caption: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        
        // Decode base64 image
        const base64Data = input.fileData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        
        // Generate unique file key
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileKey = `properties/${input.propertyId}/photos/${timestamp}-${randomSuffix}.jpg`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, "image/jpeg");
        
        // Save to database
        return await db.createPhoto({
          propertyId: input.propertyId,
          visitId: input.visitId,
          noteId: input.noteId,
          userId: ctx.user.id,
          fileKey,
          fileUrl: url,
          caption: input.caption,
          latitude: input.latitude,
          longitude: input.longitude,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deletePhoto(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  notes: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getNotesByPropertyId(input.propertyId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await db.createNote({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          content: input.content,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateNote(input.id, ctx.user.id, input.content);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteNote(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  import: router({
    uploadProperties: protectedProcedure
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
        
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error('Database not available');
        
        // Process each row
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          
          try {
            // Map Excel columns to template fields
            const addressLine1 = row['addressLine1'] || row['Address'] || '';
            const city = row['city'] || row['City'] || '';
            const state = row['state'] || row['State'] || '';
            const zipcode = row['zipcode'] || row['Zipcode'] || '';
            
            // Skip if essential fields are missing
            if (!addressLine1 || !city || !state || !zipcode) {
              errorCount++;
              errors.push(`Row ${i + 2}: Missing required fields`);
              continue;
            }
            
            // Helper function to parse dates
            const parseDate = (value: any): Date | null => {
              if (!value) return null;
              if (value instanceof Date) return value;
              const parsed = new Date(value);
              return isNaN(parsed.getTime()) ? null : parsed;
            };
            
            // All property fields from template
            const propertyData: any = {
              addressLine1: String(addressLine1).trim(),
              addressLine2: row['addressLine2'] || null,
              city: String(city).trim(),
              state: String(state).trim(),
              zipcode: String(zipcode).trim(),
              subdivisionName: row['subdivisionName'] || null,
              status: row['status'] || null,
              marketStatus: row['marketStatus'] || null,
              ownerLocation: row['ownerLocation'] || null,
              estimatedValue: row['estimatedValue'] ? Number(row['estimatedValue']) : null,
              equityAmount: row['equityAmount'] ? Number(row['equityAmount']) : null,
              equityPercent: row['equityPercent'] ? Number(row['equityPercent']) : null,
              salePrice: row['salePrice'] ? Number(row['salePrice']) : null,
              saleDate: parseDate(row['saleDate']),
              mortgageAmount: row['mortgageAmount'] ? Number(row['mortgageAmount']) : null,
              owner1Name: row['owner1Name'] || null,
              owner2Name: row['owner2Name'] || null,
              buildingSquareFeet: row['buildingSquareFeet'] ? Number(row['buildingSquareFeet']) : null,
              totalBedrooms: row['totalBedrooms'] ? Number(row['totalBedrooms']) : null,
              totalBaths: row['totalBaths'] ? Number(row['totalBaths']) : null,
              yearBuilt: row['yearBuilt'] ? Number(row['yearBuilt']) : null,
              propertyType: row['propertyType'] || null,
              constructionType: row['constructionType'] || null,
              apnParcelId: row['apnParcelId'] || null,
              taxDelinquent: row['taxDelinquent'] || null,
              taxDelinquentYear: row['taxDelinquentYear'] ? Number(row['taxDelinquentYear']) : null,
              taxYear: row['taxYear'] ? Number(row['taxYear']) : null,
              taxAmount: row['taxAmount'] ? Number(row['taxAmount']) : null,
              assignedAgentId: input.assignedAgentId,
            };
            
            // Insert property
            await dbInstance.insert(properties).values(propertyData);
            
            // Get the inserted property ID by querying the most recent insert
            const [insertedProperty] = await dbInstance
              .select({ id: properties.id })
              .from(properties)
              .where(
                and(
                  eq(properties.addressLine1, propertyData.addressLine1),
                  eq(properties.city, propertyData.city),
                  eq(properties.state, propertyData.state),
                  eq(properties.zipcode, propertyData.zipcode)
                )
              )
              .orderBy(sql`${properties.id} DESC`)
              .limit(1);
            
            if (!insertedProperty) {
              throw new Error('Failed to retrieve inserted property');
            }
            
            const propertyId = insertedProperty.id;
            
            // Process contacts (up to 2 contacts from template)
            const { contacts } = await import('../drizzle/schema');
            for (let contactNum = 1; contactNum <= 2; contactNum++) {
              const contactName = row[`contact${contactNum}_name`];
              
              // Skip if contact has no name
              if (!contactName) continue;
              
              const contactData: any = {
                propertyId,
                name: String(contactName).trim(),
                flags: row[`contact${contactNum}_flags`] || null,
                phone1: row[`contact${contactNum}_phone1`] || null,
                phone1Type: row[`contact${contactNum}_phone1Type`] || null,
                phone2: row[`contact${contactNum}_phone2`] || null,
                phone2Type: row[`contact${contactNum}_phone2Type`] || null,
                phone3: row[`contact${contactNum}_phone3`] || null,
                phone3Type: row[`contact${contactNum}_phone3Type`] || null,
                email1: row[`contact${contactNum}_email1`] || null,
                email2: row[`contact${contactNum}_email2`] || null,
                email3: row[`contact${contactNum}_email3`] || null,
              };
              
              await dbInstance.insert(contacts).values(contactData);
            }
            
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`Row ${i + 2}: ${error.message}`);
          }
        }
        
        return {
          success: true,
          successCount,
          errorCount,
          errors: errors.slice(0, 10), // Return first 10 errors only
          totalRows: data.length,
        };
      }),
  }),

  // Communication Tracking
  communication: router({
    // Contact Management
    getContactsByProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await communication.getPropertyContactsWithDetails(input.propertyId);
      }),

    getContactById: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await communication.getContactWithDetails(input.contactId);
      }),

    createContact: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          name: z.string().optional(),
          relationship: z.string().optional(),
          age: z.number().optional(),
          deceased: z.number().optional(),
          currentAddress: z.string().optional(),
          isDecisionMaker: z.number().optional(),
          dnc: z.number().optional(),
          isLitigator: z.number().optional(),
          flags: z.string().optional(),
          phone1: z.string().optional(),
          phone1Type: z.string().optional(),
          phone2: z.string().optional(),
          phone2Type: z.string().optional(),
          phone3: z.string().optional(),
          phone3Type: z.string().optional(),
          email1: z.string().optional(),
          email2: z.string().optional(),
          email3: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const contactId = await communication.createContact(input);
        return { success: true, contactId };
      }),

    updateContact: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          name: z.string().optional(),
          relationship: z.string().optional(),
          age: z.number().optional(),
          deceased: z.number().optional(),
          currentAddress: z.string().optional(),
          isDecisionMaker: z.number().optional(),
          dnc: z.number().optional(),
          isLitigator: z.number().optional(),
          flags: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { contactId, ...updates } = input;
        await communication.updateContact(contactId, updates);
        return { success: true };
      }),

    deleteContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.deleteContact(input.contactId);
        return { success: true };
      }),

    // Phone Management
    addPhone: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          phoneNumber: z.string(),
          phoneType: z.enum(["Mobile", "Landline", "Wireless", "Work", "Home", "Other"]).optional(),
          isPrimary: z.number().optional(),
          dnc: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const phoneId = await communication.addPhone(input);
        return { success: true, phoneId };
      }),

    updatePhone: protectedProcedure
      .input(
        z.object({
          phoneId: z.number(),
          phoneNumber: z.string().optional(),
          phoneType: z.enum(["Mobile", "Landline", "Wireless", "Work", "Home", "Other"]).optional(),
          isPrimary: z.number().optional(),
          dnc: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { phoneId, ...updates } = input;
        await communication.updatePhone(phoneId, updates);
        return { success: true };
      }),

    deletePhone: protectedProcedure
      .input(z.object({ phoneId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.deletePhone(input.phoneId);
        return { success: true };
      }),

    // Email Management
    addEmail: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          email: z.string(),
          isPrimary: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const emailId = await communication.addEmail(input);
        return { success: true, emailId };
      }),

    updateEmail: protectedProcedure
      .input(
        z.object({
          emailId: z.number(),
          email: z.string().optional(),
          isPrimary: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { emailId, ...updates } = input;
        await communication.updateEmail(emailId, updates);
        return { success: true };
      }),

    deleteEmail: protectedProcedure
      .input(z.object({ emailId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.deleteEmail(input.emailId);
        return { success: true };
      }),

    // Social Media Management
    addSocialMedia: protectedProcedure
      .input(
        z.object({
          contactId: z.number(),
          platform: z.enum(["Facebook", "Instagram", "LinkedIn", "Twitter", "Other"]),
          profileUrl: z.string().optional(),
          contacted: z.number().optional(),
          contactedDate: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const socialId = await communication.addSocialMedia(input);
        return { success: true, socialId };
      }),

    updateSocialMedia: protectedProcedure
      .input(
        z.object({
          socialId: z.number(),
          profileUrl: z.string().optional(),
          contacted: z.number().optional(),
          contactedDate: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { socialId, ...updates } = input;
        await communication.updateSocialMedia(socialId, updates);
        return { success: true };
      }),

    deleteSocialMedia: protectedProcedure
      .input(z.object({ socialId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.deleteSocialMedia(input.socialId);
        return { success: true };
      }),

    // Communication Log
    getCommunicationLog: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await communication.getCommunicationLogByProperty(input.propertyId);
      }),

    addCommunicationLog: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          contactId: z.number().optional(),
          communicationType: z.enum(["Phone", "Email", "SMS", "Facebook", "Instagram", "DoorKnock", "Letter", "Other"]),
          callResult: z
            .enum([
              "Interested - HOT LEAD",
              "Interested - WARM LEAD - Wants too Much / Full Price",
              "Interested - WARM LEAD - Not Hated",
              "Left Message - Owner Verified",
              "Left Message",
              "Beep Beep",
              "Busy",
              "Call Back",
              "Disconnected",
              "Duplicated number",
              "Fax",
              "Follow-up",
              "Hang up",
              "Has calling restrictions",
              "Investor/Buyer/Realtor Owned",
              "Irate - DNC",
              "Mail box full",
              "Mail box not set-up",
              "Not Answer",
              "Not Available",
              "Not Ringing",
              "Not Service",
              "Number repeated",
              "Player",
              "Portuguese",
              "Property does not fit our criteria",
              "Restrict",
              "See Notes",
              "Sold - DEAD",
              "Spanish",
              "Voicemail",
              "Wrong Number",
              "Wrong Person",
              "Other",
            ])
            .optional(),
          direction: z.enum(["Outbound", "Inbound"]).optional(),
          notes: z.string().optional(),
          nextStep: z.string().optional(),
          communicationDate: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const logId = await communication.addCommunicationLog({
          ...input,
          userId: ctx.user!.id,
        });

        // Auto-update lead temperature based on call result
        if (input.callResult) {
          let newTemperature: "HOT" | "WARM" | "COLD" | "DEAD" | null = null;

          if (input.callResult === "Interested - HOT LEAD") {
            newTemperature = "HOT";
          } else if (input.callResult === "Interested - WARM LEAD - Wants too Much / Full Price" || input.callResult === "Interested - WARM LEAD - Not Hated") {
            newTemperature = "WARM";
          } else if (input.callResult === "Irate - DNC" || input.callResult === "Sold - DEAD") {
            newTemperature = "DEAD";
          }

          if (newTemperature) {
            await db.updateLeadTemperature(input.propertyId, newTemperature);
          }
        }

        return { success: true, logId };
      }),

    updateCommunicationLog: protectedProcedure
      .input(
        z.object({
          logId: z.number(),
          notes: z.string().optional(),
          nextStep: z.string().optional(),
          callResult: z
            .enum([
              "Interested - HOT LEAD",
              "Interested - WARM LEAD - Wants too Much / Full Price",
              "Interested - WARM LEAD - Not Hated",
              "Left Message - Owner Verified",
              "Left Message",
              "Beep Beep",
              "Busy",
              "Call Back",
              "Disconnected",
              "Duplicated number",
              "Fax",
              "Follow-up",
              "Hang up",
              "Has calling restrictions",
              "Investor/Buyer/Realtor Owned",
              "Irate - DNC",
              "Mail box full",
              "Mail box not set-up",
              "Not Answer",
              "Not Available",
              "Not Ringing",
              "Not Service",
              "Number repeated",
              "Player",
              "Portuguese",
              "Property does not fit our criteria",
              "Restrict",
              "See Notes",
              "Sold - DEAD",
              "Spanish",
              "Voicemail",
              "Wrong Number",
              "Wrong Person",
              "Other",
            ])
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { logId, ...updates } = input;
        await communication.updateCommunicationLog(logId, updates);
        return { success: true };
      }),

    deleteCommunicationLog: protectedProcedure
      .input(z.object({ logId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.deleteCommunicationLog(input.logId);
        return { success: true };
      }),

    bulkMarkDNC: protectedProcedure
      .input(z.object({ contactIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await communication.bulkMarkDNC(input.contactIds);
        return { success: true, count: input.contactIds.length };
      }),

    bulkDeleteContacts: protectedProcedure
      .input(z.object({ contactIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await communication.bulkDeleteContacts(input.contactIds);
        return { success: true, count: input.contactIds.length };
      }),

    getAdjacentProperties: protectedProcedure
      .input(
        z.object({
          currentPropertyId: z.number(),
          filters: z
            .object({
              search: z.string().optional(),
              ownerLocation: z.string().optional(),
              minEquity: z.number().optional(),
              maxEquity: z.number().optional(),
              trackingStatus: z.string().optional(),
              leadTemperature: z.enum(["SUPER HOT", "HOT", "WARM", "COLD", "DEAD"]).optional(),
              ownerVerified: z.boolean().optional(),
              visited: z.boolean().optional(),
            })
            .optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        // Get the filtered property list
        const allProperties = await db.getPropertiesWithAgents({
          ...input.filters,
          userId: ctx.user?.id,
          userRole: ctx.user?.role,
        });

        // Find current property index
        const currentIndex = allProperties.findIndex(p => p.id === input.currentPropertyId);
        
        if (currentIndex === -1) {
          return { previousId: null, nextId: null };
        }

        const previousId = currentIndex > 0 ? allProperties[currentIndex - 1].id : null;
        const nextId = currentIndex < allProperties.length - 1 ? allProperties[currentIndex + 1].id : null;

        return { previousId, nextId };
      }),
  }),

  // Note Templates for Quick Insert
  noteTemplates: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const { noteTemplates } = await import("../drizzle/schema");
        return await database.select().from(noteTemplates).where(eq(noteTemplates.userId, ctx.user!.id));
      }),

    add: protectedProcedure
      .input(z.object({ templateText: z.string().min(1).max(500) }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const { noteTemplates } = await import("../drizzle/schema");
        const result: any = await database.insert(noteTemplates).values({
          userId: ctx.user!.id,
          templateText: input.templateText,
        });
        return { success: true, id: Number(result.insertId) };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), templateText: z.string().min(1).max(500) }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const { noteTemplates } = await import("../drizzle/schema");
        await database
          .update(noteTemplates)
          .set({ templateText: input.templateText })
          .where(and(eq(noteTemplates.id, input.id), eq(noteTemplates.userId, ctx.user!.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const { noteTemplates } = await import("../drizzle/schema");
        await database
          .delete(noteTemplates)
          .where(and(eq(noteTemplates.id, input.id), eq(noteTemplates.userId, ctx.user!.id)));
        return { success: true };
      }),
  }),

  // Task Management Router
  tasks: router({
    list: protectedProcedure
      .input(
        z.object({
          propertyId: z.number().optional(),
          status: z.string().optional(),
          priority: z.string().optional(),
          taskType: z.string().optional(),
          assignedToId: z.number().optional(),
          overdue: z.boolean().optional(),
          dueToday: z.boolean().optional(),
          upcoming: z.boolean().optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        // Non-admin users only see their assigned tasks
        const filters = {
          ...input,
          userId: ctx.user?.role === 'admin' ? undefined : ctx.user?.id,
        };
        return await db.getTasks(filters);
      }),

    byId: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTaskById(input.taskId);
      }),

    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTasksByPropertyId(input.propertyId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          taskType: z.enum(["Call", "Email", "Visit", "Research", "Follow-up", "Offer", "Negotiation", "Contract", "Inspection", "Closing", "Other"]),
          priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
          status: z.enum(["To Do", "In Progress", "Done"]).default("To Do"),
          assignedToId: z.number().optional(),
          propertyId: z.number().optional(),
          dueDate: z.string().optional(), // ISO date string
          checklist: z.string().optional(), // JSON string
        })
      )
      .mutation(async ({ input, ctx }) => {
        const taskData: any = {
          ...input,
          createdById: ctx.user.id,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        };
        return await db.createTask(taskData);
      }),

    update: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          taskType: z.enum(["Call", "Email", "Visit", "Research", "Follow-up", "Offer", "Negotiation", "Contract", "Inspection", "Closing", "Other"]).optional(),
          priority: z.enum(["High", "Medium", "Low"]).optional(),
          status: z.enum(["To Do", "In Progress", "Done"]).optional(),
          assignedToId: z.number().optional(),
          propertyId: z.number().optional(),
          dueDate: z.string().optional(),
          completedDate: z.string().optional(),
          checklist: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { taskId, ...updates } = input;
        const updateData: any = { ...updates };
        
        if (updates.dueDate) {
          updateData.dueDate = new Date(updates.dueDate);
        }
        if (updates.completedDate) {
          updateData.completedDate = new Date(updates.completedDate);
        }
        
        return await db.updateTask(taskId, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteTask(input.taskId);
      }),

    toggleHidden: protectedProcedure
      .input(z.object({ taskId: z.number(), hidden: z.number() }))
      .mutation(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        const { tasks } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        await dbInstance
          .update(tasks)
          .set({ hidden: input.hidden })
          .where(eq(tasks.id, input.taskId));
        return { success: true };
      }),

    addComment: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          comment: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await db.addTaskComment({
          taskId: input.taskId,
          userId: ctx.user.id,
          comment: input.comment,
        });
      }),

    getComments: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTaskComments(input.taskId);
      }),

    statistics: protectedProcedure
      .query(async ({ ctx }) => {
        // Non-admin users only see their own stats
        const userId = ctx.user?.role === 'admin' ? undefined : ctx.user?.id;
        return await db.getTaskStatistics(userId);
      }),
  }),

  skiptracing: router({
    list: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        return await database
          .select()
          .from(skiptracingLogs)
          .where(eq(skiptracingLogs.propertyId, input.propertyId))
          .orderBy(sql`${skiptracingLogs.createdAt} DESC`);
      }),

    create: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          method: z.string(),
          source: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        const agentName = ctx.user?.name || 'Unknown';
        const agentId = ctx.user?.id || 0;

        await database.insert(skiptracingLogs).values({
          propertyId: input.propertyId,
          method: input.method,
          source: input.source || null,
          agentId,
          agentName,
          notes: input.notes || null,
        });

        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          method: z.string().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        const { id, ...updateData } = input;

        await database
          .update(skiptracingLogs)
          .set(updateData)
          .where(eq(skiptracingLogs.id, id));

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        await database
          .delete(skiptracingLogs)
          .where(eq(skiptracingLogs.id, input.id));

        return { success: true };
      }),
  }),

  outreach: router({
    list: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        return await database
          .select()
          .from(outreachLogs)
          .where(eq(outreachLogs.propertyId, input.propertyId))
          .orderBy(sql`${outreachLogs.createdAt} DESC`);
      }),

    create: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          method: z.enum(["Email", "Post Card", "Door Knock", "Text Message", "Letter", "Social Media", "Other"]),
          notes: z.string().optional(),
          responseReceived: z.number().optional(),
          responseDate: z.date().optional(),
          responseNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        const agentName = ctx.user?.name || 'Unknown';
        const agentId = ctx.user?.id || 0;

        await database.insert(outreachLogs).values({
          propertyId: input.propertyId,
          method: input.method,
          agentId,
          agentName,
          notes: input.notes || null,
          responseReceived: input.responseReceived || 0,
          responseDate: input.responseDate || null,
          responseNotes: input.responseNotes || null,
        });

        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          method: z.enum(["Email", "Post Card", "Door Knock", "Text Message", "Letter", "Social Media", "Other"]).optional(),
          notes: z.string().optional(),
          responseReceived: z.number().optional(),
          responseDate: z.date().optional(),
          responseNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        const { id, ...updateData } = input;

        await database
          .update(outreachLogs)
          .set(updateData)
          .where(eq(outreachLogs.id, id));

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        await database
          .delete(outreachLogs)
          .where(eq(outreachLogs.id, input.id));

        return { success: true };
      }),
  }),

  callMetrics: router({
    statistics: protectedProcedure
      .query(async ({ ctx }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');

        const userId = ctx.user?.role === 'admin' ? undefined : ctx.user?.id;

        // Get all communication logs
        const allLogs = await database
          .select()
          .from(communicationLog)
          .execute();

        // Filter by user if not admin
        const logs = userId 
          ? allLogs.filter((log: any) => log.agentId === userId)
          : allLogs;

        // Calculate today's calls
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCalls = logs.filter((log: any) => {
          const logDate = new Date(log.createdAt);
          return logDate >= today;
        });

        // Calculate conversion rate by disposition
        const dispositionCounts: Record<string, number> = {};
        logs.forEach((log: any) => {
          if (log.disposition) {
            dispositionCounts[log.disposition] = (dispositionCounts[log.disposition] || 0) + 1;
          }
        });

        const hotLeads = logs.filter((log: any) => 
          log.disposition?.includes('HOT LEAD')
        ).length;
        const warmLeads = logs.filter((log: any) => 
          log.disposition?.includes('WARM LEAD')
        ).length;
        const totalCalls = logs.length;
        const conversionRate = totalCalls > 0 
          ? ((hotLeads + warmLeads) / totalCalls * 100).toFixed(1)
          : '0.0';

        // Calculate agent rankings
        const agentStats: Record<string, { calls: number; hotLeads: number; warmLeads: number }> = {};
        logs.forEach((log: any) => {
          const agent = log.agentName || 'Unknown';
          if (!agentStats[agent]) {
            agentStats[agent] = { calls: 0, hotLeads: 0, warmLeads: 0 };
          }
          agentStats[agent].calls++;
          if (log.disposition?.includes('HOT LEAD')) {
            agentStats[agent].hotLeads++;
          }
          if (log.disposition?.includes('WARM LEAD')) {
            agentStats[agent].warmLeads++;
          }
        });

        const agentRankings = Object.entries(agentStats)
          .map(([agent, stats]) => ({
            agent,
            calls: stats.calls,
            hotLeads: stats.hotLeads,
            warmLeads: stats.warmLeads,
            conversionRate: stats.calls > 0 
              ? ((stats.hotLeads + stats.warmLeads) / stats.calls * 100).toFixed(1)
              : '0.0',
          }))
          .sort((a, b) => b.calls - a.calls)
          .slice(0, 10);

        return {
          totalCallsToday: todayCalls.length,
          totalCallsAllTime: totalCalls,
          conversionRate,
          hotLeads,
          warmLeads,
          dispositionBreakdown: Object.entries(dispositionCounts)
            .map(([disposition, count]) => ({ disposition, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          agentRankings,
        };
      }),
  }),

  // Twilio Browser Calling
  twilio: router({
    getAccessToken: protectedProcedure.query(async ({ ctx }) => {
      const { generateAccessToken } = await import("./twilio");
      const identity = `user_${ctx.user.id}`;
      const token = generateAccessToken(identity);
      return { token, identity };
    }),
  }),
});

export type AppRouter = typeof appRouter;
