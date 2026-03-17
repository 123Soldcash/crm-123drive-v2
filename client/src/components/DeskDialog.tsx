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
import { useState, useEffect } from "react";

// Fixed desk options with colors
const DESK_OPTIONS = [
  { value: "NEW_LEAD", label: "🆕 New Lead", description: "Novos leads - entrada padrão", color: "bg-green-200 text-green-800" },
  { value: "DESK_CHRIS", label: "🏀 Desk Chris", description: "Leads do Chris", color: "bg-orange-200 text-orange-800" },
  { value: "DESK_DEEP_SEARCH", label: "🔍 Deep Search", description: "Leads para pesquisa aprofundada", color: "bg-purple-200 text-purple-800" },
  { value: "DESK_1", label: "🟦 Manager", description: "Desk 1 - Manager", color: "bg-sky-200 text-sky-800" },
  { value: "DESK_2", label: "🟩 Edsel", description: "Desk 2 - Edsel", color: "bg-emerald-200 text-emerald-800" },
  { value: "DESK_3", label: "🟧 Zach", description: "Desk 3 - Zach", color: "bg-pink-200 text-pink-800" },
  { value: "DESK_4", label: "🔵 Rodolfo", description: "Desk 4 - Rodolfo", color: "bg-blue-600 text-white" },
  { value: "DESK_5", label: "🟨 Lucas", description: "Desk 5 - Lucas", color: "bg-amber-200 text-amber-800" },
  { value: "BIN", label: "🗑️ BIN", description: "Leads descartadas", color: "bg-gray-200 text-gray-700" },
  { value: "ARCHIVED", label: "⬛ Archived", description: "Leads arquivadas/finalizadas", color: "bg-gray-800 text-white" },
];

interface DeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number;
  currentDeskName?: string | null;
  currentDeskStatus?: string;
  onSave: (deskName: string | undefined, deskStatus: "BIN" | "ACTIVE" | "ARCHIVED") => void;
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

  // Update state when dialog opens with new property
  useEffect(() => {
    setSelectedDesk(currentDeskName || "BIN");
  }, [currentDeskName, open]);

  const handleSave = () => {
    // Map desk selection to deskName and deskStatus
    let deskName: string | undefined;
    let deskStatus: "BIN" | "ACTIVE" | "ARCHIVED";

    if (selectedDesk === "BIN") {
      deskName = "BIN";
      deskStatus = "BIN";
    } else if (selectedDesk === "NEW_LEAD") {
      deskName = "NEW_LEAD";
      deskStatus = "BIN";
    } else if (selectedDesk === "ARCHIVED") {
      deskName = "ARCHIVED";
      deskStatus = "ARCHIVED";
    } else {
      deskName = selectedDesk;
      deskStatus = "ACTIVE";
    }

    onSave(deskName, deskStatus);
    onOpenChange(false);
  };

  const currentDeskOption = DESK_OPTIONS.find(d => d.value === selectedDesk);

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
            <Select value={selectedDesk} onValueChange={setSelectedDesk}>
              <SelectTrigger id="desk-select" className="w-full">
                <SelectValue placeholder="Selecione uma desk..." />
              </SelectTrigger>
              <SelectContent>
                {DESK_OPTIONS.map((desk) => (
                  <SelectItem key={desk.value} value={desk.value}>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${desk.color}`}>
                        {desk.label}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentDeskOption && (
              <p className="text-xs text-muted-foreground mt-1">
                {currentDeskOption.description}
              </p>
            )}
          </div>

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
          <Button onClick={handleSave}>
            💾 Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
