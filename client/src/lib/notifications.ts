import { toast } from "sonner";

/**
 * Tipos de notificações
 */
export type NotificationType = "success" | "error" | "info" | "warning";

/**
 * Interface para configurar notificações
 */
export interface NotificationConfig {
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Serviço de notificações para o Follow-up System
 */
export const followUpNotifications = {
  /**
   * Notificar quando um follow-up foi criado com sucesso
   */
  followUpCreated: (trigger: string) => {
    toast.success(`Follow-up criado: ${trigger}`, {
      description: "O sistema executará automaticamente quando o gatilho for acionado",
      duration: 4000,
    });
  },

  /**
   * Notificar quando um follow-up foi executado
   */
  followUpExecuted: (action: string, propertyAddress: string) => {
    toast.success(`Follow-up executado: ${action}`, {
      description: `Ação realizada para: ${propertyAddress}`,
      duration: 4000,
    });
  },

  /**
   * Notificar quando há follow-ups pendentes
   */
  pendingFollowUpsAlert: (count: number) => {
    toast.warning(`${count} follow-up(s) pendente(s)`, {
      description: "Clique para visualizar e executar",
      duration: 5000,
    });
  },

  /**
   * Notificar quando um follow-up foi pausado
   */
  followUpPaused: (trigger: string) => {
    toast.info(`Follow-up pausado: ${trigger}`, {
      duration: 3000,
    });
  },

  /**
   * Notificar quando um follow-up foi retomado
   */
  followUpResumed: (trigger: string) => {
    toast.info(`Follow-up retomado: ${trigger}`, {
      duration: 3000,
    });
  },

  /**
   * Notificar quando um follow-up foi deletado
   */
  followUpDeleted: (trigger: string) => {
    toast.info(`Follow-up deletado: ${trigger}`, {
      duration: 3000,
    });
  },

  /**
   * Notificar erro ao criar follow-up
   */
  followUpCreationError: (error: string) => {
    toast.error("Erro ao criar follow-up", {
      description: error,
      duration: 4000,
    });
  },

  /**
   * Notificar erro ao executar follow-up
   */
  followUpExecutionError: (error: string) => {
    toast.error("Erro ao executar follow-up", {
      description: error,
      duration: 4000,
    });
  },

  /**
   * Notificar quando múltiplos follow-ups foram executados
   */
  bulkFollowUpsExecuted: (count: number) => {
    toast.success(`${count} follow-up(s) executado(s)`, {
      description: "Todas as ações foram realizadas com sucesso",
      duration: 4000,
    });
  },

  /**
   * Notificar quando um lead ficou frio e precisa de follow-up
   */
  coldLeadAlert: (propertyAddress: string, daysSinceContact: number) => {
    toast.warning(`Lead frio detectado`, {
      description: `${propertyAddress} - Sem contato há ${daysSinceContact} dias`,
      duration: 5000,
    });
  },

  /**
   * Notificar quando um lead não teve contato
   */
  noContactAlert: (propertyAddress: string) => {
    toast.warning(`Sem contato`, {
      description: `${propertyAddress} - Nenhum contato registrado`,
      duration: 5000,
    });
  },
};

/**
 * Hook para mostrar notificações de follow-up (para uso em componentes React)
 */
export function useFollowUpNotifications() {
  return followUpNotifications;
}

/**
 * Função para agendar notificações em tempo real
 * (Pode ser expandida para usar Web Notifications API ou WebSockets)
 */
export function scheduleFollowUpNotification(
  followUpId: number,
  nextRunAt: Date,
  trigger: string
) {
  const now = new Date();
  const timeUntilExecution = nextRunAt.getTime() - now.getTime();

  if (timeUntilExecution > 0) {
    // Agendar notificação para 5 minutos antes da execução
    const notificationTime = timeUntilExecution - 5 * 60 * 1000;

    if (notificationTime > 0) {
      setTimeout(() => {
        toast.info(`Follow-up será executado em 5 minutos`, {
          description: trigger,
          duration: 5000,
        });
      }, notificationTime);
    }
  }
}
