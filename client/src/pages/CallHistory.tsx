import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { openDialer } from "@/lib/dialerEvents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  MessageSquare,
  MessageSquareText,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Clock,
  PhoneMissed,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Hash,
  PhoneCall,
  CheckCircle2,
  Mail,
  MailOpen,
  BellOff,
  PhoneForwarded,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CommType = "all" | "call" | "sms";
type SortField = "date" | "type" | "direction" | "property" | "agent" | "phoneNumber" | "desk";
type SortOrder = "asc" | "desc";

function getTypeBadge(type: "call" | "sms") {
  if (type === "call") {
    return (
      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1 text-xs">
        <Phone className="h-3 w-3" />
        Call
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
      <MessageSquare className="h-3 w-3" />
      SMS
    </Badge>
  );
}

function getDirectionBadge(direction: string | null, type: "call" | "sms") {
  const isInbound = direction === "Inbound";
  if (type === "call") {
    return isInbound ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
        <PhoneIncoming className="h-3 w-3" />
        Inbound
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
        <PhoneOutgoing className="h-3 w-3" />
        Outbound
      </Badge>
    );
  }
  // SMS
  return isInbound ? (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
      <ArrowDownLeft className="h-3 w-3" />
      Received
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
      <ArrowUpRight className="h-3 w-3" />
      Sent
    </Badge>
  );
}

function getSmsStatusBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, string> = {
    delivered: "bg-green-100 text-green-700 border-green-200",
    sent: "bg-blue-100 text-blue-700 border-blue-200",
    received: "bg-green-100 text-green-700 border-green-200",
    queued: "bg-yellow-100 text-yellow-700 border-yellow-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    undelivered: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`${map[status] || "bg-gray-100 text-gray-700 border-gray-200"} text-[10px]`}>
      {status}
    </Badge>
  );
}

