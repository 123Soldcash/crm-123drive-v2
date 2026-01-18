import { toast } from "sonner";

/**
 * Notification types
 */
export type NotificationType = "success" | "error" | "info" | "warning";

/**
 * Interface for configuring notifications
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
 * Notification service for the Follow-up System
 */
export const followUpNotifications = {
  /**
   * Notify when a follow-up was successfully created
   */
  followUpCreated: (trigger: string) => {
    toast.success(`Follow-up created: ${trigger}`, {
      description: "The system will execute automatically when the trigger is activated",
      duration: 4000,
    });
  },

  /**
   * Notify when a follow-up was executed
   */
  followUpExecuted: (action: string, propertyAddress: string) => {
    toast.success(`Follow-up executed: ${action}`, {
      description: `Action performed for: ${propertyAddress}`,
      duration: 4000,
    });
  },

  /**
   * Notify when there are pending follow-ups
   */
  pendingFollowUpsAlert: (count: number) => {
    toast.warning(`${count} pending follow-up(s)`, {
      description: "Click to view and execute",
      duration: 5000,
    });
  },

  /**
   * Notify when a follow-up was paused
   */
  followUpPaused: (trigger: string) => {
    toast.info(`Follow-up paused: ${trigger}`, {
      duration: 3000,
    });
  },

  /**
   * Notify when a follow-up was resumed
   */
  followUpResumed: (trigger: string) => {
    toast.info(`Follow-up resumed: ${trigger}`, {
      duration: 3000,
    });
  },

  /**
   * Notify when a follow-up was deleted
   */
  followUpDeleted: (trigger: string) => {
    toast.info(`Follow-up deleted: ${trigger}`, {
      duration: 3000,
    });
  },

  /**
   * Notify error when creating follow-up
   */
  followUpCreationError: (error: string) => {
    toast.error("Error creating follow-up", {
      description: error,
      duration: 4000,
    });
  },

  /**
   * Notify error when executing follow-up
   */
  followUpExecutionError: (error: string) => {
    toast.error("Error executing follow-up", {
      description: error,
      duration: 4000,
    });
  },

  /**
   * Notify when multiple follow-ups were executed
   */
  bulkFollowUpsExecuted: (count: number) => {
    toast.success(`${count} follow-up(s) executed`, {
      description: "All actions were performed successfully",
      duration: 4000,
    });
  },

  /**
   * Notify when a lead became cold and needs follow-up
   */
  coldLeadAlert: (propertyAddress: string, daysSinceContact: number) => {
    toast.warning(`Cold lead detected`, {
      description: `${propertyAddress} - No contact for ${daysSinceContact} days`,
      duration: 5000,
    });
  },

  /**
   * Notify when a lead had no contact
   */
  noContactAlert: (propertyAddress: string) => {
    toast.warning(`No contact`, {
      description: `${propertyAddress} - No contact recorded`,
      duration: 5000,
    });
  },
};

/**
 * Hook to show follow-up notifications (for use in React components)
 */
export function useFollowUpNotifications() {
  return followUpNotifications;
}

/**
 * Function to schedule real-time notifications
 * (Can be expanded to use Web Notifications API or WebSockets)
 */
export function scheduleFollowUpNotification(
  followUpId: number,
  nextRunAt: Date,
  trigger: string
) {
  const now = new Date();
  const timeUntilExecution = nextRunAt.getTime() - now.getTime();

  if (timeUntilExecution > 0) {
    // Schedule notification for 5 minutes before execution
    const notificationTime = timeUntilExecution - 5 * 60 * 1000;

    if (notificationTime > 0) {
      setTimeout(() => {
        toast.info(`Follow-up will be executed in 5 minutes`, {
          description: trigger,
          duration: 5000,
        });
      }, notificationTime);
    }
  }
}
