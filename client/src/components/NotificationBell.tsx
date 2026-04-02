import { useState, useEffect } from "react";
import { Bell, X, ExternalLink, CheckCheck, Building2, Zap, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SOURCE_CONFIG = {
  instantly: {
    label: "Instantly",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Zap,
    iconColor: "text-blue-500",
  },
  autocalls: {
    label: "Autocalls",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Phone,
    iconColor: "text-orange-500",
  },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Only admins see notifications
  if (user?.role !== "admin") return null;

  const utils = trpc.useUtils();

  const { data: countData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
  });

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { limit: 30, offset: 0, source: "all", unreadOnly: false },
    { enabled: open }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  // Mark all as read when drawer opens
  useEffect(() => {
    if (open && countData && countData.count > 0) {
      // Small delay so user sees the unread state briefly
      const t = setTimeout(() => markAllRead.mutate(), 1500);
      return () => clearTimeout(t);
    }
  }, [open]);

  const unreadCount = countData?.count ?? 0;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center hover:bg-accent/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 w-96 max-h-[80vh] bg-background border rounded-xl shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => markAllRead.mutate()}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    All read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => { setOpen(false); setLocation("/notifications"); }}
                >
                  View all
                </Button>
                <button
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {isLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  Loading...
                </div>
              )}
              {!isLoading && (!notifications || notifications.length === 0) && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Bell className="h-8 w-8 opacity-30" />
                  <span className="text-sm">No notifications yet</span>
                </div>
              )}
              {notifications?.map((n) => {
                const src = SOURCE_CONFIG[n.source as keyof typeof SOURCE_CONFIG];
                const SrcIcon = src?.icon ?? Building2;
                const address = [n.addressLine1, n.city, n.state].filter(Boolean).join(", ");
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${n.isRead === 0 ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                    onClick={() => {
                      setOpen(false);
                      setLocation(`/properties/${n.propertyId}`);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${src?.color ?? "bg-gray-100"}`}>
                        <SrcIcon className={`h-3.5 w-3.5 ${src?.iconColor ?? "text-gray-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${src?.color}`}>
                            {src?.label ?? n.source}
                          </span>
                          {n.isRead === 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">
                          {address || `Property #${n.propertyId}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {n.campaignName}
                        </p>
                        {n.messageText && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {n.messageText.substring(0, 120)}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
