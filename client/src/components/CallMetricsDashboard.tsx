import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, TrendingUp, Users, Target } from "lucide-react";

export function CallMetricsDashboard() {
  const { data: metrics, isLoading } = trpc.callMetrics.statistics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Call Metrics</h2>
        <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Call Metrics</h2>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCallsToday}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalCallsAllTime} total calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Hot + Warm leads
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agent Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.agentRankings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No agent activity yet
              </p>
            ) : (
              <div className="space-y-3">
                {metrics.agentRankings.map((agent, index) => (
                  <div
                    key={agent.agent}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{agent.agent}</div>
                        <div className="text-xs text-muted-foreground">
                          {agent.calls} calls · {agent.conversionRate}% conversion
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-500">
                        {agent.hotLeads} 🔥
                      </div>
                      <div className="text-xs text-orange-500">
                        {agent.warmLeads} 🌡️
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disposition Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Dispositions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.dispositionBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No dispositions recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {metrics.dispositionBreakdown.map((item) => {
                  const percentage = metrics.totalCallsAllTime > 0
                    ? ((item.count / metrics.totalCallsAllTime) * 100).toFixed(1)
                    : '0.0';
                  
                  return (
                    <div key={item.disposition} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{item.disposition}</span>
                        <span className="text-muted-foreground">
                          {item.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
