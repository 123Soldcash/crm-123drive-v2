import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Flame, ThermometerSun, Snowflake, Check, MapPin } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CallMetricsDashboard } from "@/components/CallMetricsDashboard";
import { PendingFollowUpsDashboard } from "@/components/PendingFollowUpsDashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

export default function Dashboard() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [stats, setStats] = useState({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    dead: 0,
    ownerVerified: 0,
    visited: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const { data: agents } = trpc.agents.list.useQuery();

  // Fetch dashboard stats from database
  const { data: dashboardStats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery(
    selectedAgentId === "all" ? undefined : parseInt(selectedAgentId),
    { staleTime: 0, gcTime: 0 } // Disable caching to always fetch fresh data
  );

  useEffect(() => {
    if (dashboardStats) {
      setStats({
        total: dashboardStats.total || 0,
        hot: dashboardStats.hot || 0,
        warm: dashboardStats.warm || 0,
        cold: dashboardStats.cold || 0,
        dead: dashboardStats.dead || 0,
        ownerVerified: dashboardStats.ownerVerified || 0,
        visited: dashboardStats.visited || 0,
      });
    }
    setIsLoading(statsLoading ?? false);
  }, [dashboardStats, statsLoading]);

  const formatCurrency = (value?: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Property CRM Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track your property leads for seller outreach
          </p>
        </div>
        <div className="w-[200px]">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total Properties Card */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats.total}
            </div>
            <p className="text-xs text-muted-foreground">Properties in database</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Temperature Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Lead Temperature</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/properties?leadTemperature=HOT">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">HOT</CardTitle>
                <Flame className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {isLoading ? "..." : stats.hot}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Click to view leads</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/properties?leadTemperature=WARM">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">WARM</CardTitle>
                <ThermometerSun className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {isLoading ? "..." : stats.warm}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Click to view leads</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/properties?leadTemperature=COLD">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">COLD</CardTitle>
                <Snowflake className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {isLoading ? "..." : stats.cold}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Click to view leads</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/properties?leadTemperature=DEAD">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">DEAD</CardTitle>
                <span className="text-2xl">☠️</span>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-600">
                  {isLoading ? "..." : stats.dead}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Click to view leads</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Status Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Property Status</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/properties?ownerVerified=true">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Owner Verified</CardTitle>
                <Check className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {isLoading ? "..." : stats.ownerVerified}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Click to view verified properties</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/properties?visited=true">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Property Visited</CardTitle>
                <MapPin className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {isLoading ? "..." : stats.visited}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Click to view visited properties</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/properties">
              <Button className="w-full" variant="outline">
                <Building2 className="mr-2 h-4 w-4" />
                View All Properties
              </Button>
            </Link>
            <Link href="/map">
              <Button className="w-full" variant="outline">
                <MapPin className="mr-2 h-4 w-4" />
                Open Map View
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No recent properties</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Metrics Dashboard */}
      <CallMetricsDashboard />

      {/* Pending Follow-ups Dashboard */}
      <PendingFollowUpsDashboard />
    </div>
  );
}
