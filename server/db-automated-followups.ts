import { getDb } from "./db";
import { automatedFollowUps, properties, tasks, notes } from "../drizzle/schema";
import { eq, lt, and, isNull } from "drizzle-orm";
import { toast } from "sonner";

/**
 * Tipos para o Follow-up System
 */
export type FollowUpTrigger = "Cold Lead" | "No Contact" | "Stage Change" | "Custom";
export type FollowUpAction = "Create Task" | "Send Email" | "Send SMS" | "Change Stage";

export interface CreateFollowUpInput {
  propertyId: number;
  type: FollowUpTrigger;
  trigger: string;
  action: FollowUpAction;
  actionDetails: Record<string, any>;
  nextRunAt: Date;
}

export interface FollowUpWithProperty {
  id: number;
  propertyId: number;
  type: FollowUpTrigger;
  trigger: string;
  action: FollowUpAction;
  actionDetails: string;
  status: "Active" | "Paused" | "Completed";
  lastTriggeredAt: Date | null;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
  property?: {
    addressLine1: string;
    city: string;
    state: string;
    zipcode: string;
  };
}

/**
 * Criar um novo follow-up automatizado
 */
export async function createAutomatedFollowUp(input: CreateFollowUpInput) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db.insert(automatedFollowUps).values({
      propertyId: input.propertyId,
      type: input.type,
      trigger: input.trigger,
      action: input.action,
      actionDetails: JSON.stringify(input.actionDetails),
      status: "Active",
      nextRunAt: input.nextRunAt,
    });

    return {
      success: true,
      message: "Follow-up criado com sucesso",
      followUpId: result.insertId,
    };
  } catch (error) {
    console.error("Erro ao criar follow-up:", error);
    return {
      success: false,
      message: "Erro ao criar follow-up",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Listar todos os follow-ups de uma propriedade
 */
export async function getFollowUpsByProperty(propertyId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const followUps = await db
      .select()
      .from(automatedFollowUps)
      .where(eq(automatedFollowUps.propertyId, propertyId));

    return followUps.map((fu) => ({
      ...fu,
      actionDetails: typeof fu.actionDetails === "string" ? JSON.parse(fu.actionDetails) : fu.actionDetails,
    }));
  } catch (error) {
    console.error("Erro ao buscar follow-ups:", error);
    return [];
  }
}

/**
 * Listar follow-ups que devem ser executados agora
 */export async function getPendingFollowUps() {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const pendingFollowUps = await db
      .select({
        followUp: automatedFollowUps,
        property: properties,
      })
      .from(automatedFollowUps)
      .innerJoin(properties, eq(automatedFollowUps.propertyId, properties.id))
      .where(
        and(
          eq(automatedFollowUps.status, "Active"),
          lt(automatedFollowUps.nextRunAt, now)
        )
      );

    return pendingFollowUps.map((item) => ({
      ...item.followUp,
      actionDetails: typeof item.followUp.actionDetails === "string" 
        ? JSON.parse(item.followUp.actionDetails) 
        : item.followUp.actionDetails,
      property: item.property,
    }));
  } catch (error) {
    console.error("Erro ao buscar follow-ups pendentes:", error);
    return [];
  }
}

/**
 * Executar um follow-up e criar a ação correspondente
 */
