import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { getIconComponent } from "@/lib/deskUtils";

// Fallback static options (used while DB loads or if query fails)
const FALLBACK_DESK_OPTIONS = [
  { value: "NEW_LEAD", label: "🆕 New Lead", description: "Novos leads - entrada padrão", color: "bg-green-200 text-green-800" },
  { value: "BIN", label: "🗑️ BIN", description: "Leads descartadas", color: "bg-gray-200 text-gray-700" },
  { value: "DEAD", label: "💀 Dead", description: "Dead leads - finalizadas", color: "bg-gray-800 text-white" },
];

// Default color mapping for known desk names
const DEFAULT_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-green-200 text-green-800",
  DESK_CHRIS: "bg-orange-200 text-orange-800",
  DESK_DEEP_SEARCH: "bg-purple-200 text-purple-800",
  DESK_1: "bg-sky-200 text-sky-800",
  DESK_2: "bg-emerald-200 text-emerald-800",
  DESK_3: "bg-pink-200 text-pink-800",
  DESK_4: "bg-blue-600 text-white",
  DESK_5: "bg-amber-200 text-amber-800",
  BIN: "bg-gray-200 text-gray-700",
  DEAD: "bg-gray-800 text-white",
};

function getDeskColor(name: string, dbColor?: string | null): string {
  if (dbColor) return dbColor;
  return DEFAULT_COLORS[name] || "bg-slate-200 text-slate-800";
}

interface DeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number;
  currentDeskName?: string | null;
  currentDeskStatus?: string;
  onSave: (deskName: string | undefined, deskStatus: "BIN" | "ACTIVE" | "DEAD", deadReason?: string) => void;
}

export function DeskDialog({
  open,
  onOpenChange,
  propertyId,
  currentDeskName,
  currentDeskStatus = "BIN",
  onSave,
}: DeskDialogProps) {
  const [selectedDesk, setSelectedDesk] = useState(currentDeskName || "BIN");
  const [deadReason, setDeadReason] = useState("");
  const [deadReasonError, setDeadReasonError] = useState("");

  // Fetch desks from database
  const { data: desksData, isLoading: desksLoading } = trpc.desks.list.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });

  // Build desk options from DB data
  const deskOptions = useMemo(() => {
    if (!desksData || !Array.isArray(desksData) || desksData.length === 0) return FALLBACK_DESK_OPTIONS;
    return desksData.map((desk: any) => ({
      value: desk.name,
      label: desk.description || desk.name,
      description: desk.description || "",
      color: getDeskColor(desk.name, desk.color),
      hexColor: desk.color || null,
      icon: desk.icon || null,
    }));
  }, [desksData]);

  // Update state when dialog opens with new property
  useEffect(() => {
    setSelectedDesk(currentDeskName || "BIN");
    setDeadReason("");
    setDeadReasonError("");
  }, [currentDeskName, open]);

  const handleSave = () => {
    let deskName: string | undefined;
    let deskStatus: "BIN" | "ACTIVE" | "DEAD";

    if (selectedDesk === "BIN") {
      deskName = "BIN";
      deskStatus = "BIN";
    } else if (selectedDesk === "NEW_LEAD") {
      deskName = "NEW_LEAD";
      deskStatus = "BIN";
    } else if (selectedDesk === "DEAD") {
      deskName = "DEAD";
      deskStatus = "DEAD";
      if (!deadReason.trim()) {
        setDeadReasonError("A justification is required when marking a lead as Dead.");
        return;
      }
    } else {
      deskName = selectedDesk;
      deskStatus = "ACTIVE";
    }

    onSave(deskName, deskStatus, selectedDesk === "DEAD" ? deadReason.trim() : undefined);
    onOpenChange(false);
  };

  const currentDeskOption = deskOptions.find((d: any) => d.value === selectedDesk);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>📁 Atribuir Desk</DialogTitle>
          <DialogDescription>
            Mova esta lead para uma mesa de trabalho. Vários agentes podem trabalhar na mesma lead.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="desk-select">Selecione a Desk</Label>
            {desksLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading desks...
              </div>
            ) : (
              <Select value={selectedDesk} onValueChange={(v) => { setSelectedDesk(v); setDeadReasonError(""); }}>
                <SelectTrigger id="desk-select" className="w-full">
                  <SelectValue placeholder="Selecione uma desk..." />
                </SelectTrigger>
                <SelectContent>
                  {deskOptions.map((desk: any) => {
                    const IconComp = getIconComponent(desk.icon);
                    const hexColor = desk.hexColor || "#9ca3af";
                    return (
                      <SelectItem key={desk.value} value={desk.value}>
                        <span className="inline-flex items-center gap-1.5">
                          <IconComp className="h-3.5 w-3.5 shrink-0" style={{ color: hexColor }} />
                          <span>{desk.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {currentDeskOption && currentDeskOption.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {currentDeskOption.description}
              </p>
            )}
          </div>

          {/* Dead justification - only shows when DEAD is selected */}
          {selectedDesk === "DEAD" && (
            <div className="space-y-2">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    💀 Marking as Dead
                  </span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                  Please provide a reason why this lead is being marked as Dead. This will be saved to General Notes.
                </p>
                <Textarea
                  placeholder="e.g., Owner not interested, property already sold, unable to contact..."
                  value={deadReason}
                  onChange={(e) => { setDeadReason(e.target.value); setDeadReasonError(""); }}
                  className="min-h-[80px] bg-white dark:bg-gray-900"
                />
                {deadReasonError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {deadReasonError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Current status indicator */}
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Status atual:</strong>{" "}
              {currentDeskName ? (
                <span className="text-blue-600 font-medium">{currentDeskName}</span>
              ) : (
                <span className="text-gray-500">🗑️ BIN (não atribuído)</span>
              )}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} variant={selectedDesk === "DEAD" ? "destructive" : "default"}>
            {selectedDesk === "DEAD" ? "💀 Mark as Dead" : "💾 Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
