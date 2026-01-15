import { getDb } from "./db";
import { 
  properties, 
  contacts, 
  contactPhones, 
  contactEmails,
  notes,
  tasks,
  photos,
  visits,
  leadAssignments,
  familyMembers,
  leadMergeHistory,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Merge two leads: transfer all data from secondary lead to primary lead
 * and delete the secondary lead
 */
export async function mergeLeads(
  primaryLeadId: number,
  secondaryLeadId: number,
  mergedBy: number,
  reason?: string
): Promise<{
  success: boolean;
  itemsMerged: {
    contacts: number;
    phones: number;
    emails: number;
    notes: number;
    tasks: number;
    photos: number;
    visits: number;
    agents: number;
    familyMembers: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get both properties for history snapshot
  const [primaryLead] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, primaryLeadId))
    .limit(1);

  const [secondaryLead] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, secondaryLeadId))
    .limit(1);

  if (!primaryLead || !secondaryLead) {
    throw new Error("One or both leads not found");
  }

  const itemsMerged = {
    contacts: 0,
    phones: 0,
    emails: 0,
    notes: 0,
    tasks: 0,
    photos: 0,
    visits: 0,
    agents: 0,
    familyMembers: 0,
  };

  // Start transaction
  await db.transaction(async (tx) => {
    // 1. Transfer contacts
    const secondaryContacts = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.propertyId, secondaryLeadId));

    for (const contact of secondaryContacts) {
      await tx
        .update(contacts)
        .set({ propertyId: primaryLeadId })
        .where(eq(contacts.id, contact.id));
      itemsMerged.contacts++;
    }

    // 2. Transfer contact phones (linked via contacts)
    // Phones are already transferred when contacts are transferred
    // Just count them for reporting
    for (const contact of secondaryContacts) {
      const phones = await tx
        .select()
        .from(contactPhones)
        .where(eq(contactPhones.contactId, contact.id));
      itemsMerged.phones += phones.length;
    }

    // 3. Transfer contact emails (linked via contacts)
    // Emails are already transferred when contacts are transferred
    // Just count them for reporting
    for (const contact of secondaryContacts) {
      const emails = await tx
        .select()
        .from(contactEmails)
        .where(eq(contactEmails.contactId, contact.id));
      itemsMerged.emails += emails.length;
    }

    // 4. Transfer notes
    const secondaryNotes = await tx
      .select()
      .from(notes)
      .where(eq(notes.propertyId, secondaryLeadId));

    for (const note of secondaryNotes) {
      await tx
        .update(notes)
        .set({ propertyId: primaryLeadId })
        .where(eq(notes.id, note.id));
      itemsMerged.notes++;
    }

    // 5. Transfer tasks
    const secondaryTasks = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.propertyId, secondaryLeadId));

    for (const task of secondaryTasks) {
      await tx
        .update(tasks)
        .set({ propertyId: primaryLeadId })
        .where(eq(tasks.id, task.id));
      itemsMerged.tasks++;
    }

    // 6. Transfer photos
    const secondaryPhotos = await tx
      .select()
      .from(photos)
      .where(eq(photos.propertyId, secondaryLeadId));

    for (const photo of secondaryPhotos) {
      await tx
        .update(photos)
        .set({ propertyId: primaryLeadId })
        .where(eq(photos.id, photo.id));
      itemsMerged.photos++;
    }

    // 7. Transfer visits
    const secondaryVisits = await tx
      .select()
      .from(visits)
      .where(eq(visits.propertyId, secondaryLeadId));

    for (const visit of secondaryVisits) {
      await tx
        .update(visits)
        .set({ propertyId: primaryLeadId })
        .where(eq(visits.id, visit.id));
      itemsMerged.visits++;
    }

    // 8. Transfer agent assignments (avoid duplicates)
    const secondaryAgents = await tx
      .select()
      .from(leadAssignments)
      .where(eq(leadAssignments.propertyId, secondaryLeadId));

    const primaryAgents = await tx
      .select()
      .from(leadAssignments)
      .where(eq(leadAssignments.propertyId, primaryLeadId));

    const primaryAgentIds = new Set(primaryAgents.map(a => a.agentId));

    for (const assignment of secondaryAgents) {
      if (!primaryAgentIds.has(assignment.agentId)) {
        await tx
          .update(leadAssignments)
          .set({ propertyId: primaryLeadId })
          .where(eq(leadAssignments.id, assignment.id));
        itemsMerged.agents++;
      } else {
        // Delete duplicate assignment
        await tx
          .delete(leadAssignments)
          .where(eq(leadAssignments.id, assignment.id));
      }
    }

    // 9. Transfer family members
    const secondaryFamilyMembers = await tx
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.propertyId, secondaryLeadId));

    for (const member of secondaryFamilyMembers) {
      await tx
        .update(familyMembers)
        .set({ propertyId: primaryLeadId })
        .where(eq(familyMembers.id, member.id));
      itemsMerged.familyMembers++;
    }

    // 10. Record merge history (optional - skip if table doesn't exist)
    try {
      await tx.insert(leadMergeHistory).values({
        primaryLeadId,
        secondaryLeadId,
        primaryLeadAddress: `${primaryLead.addressLine1}, ${primaryLead.city}, ${primaryLead.state} ${primaryLead.zipcode}`,
        secondaryLeadAddress: `${secondaryLead.addressLine1}, ${secondaryLead.city}, ${secondaryLead.state} ${secondaryLead.zipcode}`,
        mergedBy,
        reason: reason || null,
        itemsMerged: JSON.stringify(itemsMerged),
      });
    } catch (e) {
      // Table might not exist yet, continue without history
      console.warn("Failed to record merge history:", e);
    }

    // 11. Delete secondary lead
    await tx.delete(properties).where(eq(properties.id, secondaryLeadId));
  });

  return {
    success: true,
    itemsMerged,
  };
}

/**
 * Get merge history for a property
 */
export async function getMergeHistory(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const history = await db
    .select()
    .from(leadMergeHistory)
    .where(eq(leadMergeHistory.primaryLeadId, propertyId));

  return history.map(h => ({
    ...h,
    itemsMerged: h.itemsMerged ? JSON.parse(h.itemsMerged) : {},
  }));
}
