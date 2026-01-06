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
import { Input } from "@/components/ui/input";
import { useState } from "react";

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
  const [deskName, setDeskName] = useState(currentDeskName || "");
  const [deskStatus, setDeskStatus] = useState<"BIN" | "ACTIVE" | "ARCHIVED">(
    (currentDeskStatus as "BIN" | "ACTIVE" | "ARCHIVED") || "BIN"
  );

  const handleSave = () => {
    onSave(deskName || undefined, deskStatus);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Desk</DialogTitle>
          <DialogDescription>
            Assign this lead to a desk and set its status
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="desk-name">Desk Name</Label>
            <Input
              id="desk-name"
              placeholder="e.g., Sales, Follow-up, Research"
              value={deskName}
              onChange={(e) => setDeskName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="desk-status">Status</Label>
            <Select value={deskStatus} onValueChange={(value) => setDeskStatus(value as "BIN" | "ACTIVE" | "ARCHIVED")}>
              <SelectTrigger id="desk-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BIN">🗑️ BIN (New Lead)</SelectItem>
                <SelectItem value="ACTIVE">🔄 ACTIVE (In Progress)</SelectItem>
                <SelectItem value="ARCHIVED">✅ ARCHIVED (Completed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