export default function CallHistory() {
  const [, navigate] = useLocation();
  const [commType, setCommType] = useState<CommType>("all");
  const [direction, setDirection] = useState<"all" | "Inbound" | "Outbound">("all");
  const [search, setSearch] = useState("");
  const [twilioNumberFilter, setTwilioNumberFilter] = useState<string>("all");
  const [deskFilter, setDeskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"unread_sms" | "needs_callback" | "all">("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Fetch all Twilio numbers for the filter dropdown
  const { data: twilioNumbers } = trpc.callHistory.getTwilioNumbers.useQuery();
  // Fetch all desks for the filter dropdown
  const { data: desksList } = trpc.desks.list.useQuery();

  const { data: records, isLoading, refetch } = trpc.callHistory.unified.useQuery({
    commType,
    direction: direction as any,
    search: search || undefined,
    twilioNumber: twilioNumberFilter !== "all" ? twilioNumberFilter : undefined,
    deskFilter: deskFilter !== "all" ? deskFilter : undefined,
    statusFilter: statusFilter !== "all" ? statusFilter : undefined,
    limit: 500,
    offset: 0,
  });

  const { data: stats } = trpc.callHistory.unifiedStats.useQuery();
  const { data: unreadSmsData } = trpc.sms.unreadCount.useQuery(undefined, { refetchInterval: 20_000 });
  const { data: callbackData } = trpc.callHistory.needsCallbackCount.useQuery(undefined, { refetchInterval: 20_000 });
  const utils = trpc.useUtils();

  const markCallbackDone = trpc.callHistory.markCallbackDone.useMutation({
    onSuccess: () => {
      refetch();
      utils.callHistory.needsCallbackCount.invalidate();
      toast.success("Call marked as returned", { description: "Removed from callback queue" });
    },
  });

  const markSmsUnread = trpc.callHistory.markSmsUnread.useMutation({
    onSuccess: () => {
      refetch();
      utils.sms.unreadCount.invalidate();
    },
  });

  const markSmsRead = trpc.callHistory.markSingleSmsRead.useMutation({
    onSuccess: (_, variables) => {
      refetch();
      utils.sms.unreadCount.invalidate();
      toast("SMS marked as read", {
        description: "Tap Undo to revert",
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => {
            markSmsUnread.mutate({ smsId: variables.smsId });
          },
        },
      });
    },
  });

  const sortedRecords = useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => {
      const mult = sortOrder === "asc" ? 1 : -1;
      switch (sortField) {
        case "date":
          return mult * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case "type":
          return mult * a.type.localeCompare(b.type);
        case "direction":
          return mult * ((a.direction || "").localeCompare(b.direction || ""));
        case "property":
          return mult * ((a.propertyAddress || "").localeCompare(b.propertyAddress || ""));
        case "agent":
          return mult * ((a.agentName || "").localeCompare(b.agentName || ""));
        case "phoneNumber":
          return mult * ((a.phoneNumber || "").localeCompare(b.phoneNumber || ""));
        case "desk":
          return mult * ((a.deskName || "").localeCompare(b.deskName || ""));
        default:
          return 0;
      }
    });
  }, [records, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
      </div>
    </TableHead>
  );

  const hasFilters = search || direction !== "all" || commType !== "all" || twilioNumberFilter !== "all" || deskFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareText className="h-6 w-6 text-primary" />
            Communications Log
          </h1>
          <p className="text-muted-foreground mt-1">
            All calls and SMS messages in one place, sorted by date
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground font-medium">Total</p>
            <p className="text-xl font-bold">{stats?.totalAll ?? 0}</p>
          </CardContent>
        </Card>
        {/* Calls */}
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs text-muted-foreground font-medium">Calls</p>
            </div>
            <p className="text-xl font-bold text-violet-600">{stats?.totalCalls ?? 0}</p>
          </CardContent>
        </Card>
        {/* SMS */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-muted-foreground font-medium">SMS</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">{stats?.totalSms ?? 0}</p>
          </CardContent>
        </Card>
        {/* Inbound */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />
              <p className="text-xs text-muted-foreground font-medium">Inbound</p>
            </div>
            <p className="text-xl font-bold text-green-600">{stats?.inboundAll ?? 0}</p>
          </CardContent>
        </Card>
        {/* Outbound */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs text-muted-foreground font-medium">Outbound</p>
            </div>
            <p className="text-xl font-bold text-blue-600">{stats?.outboundAll ?? 0}</p>
          </CardContent>
        </Card>
        {/* Inbound Calls specifically */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <PhoneIncoming className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-muted-foreground font-medium">Inbound Calls</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{stats?.inboundCalls ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            setStatusFilter(statusFilter === "unread_sms" ? "all" : "unread_sms");
            setCommType("all");
            setDirection("all");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
            statusFilter === "unread_sms"
              ? "bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]"
              : "bg-white border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          <Mail className="h-4 w-4" />
          Unread SMS
          {(unreadSmsData?.count ?? 0) > 0 && (
            <span className={`inline-flex items-center justify-center rounded-full text-xs font-bold min-w-[20px] h-5 px-1.5 ${
              statusFilter === "unread_sms" ? "bg-white text-blue-700" : "bg-blue-600 text-white"
            }`}>
              {unreadSmsData?.count}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setStatusFilter(statusFilter === "needs_callback" ? "all" : "needs_callback");
            setCommType("all");
            setDirection("all");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
            statusFilter === "needs_callback"
              ? "bg-orange-500 border-orange-500 text-white shadow-md scale-[1.02]"
              : "bg-white border-orange-200 text-orange-700 hover:border-orange-400 hover:bg-orange-50"
          }`}
        >
          <PhoneMissed className="h-4 w-4" />
          Needs Callback
          {(callbackData?.count ?? 0) > 0 && (
            <span className={`inline-flex items-center justify-center rounded-full text-xs font-bold min-w-[20px] h-5 px-1.5 ${
              statusFilter === "needs_callback" ? "bg-white text-orange-600" : "bg-orange-500 text-white"
            }`}>
              {callbackData?.count}
            </span>
          )}
        </button>
        {statusFilter !== "all" && (
          <button
            onClick={() => setStatusFilter("all")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all"
          >
            ✕ Clear quick filter
          </button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, address, agent, or message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Type filter */}
            <Select value={commType} onValueChange={(v) => setCommType(v as CommType)}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call">Calls Only</SelectItem>
                <SelectItem value="sms">SMS Only</SelectItem>
              </SelectContent>
            </Select>
            {/* Direction filter */}
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="Outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            {/* Twilio Number filter */}
            <Select value={twilioNumberFilter} onValueChange={setTwilioNumberFilter}>
              <SelectTrigger className="w-[200px]">
                <Hash className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All Numbers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Numbers</SelectItem>
                {twilioNumbers?.map((num) => (
                  <SelectItem key={num.id} value={num.phoneNumber}>
                    <span className="font-medium">{num.label}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">{num.phoneNumber}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Desk filter */}
            <Select value={deskFilter} onValueChange={setDeskFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Desks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Desks</SelectItem>
                {desksList?.map((desk) => (
                  <SelectItem key={desk.id} value={desk.description || desk.name}>
                    {desk.description || desk.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDirection("all");
                  setCommType("all");
                  setTwilioNumberFilter("all");
                  setDeskFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Communications Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Communications ({sortedRecords.length} {sortedRecords.length === 1 ? "record" : "records"})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PhoneMissed className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No communications found</p>
              <p className="text-sm">
                {hasFilters
                  ? "Try adjusting your filters"
                  : "Calls and SMS will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader field="date">Date & Time</SortHeader>
                      <SortHeader field="type">Type</SortHeader>
                      <SortHeader field="direction">Direction</SortHeader>
                      <SortHeader field="phoneNumber">Phone Number</SortHeader>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <SortHeader field="property">Property</SortHeader>
                      <SortHeader field="desk">Desk</SortHeader>
                      <SortHeader field="agent">Agent</SortHeader>
                      <TableHead className="w-[60px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRecords.map((rec) => (
                      <TableRow
                        key={`${rec.type}-${rec.id}`}
                        className={`hover:bg-muted/30 ${
                          rec.type === "call" && rec.needsCallback
                            ? "border-l-4 border-l-orange-500 bg-orange-50/40"
                            : rec.type === "sms"
                            ? "border-l-2 border-l-emerald-400"
                            : "border-l-2 border-l-violet-400"
                        }`}
                      >
                        {/* Date & Time */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">
                                {new Date(rec.date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(rec.date).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Type */}
                        <TableCell>{getTypeBadge(rec.type)}</TableCell>

                        {/* Direction */}
                        <TableCell>{getDirectionBadge(rec.direction, rec.type)}</TableCell>

                        {/* Phone Number */}
                        <TableCell>
                          <div className="text-sm">
                            {rec.phoneNumber ? (
                              <div>
                                {rec.type === "call" && rec.needsCallback && rec.twilioNumber ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => {
                                          openDialer({
                                            phone: rec.phoneNumber!,
                                            callerId: rec.twilioNumber!,
                                            autoCall: false,
                                          });
                                          toast.info(`Dialer opened — calling ${rec.phoneNumber} from ${rec.twilioNumber}`, {
                                            description: "Press Call to connect",
                                          });
                                        }}
                                        className="font-semibold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer flex items-center gap-1.5 group"
                                      >
                                        <PhoneForwarded className="h-3.5 w-3.5 text-orange-500 group-hover:text-orange-700 transition-colors" />
                                        {rec.phoneNumber}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">Click to call back from <strong>{rec.twilioNumber}</strong></p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <div className="font-medium">{rec.phoneNumber}</div>
                                )}
                                {rec.twilioNumber && (
                                  <div className="text-xs text-muted-foreground">
                                    via {rec.twilioNumber}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">&mdash;</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Details — SMS body preview or call disposition */}
                        <TableCell>
                          {rec.type === "sms" && rec.messageBody ? (
                            <div className="max-w-[250px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-muted-foreground truncate cursor-default">
                                    {rec.messageBody}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm">
                                  <p className="text-xs whitespace-pre-wrap">{rec.messageBody}</p>
                                </TooltipContent>
                              </Tooltip>
                              {rec.messageStatus && (
                                <div className="mt-1">{getSmsStatusBadge(rec.messageStatus)}</div>
                              )}
                            </div>
                          ) : rec.type === "call" && rec.disposition ? (
                            <span className="text-xs text-muted-foreground">{rec.disposition}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>

                        {/* Status column */}
                        <TableCell>
                          {rec.type === "call" && rec.needsCallback ? (
                            <button
                              onClick={() => markCallbackDone.mutate({ logId: rec.id })}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-700 text-[10px] font-semibold hover:bg-orange-200 transition-colors cursor-pointer animate-pulse"
                              title="Click to mark as returned"
                            >
                              <PhoneCall className="h-2.5 w-2.5 shrink-0" />
                              Needs Callback
                            </button>
                          ) : rec.type === "sms" && rec.direction === "Inbound" && rec.isRead === 0 ? (
                            <button
                              onClick={() => markSmsRead.mutate({ smsId: rec.id })}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-700 text-[10px] font-semibold hover:bg-blue-200 transition-colors cursor-pointer"
                              title="Click to mark as read"
                            >
                              <Mail className="h-2.5 w-2.5 shrink-0" />
                              Unread
                            </button>
                          ) : rec.type === "call" && rec.direction === "Inbound" ? (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Returned
                            </span>
                          ) : rec.type === "sms" && rec.direction === "Inbound" ? (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <MailOpen className="h-3 w-3 text-green-500" />
                              Read
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Property */}
                        <TableCell>
                          {rec.propertyAddress ? (
                            <div
                              className="max-w-[200px] cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                              onClick={() => rec.propertyLeadId && navigate(`/properties/${rec.propertyLeadId}`)}
                              title="Click to view property"
                            >
                              <div className="font-medium text-sm truncate text-primary hover:underline">{rec.propertyAddress}</div>
                              {(rec.propertyCity || rec.propertyState) && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {[rec.propertyCity, rec.propertyState].filter(Boolean).join(", ")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No property</span>
                          )}
                        </TableCell>

                        {/* Desk */}
                        <TableCell>
                          {rec.deskName ? (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                              {rec.deskName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>

                        {/* Agent */}
                        <TableCell>
                          <span className="text-sm">{rec.agentName || "System"}</span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {rec.type === "call" && rec.needsCallback ? (
                              <>
                                {/* Call Back button */}
                                {rec.phoneNumber && rec.twilioNumber && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-orange-600 hover:text-white hover:bg-orange-500"
                                        onClick={() => {
                                          openDialer({
                                            phone: rec.phoneNumber!,
                                            callerId: rec.twilioNumber!,
                                            autoCall: false,
                                          });
                                          toast.info(`Dialer opened — calling ${rec.phoneNumber} from ${rec.twilioNumber}`, {
                                            description: "Press Call to connect",
                                          });
                                        }}
                                        title="Call Back"
                                      >
                                        <PhoneForwarded className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">Call back from {rec.twilioNumber}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {/* Mark as Called Back button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-orange-600 hover:text-green-600 hover:bg-green-50"
                                  onClick={() => markCallbackDone.mutate({ logId: rec.id })}
                                  title="Mark as Called Back"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : null}
                            {rec.propertyLeadId && rec.propertyLeadId > 0 ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => navigate(`/properties/${rec.propertyLeadId}`)}
                                title="View Property"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
