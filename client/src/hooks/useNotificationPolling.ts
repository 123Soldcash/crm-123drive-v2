/**
 * useNotificationPolling
 *
 * Polls for new inbound SMS and missed calls every 20 seconds.
 * Fires a sonner toast notification when a new item is detected
 * (i.e., the count increased since the last poll).
 *
 * This hook should be mounted once at the app level (e.g., DashboardLayout).
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useNotificationPolling() {
  const { user } = useAuth();

  // Track previous counts to detect increases
  const prevUnreadSms = useRef<number | null>(null);
  const prevNeedsCallback = useRef<number | null>(null);

  const { data: unreadSmsData } = trpc.sms.unreadCount.useQuery(undefined, {
    refetchInterval: 20_000,
    enabled: !!user,
  });

  const { data: callbackData } = trpc.callHistory.needsCallbackCount.useQuery(undefined, {
    refetchInterval: 20_000,
    enabled: !!user,
  });

  // Toast on new unread SMS
  useEffect(() => {
    const current = unreadSmsData?.count ?? 0;
    if (prevUnreadSms.current !== null && current > prevUnreadSms.current) {
      const newCount = current - prevUnreadSms.current;
      toast.message(`📩 ${newCount} new SMS received`, {
        description: "You have unread messages in Communications",
        duration: 6000,
        action: {
          label: "View",
          onClick: () => { window.location.href = "/call-history"; },
        },
      });
    }
    prevUnreadSms.current = current;
  }, [unreadSmsData?.count]);

  // Toast on new missed call
  useEffect(() => {
    const current = callbackData?.count ?? 0;
    if (prevNeedsCallback.current !== null && current > prevNeedsCallback.current) {
      const newCount = current - prevNeedsCallback.current;
      toast.message(`📵 ${newCount} missed call${newCount > 1 ? "s" : ""} need callback`, {
        description: "Check Communications Log to return the call",
        duration: 8000,
        action: {
          label: "View",
          onClick: () => { window.location.href = "/call-history"; },
        },
      });
    }
    prevNeedsCallback.current = current;
  }, [callbackData?.count]);
}
