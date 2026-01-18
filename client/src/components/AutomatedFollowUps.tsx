import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { followUpNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pause, Play, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutomatedFollowUpsProps {
  propertyId: number;
}

type FollowUpType = "Cold Lead" | "No Contact" | "Stage Change" | "Custom";
type FollowUpAction = "Create Task" | "Send Email" | "Send SMS" | "Change Stage";

export function AutomatedFollowUps({ propertyId }: AutomatedFollowUpsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FollowUpType>("Cold Lead");
  const [selectedAction, setSelectedAction] = useState<FollowUpAction>("Create Task");
  const [trigger, setTrigger] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = trpc.useUtils();
  const { data: followUps = [], isLoading } = trpc.followups.getByProperty.useQuery({ propertyId });
  const createMutation = trpc.followups.create.useMutation();
  const pauseMutation = trpc.followups.pause.useMutation();
  const resumeMutation = trpc.followups.resume.useMutation();
  const deleteMutation = trpc.followups.delete.useMutation();
  const executeMutation = trpc.followups.execute.useMutation();

  const handleCreateFollowUp = async () => {
    if (!trigger.trim()) {
      toast.error("Por favor, descreva o gatilho do follow-up");
      return;
    }

    setIsSubmitting(true);
    try {
      let actionDetailsObj: any = {};

      // Parse action details based on action type
      if (selectedAction === "Create Task") {
        actionDetailsObj = {
          title: `Follow-up: ${trigger}`,
          description: `Tarefa de follow-up automático: ${trigger}`,
          priority: "Medium",
        };
      } else if (selectedAction === "Send Email") {
        actionDetailsObj = {
          subject: `Follow-up: ${trigger}`,
          template: "default_followup",
        };
      } else if (selectedAction === "Send SMS") {
        actionDetailsObj = {
          message: actionDetails || `Olá! Seguindo up sobre a propriedade. ${trigger}`,
        };
      } else if (selectedAction === "Change Stage") {
        actionDetailsObj = {
          newStage: actionDetails || "FOLLOW_UP_ON_CONTRACT",
        };
      }

      // Calculate next run date based on trigger
      let nextRunAt = new Date();
      if (trigger.includes("30 dias")) {
        nextRunAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (trigger.includes("7 dias")) {
        nextRunAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else if (trigger.includes("1 dia")) {
        nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else {
        nextRunAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Default: 3 days
      }

      await createMutation.mutateAsync({
        propertyId,
        type: selectedType,
        trigger,
        action: selectedAction,
        actionDetails: actionDetailsObj,
        nextRunAt,
      });

      followUpNotifications.followUpCreated(trigger);
      setIsDialogOpen(false);
      setTrigger("");
      setActionDetails("");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Erro ao criar follow-up");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async (followUpId: number) => {
    try {
      await pauseMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpPaused(trigger);
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Erro ao pausar follow-up");
    }
  };

  const handleResume = async (followUpId: number) => {
    try {
      await resumeMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpResumed(trigger);
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Erro ao retomar follow-up");
    }
  };

  const handleDelete = async (followUpId: number) => {
    if (!confirm("Tem certeza que deseja deletar este follow-up?")) return;

    try {
      await deleteMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpDeleted(trigger);
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Erro ao deletar follow-up");
    }
  };

  const handleExecute = async (followUpId: number) => {
    try {
      await executeMutation.mutateAsync({ followUpId });
      followUpNotifications.followUpExecuted(followUp.action, "Propriedade");
      utils.followups.getByProperty.invalidate({ propertyId });
    } catch (error) {
      toast.error("Erro ao executar follow-up");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "Paused":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "Completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Active":
        return "default";
      case "Paused":
        return "secondary";
      case "Completed":
        return "outline";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando follow-ups...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Follow-ups Automáticos</CardTitle>
          <CardDescription>Gerencie lembretes e automações para este lead</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Follow-up Automático</DialogTitle>
              <DialogDescription>
                Configure um follow-up automático para este lead
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Tipo de Follow-up */}
              <div>
                <label className="text-sm font-medium">Tipo de Follow-up</label>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as FollowUpType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cold Lead">Lead Frio</SelectItem>
                    <SelectItem value="No Contact">Sem Contato</SelectItem>
                    <SelectItem value="Stage Change">Mudança de Estágio</SelectItem>
                    <SelectItem value="Custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gatilho */}
              <div>
                <label className="text-sm font-medium">Gatilho (quando executar?)</label>
                <Textarea
                  placeholder="Ex: Sem contato há 30 dias, Lead ficou FRIO, Passou 7 dias sem resposta..."
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="min-h-20"
                />
              </div>

              {/* Ação */}
              <div>
                <label className="text-sm font-medium">Ação a Executar</label>
                <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value as FollowUpAction)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Create Task">Criar Tarefa</SelectItem>
                    <SelectItem value="Send Email">Enviar Email</SelectItem>
                    <SelectItem value="Send SMS">Enviar SMS</SelectItem>
                    <SelectItem value="Change Stage">Mudar Estágio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Detalhes da Ação */}
              {selectedAction === "Send SMS" && (
                <div>
                  <label className="text-sm font-medium">Mensagem SMS</label>
                  <Textarea
                    placeholder="Digite a mensagem que será enviada..."
                    value={actionDetails}
                    onChange={(e) => setActionDetails(e.target.value)}
                    className="min-h-20"
                  />
                </div>
              )}

              {selectedAction === "Change Stage" && (
                <div>
                  <label className="text-sm font-medium">Novo Estágio</label>
                  <Select value={actionDetails} onValueChange={setActionDetails}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FOLLOW_UP_ON_CONTRACT">Follow-up no Contrato</SelectItem>
                      <SelectItem value="OFFER_PENDING">Oferta Pendente</SelectItem>
                      <SelectItem value="ANALYZING_DEAL">Analisando Deal</SelectItem>
                      <SelectItem value="DEAD_LOST">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                onClick={handleCreateFollowUp}
                disabled={isSubmitting || createMutation.isPending}
                className="w-full"
              >
                {isSubmitting ? "Criando..." : "Criar Follow-up"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum follow-up configurado para este lead
          </p>
        ) : (
          <div className="space-y-3">
            {followUps.map((followUp: any) => (
              <div
                key={followUp.id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(followUp.status)}
                    <Badge variant={getStatusBadgeVariant(followUp.status)}>
                      {followUp.status === "Active" ? "Ativo" : followUp.status === "Paused" ? "Pausado" : "Concluído"}
                    </Badge>
                    <Badge variant="outline">{followUp.type}</Badge>
                    <Badge variant="outline">{followUp.action}</Badge>
                  </div>
                  <p className="text-sm font-medium">{followUp.trigger}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Próxima execução: {format(new Date(followUp.nextRunAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {followUp.lastTriggeredAt && (
                    <p className="text-xs text-muted-foreground">
                      Última execução: {format(new Date(followUp.lastTriggeredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {followUp.status === "Active" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExecute(followUp.id)}
                        disabled={executeMutation.isPending}
                      >
                        Executar Agora
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePause(followUp.id)}
                        disabled={pauseMutation.isPending}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {followUp.status === "Paused" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResume(followUp.id)}
                      disabled={resumeMutation.isPending}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(followUp.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
