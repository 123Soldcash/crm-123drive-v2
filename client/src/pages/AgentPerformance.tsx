import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, MapPin, FileText, Camera, Flame } from "lucide-react";

export default function AgentPerformance() {
  const { data: statistics, isLoading } = trpc.users.getAgentStatistics.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading agent statistics...</div>
      </div>
    );
  }

  if (!statistics || statistics.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Agent Performance</h1>
          <p className="text-muted-foreground mt-2">
            Track and compare performance metrics for all birddog agents
          </p>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No agents found. Add agents to start tracking performance.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate totals
  const totals = statistics.reduce(
    (acc, stat) => ({
      totalProperties: acc.totalProperties + stat.totalProperties,
      hotLeads: acc.hotLeads + stat.hotLeads,
      warmLeads: acc.warmLeads + stat.warmLeads,
      coldLeads: acc.coldLeads + stat.coldLeads,
      visitedProperties: acc.visitedProperties + stat.visitedProperties,
      totalCheckIns: acc.totalCheckIns + stat.totalCheckIns,
      totalNotes: acc.totalNotes + stat.totalNotes,
      totalPhotos: acc.totalPhotos + stat.totalPhotos,
    }),
    {
      totalProperties: 0,
      hotLeads: 0,
      warmLeads: 0,
      coldLeads: 0,
      visitedProperties: 0,
      totalCheckIns: 0,
      totalNotes: 0,
      totalPhotos: 0,
    }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agent Performance</h1>
        <p className="text-muted-foreground mt-2">
          Track and compare performance metrics for all birddog agents
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.length}</div>
            <p className="text-xs text-muted-foreground">Active birddog agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalProperties}</div>
            <p className="text-xs text-muted-foreground">Assigned across all agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totals.hotLeads}</div>
            <p className="text-xs text-muted-foreground">High-priority properties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Check-ins</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalCheckIns}</div>
            <p className="text-xs text-muted-foreground">Property visits logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Details</CardTitle>
          <CardDescription>
            Detailed performance metrics for each agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead className="text-right">Properties</TableHead>
                <TableHead className="text-right">Hot</TableHead>
                <TableHead className="text-right">Warm</TableHead>
                <TableHead className="text-right">Cold</TableHead>
                <TableHead className="text-right">Visited</TableHead>
                <TableHead className="text-right">Check-ins</TableHead>
                <TableHead className="text-right">Notes</TableHead>
                <TableHead className="text-right">Photos</TableHead>
                <TableHead className="text-right">Activity Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.map((stat) => {
                // Calculate activity score (weighted sum of activities)
                const activityScore =
                  stat.totalCheckIns * 3 +
                  stat.totalNotes * 2 +
                  stat.totalPhotos * 1;

                // Calculate visit rate
                const visitRate =
                  stat.totalProperties > 0
                    ? ((stat.visitedProperties / stat.totalProperties) * 100).toFixed(0)
                    : "0";

                return (
                  <TableRow key={stat.agentId}>
                    <TableCell className="font-medium">{stat.agentName}</TableCell>
                    <TableCell className="text-right">{stat.totalProperties}</TableCell>
                    <TableCell className="text-right">
                      {stat.hotLeads > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {stat.hotLeads}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.warmLeads > 0 ? (
                        <Badge variant="default" className="text-xs">
                          {stat.warmLeads}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.coldLeads > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {stat.coldLeads}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{stat.visitedProperties}</span>
                        <span className="text-xs text-muted-foreground">
                          ({visitRate}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{stat.totalCheckIns}</TableCell>
                    <TableCell className="text-right">{stat.totalNotes}</TableCell>
                    <TableCell className="text-right">{stat.totalPhotos}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          activityScore > 100
                            ? "default"
                            : activityScore > 50
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {activityScore}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity Score Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity Score Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Activity Score = (Check-ins × 3) + (Notes × 2) + (Photos × 1)
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Higher scores indicate more active engagement with assigned properties.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
