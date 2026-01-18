import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "sonner";

export function PendingFollowUpsDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const utils = trpc.useUtils();

  const { data: pendingFollowUps = [], isLoading, refetch } = trpc.followups.getPending.useQuery(undefined, {
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every 60 seconds if auto-refresh is enabled
  });

  const executeMutation = trpc.followups.execute.useMutation({
    onSuccess: () => {
      toast.success("Follow-up executed successfully!");
      utils.followups.getPending.invalidate();
      refetch();
    },
    onError: (error) => {
      toast.error(`Error executing follow-up: ${error.message}`);
    },
  });

  const handleExecuteAll = async () => {
    if (pendingFollowUps.length === 0) {
      toast.info("No pending follow-ups to execute");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to execute ${pendingFollowUps.length} follow-up(s)?`
    );

    if (!confirmed) return;

    try {
      for (const followUp of pendingFollowUps) {
        await executeMutation.mutateAsync({ followUpId: followUp.id });
      }
      toast.success(`${pendingFollowUps.length} follow-up(s) executed!`);
    } catch (error) {
      toast.error("Error executing follow-ups");
    }
  };

  const handleExecuteSingle = async (followUpId: number) => {
    try {
      await executeMutation.mutateAsync({ followUpId });
    } catch (error) {
      toast.error("Error executing follow-up");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Follow-ups
          </CardTitle>
          <CardDescription>
            {pendingFollowUps.length} follow-up(s) waiting for execution
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          {pendingFollowUps.length > 0 && (
            <Button
              size="sm"
              onClick={handleExecuteAll}
              disabled={executeMutation.isPending}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Execute All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {pendingFollowUps.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>No Pending Follow-ups</AlertTitle>
            <AlertDescription>
              All your follow-ups are up to date! Keep tracking your leads.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {pendingFollowUps.map((followUp: any) => (
              <div
                key={followUp.id}
                className="flex items-start justify-between p-4 border rounded-lg bg-yellow-50 border-yellow-200 hover:bg-yellow-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <Badge variant="outline">{followUp.type}</Badge>
                    <Badge variant="outline">{followUp.action}</Badge>
                  </div>
                  <p className="font-medium text-sm mb-1">{followUp.trigger}</p>
                  <p className="text-xs text-muted-foreground mb-1">
                    Property: {followUp.property?.addressLine1}, {followUp.property?.city} - {followUp.property?.state}
                  </p>
                  <p className="text-xs text-yellow-700 font-medium">
                    ⏰ Should have been executed on: {format(new Date(followUp.nextRunAt), "MM/dd/yyyy HH:mm", { locale: enUS })}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleExecuteSingle(followUp.id)}
                  disabled={executeMutation.isPending}
                  className="gap-2 whitespace-nowrap"
                >
                  <Zap className="h-4 w-4" />
                  Execute
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
