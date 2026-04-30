import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { mergeLeads, getMergeHistory } from "./db-merge";
import { getAllDuplicateGroups } from "./db-duplicates-dashboard";
import { getAIMergeSuggestions, getAISuggestionForPair } from "./db-aiMergeSuggestions";
import { recordMergeFeedback, getMergeFeedbackStats, getFactorPerformance, getRecentFeedbackTimeline } from "./db-mergeFeedback";
import { getWeightAdjustmentSummary } from "./utils/aiScoringWeights";
import { searchLeadsByPhone } from "./db-phoneSearch";
import { updatePropertyStage, getPropertyStageHistory, getPropertiesByStage, getStageStats, bulkUpdateStages } from "./db-stageManagement";
import { getDb } from "./db";
// agents.db no longer needed - deleteAgent logic is inline in the router
import { storagePut } from "./storage";
import { properties, visits, photos, notes, users, skiptracingLogs, outreachLogs, communicationLog, contacts, contactPhones, contactEmails, leadAssignments, propertyAgents, twilioNumbers, propertyOffers, twilioNumberDesks, userDesks, desks, smsMessages, callLogs } from "../drizzle/schema";
import { eq, sql, and, isNull, desc, inArray, ne, or } from "drizzle-orm";
import * as communication from "./communication";
import { agentsRouter } from "./routers/agents";
import { dealmachineRouter } from "./routers/dealmachine";
import { dealmachineRolandoRouter } from "./routers/dealmachine-rolando";
import { comparablesRouter } from "./routers/comparables";
import { importDealMachineRouter } from "./routers/import-dealmachine";
import { findDuplicates } from "./utils/duplicateDetection";
import { ENV } from "./_core/env";
import { deepSearchRouter } from "./routers/deep-search";
import { importPropertiesRouter } from "./routers/import-properties";
import { invitesRouter } from "./routers/invites";
import { desksRouter } from "./routers/desks";
import { sectionNotesRouter } from "./routers/section-notes";
import { taxUrlsRouter } from "./routers/tax-urls";
import { notificationsRouter } from "./routers/notifications";
import { integrationsRouter } from "./routers/integrations";
import { trestleiqRouter } from "./routers/trestleiq";

// ─── Helper: format offer data into a readable General Note ──────────
function formatOfferNote(offer: {
  toBeSent?: boolean;
  offerSent?: boolean;
  viaAdobe?: boolean;
  viaEmail?: boolean;
  viaTxt?: boolean;
  viaUps?: boolean;
  viaFedex?: boolean;
  viaUsps?: boolean;
  viaInPerson?: boolean;
  offerDate?: string;
  offerAmount?: number;
  isVerbal?: boolean;
  isWrittenOffer?: boolean;
}, title: string): string {
  const lines: string[] = [`📋 ${title}`];
  lines.push(`Date: ${offer.offerDate || new Date().toISOString().split("T")[0]}`);
  lines.push(`Amount: $${(offer.offerAmount || 0).toLocaleString("en-US")}`);

  const status: string[] = [];
  if (offer.toBeSent) status.push("To be Sent");
  if (offer.offerSent) status.push("Offer Sent");
  if (status.length) lines.push(`Status: ${status.join(", ")}`);

  const delivery: string[] = [];
  if (offer.viaAdobe) delivery.push("Adobe");
  if (offer.viaEmail) delivery.push("Email");
  if (offer.viaTxt) delivery.push("Txt");
  if (offer.viaUps) delivery.push("UPS");
  if (offer.viaFedex) delivery.push("FedEx");
  if (offer.viaUsps) delivery.push("USPS");
  if (offer.viaInPerson) delivery.push("In Person");
  if (delivery.length) lines.push(`Delivery: ${delivery.join(", ")}`);

  const type: string[] = [];
  if (offer.isVerbal) type.push("Verbal");
  if (offer.isWrittenOffer) type.push("Written Offer");
  if (type.length) lines.push(`Type: ${type.join(", ")}`);

  return lines.join("\n");
}

function formatOfferNoteFromRow(row: {
  toBeSent: number | null;
  offerSent: number | null;
  viaAdobe: number | null;
  viaEmail: number | null;
  viaTxt: number | null;
  viaUps: number | null;
  viaFedex: number | null;
  viaUsps: number | null;
  viaInPerson: number | null;
  offerDate: Date | null;
  offerAmount: number | null;
  isVerbal: number | null;
  isWrittenOffer: number | null;
}, title: string): string {
  return formatOfferNote({
    toBeSent: row.toBeSent === 1,
    offerSent: row.offerSent === 1,
    viaAdobe: row.viaAdobe === 1,
    viaEmail: row.viaEmail === 1,
    viaTxt: row.viaTxt === 1,
    viaUps: row.viaUps === 1,
    viaFedex: row.viaFedex === 1,
    viaUsps: row.viaUsps === 1,
    viaInPerson: row.viaInPerson === 1,
    offerDate: row.offerDate ? row.offerDate.toISOString().split("T")[0] : undefined,
    offerAmount: row.offerAmount ?? 0,
    isVerbal: row.isVerbal === 1,
    isWrittenOffer: row.isWrittenOffer === 1,
  }, title);
}