export async function executeFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const followUp = await db
      .select()
      .from(automatedFollowUps)
      .where(eq(automatedFollowUps.id, followUpId))
      .then((rows) => rows[0]);

    if (!followUp) {
      return { success: false, message: "Follow-up não encontrado" };
    }

    const actionDetails = typeof followUp.actionDetails === "string"
      ? JSON.parse(followUp.actionDetails)
      : followUp.actionDetails;

    let actionResult: any = null;

    // Executar a ação apropriada
    switch (followUp.action) {
      case "Create Task":
        actionResult = await createFollowUpTask(followUp.propertyId, actionDetails);
        break;

      case "Send Email":
        actionResult = await scheduleFollowUpEmail(followUp.propertyId, actionDetails);
        break;

      case "Send SMS":
        actionResult = await scheduleFollowUpSMS(followUp.propertyId, actionDetails);
        break;

      case "Change Stage":
        actionResult = await changePropertyStage(followUp.propertyId, actionDetails.newStage);
        break;

      default:
        return { success: false, message: "Ação desconhecida" };
    }

    // Atualizar o follow-up com o timestamp de execução
    const nextRunAt = calculateNextRunDate(followUp.trigger);

    await db
      .update(automatedFollowUps)
      .set({
        lastTriggeredAt: new Date(),
        nextRunAt: nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(automatedFollowUps.id, followUpId));

    return {
      success: true,
      message: `Follow-up executado com sucesso: ${followUp.action}`,
      actionResult,
    };
  } catch (error) {
    console.error("Erro ao executar follow-up:", error);
    return {
      success: false,
      message: "Erro ao executar follow-up",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Criar uma tarefa de follow-up
 */
async function createFollowUpTask(propertyId: number, actionDetails: any) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db.insert(tasks).values({
      title: actionDetails.title || "Follow-up Automático",
      description: actionDetails.description || "Tarefa criada automaticamente pelo sistema de follow-up",
      taskType: "Follow-up",
      priority: actionDetails.priority || "Medium",
      status: "To Do",
      propertyId,
      dueDate: actionDetails.dueDate ? new Date(actionDetails.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdById: 1, // System user
      assignedToId: actionDetails.assignedToId || null,
    });

    return {
      success: true,
      taskId: result.insertId,
      message: "Tarefa de follow-up criada",
    };
  } catch (error) {
    console.error("Erro ao criar tarefa de follow-up:", error);
    return {
      success: false,
      message: "Erro ao criar tarefa",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Agendar um email de follow-up (placeholder para integração futura)
 */
async function scheduleFollowUpEmail(propertyId: number, actionDetails: any) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // TODO: Integrar com serviço de email (SendGrid, AWS SES, etc.)
    // Por enquanto, apenas criar uma nota no sistema
    const result = await db.insert(notes).values({
      propertyId,
      content: `Email agendado: ${actionDetails.subject || "Follow-up automático"}`,
      createdBy: 1, // System user
    });

    return {
      success: true,
      noteId: result.insertId,
      message: "Email de follow-up agendado",
      note: "Email será enviado quando o serviço de email estiver configurado",
    };
  } catch (error) {
    console.error("Erro ao agendar email:", error);
    return {
      success: false,
      message: "Erro ao agendar email",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Agendar um SMS de follow-up (placeholder para integração com Twilio)
 */
async function scheduleFollowUpSMS(propertyId: number, actionDetails: any) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // TODO: Integrar com Twilio para enviar SMS
    // Por enquanto, apenas criar uma nota no sistema
    const result = await db.insert(notes).values({
      propertyId,
      content: `SMS agendado: ${actionDetails.message || "Follow-up automático"}`,
      createdBy: 1, // System user
    });

    return {
      success: true,
      noteId: result.insertId,
      message: "SMS de follow-up agendado",
      note: "SMS será enviado quando o Twilio estiver configurado",
    };
  } catch (error) {
    console.error("Erro ao agendar SMS:", error);
    return {
      success: false,
      message: "Erro ao agendar SMS",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Mudar o estágio de uma propriedade
 */
async function changePropertyStage(propertyId: number, newStage: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(properties)
      .set({
        dealStage: newStage as any,
        stageChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    return {
      success: true,
      message: `Estágio da propriedade alterado para: ${newStage}`,
    };
  } catch (error) {
    console.error("Erro ao alterar estágio:", error);
    return {
      success: false,
      message: "Erro ao alterar estágio",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Calcular a próxima data de execução do follow-up
 */
function calculateNextRunDate(trigger: string): Date {
  const now = new Date();

  // Exemplos de triggers e seus intervalos
  if (trigger.includes("30 dias")) {
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (trigger.includes("7 dias")) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (trigger.includes("1 dia")) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (trigger.includes("COLD")) {
    // Se o lead ficou frio, fazer follow-up em 3 dias
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  // Padrão: 7 dias
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Pausar um follow-up
 */
export async function pauseFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(automatedFollowUps)
      .set({
        status: "Paused",
        updatedAt: new Date(),
      })
      .where(eq(automatedFollowUps.id, followUpId));

    return { success: true, message: "Follow-up pausado" };
  } catch (error) {
    console.error("Erro ao pausar follow-up:", error);
    return {
      success: false,
      message: "Erro ao pausar follow-up",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Retomar um follow-up pausado
 */
export async function resumeFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(automatedFollowUps)
      .set({
        status: "Active",
        updatedAt: new Date(),
      })
      .where(eq(automatedFollowUps.id, followUpId));

    return { success: true, message: "Follow-up retomado" };
  } catch (error) {
    console.error("Erro ao retomar follow-up:", error);
    return {
      success: false,
      message: "Erro ao retomar follow-up",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Deletar um follow-up
 */
export async function deleteFollowUp(followUpId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .delete(automatedFollowUps)
      .where(eq(automatedFollowUps.id, followUpId));

    return { success: true, message: "Follow-up deletado" };
  } catch (error) {
    console.error("Erro ao deletar follow-up:", error);
    return {
      success: false,
      message: "Erro ao deletar follow-up",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
