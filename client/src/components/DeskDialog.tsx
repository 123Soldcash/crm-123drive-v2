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

// Fixed desk options
const DESK_OPTIONS = [
  { value: "BIN", label: "🗑️ BIN (Novas Leads)", description: "Leads não processadas" },
  { value: "DESK_CHRIS", label: "👤 Desk Chris", description: "Leads do Chris" },
  { value: "DESK_DEEP_SEARCH", label: "🔍 Desk Deep Search", description: "Leads para pesquisa aprofundada" },
  { value: "DESK_1", label: "📋 Desk 1", description: "Mesa de trabalho 1" },
  { value: "DESK_2", label: "📋 Desk 2", description: "Mesa de trabalho 2" },
  { value: "DESK_3", label: "📋 Desk 3", description: "Mesa de trabalho 3" },
  { value: "DESK_4", label: "📋 Desk 4", description: "Mesa de trabalho 4" },
  { value: "DESK_5", label: "📋 Desk 5", description: "Mesa de trabalho 5" },
  { value: "ARCHIVED", label: "✅ Archived", description: "Leads arquivadas/finalizadas" },
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
      deskName = undefined;
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
                    <div className="flex flex-col">
                      <span>{desk.label}</span>
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
