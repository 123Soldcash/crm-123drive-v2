import { useState } from "react";
import { Bell, Building2, Zap, Phone, CheckCheck, ExternalLink, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const SOURCE_CONFIG = {
  instantly: {
    label: "Instantly",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Zap,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  autocalls: {
    label: "Autocalls",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Phone,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
};

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [source, setSource] = useState<"all" | "instantly" | "autocalls">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const utils = trpc.useUtils();

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery({
    source,
    unreadOnly,
    limit: 100,
    offset: 0,
  });

  const { data: countData } = trpc.notifications.unreadCount.useQuery();

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const unreadCount = countData?.count ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                Slack updates from Instantly and Autocalls
              </p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg border">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={source} onValueChange={(v) => setSource(v as any)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="instantly">Instantly</SelectItem>
                <SelectItem value="autocalls">Autocalls</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={unreadOnly ? "default" : "outline"}
              size="sm"
              className="h-8 text-sm"
              onClick={() => setUnreadOnly(!unreadOnly)}
            >
              {unreadOnly ? "Unread only" : "All notifications"}
            </Button>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {notifications?.rows.length ?? 0} results
          </div>
        </div>

        {/* Notification List */}
        <div className="space-y-2">
          {isLoading && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Loading notifications...
            </div>
          )}

          {!isLoading && (!notifications || notifications.rows.length === 0) && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Bell className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">No notifications found</p>
              <p className="text-xs">
                {unreadOnly
                  ? "All caught up! No unread notifications."
                  : "Notifications will appear here when Slack messages are processed."}
              </p>
            </div>
          )}

          {notifications?.rows.map((n: any) => {
            const src = SOURCE_CONFIG[n.source as keyof typeof SOURCE_CONFIG];
            const SrcIcon = src?.icon ?? Building2;
            const address = [n.addressLine1, n.city, n.state].filter(Boolean).join(", ");

            return (
              <div
                key={n.id}
                className={`rounded-xl border p-4 transition-all cursor-pointer hover:shadow-sm hover:border-primary/30 ${
                  n.isRead === 0
                    ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60"
                    : "bg-background"
                }`}
                onClick={() => {
                  if (n.isRead === 0) markRead.mutate({ id: n.id });
                  setLocation(`/properties/${n.propertyId}`);
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Source Icon */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${src?.iconBg ?? "bg-gray-100"}`}>
                    <SrcIcon className={`h-5 w-5 ${src?.iconColor ?? "text-gray-500"}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${src?.color}`}>
                        {src?.label ?? n.source}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {n.campaignName}
                      </span>
                      {n.isRead === 0 && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold text-foreground truncate">
                        {address || `Property #${n.propertyId}`}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        #{n.propertyId}
                      </span>
                    </div>

                    {n.messageText && (
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mt-1">
                        {n.messageText}
                      </p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(n.createdAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/properties/${n.propertyId}`);
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
