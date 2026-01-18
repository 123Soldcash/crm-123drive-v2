import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function PendingFollowUpsDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const utils = trpc.useUtils();

  const { data: pendingFollowUps = [], isLoading, refetch } = trpc.followups.getPending.useQuery(undefined, {
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every 60 seconds if auto-refresh is enabled
  });

  const executeMutation = trpc.followups.execute.useMutation({
    onSuccess: () => {
      toast.success("Follow-up executado com sucesso!");
      utils.followups.getPending.invalidate();
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao executar follow-up: ${error.message}`);
    },
  });

  const handleExecuteAll = async () => {
    if (pendingFollowUps.length === 0) {
      toast.info("Nenhum follow-up pendente para executar");
      return;
    }

    const confirmed = confirm(
      `Tem certeza que deseja executar ${pendingFollowUps.length} follow-up(s)?`
    );

    if (!confirmed) return;

    try {
      for (const followUp of pendingFollowUps) {
        await executeMutation.mutateAsync({ followUpId: followUp.id });
      }
      toast.success(`${pendingFollowUps.length} follow-up(s) executado(s)!`);
    } catch (error) {
      toast.error("Erro ao executar follow-ups");
    }
  };

  const handleExecuteSingle = async (followUpId: number) => {
    try {
      await executeMutation.mutateAsync({ followUpId });
    } catch (error) {
      toast.error("Erro ao executar follow-up");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follow-ups Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
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
            Follow-ups Pendentes
          </CardTitle>
          <CardDescription>
            {pendingFollowUps.length} follow-up(s) aguardando execução
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
              Executar Todos
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {pendingFollowUps.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Nenhum Follow-up Pendente</AlertTitle>
            <AlertDescription>
              Todos os seus follow-ups estão em dia! Continue acompanhando seus leads.
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
                    Propriedade: {followUp.property?.addressLine1}, {followUp.property?.city} - {followUp.property?.state}
                  </p>
                  <p className="text-xs text-yellow-700 font-medium">
                    ⏰ Deveria ter sido executado em: {format(new Date(followUp.nextRunAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleExecuteSingle(followUp.id)}
                  disabled={executeMutation.isPending}
                  className="gap-2 whitespace-nowrap"
                >
                  <Zap className="h-4 w-4" />
                  Executar
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
