import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
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
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Clock,
  BarChart3,
  PhoneMissed,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";

const CALL_RESULT_OPTIONS = [
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
];

function getCallResultBadgeColor(result: string | null): string {
  if (!result) return "bg-gray-100 text-gray-700 border-gray-200";
  if (result.includes("HOT LEAD")) return "bg-red-100 text-red-700 border-red-200";
  if (result.includes("WARM LEAD")) return "bg-orange-100 text-orange-700 border-orange-200";
  if (result.includes("Interested")) return "bg-green-100 text-green-700 border-green-200";
  if (result.includes("Left Message")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (result.includes("Voicemail")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (result.includes("Not Interested")) return "bg-rose-100 text-rose-700 border-rose-200";
  if (result.includes("DNC") || result.includes("DEAD")) return "bg-red-100 text-red-800 border-red-300";
  if (result.includes("Disconnected") || result.includes("Wrong")) return "bg-gray-100 text-gray-600 border-gray-200";
  if (result.includes("Follow-up") || result.includes("Call Back")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (result.includes("Not Answer") || result.includes("Busy")) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function getDirectionIcon(direction: string | null) {
  if (direction === "Inbound") return <PhoneIncoming className="h-4 w-4 text-green-600" />;
  if (direction === "Outbound") return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
  return <Phone className="h-4 w-4 text-gray-500" />;
}

function getDirectionBadge(direction: string | null) {
  if (direction === "Inbound")
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
        <PhoneIncoming className="h-3 w-3" />
        Inbound
      </Badge>
    );
  if (direction === "Outbound")
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
        <PhoneOutgoing className="h-3 w-3" />
        Outbound
      </Badge>
    );
  return <Badge variant="outline">Unknown</Badge>;
}

type SortField = "date" | "direction" | "callResult" | "property" | "agent" | "phoneNumber";
type SortOrder = "asc" | "desc";

export default function CallHistory() {
  const [, navigate] = useLocation();
  const [direction, setDirection] = useState<"all" | "Inbound" | "Outbound">("all");
  const [callResult, setCallResult] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: calls, isLoading, refetch } = trpc.callHistory.list.useQuery({
    direction: direction as any,
    callResult: callResult || undefined,
    search: search || undefined,
    limit: 500,
    offset: 0,
  });

  const { data: stats } = trpc.callHistory.stats.useQuery();

  const sortedCalls = useMemo(() => {
    if (!calls) return [];
    return [...calls].sort((a, b) => {
      const mult = sortOrder === "asc" ? 1 : -1;
      switch (sortField) {
        case "date":
          return mult * (new Date(a.communicationDate).getTime() - new Date(b.communicationDate).getTime());
        case "direction":
          return mult * ((a.direction || "").localeCompare(b.direction || ""));
        case "callResult":
          return mult * ((a.callResult || "").localeCompare(b.callResult || ""));
        case "property":
          return mult * ((a.propertyAddress || "").localeCompare(b.propertyAddress || ""));
        case "agent":
          return mult * ((a.userName || "").localeCompare(b.userName || ""));
        case "phoneNumber":
          return mult * ((a.contactPhoneNumber || "").localeCompare(b.contactPhoneNumber || ""));
        default:
          return 0;
      }
    });
  }, [calls, sortField, sortOrder]);

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            Call History
          </h1>
          <p className="text-muted-foreground mt-1">
            View and track all phone calls made and received through Twilio
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <PhoneIncoming className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inbound</p>
                <p className="text-2xl font-bold text-green-600">{stats?.inbound ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <PhoneOutgoing className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outbound</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.outbound ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <BarChart3 className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Results</p>
                <p className="text-2xl font-bold">{stats?.byResult ? Object.keys(stats.byResult).length : 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Results Breakdown */}
      {stats?.byResult && Object.keys(stats.byResult).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Call Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byResult)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 12)
                .map(([result, count]) => (
                  <Badge
                    key={result}
                    variant="outline"
                    className={`${getCallResultBadgeColor(result)} cursor-pointer`}
                    onClick={() => setCallResult(callResult === result ? "" : result)}
                  >
                    {result}: {count as number}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address, agent, notes, or result..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="Outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select value={callResult || "all_results"} onValueChange={(v) => setCallResult(v === "all_results" ? "" : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Call Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_results">All Results</SelectItem>
                {CALL_RESULT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || direction !== "all" || callResult) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDirection("all");
                  setCallResult("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Call History Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Call Log ({sortedCalls.length} {sortedCalls.length === 1 ? "call" : "calls"})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PhoneMissed className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No calls found</p>
              <p className="text-sm">
                {search || direction !== "all" || callResult
                  ? "Try adjusting your filters"
                  : "Call logs will appear here when calls are made or received"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader field="date">Date & Time</SortHeader>
                    <SortHeader field="direction">Direction</SortHeader>
                    <SortHeader field="phoneNumber">Phone Number</SortHeader>
                    <SortHeader field="property">Property</SortHeader>
                    <SortHeader field="agent">Agent</SortHeader>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCalls.map((call) => (
                    <TableRow key={call.id} className="hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">
                              {new Date(call.communicationDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(call.communicationDate).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getDirectionBadge(call.direction)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {call.contactPhoneNumber ? (
                            <div>
                              <div className="font-medium">{call.contactPhoneNumber}</div>
                              {call.twilioNumber && (
                                <div className="text-xs text-muted-foreground">
                                  via {call.twilioNumber}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.propertyAddress ? (
                          <div className="max-w-[200px]">
                            <div className="font-medium text-sm truncate">{call.propertyAddress}</div>
                            {(call.propertyCity || call.propertyState) && (
                              <div className="text-xs text-muted-foreground truncate">
                                {[call.propertyCity, call.propertyState].filter(Boolean).join(", ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unknown property</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{call.userName || "System"}</span>
                      </TableCell>
                      <TableCell>
                        {call.propertyLeadId && call.propertyLeadId > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => navigate(`/properties/${call.propertyLeadId}`)}
                            title="View Property"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