export const appRouter = router({
  system: systemRouter,
  agents: agentsRouter,
  deepSearch: deepSearchRouter,
  importProperties: importPropertiesRouter,
  dealmachine: dealmachineRouter,
  dealmachineRolando: dealmachineRolandoRouter,
  comparables: comparablesRouter,
  invites: invitesRouter,
  desks: desksRouter,
  sectionNotes: sectionNotesRouter,
  taxUrls: taxUrlsRouter,
  notifications: notificationsRouter,
  integrations: integrationsRouter,
  trestleiq: trestleiqRouter,
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

  // ─── Helper: format offer data into a readable note ──────────
  // Used by createOffer, moveToOfferPending, and updateOffer
  // to auto-save offer details as General Notes

  properties: router({
    statusCounts: protectedProcedure.query(async () => {
      // Get all properties and count property flags from dealMachineRawData
      const result = await db.getProperties({ pageSize: 10000 });
      const allProperties = result.data;
      const counts: Record<string, number> = {};

      allProperties.forEach((property: any) => {
        // Parse dealMachineRawData to extract property_flags
        if (property.dealMachineRawData) {
          try {
            const rawData = JSON.parse(property.dealMachineRawData);
            if (rawData.property_flags) {
              const flags = rawData.property_flags
                .split(',')
                .map((flag: string) => flag.trim())
                .filter((flag: string) => flag.length > 0);
              
              flags.forEach((flag: string) => {
                counts[flag] = (counts[flag] || 0) + 1;
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
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
            tag: z.string().optional(),
            leadSource: z.string().optional(),
            campaignName: z.string().optional(),
            // Pagination
            page: z.number().optional(),
            pageSize: z.number().optional(),
            // Server-side filters
            assignedAgentId: z.number().nullable().optional(),
            deskName: z.string().optional(),
            dealStage: z.string().optional(),
            // Filter by exact property DB id
            propertyIdFilter: z.number().optional(),
            // Filter by city
            city: z.string().optional(),
            // Filter by email
            email: z.string().optional(),
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

    search: protectedProcedure
      .input(
        z.object({
          query: z.string(),
        })
      )
      .query(async ({ input, ctx }) => {
        // Search properties by address
        const result = await db.getPropertiesWithAgents({
          search: input.query,
          userId: ctx.user?.id,
          userRole: ctx.user?.role,
          pageSize: 10,
        });
        
        // Return top 10 results
        return result.data;
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
    getCities: protectedProcedure
      .query(async () => {
        return await db.getUniqueCities();
      }),
    getAllTags: protectedProcedure
      .query(async () => {
        return await db.getAllUniqueTags();
      }),
    deleteTagGlobally: protectedProcedure
      .input(z.object({ tagName: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteTagGlobally(input.tagName);
        return { success: true };
      }),
    renameTag: protectedProcedure
      .input(z.object({ oldName: z.string(), newName: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.renameTag(input.oldName, input.newName);
        return { success: true };
      }),

    getActivities: adminProcedure
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

        // Get standalone property photos (not linked to notes)
        const standalonePhotos = await dbInstance
          .select()
          .from(photos)
          .where(
            and(
              eq(photos.propertyId, input.propertyId),
              isNull(photos.noteId),
              isNull(photos.visitId)
            )
          );
        
        for (const photo of standalonePhotos) {
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
            details: photo.caption || 'Property photo uploaded',
            metadata: {
              url: photo.fileUrl,
              source: 'property',
            },
          });
        }

        // Get note-linked photos (screenshots/prints in General Notes)
        const notePhotos = await dbInstance
          .select()
          .from(photos)
          .where(
            and(
              eq(photos.propertyId, input.propertyId),
              sql`${photos.noteId} IS NOT NULL`
            )
          );
        
        for (const photo of notePhotos) {
          const user = await dbInstance
            .select()
            .from(users)
            .where(eq(users.id, photo.userId))
            .limit(1);
          
          activities.push({
            id: `note-photo-${photo.id}`,
            type: 'photo',
            timestamp: photo.createdAt,
            user: user[0]?.name || 'Unknown User',
            details: photo.caption || 'Screenshot added to note',
            metadata: {
              url: photo.fileUrl,
              source: 'note',
              noteId: photo.noteId,
            },
          });
        }

        // ── Phone calls from communicationLog ─────────────────────────────
        const callEntries = await dbInstance
          .select({
            id: communicationLog.id,
            communicationType: communicationLog.communicationType,
            direction: communicationLog.direction,
            callResult: communicationLog.callResult,
            twilioNumber: communicationLog.twilioNumber,
            contactPhoneNumber: communicationLog.contactPhoneNumber,
            notes: communicationLog.notes,
            communicationDate: communicationLog.communicationDate,
            userId: communicationLog.userId,
            deskName: communicationLog.deskName,
            needsCallback: communicationLog.needsCallback,
            userName: users.name,
          })
          .from(communicationLog)
          .leftJoin(users, eq(communicationLog.userId, users.id))
          .where(
            and(
              eq(communicationLog.propertyId, input.propertyId),
              eq(communicationLog.communicationType, "Phone")
            )
          )
          .orderBy(desc(communicationLog.communicationDate));

        for (const call of callEntries) {
          const isInbound = call.direction === "Inbound";
          const fromNum = isInbound ? (call.contactPhoneNumber || "Unknown") : (call.twilioNumber || "CRM");
          const toNum = isInbound ? (call.twilioNumber || "CRM") : (call.contactPhoneNumber || "Unknown");
          const isMissed = call.needsCallback === 1;
          activities.push({
            id: `call-${call.id}`,
            type: 'call',
            timestamp: call.communicationDate,
            user: call.userName || 'Unknown User',
            details: call.callResult || (isMissed ? 'Missed Call' : 'Call'),
            metadata: {
              direction: call.direction || 'Outbound',
              from: fromNum,
              to: toNum,
              callResult: call.callResult,
              deskName: call.deskName,
              notes: call.notes,
              isMissed,
            },
          });
        }

        // ── SMS messages from smsMessages (direct propertyId link) ──────────
        const directSmsEntries = await dbInstance
          .select()
          .from(smsMessages)
          .where(eq(smsMessages.propertyId, input.propertyId))
          .orderBy(desc(smsMessages.createdAt));

        const seenSmsIds = new Set<number>();
        for (const sms of directSmsEntries) {
          seenSmsIds.add(sms.id);
          const isInbound = sms.direction === "inbound";
          activities.push({
            id: `sms-${sms.id}`,
            type: 'sms',
            timestamp: sms.createdAt,
            user: sms.sentByName || (isInbound ? 'Contact' : 'Agent'),
            details: sms.body ? (sms.body.length > 120 ? sms.body.substring(0, 120) + '…' : sms.body) : '',
            metadata: {
              direction: sms.direction,
              from: isInbound ? sms.contactPhone : sms.twilioPhone,
              to: isInbound ? sms.twilioPhone : sms.contactPhone,
              status: sms.status,
              fullBody: sms.body,
              contactId: sms.contactId,
            },
          });
        }

        // ── SMS messages linked via contacts of this property (no direct propertyId) ──
        // Find all contact phones for this property
        const propertyContacts = await dbInstance
          .select({ id: contacts.id })
          .from(contacts)
          .where(eq(contacts.propertyId, input.propertyId));

        if (propertyContacts.length > 0) {
          const contactIds = propertyContacts.map(c => c.id);
          const contactPhonesRows = await dbInstance
            .select({ phoneNumber: contactPhones.phoneNumber, contactId: contactPhones.contactId })
            .from(contactPhones)
            .where(inArray(contactPhones.contactId, contactIds));

          if (contactPhonesRows.length > 0) {
            const phoneNumbers = contactPhonesRows.map(cp => cp.phoneNumber);
            // Build a map: phone → contactId
            const phoneToContactId: Record<string, number> = {};
            for (const cp of contactPhonesRows) {
              phoneToContactId[cp.phoneNumber] = cp.contactId;
            }

            // Find SMS where contactPhone matches any of these phone numbers and no propertyId set
            const linkedSmsEntries = await dbInstance
              .select()
              .from(smsMessages)
              .where(
                and(
                  inArray(smsMessages.contactPhone, phoneNumbers),
                  isNull(smsMessages.propertyId)
                )
              )
              .orderBy(desc(smsMessages.createdAt));

            for (const sms of linkedSmsEntries) {
              if (seenSmsIds.has(sms.id)) continue;
              seenSmsIds.add(sms.id);
              const isInbound = sms.direction === "inbound";
              activities.push({
                id: `sms-${sms.id}`,
                type: 'sms',
                timestamp: sms.createdAt,
                user: sms.sentByName || (isInbound ? 'Contact' : 'Agent'),
                details: sms.body ? (sms.body.length > 120 ? sms.body.substring(0, 120) + '…' : sms.body) : '',
                metadata: {
                  direction: sms.direction,
                  from: isInbound ? sms.contactPhone : sms.twilioPhone,
                  to: isInbound ? sms.twilioPhone : sms.contactPhone,
                  status: sms.status,
                  fullBody: sms.body,
                  contactId: sms.contactId || phoneToContactId[sms.contactPhone],
                },
              });
            }
          }
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
      .input(z.object({ propertyId: z.number(), tag: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await db.addPropertyTag(input.propertyId, input.tag.trim(), ctx.user.id);
        return { success: true };
      }),
    removeTag: protectedProcedure
      .input(z.object({ tagId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removePropertyTag(input.tagId);
        return { success: true };
      }),

    // Search properties by address for autocomplete
    searchByAddress: protectedProcedure
      .input(
        z.object({
          search: z.string(),
        })
      )
      .query(async ({ input }) => {
        if (input.search.length < 3) return [];
        
        const dbInstance = await getDb();
        if (!dbInstance) return [];
        
        // Search for matching addresses using LIKE
        const searchTerm = `%${input.search}%`;
        const results = await dbInstance
          .select({
            id: properties.id,
            addressLine1: properties.addressLine1,
            city: properties.city,
            state: properties.state,
            zipcode: properties.zipcode,
            owner1Name: properties.owner1Name,
            leadTemperature: properties.leadTemperature,
          })
          .from(properties)
          .where(sql`${properties.addressLine1} LIKE ${searchTerm}`)
          .limit(10);
        
        return results;
      }),

    searchDuplicates: protectedProcedure
      .input(
        z.object({
          address: z.string(),
          ownerName: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          similarityThreshold: z.number().optional().default(85),
        })
      )
      .query(async ({ input }) => {
        // Get all properties for duplicate detection
        const result = await db.getProperties({ pageSize: 10000 });
        const allProperties = result.data;
        
        // Transform to format expected by duplicate detection
        const propertiesForMatching = allProperties.map((p: any) => ({
          id: p.id,
          address: `${p.addressLine1}${p.unitNumber ? ' #' + p.unitNumber : ''}${p.addressLine2 ? ' ' + p.addressLine2 : ''}, ${p.city}, ${p.state} ${p.zipcode}`,
          ownerName: p.owner1Name,
          leadTemperature: p.leadTemperature,
          createdAt: p.createdAt,
          lat: null as number | null,
          lng: null as number | null,
        }));
        
        // Find duplicates
        const duplicates = findDuplicates(
          input.address,
          propertiesForMatching,
          input.lat,
          input.lng,
          input.similarityThreshold,
          input.ownerName
        );
        
        return duplicates;
      }),

    create: protectedProcedure
      .input(
        z.object({
          addressLine1: z.string().min(1),
          unitNumber: z.string().optional(),
          apnParcelId: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipcode: z.string().optional(),
          owner1Name: z.string().optional(),
          leadTemperature: z.enum(["SUPER HOT", "HOT", "WARM", "COLD", "DEAD", "TBD"]).optional(),
          status: z.string().optional(),
          dealStage: z.string().optional(),
          ownerPhone: z.string().optional(),
          ownerEmail: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        
        console.log('[CREATE PROPERTY V3] Using PURE RAW SQL');
        console.log('[CREATE PROPERTY V3] Input:', JSON.stringify(input));
        
        // Generate a unique propertyId
        const propertyId = `MANUAL-${Date.now()}`;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        // Escape strings for SQL
        const escapeStr = (s: string | null | undefined) => {
          if (s === null || s === undefined) return 'NULL';
          return `'${String(s).replace(/'/g, "''")}'`;
        };
        
        // Build RAW SQL INSERT - only required fields + a few optional
        const rawSQL = `
          INSERT INTO properties (
            propertyId,
            addressLine1,
            unitNumber,
            apnParcelId,
            city,
            state,
            zipcode,
            owner1Name,
            leadTemperature,
            dealStage,
            deskName,
            deskStatus,
            source,
            entryDate,
            stageChangedAt,
            createdAt
          ) VALUES (
            ${escapeStr(propertyId)},
            ${escapeStr(input.addressLine1)},
            ${escapeStr(input.unitNumber || null)},
            ${escapeStr(input.apnParcelId || null)},
            ${escapeStr(input.city || 'TBD')},
            ${escapeStr(input.state || 'FL')},
            ${escapeStr(input.zipcode || '00000')},
            ${escapeStr(input.owner1Name)},
            ${escapeStr(input.leadTemperature || 'TBD')},
            ${escapeStr(input.dealStage || null)},
            'NEW_LEAD',
            'BIN',
            'Manual',
            '${now}',
            '${now}',
            '${now}'
          )
        `;
        
        console.log('[CREATE PROPERTY V3] Executing SQL:', rawSQL);
        
        // Execute raw SQL
        await dbInstance.execute(sql.raw(rawSQL));
        
        // Get the inserted ID
        const [result] = await dbInstance.execute(sql.raw('SELECT LAST_INSERT_ID() as id'));
        const insertedId = (result as any)?.[0]?.id;
        
        console.log('[CREATE PROPERTY V3] Success! ID:', insertedId);
        
        // Always create a contact (owner) for the new property
        // New model: 1 contact = 1 phone OR 1 email
        try {
          const { createContact } = await import("./communication");
          const ownerPhone = input.ownerPhone?.trim() || undefined;
          const ownerEmail = input.ownerEmail?.trim() || undefined;
          
          // Create primary contact with phone
          if (ownerPhone) {
            const contactId = await createContact({
              propertyId: Number(insertedId),
              name: input.owner1Name || "Owner",
              relationship: "Owner",
              phoneNumber: ownerPhone,
              phoneType: "Mobile",
              email: ownerEmail, // attach email to same contact if both exist
              contactType: "phone",
            });
            console.log('[CREATE PROPERTY V3] Contact created with phone! ID:', contactId);
          } else if (ownerEmail) {
            // Only email, no phone
            const contactId = await createContact({
              propertyId: Number(insertedId),
              name: input.owner1Name || "Owner",
              relationship: "Owner",
              email: ownerEmail,
              contactType: "email",
            });
            console.log('[CREATE PROPERTY V3] Contact created with email! ID:', contactId);
          } else {
            // No phone or email, just create name-only contact
            const contactId = await createContact({
              propertyId: Number(insertedId),
              name: input.owner1Name || "Owner",
              relationship: "Owner",
            });
            console.log('[CREATE PROPERTY V3] Contact created (no phone/email)! ID:', contactId);
          }
        } catch (contactError) {
          console.error('[CREATE PROPERTY V3] Error creating contact:', contactError);
          // Don't fail the property creation if contact creation fails
        }
        
        return { success: true, id: Number(insertedId) };
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

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          addressLine1: z.string().optional(),
          unitNumber: z.string().nullable().optional(),
          apnParcelId: z.string().nullable().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipcode: z.string().optional(),
          leadTemperature: z.string().optional(),
          estimatedValue: z.number().optional(),
          equityPercent: z.number().optional(),
          owner1Name: z.string().optional(),
          owner2Name: z.string().optional(),
          totalBedrooms: z.number().optional(),
          totalBaths: z.number().optional(),
          buildingSquareFeet: z.number().optional(),
          yearBuilt: z.number().optional(),
          source: z.string().optional(),
          listName: z.string().optional(),
          entryDate: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        
        // Build update object with only provided fields
        const updateData: any = {};
        if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
        if (input.unitNumber !== undefined) updateData.unitNumber = input.unitNumber;
        if (input.apnParcelId !== undefined) updateData.apnParcelId = input.apnParcelId;
        if (input.city !== undefined) updateData.city = input.city;
        if (input.state !== undefined) updateData.state = input.state;
        if (input.zipcode !== undefined) updateData.zipcode = input.zipcode;
        if (input.leadTemperature !== undefined) updateData.leadTemperature = input.leadTemperature;
        if (input.estimatedValue !== undefined) updateData.estimatedValue = input.estimatedValue;
        if (input.equityPercent !== undefined) updateData.equityPercent = input.equityPercent;
        if (input.owner1Name !== undefined) updateData.owner1Name = input.owner1Name;
        if (input.owner2Name !== undefined) updateData.owner2Name = input.owner2Name;
        if (input.totalBedrooms !== undefined) updateData.totalBedrooms = input.totalBedrooms;
        if (input.totalBaths !== undefined) updateData.totalBaths = input.totalBaths;
        if (input.buildingSquareFeet !== undefined) updateData.buildingSquareFeet = input.buildingSquareFeet;
        if (input.yearBuilt !== undefined) updateData.yearBuilt = input.yearBuilt;
        if (input.source !== undefined) updateData.source = input.source;
        if (input.listName !== undefined) updateData.listName = input.listName;
        if (input.entryDate !== undefined) updateData.entryDate = input.entryDate;
        
        await dbInstance
          .update(properties)
          .set(updateData)
          .where(eq(properties.id, input.id));
        return { success: true };
      }),

    /** Update property from DealMachine CSV row (paste a single row with headers) */
    updateFromDealMachineCSV: protectedProcedure
      .input(z.object({
        id: z.number(),
        csvData: z.string().min(1, "CSV data is required"),
      }))
      .mutation(async ({ input }) => {
        const { parseCSV, transformProperty } = await import("./dealmachine-import");
        const rows = parseCSV(input.csvData);
        if (rows.length === 0) throw new Error("No valid CSV data found. Make sure to include the header row.");

        const parsed = transformProperty(rows[0]);
        if (!parsed) throw new Error("Could not parse property data from CSV. Check required fields: address, city, state, zipcode.");

        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");

        // Build update object from parsed data
        const updateData: any = {};
        if (parsed.addressLine1) updateData.addressLine1 = parsed.addressLine1;
        if (parsed.addressLine2) updateData.addressLine2 = parsed.addressLine2;
        if (parsed.city) updateData.city = parsed.city;
        if (parsed.state) updateData.state = parsed.state;
        if (parsed.zipcode) updateData.zipcode = parsed.zipcode;
        if (parsed.owner1Name) updateData.owner1Name = parsed.owner1Name;
        if (parsed.propertyType) updateData.propertyType = parsed.propertyType;
        if (parsed.yearBuilt) updateData.yearBuilt = parsed.yearBuilt;
        if (parsed.totalBedrooms) updateData.totalBedrooms = parsed.totalBedrooms;
        if (parsed.totalBaths) updateData.totalBaths = parsed.totalBaths;
        if (parsed.buildingSquareFeet) updateData.buildingSquareFeet = parsed.buildingSquareFeet;
        if (parsed.estimatedValue) updateData.estimatedValue = parsed.estimatedValue;
        if (parsed.equityPercent) updateData.equityPercent = parsed.equityPercent;
        if (parsed.dealMachinePropertyId) updateData.dealMachinePropertyId = parsed.dealMachinePropertyId;
        if (parsed.dealMachineLeadId) updateData.dealMachineLeadId = parsed.dealMachineLeadId;
        if (parsed.dealMachineRawData) updateData.dealMachineRawData = parsed.dealMachineRawData;
        if (parsed.marketStatus) updateData.marketStatus = parsed.marketStatus;
        updateData.updatedAt = new Date();

        await dbInstance
          .update(properties)
          .set(updateData)
          .where(eq(properties.id, input.id));

        const fieldsUpdated = Object.keys(updateData).filter(k => k !== 'updatedAt').length;
        return { success: true, fieldsUpdated, message: `${fieldsUpdated} fields updated from DealMachine CSV` };
      }),

    /** Import contacts from DealMachine CSV for an existing property */
    importContactsFromDealMachineCSV: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        csvData: z.string().min(1, "CSV data is required"),
      }))
      .mutation(async ({ input }) => {
        const { parseCSV, extractContactsFromProperty } = await import("./dealmachine-import");
        const rows = parseCSV(input.csvData);
        if (rows.length === 0) throw new Error("No valid CSV data found. Make sure to include the header row.");

        const parsedContacts = extractContactsFromProperty(rows[0]);
        if (parsedContacts.length === 0) throw new Error("No contacts found in CSV data. Check that contact columns (contact_1_name, etc.) are present.");

        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");

        let contactsCreated = 0;
        let phonesCreated = 0;
        let emailsCreated = 0;

        for (const contact of parsedContacts) {
          // Insert contact
          const contactResult = await dbInstance.insert(contacts).values({
            propertyId: input.propertyId,
            name: contact.name,
            relationship: contact.relationship as any,
            dnc: contact.dnc ? 1 : 0,
            flags: contact.flags || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const contactId = (contactResult as any)[0]?.insertId || (contactResult as any).insertId || 0;
          contactsCreated++;

          if (contactId) {
            // Add phones
            for (let i = 0; i < contact.phones.length; i++) {
              const phone = contact.phones[i];
              if (phone.phoneNumber?.trim()) {
                const validTypes = ["Mobile", "Landline", "Wireless", "Work", "Home", "Other"];
                let phoneType: any = phone.phoneType || "Mobile";
                if (!validTypes.includes(phoneType)) phoneType = "Mobile";
                await dbInstance.insert(contactPhones).values({
                  contactId,
                  phoneNumber: phone.phoneNumber.trim(),
                  phoneType,
                  isPrimary: i === 0 ? 1 : 0,
                } as any);
                phonesCreated++;
              }
            }

            // Add emails
            for (let i = 0; i < contact.emails.length; i++) {
              const email = contact.emails[i];
              if (email.email?.trim()) {
                await dbInstance.insert(contactEmails).values({
                  contactId,
                  email: email.email.trim(),
                  emailType: email.emailType || "Personal",
                  isPrimary: i === 0 ? 1 : 0,
                } as any);
                emailsCreated++;
              }
            }
          }
        }

        return {
          success: true,
          contactsCreated,
          phonesCreated,
          emailsCreated,
          message: `Imported ${contactsCreated} contacts, ${phonesCreated} phones, ${emailsCreated} emails`,
        };
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
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        await database
          .delete(propertyAgents)
          .where(
            and(
              eq(propertyAgents.propertyId, input.propertyId),
              eq(propertyAgents.agentId, input.agentId)
            )
          );
        return { success: true };
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
          successCount++;
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
        return await db.getLeadTransfers(input.propertyId);
      }),

    getPendingTransfers: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user?.id) return [];
        return await db.getPendingTransfersForAgent(ctx.user.id);
      }),

    mergeLeads: protectedProcedure
      .input(
        z.object({
          primaryLeadId: z.number(),
          secondaryLeadId: z.number(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }
        return await mergeLeads(
          input.primaryLeadId,
          input.secondaryLeadId,
          ctx.user.id,
          input.reason
        );
      }),

    getMergeHistory: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await getMergeHistory(input.propertyId);
      }),

    getAllDuplicateGroups: protectedProcedure
      .input(z.object({ similarityThreshold: z.number().optional().default(85) }))
      .query(async ({ input }) => {
        return await getAllDuplicateGroups(input.similarityThreshold);
      }),

    getAIMergeSuggestions: protectedProcedure
      .input(z.object({ minConfidence: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        return await getAIMergeSuggestions(input.minConfidence);
      }),

    getAISuggestionForPair: protectedProcedure
      .input(z.object({ lead1Id: z.number(), lead2Id: z.number() }))
      .query(async ({ input }) => {
        return await getAISuggestionForPair(input.lead1Id, input.lead2Id);
      }),

    recordMergeFeedback: protectedProcedure
      .input(z.object({
        lead1Id: z.number(),
        lead2Id: z.number(),
        aiSuggestion: z.object({
          overallScore: z.number(),
          addressSimilarity: z.number(),
          ownerNameSimilarity: z.number(),
          dataCompletenessScore: z.number(),
          leadQualityScore: z.number(),
          riskScore: z.number(),
          confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW", "VERY_LOW"]),
          suggestedPrimary: z.number(),
          reasoning: z.array(z.string()),
        }),
        action: z.enum(["accepted", "rejected", "ignored"]),
        actualPrimaryId: z.number().optional(),
        rejectionReason: z.enum(["wrong_address", "wrong_owner", "not_duplicates", "too_risky", "other"]).optional(),
        rejectionNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await recordMergeFeedback({
          ...input,
          userId: ctx.user.id,
        });
      }),

    getMergeFeedbackStats: protectedProcedure
      .query(async () => {
        return await getMergeFeedbackStats();
      }),

    getFactorPerformance: protectedProcedure
      .query(async () => {
        return await getFactorPerformance();
      }),

    getRecentFeedbackTimeline: protectedProcedure
      .query(async () => {
        return await getRecentFeedbackTimeline();
      }),

    getWeightAdjustmentSummary: protectedProcedure
      .query(async () => {
        return await getWeightAdjustmentSummary();
      }),

    searchLeadsByPhone: protectedProcedure
      .input(z.object({ phoneNumber: z.string() }))
      .query(async ({ input }) => {
        return await searchLeadsByPhone(input.phoneNumber);
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

    getDeepSearch: adminProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const result = await db.getPropertyDeepSearch(input.propertyId);
        console.log('[DEBUG] getDeepSearch result for property', input.propertyId, ':', result);
        return result;
      }),

    updateDeepSearch: adminProcedure
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
    updateDesk: protectedProcedure
      .input(z.object({ propertyId: z.number(), deskName: z.string().optional(), deskStatus: z.enum(["BIN", "ACTIVE", "DEAD"]) }))
      .mutation(async ({ input }) => {
        await db.updateDesk(input.propertyId, input.deskName, input.deskStatus);
        return { success: true };
      }),
    // Property Image upload
    updatePropertyImage: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        imageBase64: z.string(), // base64 encoded image data
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `property-images/${input.propertyId}-${randomSuffix}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const drizzleDb = await getDb();
        await drizzleDb!.update(properties).set({ propertyImage: url }).where(eq(properties.id, input.propertyId));
        return { url };
      }),
    removePropertyImage: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        const drizzleDb = await getDb();
        await drizzleDb!.update(properties).set({ propertyImage: null }).where(eq(properties.id, input.propertyId));
        return { success: true };
      }),
    getStreetViewImage: protectedProcedure
      .input(z.object({
        address: z.string(),
        city: z.string(),
        state: z.string(),
        zipcode: z.string(),
      }))
      .query(async ({ input }) => {
        const fullAddress = `${input.address}, ${input.city}, ${input.state} ${input.zipcode}`;
        const forgeUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
        const forgeKey = ENV.forgeApiKey;
        if (!forgeUrl || !forgeKey) return { imageBase64: null };
        const url = `${forgeUrl}/v1/maps/proxy/maps/api/streetview?size=600x400&location=${encodeURIComponent(fullAddress)}&key=${forgeKey}&fov=90&pitch=10`;
        try {
          const res = await fetch(url);
          if (!res.ok) return { imageBase64: null };
          const contentType = res.headers.get("content-type") || "image/jpeg";
          if (!contentType.startsWith("image/")) return { imageBase64: null };
          const buffer = Buffer.from(await res.arrayBuffer());
          return { imageBase64: `data:${contentType};base64,${buffer.toString("base64")}` };
        } catch {
          return { imageBase64: null };
        }
      }),
    getDeskStats: protectedProcedure.query(async () => {
      return await db.getDeskStats();
    }),
    listByDesk: protectedProcedure
      .input(z.object({ deskName: z.string().optional(), deskStatus: z.enum(["BIN", "ACTIVE", "DEAD"]).optional() }))
      .query(async ({ input }) => {
        return await db.listByDesk(input.deskName, input.deskStatus);
      }),

    assignAgent: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        agentId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error("User not authenticated");
        }
        const result = await db.assignAgentToProperty({
          propertyId: input.propertyId,
          agentId: input.agentId,
          assignedBy: ctx.user.id,
          assignedAt: new Date(),
        });
        return { success: true, result };
      }),

    getAssignedAgents: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        const assignments = await database
          .select({
            id: propertyAgents.id,
            agentId: propertyAgents.agentId,
            assignedAt: propertyAgents.assignedAt,
          })
          .from(propertyAgents)
          .where(eq(propertyAgents.propertyId, input.propertyId));

        const agentsWithDetails = await Promise.all(
          assignments.map(async (assignment) => {
            const agent = await database
              .select()
              .from(users)
              .where(eq(users.id, assignment.agentId))
              .limit(1);
            return {
              ...assignment,
              agent: agent[0],
            };
          })
        );

        return agentsWithDetails;
      }),

    listFiltered: protectedProcedure
      .input(z.object({
        leadTemperature: z.string().optional(),
        deskName: z.string().optional(),
        status: z.string().optional(),
        unassignedOnly: z.boolean().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getPropertiesWithFilters({
          leadTemperature: input?.leadTemperature,
          deskName: input?.deskName,
          status: input?.status,
          unassignedOnly: input?.unassignedOnly,
          userId: ctx.user?.id,
          userRole: ctx.user?.role,
        });
      }),

    bulkAssignAgent: protectedProcedure
      .input(z.object({
        agentId: z.number(),
        filters: z.object({
          leadTemperature: z.string().optional(),
          deskName: z.string().optional(),
          status: z.string().optional(),
          unassignedOnly: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error("User not authenticated");
        }
        if (ctx.user.role !== "admin") {
          throw new Error("Only admins can perform bulk assignments");
        }
        const result = await db.bulkAssignAgentToProperties(input.agentId, {
          ...input.filters,
          userId: ctx.user.id,
          userRole: ctx.user.role,
        });
        return result;
      }),

    bulkUpdateDesk: protectedProcedure
      .input(z.object({
        targetDesk: z.string(),
        filters: z.object({
          leadTemperature: z.string().optional(),
          deskName: z.string().optional(),
          status: z.string().optional(),
          unassignedOnly: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error("User not authenticated");
        }
        if (ctx.user.role !== "admin") {
          throw new Error("Only admins can perform bulk desk updates");
        }
        const result = await db.bulkUpdateDesk(input.targetDesk, {
          ...input.filters,
          userId: ctx.user.id,
          userRole: ctx.user.role,
        });
        return result;
      }),

    createFamilyMember: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        name: z.string(),
        relationship: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        isRepresentative: z.number().optional(),
        isDeceased: z.number().optional(),
        isContacted: z.number().optional(),
        contactedDate: z.date().optional(),
        isOnBoard: z.number().optional(),
        isNotOnBoard: z.number().optional(),
        relationshipPercentage: z.number().optional(),
        isCurrentResident: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.createFamilyMember(input as any);
        
        // Auto-activate probate when a family member is added
        try {
          const { getDb: getDatabase } = await import("./db");
          const { deepSearchOverview } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const database = await getDatabase();
          if (database) {
            const existing = await database
              .select()
              .from(deepSearchOverview)
              .where(eq(deepSearchOverview.propertyId, input.propertyId))
              .limit(1);
            
            if (existing.length > 0) {
              // Only update if probate is not already active
              if (existing[0].probate !== 1) {
                await database
                  .update(deepSearchOverview)
                  .set({ probate: 1 })
                  .where(eq(deepSearchOverview.propertyId, input.propertyId));
              }
            } else {
              // Create deep search overview with probate active
              await database
                .insert(deepSearchOverview)
                .values({ propertyId: input.propertyId, probate: 1 } as any);
            }
          }
        } catch (e) {
          // Non-critical: don't fail family member creation if probate auto-activate fails
          console.error("[Auto-Probate] Failed to auto-activate probate:", e);
        }
        
        return result;
      }),

    getFamilyMembers: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getFamilyMembers(input.propertyId);
      }),

    updateFamilyMember: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        relationship: z.enum(["Owner", "Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Grandfather", "Grandmother", "Grandson", "Granddaughter", "Uncle", "Aunt", "Cousin", "Nephew", "Niece", "In-Law", "Other"]).optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        isRepresentative: z.number().optional(),
        isDeceased: z.number().optional(),
        isContacted: z.number().optional(),
        contactedDate: z.date().optional(),
        isOnBoard: z.number().optional(),
        isNotOnBoard: z.number().optional(),
        relationshipPercentage: z.number().optional(),
        isCurrentResident: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateFamilyMember(id, data);
      }),

    deleteFamilyMember: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.deleteFamilyMember(input.id);
      }),

    // Deal Pipeline Stage Management
    updateDealStage: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        newStage: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await updatePropertyStage(
          input.propertyId,
          input.newStage,
          ctx.user!.id,
          input.notes
        );
      }),

    getStageHistory: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await getPropertyStageHistory(input.propertyId);
      }),

    getPropertiesByStage: protectedProcedure
      .input(z.object({
        stage: z.string().optional(),
        agentId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getPropertiesByStage(input.stage, input.agentId);
      }),

    getStageStats: protectedProcedure
      .input(z.object({
        agentId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getStageStats(input.agentId);
      }),

    bulkUpdateStages: protectedProcedure
      .input(z.object({
        propertyIds: z.array(z.number()),
        newStage: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await bulkUpdateStages(
          input.propertyIds,
          input.newStage,
          ctx.user!.id,
          input.notes
        );
      }),

    // ─── Pipeline Stage Data: Offers ──────────────────────────────

    // Helper: format offer data into a readable note
    // (defined inline so it's accessible to all offer procedures)

    createOffer: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        toBeSent: z.boolean().default(false),
        offerSent: z.boolean().default(false),
        viaAdobe: z.boolean().default(false),
        viaEmail: z.boolean().default(false),
        viaTxt: z.boolean().default(false),
        viaUps: z.boolean().default(false),
        viaFedex: z.boolean().default(false),
        viaUsps: z.boolean().default(false),
        viaInPerson: z.boolean().default(false),
        offerDate: z.string().optional(),
        offerAmount: z.number().default(0),
        isVerbal: z.boolean().default(false),
        isWrittenOffer: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const b = (v: boolean) => v ? 1 : 0;
        const result = await database.insert(propertyOffers).values({
          propertyId: input.propertyId,
          toBeSent: b(input.toBeSent),
          offerSent: b(input.offerSent),
          viaAdobe: b(input.viaAdobe),
          viaEmail: b(input.viaEmail),
          viaTxt: b(input.viaTxt),
          viaUps: b(input.viaUps),
          viaFedex: b(input.viaFedex),
          viaUsps: b(input.viaUsps),
          viaInPerson: b(input.viaInPerson),
          offerDate: input.offerDate ? new Date(input.offerDate) : new Date(),
          offerAmount: input.offerAmount,
          isVerbal: b(input.isVerbal),
          isWrittenOffer: b(input.isWrittenOffer),
          createdBy: ctx.user!.id,
        });

        // Auto-save offer data as a General Note
        const noteContent = formatOfferNote(input, "New Offer Created");
        await database.insert(notes).values({
          propertyId: input.propertyId,
          userId: ctx.user!.id,
          content: noteContent,
          noteType: "general",
        });

        return { success: true, id: Number((result as any)[0]?.insertId) };
      }),

    getOffers: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        return database.select().from(propertyOffers)
          .where(eq(propertyOffers.propertyId, input.propertyId))
          .orderBy(desc(propertyOffers.createdAt));
      }),

    updateOffer: protectedProcedure
      .input(z.object({
        offerId: z.number(),
        toBeSent: z.boolean().optional(),
        offerSent: z.boolean().optional(),
        viaAdobe: z.boolean().optional(),
        viaEmail: z.boolean().optional(),
        viaTxt: z.boolean().optional(),
        viaUps: z.boolean().optional(),
        viaFedex: z.boolean().optional(),
        viaUsps: z.boolean().optional(),
        viaInPerson: z.boolean().optional(),
        offerDate: z.string().optional(),
        offerAmount: z.number().optional(),
        isVerbal: z.boolean().optional(),
        isWrittenOffer: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const { offerId, ...fields } = input;
        const updates: Record<string, any> = {};
        const b = (v: boolean) => v ? 1 : 0;
        if (fields.toBeSent !== undefined) updates.toBeSent = b(fields.toBeSent);
        if (fields.offerSent !== undefined) updates.offerSent = b(fields.offerSent);
        if (fields.viaAdobe !== undefined) updates.viaAdobe = b(fields.viaAdobe);
        if (fields.viaEmail !== undefined) updates.viaEmail = b(fields.viaEmail);
        if (fields.viaTxt !== undefined) updates.viaTxt = b(fields.viaTxt);
        if (fields.viaUps !== undefined) updates.viaUps = b(fields.viaUps);
        if (fields.viaFedex !== undefined) updates.viaFedex = b(fields.viaFedex);
        if (fields.viaUsps !== undefined) updates.viaUsps = b(fields.viaUsps);
        if (fields.viaInPerson !== undefined) updates.viaInPerson = b(fields.viaInPerson);
        if (fields.offerDate !== undefined) updates.offerDate = new Date(fields.offerDate);
        if (fields.offerAmount !== undefined) updates.offerAmount = fields.offerAmount;
        if (fields.isVerbal !== undefined) updates.isVerbal = b(fields.isVerbal);
        if (fields.isWrittenOffer !== undefined) updates.isWrittenOffer = b(fields.isWrittenOffer);
        await database.update(propertyOffers).set(updates).where(eq(propertyOffers.id, offerId));

        // Auto-save update as a General Note
        // Fetch the updated offer to get full data for the note
        const [updatedOffer] = await database.select().from(propertyOffers).where(eq(propertyOffers.id, offerId));
        if (updatedOffer) {
          const noteContent = formatOfferNoteFromRow(updatedOffer, "Offer Updated");
          await database.insert(notes).values({
            propertyId: updatedOffer.propertyId,
            userId: ctx.user!.id,
            content: noteContent,
            noteType: "general",
          });
        }

        return { success: true };
      }),

    deleteOffer: protectedProcedure
      .input(z.object({ offerId: z.number() }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        await database.delete(propertyOffers).where(eq(propertyOffers.id, input.offerId));
        return { success: true };
      }),

    // Move to Offer Pending: create offer(s) + change stage in one action
    moveToOfferPending: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        offers: z.array(z.object({
          toBeSent: z.boolean().default(false),
          offerSent: z.boolean().default(false),
          viaAdobe: z.boolean().default(false),
          viaEmail: z.boolean().default(false),
          viaTxt: z.boolean().default(false),
          viaUps: z.boolean().default(false),
          viaFedex: z.boolean().default(false),
          viaUsps: z.boolean().default(false),
          viaInPerson: z.boolean().default(false),
          offerDate: z.string().optional(),
          offerAmount: z.number().default(0),
          isVerbal: z.boolean().default(false),
          isWrittenOffer: z.boolean().default(false),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const b = (v: boolean) => v ? 1 : 0;

        // Insert all offers
        for (const offer of input.offers) {
          await database.insert(propertyOffers).values({
            propertyId: input.propertyId,
            toBeSent: b(offer.toBeSent),
            offerSent: b(offer.offerSent),
            viaAdobe: b(offer.viaAdobe),
            viaEmail: b(offer.viaEmail),
            viaTxt: b(offer.viaTxt),
            viaUps: b(offer.viaUps),
            viaFedex: b(offer.viaFedex),
            viaUsps: b(offer.viaUsps),
            viaInPerson: b(offer.viaInPerson),
            offerDate: offer.offerDate ? new Date(offer.offerDate) : new Date(),
            offerAmount: offer.offerAmount,
            isVerbal: b(offer.isVerbal),
            isWrittenOffer: b(offer.isWrittenOffer),
            createdBy: ctx.user!.id,
          });
        }

        // Auto-save each offer as a General Note
        for (let i = 0; i < input.offers.length; i++) {
          const offer = input.offers[i];
          const noteContent = formatOfferNote(offer, `Offer #${i + 1} — Moved to Offer Pending`);
          await database.insert(notes).values({
            propertyId: input.propertyId,
            userId: ctx.user!.id,
            content: noteContent,
            noteType: "general",
          });
        }

        // Move the property to OFFER_PENDING stage
        await updatePropertyStage(input.propertyId, "OFFER_PENDING", ctx.user!.id, `Offer created with ${input.offers.length} offer(s)`);

        return { success: true, offersCreated: input.offers.length };
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
      const database = await getDb();
      if (!database) throw new Error('Database not available');

      // Get all non-admin users (agents)
      const agentsList = await database
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .where(eq(users.role, 'agent'));

      // Build per-agent statistics
      const stats = await Promise.all(
        agentsList.map(async (agent) => {
          // Get assigned properties
          const assignedProps = await database
            .select()
            .from(properties)
            .where(eq(properties.assignedAgentId, agent.id));

          const propIds = assignedProps.map(p => p.id);
          const hotLeads = assignedProps.filter(p => p.leadTemperature === 'HOT' || p.leadTemperature === 'SUPER HOT').length;
          const warmLeads = assignedProps.filter(p => p.leadTemperature === 'WARM').length;
          const coldLeads = assignedProps.filter(p => p.leadTemperature === 'COLD').length;

          // Get visits, notes, photos for these properties
          let totalCheckIns = 0;
          let visitedProperties = 0;
          let totalNotes = 0;
          let totalPhotos = 0;

          if (propIds.length > 0) {
            const allVisits = await database
              .select()
              .from(visits)
              .where(sql`${visits.propertyId} IN (${sql.join(propIds.map(id => sql`${id}`), sql`, `)})`);
            totalCheckIns = allVisits.length;
            const visitedPropIds = new Set(allVisits.map(v => v.propertyId));
            visitedProperties = visitedPropIds.size;

            const allNotes = await database
              .select()
              .from(notes)
              .where(sql`${notes.propertyId} IN (${sql.join(propIds.map(id => sql`${id}`), sql`, `)})`);
            totalNotes = allNotes.length;

            const allPhotos = await database
              .select()
              .from(photos)
              .where(sql`${photos.propertyId} IN (${sql.join(propIds.map(id => sql`${id}`), sql`, `)})`);
            totalPhotos = allPhotos.length;
          }

          return {
            agentId: agent.id,
            agentName: agent.name,
            role: agent.role,
            status: agent.status,
            totalProperties: assignedProps.length,
            hotLeads,
            warmLeads,
            coldLeads,
            visitedProperties,
            totalCheckIns,
            totalNotes,
            totalPhotos,
          };
        })
      );

      return stats;
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
        
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        
        // 1. Remove property agent assignments
        const deletedPA = await database.delete(propertyAgents)
          .where(eq(propertyAgents.agentId, input.userId));
        
        // 2. Remove lead assignments
        await database.delete(leadAssignments)
          .where(eq(leadAssignments.agentId, input.userId));
        
        // 3. Clear assignedAgentId on properties assigned to this user
        await database.update(properties)
          .set({ assignedAgentId: null })
          .where(eq(properties.assignedAgentId, input.userId));
        
        // 4. Delete from users table (where agents are listed)
        await database.delete(users)
          .where(eq(users.id, input.userId));
        
        // agents table no longer used — unified into users table
        
        return { success: true, deletedPropertyAgents: 0 };
      }),
    reassignAgentProperties: protectedProcedure
      .input(z.object({ fromAgentId: z.number(), toAgentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can reassign properties
        if (ctx.user?.role !== 'admin') {
          throw new Error('Only admins can reassign agent properties');
        }
        
        const database = await getDb();
        if (!database) throw new Error('Database not available');
        
        // Update propertyAgents assignments
        await database.update(propertyAgents)
          .set({ agentId: input.toAgentId })
          .where(eq(propertyAgents.agentId, input.fromAgentId));
        
        // Update lead assignments
        await database.update(leadAssignments)
          .set({ agentId: input.toAgentId })
          .where(eq(leadAssignments.agentId, input.fromAgentId));
        
        // Update properties assignedAgentId
        const updated = await database.update(properties)
          .set({ assignedAgentId: input.toAgentId })
          .where(eq(properties.assignedAgentId, input.fromAgentId));
        
        return { success: true, reassignedCount: 0 };
      }),
  }),

  contacts: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const allContacts = await communication.getPropertyContactsWithDetails(input.propertyId);
        // Agents only see decision makers
        if (ctx.user?.role === 'agent') {
          return allContacts.filter((c: any) => c.isDecisionMaker === 1);
        }
        return allContacts;
      }),

    updateContact: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          relationship: z.string().optional(),
          age: z.number().nullable().optional(),
          deceased: z.number().optional(),
          currentAddress: z.string().optional(),
          isDecisionMaker: z.number().optional(),
          dnc: z.number().optional(),
          isLitigator: z.number().optional(),
          flags: z.string().optional(),
          currentResident: z.number().optional(),
          contacted: z.number().optional(),
          onBoard: z.number().optional(),
          notOnBoard: z.number().optional(),
          phones: z.array(z.object({
            phoneNumber: z.string(),
            phoneType: z.string().optional(),
            isPrimary: z.number().optional(),
            dnc: z.number().optional(),
          })).optional(),
          emails: z.array(z.object({
            email: z.string(),
            isPrimary: z.number().optional(),
          })).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await communication.updateContact(id, updates);
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
    // AI: Extract contact data from raw text
    aiExtract: protectedProcedure
      .input(z.object({ text: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm.js");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a contact data extractor. Given raw text (website forms, emails, notes, etc.), extract all contact information and return structured JSON. Always return valid JSON matching the schema exactly. For phone numbers, normalize to E.164 format if possible (e.g. +1XXXXXXXXXX for US numbers). If the country code is missing and the number has 10 digits, assume +1 (US). For addresses, extract street, city, state, and zip separately if available.`,
            },
            {
              role: "user",
              content: `Extract all contact information from this text and return JSON:\n\n${input.text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "extracted_contacts",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  contacts: {
                    type: "array",
                    description: "List of contacts extracted from the text",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Full name of the contact" },
                        firstName: { type: "string", description: "First name" },
                        lastName: { type: "string", description: "Last name" },
                        phones: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              phoneNumber: { type: "string" },
                              phoneType: { type: "string", description: "Mobile, Landline, Work, Home, or Other" },
                            },
                            required: ["phoneNumber", "phoneType"],
                            additionalProperties: false,
                          },
                        },
                        emails: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              email: { type: "string" },
                            },
                            required: ["email"],
                            additionalProperties: false,
                          },
                        },
                        address: { type: "string", description: "Full street address" },
                        city: { type: "string" },
                        state: { type: "string" },
                        zip: { type: "string" },
                        notes: { type: "string", description: "Any additional info like property condition, reason to sell, etc." },
                        relationship: { type: "string", description: "Owner, Spouse, Son, Daughter, Heir, or Other" },
                      },
                      required: ["name", "firstName", "lastName", "phones", "emails", "address", "city", "state", "zip", "notes", "relationship"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["contacts"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return parsed as { contacts: Array<{ name: string; firstName: string; lastName: string; phones: Array<{ phoneNumber: string; phoneType: string }>; emails: Array<{ email: string }>; address: string; city: string; state: string; zip: string; notes: string; relationship: string }> };
      }),
  }),

  visits: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropertyVisits(input.propertyId);
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
      const db_instance = await db.getDb();
      if (!db_instance) return [];
      const { savedSearches } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      return await db_instance.select().from(savedSearches).where(eq(savedSearches.userId, ctx.user.id));
    }),
    listWithCounts: protectedProcedure.query(async ({ ctx }) => {
      const db_instance = await db.getDb();
      if (!db_instance) return [];
      const { savedSearches } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const searches = await db_instance.select().from(savedSearches).where(eq(savedSearches.userId, ctx.user.id));
      
      // Calculate property count for each saved search
      const searchesWithCounts = await Promise.all(
        searches.map(async (search) => {
          try {
            const filters = JSON.parse(search.filters);
            const result = await db.getProperties({
              search: filters.search || undefined,
              ownerLocation: filters.ownerLocation || undefined,
              minEquity: filters.minEquity > 0 ? filters.minEquity : undefined,
              trackingStatus: filters.marketStatus || undefined,
              pageSize: 10000,
            });
            const properties = result.data;

            // Filter by status tags on the server side
            let filteredCount = properties.length;
            if (filters.statusTags && filters.statusTags.length > 0) {
              const filtered = properties.filter((property: any) => {
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
    // Returns ONLY standalone property photos (no noteId, no visitId) - used by PhotoGallery
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPhotosByPropertyId(input.propertyId);
      }),

    // Returns ALL photos for a property (including notes/visits) - used by NotesSection
    allByProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAllPhotosByPropertyId(input.propertyId);
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
      .query(async ({ input, ctx }) => {
        const allNotes = await db.getPropertyNotes(input.propertyId);
        // Agents only see their own notes
        if (ctx.user?.role === 'agent') {
          return allNotes.filter((n: any) => n.userId === ctx.user!.id);
        }
        return allNotes;
      }),

    create: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          content: z.string().min(1),
          noteType: z.enum(["general", "desk-chris"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await db.addPropertyNote({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          content: input.content,
          noteType: input.noteType,
        });
        // Return the created note with user info for immediate display
        return {
          id: result[0].insertId,
          propertyId: input.propertyId,
          userId: ctx.user.id,
          content: input.content,
          noteType: input.noteType || "general",
          userName: ctx.user.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
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

    togglePin: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.toggleNotePin(input.id);
      }),
  }),

  importDealMachine: importDealMachineRouter,
  
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
        const { mapDealMachineRow, validateProperty } = await import('./dealmachine-mapper');
        
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
            // Map DealMachine row using comprehensive mapper
            const { property, contacts: mappedContacts } = mapDealMachineRow(row);
            
            // Validate property
            const validation = validateProperty(property);
            if (!validation.valid) {
              errorCount++;
              errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
              continue;
            }
            
            // Check for duplicate propertyId
            if (property.propertyId) {
              const existing = await dbInstance
                .select({ id: properties.id })
                .from(properties)
                .where(eq(properties.propertyId, property.propertyId))
                .limit(1);
              
              if (existing.length > 0) {
                errorCount++;
                errors.push(`Row ${i + 2}: Property with ID ${property.propertyId} already exists (duplicate)`);
                continue;
              }
            }
            
            // Prepare property data for insertion
            const propertyData: any = {
              propertyId: property.propertyId,
              leadId: property.leadId,
              addressLine1: property.addressLine1,
              addressLine2: property.addressLine2,
              city: property.city,
              state: property.state,
              zipcode: property.zipcode,
              subdivisionName: property.subdivisionName,
              status: property.status,
              marketStatus: property.marketStatus,
              ownerLocation: property.ownerLocation,
              estimatedValue: property.estimatedValue,
              equityAmount: property.equityAmount,
              equityPercent: property.equityPercent,
              salePrice: property.salePrice,
              saleDate: property.saleDate,
              mortgageAmount: property.mortgageAmount,
              totalLoanBalance: property.totalLoanBalance,
              totalLoanPayment: property.totalLoanPayment,
              estimatedRepairCost: property.estimatedRepairCost,
              taxYear: property.taxYear,
              taxAmount: property.taxAmount,
              owner1Name: property.owner1Name,
              owner2Name: property.owner2Name,
              buildingSquareFeet: property.buildingSquareFeet,
              totalBedrooms: property.totalBedrooms,
              totalBaths: property.totalBaths,
              yearBuilt: property.yearBuilt,
              propertyType: property.propertyType,
              constructionType: property.constructionType,
              apnParcelId: property.apnParcelId,
              taxDelinquent: property.taxDelinquent,
              taxDelinquentYear: property.taxDelinquentYear,
              dealMachinePropertyId: property.dealMachinePropertyId,
              dealMachineLeadId: property.dealMachineLeadId,
              dealMachineRawData: property.dealMachineRawData,
              assignedAgentId: input.assignedAgentId,
              deskName: "NEW_LEAD",
              deskStatus: "BIN",
            };
            
            // Insert property
            await dbInstance.insert(properties).values(propertyData);
            
            // Get the inserted property ID
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
            
            const insertedPropertyId = insertedProperty.id;
            
            // Process all mapped contacts (up to 14)
            for (const contact of mappedContacts) {
              const contactData: any = {
                propertyId: insertedPropertyId,
                name: contact.name,
                flags: contact.flags,
                phone1: contact.phone1,
                phone1Type: contact.phone1Type,
                phone2: contact.phone2,
                phone2Type: contact.phone2Type,
                phone3: contact.phone3,
                phone3Type: contact.phone3Type,
                email1: contact.email1,
                email2: contact.email2,
                email3: contact.email3,
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
    // AI: Extract contact data from raw text
    aiExtract: protectedProcedure
      .input(z.object({ text: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm.js");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a contact data extractor. Given raw text (website forms, emails, notes, etc.), extract all contact information and return structured JSON. Always return valid JSON matching the schema exactly. For phone numbers, keep the original digits but normalize to E.164 format if possible (e.g. +1XXXXXXXXXX for US numbers). If the country code is missing and the number has 10 digits, assume +1 (US). For addresses, extract street, city, state, and zip separately if available.`,
            },
            {
              role: "user",
              content: `Extract all contact information from this text and return JSON:\n\n${input.text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "extracted_contacts",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  contacts: {
                    type: "array",
                    description: "List of contacts extracted from the text",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Full name of the contact" },
                        firstName: { type: "string", description: "First name" },
                        lastName: { type: "string", description: "Last name" },
                        phones: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              phoneNumber: { type: "string" },
                              phoneType: { type: "string", description: "Mobile, Landline, Work, Home, or Other" },
                            },
                            required: ["phoneNumber", "phoneType"],
                            additionalProperties: false,
                          },
                        },
                        emails: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              email: { type: "string" },
                            },
                            required: ["email"],
                            additionalProperties: false,
                          },
                        },
                        address: { type: "string", description: "Full street address" },
                        city: { type: "string" },
                        state: { type: "string" },
                        zip: { type: "string" },
                        notes: { type: "string", description: "Any additional info like property condition, reason to sell, etc." },
                        relationship: { type: "string", description: "Owner, Spouse, Son, Daughter, Heir, or Other" },
                      },
                      required: ["name", "firstName", "lastName", "phones", "emails", "address", "city", "state", "zip", "notes", "relationship"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["contacts"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return parsed as { contacts: Array<{ name: string; firstName: string; lastName: string; phones: Array<{ phoneNumber: string; phoneType: string }>; emails: Array<{ email: string }>; address: string; city: string; state: string; zip: string; notes: string; relationship: string }> };
      }),
  }),
  // Communication Tracking
  communication: router({
    // Contact Management
    getContactsByProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const { getPropertyContactsSimple } = await import("./contacts-simple.js");
        const allContacts = await getPropertyContactsSimple(input.propertyId);
        // Agents only see decision makers
        if (ctx.user?.role === 'agent') {
          return allContacts.filter((c: any) => c.isDecisionMaker === 1);
        }
        return allContacts;
      }),

    getContactById: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await communication.getContactWithDetails(input.contactId);
      }),

    // Cross-property phone check: warns if phone exists in other properties
    checkCrossPropertyPhones: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        phones: z.array(z.string()),
      }))
      .query(async ({ input }) => {
        const matches = await communication.findCrossPropertyPhones(input.propertyId, input.phones);
        return { matches };
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
          // New model: 1 contact = 1 phone OR 1 email (direct fields)
          phone1: z.string().optional(),
          phone1Type: z.string().optional(),
          email1: z.string().optional(),
          // Legacy fields still accepted for backward compat
          phone2: z.string().optional(),
          phone2Type: z.string().optional(),
          phone3: z.string().optional(),
          phone3Type: z.string().optional(),
          email2: z.string().optional(),
          email3: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { phone1, phone1Type, phone2, phone2Type, phone3, phone3Type, email1, email2, email3, ...contactBase } = input;
        
        // New model: store phoneNumber/email directly on the contact
        // phone1 goes directly as the contact's phoneNumber
        const createData: any = {
          ...contactBase,
          phoneNumber: phone1 || undefined,
          phoneType: phone1Type || (phone1 ? "Mobile" : undefined),
          email: email1 || undefined,
          contactType: phone1 ? "phone" : (email1 ? "email" : undefined),
        };
        
        const contactId = await communication.createContact(createData);
        
        // If there are additional phones (phone2, phone3), create separate contacts for them
        const extraContactIds: number[] = [];
        if (phone2) {
          try {
            const id = await communication.createContact({
              propertyId: input.propertyId,
              name: input.name,
              relationship: input.relationship,
              phoneNumber: phone2,
              phoneType: phone2Type || "Mobile",
              contactType: "phone",
            });
            extraContactIds.push(id);
          } catch (e) {
            // Duplicate phone, skip
          }
        }
        if (phone3) {
          try {
            const id = await communication.createContact({
              propertyId: input.propertyId,
              name: input.name,
              relationship: input.relationship,
              phoneNumber: phone3,
              phoneType: phone3Type || "Mobile",
              contactType: "phone",
            });
            extraContactIds.push(id);
          } catch (e) {
            // Duplicate phone, skip
          }
        }
        // If there are additional emails (email2, email3), create separate contacts
        if (email2) {
          try {
            const id = await communication.createContact({
              propertyId: input.propertyId,
              name: input.name,
              relationship: input.relationship,
              email: email2,
              contactType: "email",
            });
            extraContactIds.push(id);
          } catch (e) {
            // Skip
          }
        }
        if (email3) {
          try {
            const id = await communication.createContact({
              propertyId: input.propertyId,
              name: input.name,
              relationship: input.relationship,
              email: email3,
              contactType: "email",
            });
            extraContactIds.push(id);
          } catch (e) {
            // Skip
          }
        }
        
        return { success: true, contactId };
      }),

    bulkCreateContacts: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          contacts: z.array(
            z.object({
              name: z.string(),
              phones: z.array(z.object({ phoneNumber: z.string(), phoneType: z.string().optional() })).optional(),
              emails: z.array(z.object({ email: z.string() })).optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const results: Array<{ name: string; success: boolean; contactId?: number; error?: string }> = [];
        for (const contact of input.contacts) {
          // New model: each phone becomes a separate contact, each email becomes a separate contact
          const phones = contact.phones || [];
          const emails = contact.emails || [];
          
          if (phones.length === 0 && emails.length === 0) {
            // Contact with no phone or email
            try {
              const contactId = await communication.createContact({
                propertyId: input.propertyId,
                name: contact.name,
              });
              results.push({ name: contact.name, success: true, contactId });
            } catch (error: any) {
              results.push({ name: contact.name, success: false, error: error.message });
            }
          } else {
            // Create one contact per phone
            for (const phone of phones) {
              try {
                const contactId = await communication.createContact({
                  propertyId: input.propertyId,
                  name: contact.name,
                  phoneNumber: phone.phoneNumber,
                  phoneType: phone.phoneType || "Mobile",
                  contactType: "phone",
                });
                results.push({ name: `${contact.name} (${phone.phoneNumber})`, success: true, contactId });
              } catch (error: any) {
                results.push({ name: `${contact.name} (${phone.phoneNumber})`, success: false, error: error.message });
              }
            }
            // Create one contact per email (only emails not already covered by a phone contact)
            for (const email of emails) {
              try {
                const contactId = await communication.createContact({
                  propertyId: input.propertyId,
                  name: contact.name,
                  email: email.email,
                  contactType: "email",
                });
                results.push({ name: `${contact.name} (${email.email})`, success: true, contactId });
              } catch (error: any) {
                results.push({ name: `${contact.name} (${email.email})`, success: false, error: error.message });
              }
            }
          }
        }
        return { success: true, imported: results.filter(r => r.success).length, total: results.length, results };
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
          currentResident: z.number().optional(),
          contacted: z.number().optional(),
          onBoard: z.number().optional(),
          notOnBoard: z.number().optional(),
          // New model: direct fields
          phoneNumber: z.string().optional(),
          phoneType: z.string().optional(),
          email: z.string().optional(),
          contactType: z.string().optional(),
          // Legacy: still accept phones/emails arrays for backward compat
          phones: z.array(z.object({
            phoneNumber: z.string(),
            phoneType: z.string().optional(),
            isPrimary: z.number().optional(),
            dnc: z.number().optional(),
          })).optional(),
          emails: z.array(z.object({
            email: z.string(),
            isPrimary: z.number().optional(),
          })).optional(),
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

    reorderContacts: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        orderedIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database unavailable");
        await Promise.all(
          input.orderedIds.map((id, index) =>
            database.update(contacts)
              .set({ sortOrder: index } as any)
              .where(eq(contacts.id, id))
          )
        );
        return { success: true };
      }),

    // Primary Twilio Number Management (Property-level)
    updatePrimaryTwilioNumber: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        primaryTwilioNumber: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { properties } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        const { getDb } = await import("./db.js");
        const database = await getDb();
        if (!database) throw new Error("Database unavailable");
        await database.update(properties)
          .set({ primaryTwilioNumber: input.primaryTwilioNumber })
          .where(eq(properties.id, input.propertyId));
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
              "Not Interested - IHATE - DEAD",
              "Not Interested - Hang-up - FU in 4 months",
              "Not Interested - NICE - FU in 2 Months",
              "Other",
            ])
            .optional(),
          direction: z.enum(["Outbound", "Inbound"]).optional(),
          mood: z.string().optional(),
          disposition: z.string().optional(),
          propertyDetails: z.string().optional(), // JSON string
          notes: z.string().optional(),
          nextStep: z.string().optional(),
          twilioNumber: z.string().optional(),
          contactPhoneNumber: z.string().optional(),
          communicationDate: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const logId = await communication.addCommunicationLog({
          ...input,
          userId: ctx.user!.id,
        });

        // Auto-clear needsCallback: if this is an outbound call to a phone number
        // that had a missed inbound call, mark those as returned
        if (input.communicationType === "Phone" && (!input.direction || input.direction === "Outbound") && input.contactPhoneNumber) {
          try {
            const { communicationLog: commLog } = await import("../drizzle/schema");
            const { eq, and } = await import("drizzle-orm");
            const dbInst = await db.getDb();
            if (dbInst) {
              await dbInst
                .update(commLog)
                .set({ needsCallback: 0 })
                .where(
                  and(
                    eq(commLog.contactPhoneNumber, input.contactPhoneNumber),
                    eq(commLog.needsCallback, 1)
                  )
                );
            }
          } catch (cbClearErr) {
            console.error("[CommunicationLog] Error clearing needsCallback:", cbClearErr);
          }
        }

        // Auto-update lead temperature based on call result
        if (input.callResult) {
          let newTemperature: "HOT" | "WARM" | "COLD" | "DEAD" | null = null;

          if (input.callResult === "Interested - HOT LEAD") {
            newTemperature = "HOT";
          } else if (input.callResult === "Interested - WARM LEAD - Wants too Much / Full Price" || input.callResult === "Interested - WARM LEAD - Not Hated") {
            newTemperature = "WARM";
          } else if (input.callResult === "Irate - DNC" || input.callResult === "Sold - DEAD" || input.callResult === "Not Interested - IHATE - DEAD") {
            newTemperature = "DEAD";
          }

          if (newTemperature) {
            await db.updateLeadTemperature(input.propertyId, newTemperature);
          }
        }

        // Auto-actions for "Not Interested" dispositions
        if (input.callResult === "Not Interested - IHATE - DEAD") {
          // Mark property as DEAD
          await db.updateDesk(input.propertyId, undefined, "DEAD");
          // Create a note explaining why
          await db.addPropertyNote({
            propertyId: input.propertyId,
            userId: ctx.user!.id,
            content: "\u274c Not Interested - IHATE - Property marked as DEAD automatically via disposition.",
            noteType: "general",
          });
        } else if (input.callResult === "Not Interested - Hang-up - FU in 4 months") {
          // Create follow-up task in 4 months
          const fuDate = new Date();
          fuDate.setMonth(fuDate.getMonth() + 4);
          await db.createTask({
            title: "Follow-up: Not Interested - Hang-up",
            description: "Auto-created from disposition: Not Interested - Hang-up - FU in 4 months",
            taskType: "Follow-up",
            priority: "Medium",
            status: "To Do",
            propertyId: input.propertyId,
            createdById: ctx.user!.id,
            dueDate: fuDate,
          });
        } else if (input.callResult === "Not Interested - NICE - FU in 2 Months") {
          // Create follow-up task in 2 months
          const fuDate = new Date();
          fuDate.setMonth(fuDate.getMonth() + 2);
          await db.createTask({
            title: "Follow-up: Not Interested - NICE",
            description: "Auto-created from disposition: Not Interested - NICE - FU in 2 Months",
            taskType: "Follow-up",
            priority: "Medium",
            status: "To Do",
            propertyId: input.propertyId,
            createdById: ctx.user!.id,
            dueDate: fuDate,
          });
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
              "Not Interested - IHATE - DEAD",
              "Not Interested - Hang-up - FU in 4 months",
              "Not Interested - NICE - FU in 2 Months",
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

    togglePhoneDNC: protectedProcedure
      .input(z.object({ phoneId: z.number(), dnc: z.boolean() }))
      .mutation(async ({ input }) => {
        await communication.togglePhoneDNC(input.phoneId, input.dnc);
        return { success: true };
      }),

    markPropertyDNC: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.markPropertyDNC(input.propertyId);
        return { success: true };
      }),

    unmarkPropertyDNC: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        await communication.unmarkPropertyDNC(input.propertyId);
        return { success: true };
      }),

    bulkDeleteContacts: protectedProcedure
      .input(z.object({ contactIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await communication.bulkDeleteContacts(input.contactIds);
        return { success: true, count: input.contactIds.length };
      }),

    /**
     * Check DNC status for all phone numbers of a property via Supabase.
     * Updates contactPhones.dnc and contacts.dnc in the database.
     */
    checkDNCForProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        const { checkDNCForProperty } = await import("./supabase-dnc.js");
        return await checkDNCForProperty(input.propertyId);
      }),

    /**
     * Check DNC status for specific phone IDs (used after adding a contact).
     */
    checkDNCForPhones: protectedProcedure
      .input(z.object({ phoneIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const { checkDNCForPhoneIds } = await import("./supabase-dnc.js");
        return await checkDNCForPhoneIds(input.phoneIds);
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
        // Get the filtered property list (no pagination for navigation)
        const result = await db.getPropertiesWithAgents({
          ...input.filters,
          userId: ctx.user?.id,
          userRole: ctx.user?.role,
          pageSize: 10000, // Get all for navigation
        });
        const allProperties = result.data;

        // Find current property index
        const currentIndex = allProperties.findIndex((p: any) => p.id === input.currentPropertyId);
        
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
          deskId: z.number().optional(),
          overdue: z.boolean().optional(),
          dueToday: z.boolean().optional(),
          upcoming: z.boolean().optional(),
          // When true, always filter by the logged-in user regardless of role
          onlyMine: z.boolean().optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const { onlyMine, ...rest } = input ?? {};
        // Non-admin users always see only their desk tasks
        // Admins see all tasks unless onlyMine=true (used by sidebar badge)
        const forceUserFilter = onlyMine || ctx.user?.role !== 'admin';
        
        // Get user's desk IDs for filtering
        let userDeskIds: number[] | undefined;
        if (forceUserFilter && ctx.user?.id) {
          const database = await getDb();
          if (database) {
            const deskRows = await database
              .select({ deskId: userDesks.deskId })
              .from(userDesks)
              .where(eq(userDesks.userId, ctx.user.id));
            userDeskIds = deskRows.map(r => r.deskId);
          }
        }
        
        const filters = {
          ...rest,
          userId: forceUserFilter ? ctx.user?.id : undefined,
          userDeskIds,
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
      .query(async ({ input, ctx }) => {
        const allTasks = await db.getTasksByPropertyId(input.propertyId);
        // Agents only see their own tasks (assigned to them or created by them)
        if (ctx.user?.role === 'agent') {
          return allTasks.filter((t: any) => t.assignedToId === ctx.user!.id || t.createdById === ctx.user!.id);
        }
        return allTasks;
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          taskType: z.enum(["Call", "Text", "Email", "Meeting", "Site Visit", "Follow Up", "Offer", "Contract", "Closing", "Sent Letter", "Sent Post Card", "Skiptrace", "Take Over Lead", "Drip Campaign", "Visit", "Research", "Follow-up", "Negotiation", "Inspection", "Other"]),
          priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
          status: z.enum(["To Do", "In Progress", "Done"]).default("To Do"),
          assignedToId: z.number().optional(),
          deskId: z.number().optional(),
          propertyId: z.number().optional(),
          dueDate: z.string().optional(), // ISO date string
          dueTime: z.string().optional(), // HH:MM format
          repeatTask: z.enum(["Daily", "Weekly", "Monthly", "3 Months", "6 Months", "No repeat"]).optional(),
          checklist: z.string().optional(), // JSON string
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Auto-generate title from taskType if not provided
        const autoTitle = input.title || input.taskType;
        
        // Resolve deskId: use provided deskId, or auto-resolve from property's deskName
        let resolvedDeskId = input.deskId;
        if (!resolvedDeskId && input.propertyId) {
          const database = await getDb();
          if (database) {
            const [prop] = await database
              .select({ deskName: properties.deskName })
              .from(properties)
              .where(eq(properties.id, input.propertyId))
              .limit(1);
            if (prop?.deskName) {
              const [desk] = await database
                .select({ id: desks.id })
                .from(desks)
                .where(eq(desks.name, prop.deskName))
                .limit(1);
              if (desk) {
                resolvedDeskId = desk.id;
              }
            }
          }
        }
        
        const taskData: any = {
          title: autoTitle,
          description: input.description,
          taskType: input.taskType,
          priority: input.priority,
          status: input.status,
          propertyId: input.propertyId,
          deskId: resolvedDeskId,
          dueTime: input.dueTime,
          repeatTask: input.repeatTask,
          checklist: input.checklist,
          createdById: ctx.user.id,
          dueDate: input.dueDate && input.dueDate.length > 0 ? new Date(input.dueDate) : null,
        };
        return await db.createTask(taskData);
      }),

    update: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          taskType: z.enum(["Call", "Text", "Email", "Meeting", "Site Visit", "Follow Up", "Offer", "Contract", "Closing", "Sent Letter", "Sent Post Card", "Skiptrace", "Take Over Lead", "Drip Campaign", "Visit", "Research", "Follow-up", "Negotiation", "Inspection", "Other"]).optional(),
          priority: z.enum(["High", "Medium", "Low"]).optional(),
          status: z.enum(["To Do", "In Progress", "Done"]).optional(),
          dueTime: z.string().optional(),
          repeatTask: z.enum(["Daily", "Weekly", "Monthly", "3 Months", "6 Months", "No repeat"]).optional(),
          assignedToId: z.number().optional(),
          deskId: z.number().nullable().optional(),
          propertyId: z.number().optional(),
          dueDate: z.string().optional(),
          completedDate: z.string().optional(),
          checklist: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { taskId, ...updates } = input;
        const updateData: any = { ...updates };
        
        if (updates.dueDate && updates.dueDate.length > 0) {
          updateData.dueDate = new Date(updates.dueDate);
        } else if (updates.dueDate === '') {
          updateData.dueDate = null;
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

    cancelRepeat: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");
        const { tasks } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        // Set repeatActive = 0 and repeatTask = 'No repeat' to fully disable repeat
        await dbInstance
          .update(tasks)
          .set({ repeatActive: 0, repeatTask: "No repeat" })
          .where(eq(tasks.id, input.taskId));
        return { success: true };
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

        // Get all communication logs with null safety
        let allLogs: any[] = [];
        try {
          const result = await database
            .select()
            .from(communicationLog)
            .execute();
          allLogs = result || [];
        } catch (e) {
          console.error('[getCallStats] Error fetching logs:', e);
          allLogs = [];
        }

        // Filter by user if not admin - ensure logs is always an array
        const logs = (userId 
          ? allLogs.filter((log: any) => log && log.agentId === userId)
          : allLogs) || [];

        // Calculate today's calls with null checks
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCalls = Array.isArray(logs) ? logs.filter((log: any) => {
          if (!log || !log.createdAt) return false;
          const logDate = new Date(log.createdAt);
          return logDate >= today;
        }) : [];

        // Calculate conversion rate by disposition with null checks
        const dispositionCounts: Record<string, number> = {};
        if (Array.isArray(logs)) {
          logs.forEach((log: any) => {
            if (log && log.disposition) {
              dispositionCounts[log.disposition] = (dispositionCounts[log.disposition] || 0) + 1;
            }
          });
        }

        // Safe filtering with null checks
        const hotLeads = Array.isArray(logs) ? logs.filter((log: any) => 
          log && log.disposition?.includes('HOT LEAD')
        ).length : 0;
        const warmLeads = Array.isArray(logs) ? logs.filter((log: any) => 
          log && log.disposition?.includes('WARM LEAD')
        ).length : 0;
        const totalCalls = Array.isArray(logs) ? logs.length : 0;
        const conversionRate = totalCalls > 0 
          ? ((hotLeads + warmLeads) / totalCalls * 100).toFixed(1)
          : '0.0';

        // Calculate agent rankings with safe handling
        const agentStats: Record<string, { calls: number; hotLeads: number; warmLeads: number }> = {};
        if (Array.isArray(logs)) {
          logs.forEach((log: any) => {
            if (!log) return;
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
        }

        // Safe Object.entries with null check
        const agentRankings = agentStats && Object.keys(agentStats).length > 0
          ? Object.entries(agentStats)
            .map(([agent, stats]) => ({
              agent,
              calls: stats?.calls ?? 0,
              hotLeads: stats?.hotLeads ?? 0,
              warmLeads: stats?.warmLeads ?? 0,
              conversionRate: (stats?.calls ?? 0) > 0 
                ? (((stats?.hotLeads ?? 0) + (stats?.warmLeads ?? 0)) / (stats?.calls ?? 1) * 100).toFixed(1)
                : '0.0',
            }))
            .sort((a, b) => b.calls - a.calls)
            .slice(0, 10)
          : [];

        return {
          totalCallsToday: todayCalls.length,
          totalCallsAllTime: totalCalls,
          conversionRate,
          hotLeads,
          warmLeads,
          dispositionBreakdown: dispositionCounts && Object.keys(dispositionCounts).length > 0
            ? Object.entries(dispositionCounts)
              .map(([disposition, count]) => ({ disposition, count: count ?? 0 }))
              .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
              .slice(0, 10)
            : [],
          agentRankings,
        };
      }),
  }),

  // ─── Twilio Voice Calling (Browser SDK + REST API) ──────────────
  twilio: router({
    /**
     * Validate that Twilio credentials are properly configured.
     */
    checkConfig: protectedProcedure.query(async () => {
      const { validateTwilioConfig } = await import("./twilio");
      return validateTwilioConfig();
    }),

    /**
     * Generate an Access Token for the Twilio Voice JavaScript SDK.
     * This token allows the browser to make AND RECEIVE calls.
     * incomingAllow: true enables the Device to receive incoming calls.
     */
    getAccessToken: protectedProcedure.query(async ({ ctx }) => {
      const twilio = await import("twilio");
      const AccessToken = twilio.default.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      if (!ENV.twilioAccountSid || !ENV.twilioApiKey || !ENV.twilioApiSecret || !ENV.twilioTwimlAppSid) {
        throw new Error("Twilio Voice SDK not configured. Missing API Key, API Secret, or TwiML App SID.");
      }

      const identity = `crm-user-${ctx.user.id}`;
      const token = new AccessToken(
        ENV.twilioAccountSid,
        ENV.twilioApiKey,
        ENV.twilioApiSecret,
        { identity, ttl: 3600 }
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: ENV.twilioTwimlAppSid,
        incomingAllow: true, // Enable receiving incoming calls
      });
      token.addGrant(voiceGrant);

      return {
        token: token.toJwt(),
        identity,
        twilioPhone: ctx.user.twilioPhone || ENV.twilioPhoneNumber || null,
      };
    }),

    /**
     * Heartbeat: called every 30 seconds by the frontend when the Twilio Device is registered.
     * Upserts a userSessions row to mark the user as online.
     * The inbound call router uses this to ring only users with a recent heartbeat.
     */
    heartbeat: protectedProcedure.mutation(async ({ ctx }) => {
      const { userSessions } = await import("../drizzle/schema");
      const database = await getDb();
      if (!database) return { ok: false };
      const existing = await database
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(eq(userSessions.userId, ctx.user.id))
        .limit(1);
      if (existing.length > 0) {
        await database
          .update(userSessions)
          .set({ isOnline: 1, lastHeartbeat: new Date() })
          .where(eq(userSessions.userId, ctx.user.id));
      } else {
        await database.insert(userSessions).values({
          userId: ctx.user.id,
          isOnline: 1,
          lastHeartbeat: new Date(),
        });
      }
      return { ok: true };
    }),

    /**
     * Go offline: called when the Twilio Device unregisters (browser tab closes, logout).
     * Marks the user as offline so inbound calls skip them.
     */
    goOffline: protectedProcedure.mutation(async ({ ctx }) => {
      const { userSessions } = await import("../drizzle/schema");
      const database = await getDb();
      if (!database) return { ok: false };
      await database
        .update(userSessions)
        .set({ isOnline: 0 })
        .where(eq(userSessions.userId, ctx.user.id));
      return { ok: true };
    }),

    /**
     * Initiate an outbound call via the Twilio REST API.
     */
    makeCall: protectedProcedure
      .input(z.object({
        to: z.string().min(1, "Phone number is required"),
        contactId: z.number().optional(),
        propertyId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { makeOutboundCall, validateTwilioConfig } = await import("./twilio");
        const { createCallLog } = await import("./db-callNotes");

        const config = validateTwilioConfig();
        if (!config.valid) {
          throw new Error(`Twilio not configured. Missing: ${config.missing.join(", ")}`);
        }

        // Server-side DNC + Litigator guard — block call regardless of frontend state
        if (input.contactId) {
          const db = await getDb();
          if (db) {
            const toDigits = input.to.replace(/\D/g, "");
            const toVariants = [input.to, toDigits, toDigits.startsWith("1") ? toDigits.slice(1) : `1${toDigits}`];
            const phoneRows = await db
              .select({
                dnc: contactPhones.dnc,
                isLitigator: contactPhones.isLitigator,
                contactDnc: contacts.dnc,
                contactLitigator: contacts.isLitigator,
              })
              .from(contactPhones)
              .innerJoin(contacts, eq(contacts.id, contactPhones.contactId))
              .where(
                and(
                  eq(contactPhones.contactId, input.contactId),
                  sql`${contactPhones.phoneNumber} IN (${sql.join(toVariants.map(v => sql`${v}`), sql`, `)})`
                )
              )
              .limit(1);
            const phoneRow = phoneRows[0] ?? null;
            if (phoneRow) {
              if (phoneRow.dnc || phoneRow.contactDnc) {
                throw new TRPCError({ code: "FORBIDDEN", message: "This number is marked as DNC. Call blocked." });
              }
              if (phoneRow.isLitigator || phoneRow.contactLitigator) {
                throw new TRPCError({ code: "FORBIDDEN", message: "This number is flagged as a Litigator. Call blocked." });
              }
            }
          }
        }

        const userTwilioPhone = ctx.user.twilioPhone || undefined;
        const result = await makeOutboundCall({ to: input.to, fromNumber: userTwilioPhone });

        // Create a call log entry if contact and property IDs are provided
        let callLogId: number | undefined;
        if (input.contactId && input.propertyId) {
          const logResult = await createCallLog({
            propertyId: input.propertyId,
            contactId: input.contactId,
            userId: ctx.user.id,
            toPhoneNumber: result.to,
            fromPhoneNumber: result.from,
            callType: "outbound",
            status: "ringing",
            twilioCallSid: result.callSid,
          });
          callLogId = logResult.id;
        }

        return { ...result, callLogId };
      }),

    /**
     * Update a call log entry (status, duration, etc.)
     */
    updateCallLog: protectedProcedure
      .input(z.object({
        callLogId: z.number(),
        status: z.enum(["ringing", "in-progress", "completed", "failed", "no-answer"]).optional(),
        duration: z.number().optional(),
        notes: z.string().optional(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateCallLog } = await import("./db-callNotes");
        return updateCallLog(input.callLogId, {
          status: input.status,
          duration: input.duration,
          endedAt: input.status === "completed" || input.status === "failed" || input.status === "no-answer" ? new Date() : undefined,
          notes: input.notes,
          errorMessage: input.errorMessage,
        });
      }),

    /**
     * Create a call log entry (for browser SDK calls that don't use REST API).
     * This just records the call in the database without initiating a Twilio REST call.
     */
    createCallLog: protectedProcedure
      .input(z.object({
        to: z.string().min(1, "Phone number is required"),
        contactId: z.number().optional(),
        propertyId: z.number().optional(),
        status: z.enum(["ringing", "in-progress", "completed", "failed", "no-answer"]).default("ringing"),
      }))
      .mutation(async ({ input, ctx }) => {
        const { createCallLog } = await import("./db-callNotes");
        const { formatPhoneNumber } = await import("./twilio");

        let callLogId: number | undefined;
        if (input.contactId && input.propertyId) {
          const userTwilioPhone = ctx.user.twilioPhone || ENV.twilioPhoneNumber || "browser";
          const logResult = await createCallLog({
            propertyId: input.propertyId,
            contactId: input.contactId,
            userId: ctx.user.id,
            toPhoneNumber: formatPhoneNumber(input.to),
            fromPhoneNumber: userTwilioPhone,
            callType: "outbound",
            status: input.status,
          });
          callLogId = logResult.id;
        }

        return { callLogId };
      }),

    /**
     * Get the current status of a call by its SID.
     */
    getCallStatus: protectedProcedure
      .input(z.object({
        callSid: z.string().min(1, "Call SID is required"),
      }))
      .query(async ({ input }) => {
        const { getCallStatus } = await import("./twilio");
        return getCallStatus(input.callSid);
      }),

    // ─── Global Twilio Numbers Registry ────────────────────────────
    /** List all registered Twilio numbers (active ones for agents, all for admins unless activeOnly=true) */
    listNumbers: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Admins see all numbers in the management page, but activeOnly=true forces active filter (used by call/SMS widgets)
        if (ctx.user.role === "admin" && !input?.activeOnly) {
          return database.select().from(twilioNumbers).orderBy(twilioNumbers.sortOrder);
        }
        return database.select().from(twilioNumbers).where(eq(twilioNumbers.isActive, 1)).orderBy(twilioNumbers.sortOrder);
      }),

    /** Add a new Twilio number (admin only) */
    addNumber: adminProcedure
      .input(z.object({
        phoneNumber: z.string().min(10, "Phone number is required"),
        label: z.string().min(1, "Label is required"),
        description: z.string().optional(),
        campaignName: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Normalize phone to E.164
        const rawDigits = input.phoneNumber.replace(/\D/g, "");
        const phone = rawDigits.length === 10 ? `+1${rawDigits}` : rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` : input.phoneNumber.startsWith("+") ? input.phoneNumber : `+1${rawDigits}`;
        const result = await database.insert(twilioNumbers).values({
          phoneNumber: phone,
          label: input.label,
          description: input.description || null,
          campaignName: input.campaignName || null,
          sortOrder: input.sortOrder ?? 0,
        });
        return { success: true, id: result[0].insertId };
      }),

    /** Update a Twilio number (admin only) */
    updateNumber: adminProcedure
      .input(z.object({
        id: z.number(),
        phoneNumber: z.string().min(10).optional(),
        label: z.string().min(1).optional(),
        description: z.string().optional(),
        campaignName: z.string().nullable().optional(),
        isActive: z.number().min(0).max(1).optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const updates: any = {};
        if (input.phoneNumber !== undefined) {
          const rawDigits = input.phoneNumber.replace(/\D/g, "");
          updates.phoneNumber = rawDigits.length === 10 ? `+1${rawDigits}` : rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` : input.phoneNumber.startsWith("+") ? input.phoneNumber : `+1${rawDigits}`;
        }
        if (input.label !== undefined) updates.label = input.label;
        if (input.description !== undefined) updates.description = input.description;
        if (input.campaignName !== undefined) updates.campaignName = input.campaignName || null;
        if (input.isActive !== undefined) updates.isActive = input.isActive;
        if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
        await database.update(twilioNumbers).set(updates).where(eq(twilioNumbers.id, input.id));
        return { success: true };
      }),

    /** Delete a Twilio number (admin only) */
    deleteNumber: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Also remove desk assignments
        await database.delete(twilioNumberDesks).where(eq(twilioNumberDesks.twilioNumberId, input.id));
        await database.delete(twilioNumbers).where(eq(twilioNumbers.id, input.id));
        return { success: true };
      }),

    // ─── Desk ↔ Twilio Number assignments ─────────────────────────
    /** Get desk IDs assigned to a Twilio number */
    getNumberDesks: protectedProcedure
      .input(z.object({ twilioNumberId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const rows = await database
          .select({ deskId: twilioNumberDesks.deskId })
          .from(twilioNumberDesks)
          .where(eq(twilioNumberDesks.twilioNumberId, input.twilioNumberId));
        return rows.map(r => r.deskId);
      }),

    /** Get all desk assignments for all Twilio numbers (batch) */
    getAllNumberDesks: protectedProcedure.query(async () => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");
      const rows = await database
        .select({
          twilioNumberId: twilioNumberDesks.twilioNumberId,
          deskId: twilioNumberDesks.deskId,
        })
        .from(twilioNumberDesks);
      // Group by twilioNumberId
      const map: Record<number, number[]> = {};
      for (const r of rows) {
        if (!map[r.twilioNumberId]) map[r.twilioNumberId] = [];
        map[r.twilioNumberId].push(r.deskId);
      }
      return map;
    }),

    /** Set desk assignments for a Twilio number (replace all) */
    setNumberDesks: adminProcedure
      .input(z.object({
        twilioNumberId: z.number(),
        deskIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Delete existing
        await database.delete(twilioNumberDesks).where(eq(twilioNumberDesks.twilioNumberId, input.twilioNumberId));
        // Insert new
        if (input.deskIds.length > 0) {
          await database.insert(twilioNumberDesks).values(
            input.deskIds.map(deskId => ({ twilioNumberId: input.twilioNumberId, deskId }))
          );
        }
        return { success: true };
      }),

    // ─── Desk ↔ User assignments ──────────────────────────────────
    /** Get desk IDs assigned to a user */
    getUserDesks: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        const rows = await database
          .select({ deskId: userDesks.deskId })
          .from(userDesks)
          .where(eq(userDesks.userId, input.userId));
        return rows.map(r => r.deskId);
      }),

    /** Get all desk assignments for all users (batch) */
    getAllUserDesks: protectedProcedure.query(async () => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");
      const rows = await database
        .select({
          userId: userDesks.userId,
          deskId: userDesks.deskId,
        })
        .from(userDesks);
      // Group by userId
      const map: Record<number, number[]> = {};
      for (const r of rows) {
        if (!map[r.userId]) map[r.userId] = [];
        map[r.userId].push(r.deskId);
      }
      return map;
    }),

    /** Set desk assignments for a user (replace all) */
    setUserDesks: adminProcedure
      .input(z.object({
        userId: z.number(),
        deskIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Delete existing
        await database.delete(userDesks).where(eq(userDesks.userId, input.userId));
        // Insert new
        if (input.deskIds.length > 0) {
          await database.insert(userDesks).values(
            input.deskIds.map(deskId => ({ userId: input.userId, deskId }))
          );
        }
        return { success: true };
      }),
  }),

  // ─── Call Notes ──────────────────────────────────────────────────────────
  callNotes: router({
    /** Create a new call note */
    create: protectedProcedure
      .input(z.object({
        callLogId: z.number().optional(),
        contactId: z.number(),
        propertyId: z.number(),
        content: z.string().min(1, "Note content is required"),
      }))
      .mutation(async ({ input, ctx }) => {
        const { createCallNote } = await import("./db-callNotes");
        return createCallNote({
          callLogId: input.callLogId,
          contactId: input.contactId,
          propertyId: input.propertyId,
          userId: ctx.user.id,
          content: input.content,
        });
      }),

    /** Get all notes for a contact (with call info) */
    getByContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        const { getCallNotesWithCallInfo } = await import("./db-callNotes");
        return getCallNotesWithCallInfo(input.contactId);
      }),

    /** Get UNIFIED notes for a contact — merges callNotes + communicationLog */
    getUnifiedByContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        const { getUnifiedNotesForContact } = await import("./db-callNotes");
        return getUnifiedNotesForContact(input.contactId);
      }),

    /** Get notes for a specific call log */
    getByCallLog: protectedProcedure
      .input(z.object({ callLogId: z.number() }))
      .query(async ({ input }) => {
        const { getCallNotesByCallLog } = await import("./db-callNotes");
        return getCallNotesByCallLog(input.callLogId);
      }),

    /** Delete a call note (only by the creator) */
    delete: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteCallNote } = await import("./db-callNotes");
        return deleteCallNote(input.noteId, ctx.user.id);
      }),

    /** Get call logs for a contact */
    getCallLogs: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        const { getCallLogsByContact } = await import("./db-callNotes");
        return getCallLogsByContact(input.contactId);
      }),

    /** Get the latest call note per contact for a property (for contacts list display) */
    getLatestByProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const { getLatestCallNotesByProperty } = await import("./db-callNotes");
        return getLatestCallNotesByProperty(input.propertyId);
      }),
  }),

  // Agents Management


  // Webhook endpoint for WordPress/Elementor form submissions
  webhook: router({
    submitLead: publicProcedure
      .input(
        z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          fullName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipcode: z.string().optional(),
          propertyType: z.string().optional(),
          estimatedValue: z.number().optional(),
          bedrooms: z.number().optional(),
          bathrooms: z.number().optional(),
          squareFeet: z.number().optional(),
          ownerName: z.string().optional(),
          ownerLocation: z.string().optional(),
          marketStatus: z.string().optional(),
          leadTemperature: z.string().optional(),
          notes: z.string().optional(),
          source: z.string().optional(),
          formName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const database = await getDb();
          if (!database) throw new Error('Database not available');

          // Prepare the property data
          const ownerName = input.ownerName || input.fullName || `${input.firstName || ''} ${input.lastName || ''}`.trim() || 'Unknown';
          const addressLine1 = input.address || '';
          const city = input.city || 'Unknown';
          const state = input.state || '';
          const zipcode = input.zipcode || '';

          // Insert the new property
          const validTrackingStatuses = ['Not Visited', 'Off Market', 'Cash Buyer', 'Free And Clear', 'High Equity', 'Senior Owner', 'Tired Landlord', 'Absentee Owner', 'Corporate Owner', 'Empty Nester', 'Interested', 'Not Interested', 'Follow Up'];
          const trackingStatus = (input.marketStatus && validTrackingStatuses.includes(input.marketStatus as any)) ? (input.marketStatus as any) : 'Not Visited';
          const validLeadTemps = ['SUPER HOT', 'HOT', 'WARM', 'COLD', 'TBD', 'DEAD'];
          const leadTemp = (input.leadTemperature && validLeadTemps.includes(input.leadTemperature as any)) ? (input.leadTemperature as any) : 'TBD';
          // Web leads always use the website Twilio number as default caller
          const WEB_CALLER_ID = '+17869041444';

          const result = await database.insert(properties).values({
            addressLine1,
            city,
            state,
            zipcode,
            owner1Name: ownerName,
            ownerLocation: input.ownerLocation || city,
            propertyType: input.propertyType || 'Unknown',
            totalBedrooms: input.bedrooms,
            totalBaths: input.bathrooms,
            buildingSquareFeet: input.squareFeet,
            estimatedValue: input.estimatedValue,
            trackingStatus,
            leadTemperature: leadTemp,
            deskName: 'NEW_LEAD',
            deskStatus: 'BIN',
            status: input.source ? `WordPress Form - ${input.source}` : 'WordPress Form',
            leadSource: 'Website',
            source: 'Manual',
            primaryTwilioNumber: WEB_CALLER_ID, // Auto-assign web number for all website leads
          });

          // If contact info provided, add contact
          if (input.email || input.phone) {
            const propertyId = (result as any).insertId || (result as any)[0]?.id;
            if (propertyId) {
              await database.insert(contacts).values({
                propertyId,
                name: ownerName,
                relationship: 'Owner',
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any);
            }
          }

          return {
            success: true,
            message: 'Lead successfully added to CRM',
            ownerName,
            address: addressLine1,
          };
        } catch (error) {
          console.error('Webhook error:', error);
          return {
            success: false,
            message: 'Error adding lead to CRM',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
       }),
  }),
  dashboard: router({
    getStats: protectedProcedure
      .input(z.number().optional())
      .query(async ({ input: agentId, ctx }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new Error("Database not available");

        // Build base condition: agent filtering
        const conditions: any[] = [];
        if (ctx.user?.role !== 'admin' && ctx.user?.id) {
          conditions.push(eq(properties.assignedAgentId, ctx.user.id));
        } else if (agentId && ctx.user?.role === 'admin') {
          conditions.push(eq(properties.assignedAgentId, agentId));
        }

        const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

        // Use efficient SQL COUNT queries instead of loading all rows
        const countQuery = (extraCondition?: any) => {
          const allConditions = extraCondition 
            ? (baseWhere ? and(baseWhere, extraCondition) : extraCondition)
            : baseWhere;
          const q = dbInstance.select({ count: sql<number>`COUNT(*)` }).from(properties);
          return allConditions ? q.where(allConditions) : q;
        };

        // Total count excludes DEAD leads (both leadTemperature=DEAD and deskStatus=DEAD)
        const [totalResult] = await countQuery(and(
          sql`${properties.leadTemperature} != 'DEAD'`,
          ne(properties.deskStatus, 'DEAD')
        ));
        const [newLeadsResult] = await countQuery(eq(properties.deskName, 'NEW_LEAD'));
        const [superHotResult] = await countQuery(eq(properties.leadTemperature, 'SUPER HOT'));
        const [hotResult] = await countQuery(eq(properties.leadTemperature, 'HOT'));
        const [warmResult] = await countQuery(eq(properties.leadTemperature, 'WARM'));
        const [coldResult] = await countQuery(eq(properties.leadTemperature, 'COLD'));
        // DEAD count includes both leadTemperature=DEAD and deskStatus=DEAD
        const [deadResult] = await countQuery(or(
          eq(properties.leadTemperature, 'DEAD'),
          eq(properties.deskStatus, 'DEAD')
        ));
        const [ownerVerifiedResult] = await countQuery(eq(properties.ownerVerified, 1));

        // Visited count (requires join with visits table)
        let visitedCount = 0;
        try {
          const visitedQuery = dbInstance
            .select({ count: sql<number>`COUNT(DISTINCT ${properties.id})` })
            .from(properties)
            .innerJoin(visits, eq(visits.propertyId, properties.id));
          const [visitedResult] = baseWhere ? await visitedQuery.where(baseWhere) : await visitedQuery;
          visitedCount = Number(visitedResult?.count || 0);
        } catch { visitedCount = 0; }

        return {
          total: Number(totalResult?.count || 0),
          newLeads: Number(newLeadsResult?.count || 0),
          superHot: Number(superHotResult?.count || 0),
          hot: Number(hotResult?.count || 0),
          warm: Number(warmResult?.count || 0),
          cold: Number(coldResult?.count || 0),
          dead: Number(deadResult?.count || 0),
          ownerVerified: Number(ownerVerifiedResult?.count || 0),
          visited: visitedCount,
        };
      }),
        importDealMachine: protectedProcedure
      .input(
        z.object({
          rows: z.array(z.record(z.string(), z.any())),
          assignedAgentId: z.number().nullable().optional(),
          listName: z.string().nullable().optional(),
          campaignName: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { mapDealMachineRow, validateProperty } = await import("./lib/dealmachine-mapper");
        const { importDealMachineProperties } = await import("./db-dealmachine-import");
        const mappedProperties = input.rows.map((row) => mapDealMachineRow(row));
        const validProperties = mappedProperties.filter((prop) => {
          const errors = validateProperty(prop);
          return errors.length === 0;
        });
        const result = await importDealMachineProperties(
          validProperties,
          input.assignedAgentId ?? undefined,
          input.listName ?? undefined,
          input.campaignName ?? undefined
        );
        return result;
      }),
  }),

  followups: router({
    create: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          type: z.enum(["Cold Lead", "No Contact", "Stage Change", "Custom"]),
          trigger: z.string(),
          action: z.enum(["Create Task", "Send Email", "Send SMS", "Change Stage"]),
          actionDetails: z.record(z.string(), z.any()),
          nextRunAt: z.date(),
          // SMS template fields (optional)
          templateId: z.number().int().optional(),
          templateBody: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { createAutomatedFollowUp } = await import("./db-automated-followups");
        return await createAutomatedFollowUp({
          ...input,
          createdByUserId: ctx.user!.id,
          createdByName: ctx.user!.name ?? undefined,
        });
      }),

    getByProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const { getFollowUpsByProperty } = await import("./db-automated-followups");
        return await getFollowUpsByProperty(input.propertyId);
      }),

    getPending: protectedProcedure.query(async () => {
      const { getPendingFollowUps } = await import("./db-automated-followups");
      return await getPendingFollowUps();
    }),

    execute: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ input }) => {
        const { executeFollowUp } = await import("./db-automated-followups");
        return await executeFollowUp(input.followUpId);
      }),

    pause: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ input }) => {
        const { pauseFollowUp } = await import("./db-automated-followups");
        return await pauseFollowUp(input.followUpId);
      }),

    resume: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ input }) => {
        const { resumeFollowUp } = await import("./db-automated-followups");
        return await resumeFollowUp(input.followUpId);
      }),

    delete: protectedProcedure
      .input(z.object({ followUpId: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteFollowUp } = await import("./db-automated-followups");
        return await deleteFollowUp(input.followUpId);
      }),

    // Manual trigger: run the scheduler cycle now
    runSchedulerNow: protectedProcedure.mutation(async () => {
      const { runSchedulerCycle } = await import("./db-automated-followups");
      return await runSchedulerCycle();
    }),
  }),

  dealCalculator: router({
    save: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          arv: z.number().positive(),
          repairCost: z.number().nonnegative(),
          closingCost: z.number().nonnegative(),
          assignmentFee: z.number().nonnegative(),
          desiredProfit: z.number().nonnegative(),
        })
      )
      .mutation(async ({ input }) => {
        const { saveDealCalculation } = await import("./db-deal-calculator");
        return await saveDealCalculation(
          input.propertyId,
          input.arv,
          input.repairCost,
          input.closingCost,
          input.assignmentFee,
          input.desiredProfit
        );
      }),

    get: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        try {
          const { getDealCalculation } = await import("./db-deal-calculator");
          return await getDealCalculation(input.propertyId);
        } catch (_) {
          return null;
        }
      }),

    delete: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteDealCalculation } = await import("./db-deal-calculator");
        return await deleteDealCalculation(input.propertyId);
      }),

    getAll: protectedProcedure.query(async () => {
      const { getAllDealCalculations } = await import("./db-deal-calculator");
      return await getAllDealCalculations();
    }),

    calculateProfitMargin: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          offerPrice: z.number().nonnegative(),
        })
      )
      .query(async ({ input }) => {
        const { calculateProfitMargin } = await import("./db-deal-calculator");
        return await calculateProfitMargin(input.propertyId, input.offerPrice);
      }),

    analyzeDeal: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          offerPrice: z.number().nonnegative(),
        })
      )
      .query(async ({ input }) => {
        const { analyzeDeal } = await import("./db-deal-calculator");
        return await analyzeDeal(input.propertyId, input.offerPrice);
      }),
  }),

  buyers: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
          company: z.string().optional(),
          status: z.enum(["Active", "Inactive", "Verified", "Blacklisted"]).optional(),
          notes: z.string().optional(),
          preferences: z.object({
            states: z.array(z.string()).optional(),
            cities: z.array(z.string()).optional(),
            zipcodes: z.array(z.string()).optional(),
            propertyTypes: z.array(z.string()).optional(),
            minBeds: z.number().optional(),
            maxBeds: z.number().optional(),
            minBaths: z.number().optional(),
            maxBaths: z.number().optional(),
            minPrice: z.number().optional(),
            maxPrice: z.number().optional(),
            maxRepairCost: z.number().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { createBuyer } = await import("./db-buyers");
        return await createBuyer(input);
      }),

    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const { getAllBuyers } = await import("./db-buyers");
        return await getAllBuyers(input?.search);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getBuyerById } = await import("./db-buyers");
        return await getBuyerById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            company: z.string().optional(),
            status: z.enum(["Active", "Inactive", "Verified", "Blacklisted"]).optional(),
            notes: z.string().optional(),
            preferences: z.object({
              states: z.array(z.string()).optional(),
              cities: z.array(z.string()).optional(),
              zipcodes: z.array(z.string()).optional(),
              propertyTypes: z.array(z.string()).optional(),
              minBeds: z.number().optional(),
              maxBeds: z.number().optional(),
              minBaths: z.number().optional(),
              maxBaths: z.number().optional(),
              minPrice: z.number().optional(),
              maxPrice: z.number().optional(),
              maxRepairCost: z.number().optional(),
            }).optional(),
          }),
        })
      )
      .mutation(async ({ input }) => {
        const { updateBuyer } = await import("./db-buyers");
        return await updateBuyer(input.id, input.data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteBuyer } = await import("./db-buyers");
        return await deleteBuyer(input.id);
      }),

    getMatches: adminProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const { getMatchingBuyers } = await import("./db-buyers");
        return await getMatchingBuyers(input.propertyId);
      }),

    // Validate Excel import data (preview before importing)
    validateImport: protectedProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              name: z.string(),
              email: z.string(),
              phone: z.string().optional(),
              company: z.string().optional(),
              status: z.string().optional(),
              notes: z.string().optional(),
              preferredStates: z.string().optional(),
              preferredCities: z.string().optional(),
              preferredZipcodes: z.string().optional(),
              propertyTypes: z.string().optional(),
              minBeds: z.number().optional().nullable(),
              maxBeds: z.number().optional().nullable(),
              minBaths: z.number().optional().nullable(),
              maxBaths: z.number().optional().nullable(),
              minPrice: z.number().optional().nullable(),
              maxPrice: z.number().optional().nullable(),
              maxRepairCost: z.number().optional().nullable(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const { validateBuyerImport } = await import("./db-buyers-import");
        return await validateBuyerImport(input.rows as any);
      }),

    // Execute the actual import after validation
    bulkImport: protectedProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              name: z.string(),
              email: z.string(),
              phone: z.string().optional(),
              company: z.string().optional(),
              status: z.string().optional(),
              notes: z.string().optional(),
              preferredStates: z.string().optional(),
              preferredCities: z.string().optional(),
              preferredZipcodes: z.string().optional(),
              propertyTypes: z.string().optional(),
              minBeds: z.number().optional().nullable(),
              maxBeds: z.number().optional().nullable(),
              minBaths: z.number().optional().nullable(),
              maxBaths: z.number().optional().nullable(),
              minPrice: z.number().optional().nullable(),
              maxPrice: z.number().optional().nullable(),
              maxRepairCost: z.number().optional().nullable(),
            })
          ),
          skipDuplicates: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        const { importBuyersBatch } = await import("./db-buyers-import");
        return await importBuyersBatch(input.rows as any, input.skipDuplicates);
      }),

    // Get template column definitions
    getTemplateColumns: protectedProcedure
      .query(async () => {
        const { getTemplateColumns } = await import("./db-buyers-import");
        return getTemplateColumns();
      }),
  }),

  documents: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPropertyDocuments(input.propertyId);
      }),

    upload: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          noteId: z.number().optional(),
          fileName: z.string().min(1),
          fileData: z.string(), // base64 encoded file
          fileSize: z.number(),
          mimeType: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");

        // Decode base64 file
        const base64Data = input.fileData.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Generate unique file key with original extension
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const ext = input.fileName.split(".").pop() || "bin";
        const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `properties/${input.propertyId}/documents/${timestamp}-${randomSuffix}-${safeFileName}`;

        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Save to database
        const result = await db.createPropertyDocument({
          propertyId: input.propertyId,
          noteId: input.noteId,
          userId: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          description: input.description,
        });

        return { ...result, fileUrl: url, uploaderName: ctx.user.name };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deletePropertyDocument(input.id);
      }),
  }),

  // ─── Twilio SMS Chat ────────────────────────────────────────────────────────
  sms: router({
    /**
     * Send an SMS to a contact phone number via Twilio REST API.
     * Saves the message to the smsMessages table.
     */
    send: protectedProcedure
      .input(z.object({
        to: z.string().min(7, "Phone number required"),
        body: z.string().min(1, "Message body required").max(1600),
        contactId: z.number().optional(),
        propertyId: z.number().optional(),
        fromNumber: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getIntegrationConfig } = await import("./integrationConfig");
        const twilioConfig = await getIntegrationConfig("twilio");
        const twilio = await import("twilio");
        const client = twilio.default(
          twilioConfig.accountSid || ENV.twilioAccountSid,
          twilioConfig.authToken || ENV.twilioAuthToken
        );
        const fromPhone = input.fromNumber || twilioConfig.phoneNumber || ENV.twilioPhoneNumber;
        const messagingServiceSid = twilioConfig.messagingServiceSid || ENV.twilioMessagingServiceSid;
        if (!messagingServiceSid && !fromPhone) throw new Error("No Twilio Messaging Service or phone number configured. Go to Settings → Integrations → Twilio to add your Messaging Service SID.");
        // Format to E.164
        const rawDigits = input.to.replace(/\D/g, "");
        const toPhone = rawDigits.length === 10 ? `+1${rawDigits}` : rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` : input.to.startsWith("+") ? input.to : `+1${rawDigits}`;
        let twilioSid: string | undefined;
        let msgStatus: "queued" | "sent" | "delivered" | "failed" | "received" | "undelivered" = "queued";
        let errorMessage: string | undefined;
        try {
          // Use Messaging Service SID (A2P 10DLC compliant) when available, fallback to direct number
          const twilioParams: any = { to: toPhone, body: input.body };
          if (messagingServiceSid) {
            twilioParams.messagingServiceSid = messagingServiceSid;
          } else {
            twilioParams.from = fromPhone;
          }
          const msg = await client.messages.create(twilioParams);
          twilioSid = msg.sid;
          msgStatus = "sent";
        } catch (err: any) {
          errorMessage = err?.message || "Unknown error";
          msgStatus = "failed";
        }
        // Save to DB regardless of success/failure
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        await database.insert(smsTable).values({
          contactPhone: toPhone,
          twilioPhone: fromPhone || "",
          direction: "outbound",
          body: input.body,
          twilioSid,
          status: msgStatus,
          contactId: input.contactId,
          propertyId: input.propertyId,
          sentByUserId: ctx.user.id,
          sentByName: ctx.user.name || ctx.user.email || "Agent",
          errorMessage,
        });
        if (msgStatus === "failed") throw new Error(`SMS failed: ${errorMessage}`);
        return { success: true, twilioSid, status: msgStatus };
      }),

    /**
     * Get the full SMS conversation thread for a given phone number.
     * Returns messages ordered oldest-first.
     */
    getConversation: protectedProcedure
      .input(z.object({
        contactPhone: z.string(),
        limit: z.number().min(1).max(200).default(100),
      }))
      .query(async ({ input }) => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Normalize phone to E.164
        const rawDigits = input.contactPhone.replace(/\D/g, "");
        const normalized = rawDigits.length === 10 ? `+1${rawDigits}` : rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` : input.contactPhone.startsWith("+") ? input.contactPhone : `+1${rawDigits}`;
        const messages = await database
          .select()
          .from(smsTable)
          .where(eq(smsTable.contactPhone, normalized))
          .orderBy(desc(smsTable.createdAt))
          .limit(input.limit);
        return messages.reverse(); // Return oldest-first for chat display
      }),

    /**
     * Get list of all conversations (unique phone numbers) with last message preview.
     */
    getConversationList: protectedProcedure
      .query(async () => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const { desc, sql: sqlFn, eq: eqFn, and: andFn } = await import("drizzle-orm");
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Get last message per contact phone with unread count
        const rows = await database
          .select({
            contactPhone: smsTable.contactPhone,
            lastMessage: sqlFn<string>`MAX(${smsTable.createdAt})`,
            unreadCount: sqlFn<number>`SUM(CASE WHEN ${smsTable.direction} = 'inbound' AND ${smsTable.isRead} = 0 THEN 1 ELSE 0 END)`,
          })
          .from(smsTable)
          .groupBy(smsTable.contactPhone)
          .orderBy(desc(sqlFn`MAX(${smsTable.createdAt})`));
        return rows;
      }),

    /** Returns total count of unread inbound SMS across all conversations */
    unreadCount: protectedProcedure.query(async () => {
      const { smsMessages: smsTable } = await import("../drizzle/schema");
      const { eq: eqFn, and: andFn, sql: sqlFn } = await import("drizzle-orm");
      const database = await getDb();
      if (!database) throw new Error("Database not available");
      const result = await database
        .select({ count: sqlFn<number>`COUNT(*)` })
        .from(smsTable)
        .where(andFn(eqFn(smsTable.direction, "inbound"), eqFn(smsTable.isRead, 0)));
      return { count: Number(result[0]?.count ?? 0) };
    }),

    /** Mark all inbound SMS from a contact phone as read */
    markConversationRead: protectedProcedure
      .input(z.object({ contactPhone: z.string() }))
      .mutation(async ({ input }) => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const { eq: eqFn, and: andFn } = await import("drizzle-orm");
        const database = await getDb();
        if (!database) throw new Error("Database not available");
        // Normalize phone
        const rawDigits = input.contactPhone.replace(/\D/g, "");
        const normalized = rawDigits.length === 10 ? `+1${rawDigits}` : rawDigits.length === 11 && rawDigits.startsWith("1") ? `+${rawDigits}` : input.contactPhone.startsWith("+") ? input.contactPhone : `+1${rawDigits}`;
        await database
          .update(smsTable)
          .set({ isRead: 1 })
          .where(andFn(eqFn(smsTable.contactPhone, normalized), eqFn(smsTable.direction, "inbound"), eqFn(smsTable.isRead, 0)));
         return { success: true };
      }),

    /**
     * Retroactively link all unmatched SMS (propertyId IS NULL) to properties.
     * Runs the shared phone→property lookup for every unlinked message.
     */
    retroactiveRelink: adminProcedure
      .mutation(async () => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const { isNull: isNullFn } = await import("drizzle-orm");
        const { lookupPropertiesByPhone } = await import("./utils/phoneToPropertyLookup");
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        // Fetch all SMS with no property linked
        const unlinked = await database
          .select({ id: smsTable.id, contactPhone: smsTable.contactPhone })
          .from(smsTable)
          .where(isNullFn(smsTable.propertyId));

        let updated = 0;
        let skipped = 0;

        for (const msg of unlinked) {
          if (!msg.contactPhone) { skipped++; continue; }
          try {
            const matches = await lookupPropertiesByPhone(msg.contactPhone);
            if (matches.length === 0) { skipped++; continue; }
            const { propertyId, deskName } = matches[0];
            await database
              .update(smsTable)
              .set({ propertyId, deskName: deskName ?? null })
              .where(eq(smsTable.id, msg.id));
            updated++;
          } catch {
            skipped++;
          }
        }

        return { total: unlinked.length, updated, skipped };
      }),

    /**
     * Manually re-link a single SMS message to a specific property.
     */
    relinkSingle: protectedProcedure
      .input(z.object({
        smsId: z.number(),
        propertyId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        // Get the property's deskName
        const prop = await database
          .select({ deskName: properties.deskName })
          .from(properties)
          .where(eq(properties.id, input.propertyId))
          .limit(1);

        const deskName = prop[0]?.deskName ?? null;

        await database
          .update(smsTable)
          .set({ propertyId: input.propertyId, deskName })
          .where(eq(smsTable.id, input.smsId));

        return { success: true, propertyId: input.propertyId, deskName };
      }),
  }),
  /**
   * SMS Templates — CRUD for reusable follow-up message templates.
   */
  smsTemplates: router({
    /** List all templates, optionally filtered by channel. */
    list: protectedProcedure
      .input(z.object({ channel: z.enum(["sms", "email", "both", "all"]).default("all") }).optional())
      .query(async ({ input }) => {
        const { smsTemplates: tbl } = await import("../drizzle/schema");
        const { asc, eq, or, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const ch = input?.channel ?? "all";
        if (ch === "all") {
          return db.select().from(tbl).orderBy(asc(tbl.category), asc(tbl.sortOrder), asc(tbl.name));
        }
        // "sms" matches channel='sms' or 'both'; "email" matches channel='email' or 'both'
        const matchChannels = ch === "both" ? ["both"] : [ch, "both"];
        return db.select().from(tbl).where(inArray(tbl.channel, matchChannels)).orderBy(asc(tbl.category), asc(tbl.sortOrder), asc(tbl.name));
      }),

    /** Create a new template */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          category: z.string().min(1).max(100).default("Custom"),
          channel: z.enum(["sms", "email", "both"]).default("both"),
          body: z.string().min(1),
          emailSubject: z.string().max(500).optional(),
          sortOrder: z.number().int().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { smsTemplates: tbl } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.insert(tbl).values({
          name: input.name,
          category: input.category,
          channel: input.channel,
          body: input.body,
          emailSubject: input.emailSubject ?? null,
          sortOrder: input.sortOrder,
          createdByUserId: ctx.user!.id,
          createdByName: ctx.user!.name ?? undefined,
        });
        return { id: (result as any)[0]?.insertId as number };
      }),

    /** Update an existing template */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          name: z.string().min(1).max(255).optional(),
          category: z.string().min(1).max(100).optional(),
          channel: z.enum(["sms", "email", "both"]).optional(),
          body: z.string().min(1).optional(),
          emailSubject: z.string().max(500).nullish(),
          sortOrder: z.number().int().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { smsTemplates: tbl } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...fields } = input;
        await db.update(tbl).set({ ...fields, updatedAt: new Date() }).where(eq(tbl.id, id));
        return { success: true };
      }),

    /**
     * Delete a template.
     * If the template is referenced by active follow-ups, returns
     * { success: false, usageCount, usages } so the UI can warn the user.
     * Pass force=true to delete anyway (follow-ups keep their templateBody snapshot).
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number().int(), force: z.boolean().default(false) }))
      .mutation(async ({ input }) => {
        const { smsTemplates: tbl, automatedFollowUps } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check active usage
        const usages = await db
          .select({
            id: automatedFollowUps.id,
            propertyId: automatedFollowUps.propertyId,
            trigger: automatedFollowUps.trigger,
            status: automatedFollowUps.status,
          })
          .from(automatedFollowUps)
          .where(eq(automatedFollowUps.templateId, input.id));

        const activeUsages = usages.filter(u => u.status === "Active");

        if (activeUsages.length > 0 && !input.force) {
          return { success: false as const, usageCount: activeUsages.length, usages: activeUsages };
        }

        // Nullify templateId on follow-ups that reference this template (keep snapshot)
        await db.update(automatedFollowUps).set({ templateId: null }).where(eq(automatedFollowUps.templateId, input.id));
        await db.delete(tbl).where(eq(tbl.id, input.id));
        return { success: true as const, usageCount: 0, usages: [] as typeof usages };
      }),

    /**
     * Get all automated follow-ups that reference a specific template,
     * joined with property address for display.
     */
    getUsage: protectedProcedure
      .input(z.object({ templateId: z.number().int() }))
      .query(async ({ input }) => {
        const { automatedFollowUps, properties: propsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const rows = await db
          .select({
            followUpId: automatedFollowUps.id,
            propertyId: automatedFollowUps.propertyId,
            trigger: automatedFollowUps.trigger,
            status: automatedFollowUps.status,
            nextRunAt: automatedFollowUps.nextRunAt,
            address: propsTable.addressLine1,
            city: propsTable.city,
            state: propsTable.state,
          })
          .from(automatedFollowUps)
          .leftJoin(propsTable, eq(automatedFollowUps.propertyId, propsTable.id))
          .where(eq(automatedFollowUps.templateId, input.templateId));
        return rows;
      }),
  }),
  leadSource: router({
    /** Seed defaults + return all sources */
    list: protectedProcedure.query(async () => {
      await db.ensureDefaultLeadSources();
      return db.getLeadSources();
    }),

    /** Add a custom lead source */
    addCustom: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ input }) => {
        return db.addCustomLeadSource(input.name.trim());
      }),

    /** Delete a custom (non-default) lead source */
    deleteCustom: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deleteCustomLeadSource(input.id);
        return { success: true };
      }),

    /** Set the lead source for a property */
    setForProperty: protectedProcedure
      .input(z.object({ propertyId: z.number().int(), leadSource: z.string().nullable() }))
      .mutation(async ({ input }) => {
        await db.setPropertyLeadSource(input.propertyId, input.leadSource);
        return { success: true };
      }),
  }),

  campaignName: router({
    /** Seed defaults + return all campaign names */
    list: protectedProcedure.query(async () => {
      return db.getCampaignNames();
    }),

    /** Add a custom campaign name */
    addCustom: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ input }) => {
        return db.addCustomCampaignName(input.name.trim());
      }),

    /** Delete a custom (non-default) campaign name */
    deleteCustom: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deleteCustomCampaignName(input.id);
        return { success: true };
      }),

    /** Set the campaign name for a property */
    setForProperty: protectedProcedure
      .input(z.object({ propertyId: z.number().int(), campaignName: z.string().nullable() }))
      .mutation(async ({ input }) => {
        await db.setPropertyCampaignName(input.propertyId, input.campaignName);
        return { success: true };
      }),
  }),

  // Call History - view all call logs with filters
  callHistory: router({
    list: protectedProcedure
      .input(
        z.object({
          direction: z.enum(["Inbound", "Outbound", "all"]).optional().default("all"),
          callResult: z.string().optional(),
          search: z.string().optional(),
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          userId: z.number().optional(),
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        return await communication.getCallHistory(input);
      }),

    stats: protectedProcedure.query(async () => {
      return await communication.getCallHistoryStats();
    }),

    // Unified Communications Log (Calls + SMS merged)
    unified: protectedProcedure
      .input(
        z.object({
          commType: z.enum(["call", "sms", "all"]).optional().default("all"),
          direction: z.enum(["Inbound", "Outbound", "all"]).optional().default("all"),
          search: z.string().optional(),
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          userId: z.number().optional(),
          twilioNumber: z.string().optional(), // Filter by specific Twilio number
          statusFilter: z.enum(["unread_sms", "needs_callback"]).optional(), // Quick filter
          deskFilter: z.string().optional(), // Filter by desk name
          limit: z.number().optional().default(200),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        return await communication.getUnifiedCommunications(input);
      }),

    unifiedStats: protectedProcedure.query(async () => {
      return await communication.getUnifiedCommStats();
    }),

    /** Returns count of calls that need callback */
    needsCallbackCount: protectedProcedure.query(async () => {
      const { communicationLog: commLog } = await import("../drizzle/schema");
      const { eq: eqFn, sql: sqlFn } = await import("drizzle-orm");
      const dbInst = await db.getDb();
      if (!dbInst) throw new Error("Database not available");
      const result = await dbInst
        .select({ count: sqlFn<number>`COUNT(*)` })
        .from(commLog)
        .where(eqFn(commLog.needsCallback, 1));
      return { count: Number(result[0]?.count ?? 0) };
    }),

    /** Manually mark a call as callback done (needsCallback=0) */
    markCallbackDone: protectedProcedure
      .input(z.object({ logId: z.number() }))
      .mutation(async ({ input }) => {
        const { communicationLog: commLog } = await import("../drizzle/schema");
        const { eq: eqFn } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");
        await dbInst.update(commLog).set({ needsCallback: 0 }).where(eqFn(commLog.id, input.logId));
        return { success: true };
      }),

    /** Classify a call as telemarketing, wholesale, or others */
    classifyCall: protectedProcedure
      .input(z.object({
        logId: z.number(),
        classification: z.enum(["telemarketing", "wholesale", "others"]).nullable(),
      }))
      .mutation(async ({ input }) => {
        const { communicationLog: commLog } = await import("../drizzle/schema");
        const { eq: eqFn } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");
        await dbInst.update(commLog).set({ callClassification: input.classification }).where(eqFn(commLog.id, input.logId));
        return { success: true };
      }),

    /** Mark a single SMS message as read by its ID */
    markSingleSmsRead: protectedProcedure
      .input(z.object({ smsId: z.number() }))
      .mutation(async ({ input }) => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const { eq: eqFn } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");
        await dbInst.update(smsTable).set({ isRead: 1 }).where(eqFn(smsTable.id, input.smsId));
        return { success: true };
      }),

    /** Undo: mark a single SMS back as unread (isRead=0) */
    markSmsUnread: protectedProcedure
      .input(z.object({ smsId: z.number() }))
      .mutation(async ({ input }) => {
        const { smsMessages: smsTable } = await import("../drizzle/schema");
        const { eq: eqFn } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");
        await dbInst.update(smsTable).set({ isRead: 0 }).where(eqFn(smsTable.id, input.smsId));
        return { success: true };
      }),

    // Returns all active Twilio numbers for filter dropdown
    getTwilioNumbers: protectedProcedure.query(async () => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new Error("Database not available");
      const { twilioNumbers } = await import("../drizzle/schema.js");
      const nums = await dbInstance
        .select({
          id: twilioNumbers.id,
          phoneNumber: twilioNumbers.phoneNumber,
          label: twilioNumbers.label,
          isActive: twilioNumbers.isActive,
        })
        .from(twilioNumbers)
        .orderBy(twilioNumbers.sortOrder, twilioNumbers.label);
      return nums;
    }),
  }),
  // ─── Voicemails ─────────────────────────────────────────────────────────────
  voicemails: router({
    /**
     * List all voicemails, newest first. Optionally filter by unheard only.
     */
    list: protectedProcedure
      .input(z.object({
        unheardOnly: z.boolean().optional().default(false),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        const { voicemails: vmTable, contacts, contactPhones, properties: propsTable } = await import("../drizzle/schema");
        const { eq, desc, and } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");

        const conditions = input.unheardOnly ? [eq(vmTable.isHeard, 0)] : [];
        const rows = await dbInst
          .select()
          .from(vmTable)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(vmTable.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        // Enrich with property address and contact name
        const enriched = await Promise.all(rows.map(async (vm) => {
          let propertyAddress: string | null = null;
          let contactName: string | null = null;
          if (vm.propertyId) {
            const prop = await dbInst
              .select({ addressLine1: propsTable.addressLine1, city: propsTable.city, state: propsTable.state })
              .from(propsTable)
              .where(eq(propsTable.id, vm.propertyId))
              .limit(1);
            if (prop.length > 0) {
              propertyAddress = `${prop[0].addressLine1}, ${prop[0].city}, ${prop[0].state}`;
            }
          }
          if (vm.contactId) {
            const contact = await dbInst
              .select({ name: contacts.name, firstName: contacts.firstName, lastName: contacts.lastName })
              .from(contacts)
              .where(eq(contacts.id, vm.contactId))
              .limit(1);
            if (contact.length > 0) {
              const c = contact[0];
              contactName = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || null;
            }
          }
          return { ...vm, propertyAddress, contactName };
        }));

        return enriched;
      }),

    /**
     * Mark a voicemail as heard
     */
    markHeard: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { voicemails: vmTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");
        await dbInst.update(vmTable).set({
          isHeard: 1,
          heardByUserId: ctx.user.id,
          heardAt: new Date(),
        }).where(eq(vmTable.id, input.id));
        return { success: true };
      }),

    /**
     * Get count of unheard voicemails (for sidebar badge)
     */
    getUnheardCount: protectedProcedure.query(async () => {
      const { voicemails: vmTable } = await import("../drizzle/schema");
      const { eq, count } = await import("drizzle-orm");
      const dbInst = await db.getDb();
      if (!dbInst) return { count: 0 };
      const result = await dbInst
        .select({ count: count() })
        .from(vmTable)
        .where(eq(vmTable.isHeard, 0));
      return { count: result[0]?.count ?? 0 };
    }),

    /**
     * Delete a voicemail
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { voicemails: vmTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");
        await dbInst.delete(vmTable).where(eq(vmTable.id, input.id));
        return { success: true };
      }),

    /**
     * Upload voicemail greeting MP3 and store URL in integrationSettings
     */
    uploadGreeting: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        mimeType: z.string().default("audio/mpeg"),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `voicemail-greetings/greeting-${randomSuffix}.mp3`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Upsert the greetingUrl in integrationSettings
        const { integrationSettings: iSettings } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const dbInst = await db.getDb();
        if (!dbInst) throw new Error("Database not available");

        const existing = await dbInst
          .select()
          .from(iSettings)
          .where(and(eq(iSettings.integration, "voicemail"), eq(iSettings.settingKey, "greetingUrl")))
          .limit(1);

        if (existing.length > 0) {
          await dbInst
            .update(iSettings)
            .set({ settingValue: url, updatedBy: ctx.user.id })
            .where(eq(iSettings.id, existing[0].id));
        } else {
          await dbInst.insert(iSettings).values({
            integration: "voicemail",
            settingKey: "greetingUrl",
            settingValue: url,
            label: "Voicemail Greeting MP3 URL",
            description: "Public URL of the MP3 file played when an inbound call goes unanswered",
            isSecret: 0,
            updatedBy: ctx.user.id,
          });
        }

        const { clearIntegrationCache } = await import("./integrationConfig");
        clearIntegrationCache();

        return { url };
      }),

    /**
     * Get current voicemail greeting URL
     */
    getGreeting: protectedProcedure.query(async () => {
      const { integrationSettings: iSettings } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const dbInst = await db.getDb();
      if (!dbInst) return { url: null };
      const rows = await dbInst
        .select()
        .from(iSettings)
        .where(and(eq(iSettings.integration, "voicemail"), eq(iSettings.settingKey, "greetingUrl")))
        .limit(1);
      return { url: rows[0]?.settingValue || null };
    }),
  }),
});
export type AppRouter = typeof appRouter;;