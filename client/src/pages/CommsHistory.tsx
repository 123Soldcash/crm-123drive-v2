import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import {
  Search,
  CheckCheck,
  ExternalLink,
  Mail,
  PhoneCall,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

const PAGE_SIZE = 25;

export default function CommsHistory() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"instantly" | "autocalls">("instantly");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  // Debounce search
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 400);
    setSearchTimer(timer);
  };

  // Fetch data for current tab
  const { data, isLoading, refetch } = trpc.notifications.list.useQuery({
    source: activeTab,
    search: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  // Unread counts
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "instantly" | "autocalls");
    setPage(0);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate({ source: activeTab });
  };

  const handleRowClick = (notification: any) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      markReadMutation.mutate({ id: notification.id });
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const truncateMessage = (text: string | null, maxLen = 80) => {
    if (!text) return "—";
    return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
  };

  const instantlyUnread = unreadData?.instantly ?? 0;
  const autocallsUnread = unreadData?.autocalls ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Communication History</h1>
        <p className="text-muted-foreground mt-1">
          View all incoming messages from Instantly and Autocalls via Slack integration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="instantly" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Instantly
              {instantlyUnread > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                  {instantlyUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="autocalls" className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Autocalls
              {autocallsUnread > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                  {autocallsUnread}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by property, campaign, message..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Table content (shared layout for both tabs) */}
        <TabsContent value="instantly" className="mt-4">
          <NotificationTable
            rows={rows}
            total={total}
            totalPages={totalPages}
            page={page}
            setPage={setPage}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            formatDate={formatDate}
            truncateMessage={truncateMessage}
            setLocation={setLocation}
            sourceLabel="Instantly"
          />
        </TabsContent>

        <TabsContent value="autocalls" className="mt-4">
          <NotificationTable
            rows={rows}
            total={total}
            totalPages={totalPages}
            page={page}
            setPage={setPage}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            formatDate={formatDate}
            truncateMessage={truncateMessage}
            setLocation={setLocation}
            sourceLabel="Autocalls"
          />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification?.source === "instantly" ? (
                <Mail className="h-5 w-5 text-blue-500" />
              ) : (
                <PhoneCall className="h-5 w-5 text-green-500" />
              )}
              {selectedNotification?.source === "instantly" ? "Instantly" : "Autocalls"} Message
            </DialogTitle>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">Date</p>
                  <p className="text-sm font-medium">{formatDate(selectedNotification.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">Property ID</p>
                  <button
                    className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                    onClick={() => {
                      setSelectedNotification(null);
                      setLocation(`/properties/${selectedNotification.propertyId}`);
                    }}
                  >
                    #{selectedNotification.propertyId}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">Property</p>
                  <p className="text-sm">
                    {[selectedNotification.addressLine1, selectedNotification.city, selectedNotification.state]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">Campaign</p>
                  <p className="text-sm">
                    {selectedNotification.campaignName || "—"}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Message</p>
                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedNotification.messageText || "No message content"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Reusable Table Component ───────────────────────────────────────────────

interface NotificationTableProps {
  rows: any[];
  total: number;
  totalPages: number;
  page: number;
  setPage: (p: number) => void;
  isLoading: boolean;
  onRowClick: (n: any) => void;
  formatDate: (d: any) => string;
  truncateMessage: (t: string | null, maxLen?: number) => string;
  setLocation: (path: string) => void;
  sourceLabel: string;
}

function NotificationTable({
  rows,
  total,
  totalPages,
  page,
  setPage,
  isLoading,
  onRowClick,
  formatDate,
  truncateMessage,
  setLocation,
  sourceLabel,
}: NotificationTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          {sourceLabel === "Instantly" ? (
            <Mail className="h-12 w-12 mb-3 opacity-30" />
          ) : (
            <PhoneCall className="h-12 w-12 mb-3 opacity-30" />
          )}
          <p className="text-lg font-medium">No {sourceLabel} messages yet</p>
          <p className="text-sm mt-1">Messages from {sourceLabel} via Slack will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {sourceLabel} Messages
            <span className="text-muted-foreground font-normal ml-2">({total} total)</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[170px]">Date</TableHead>
              <TableHead className="w-[80px]">Prop #</TableHead>
              <TableHead className="w-[200px]">Property</TableHead>
              <TableHead className="w-[150px]">Campaign</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                  !row.isRead ? "bg-blue-50/60 dark:bg-blue-950/20 font-medium" : ""
                }`}
                onClick={() => onRowClick(row)}
              >
                <TableCell className="text-center">
                  {!row.isRead && (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell>
                  <button
                    className="text-blue-600 hover:underline font-medium text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/properties/${row.propertyId}`);
                    }}
                  >
                    #{row.propertyId}
                  </button>
                </TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">
                  {[row.addressLine1, row.city, row.state].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  {row.campaignName ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      {row.campaignName}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {truncateMessage(row.messageText)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
