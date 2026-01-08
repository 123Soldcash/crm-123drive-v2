'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Check, X, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const RELATIONSHIPS = [
  "Owner",
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Grandson",
  "Granddaughter",
  "Uncle",
  "Aunt",
  "Cousin",
  "Nephew",
  "Niece",
  "In-Law",
  "Other",
];

interface FamilyMember {
  id: number;
  propertyId: number;
  name: string;
  relationship: string;
  phone?: string | null;
  email?: string | null;
  isRepresentative: number;
  isDeceased: number;
  isContacted: number;
  contactedDate?: Date | null;
  isOnBoard: number;
  isNotOnBoard: number;
  relationshipPercentage?: number | null;
  isCurrentResident: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FamilyTreeProps {
  propertyId: number;
}

export function FamilyTreeRedesigned({ propertyId }: FamilyTreeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [treeNotes, setTreeNotes] = useState<string>("");
  const [notesEditing, setNotesEditing] = useState(false);
  const [lastAddedName, setLastAddedName] = useState<string>("");
  const svgRef = useRef<SVGSVGElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form state for inline entry row
  const [newMember, setNewMember] = useState({
    name: "",
    relationship: "Owner",
    relationshipPercentage: 0,
    isCurrentResident: 0,
    isRepresentative: 0,
    isDeceased: 0,
    isContacted: 0,
    isOnBoard: 0,
    isNotOnBoard: 0,
  });

  const { data: familyMembers = [], refetch } = trpc.properties.getFamilyMembers.useQuery({
    propertyId,
  });

  const createMutation = trpc.properties.createFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Pessoa adicionada!", {
        description: `${newMember.name} foi adicionado(a) à árvore genealógica`,
        duration: 2000,
      });
      setLastAddedName(newMember.name);
      refetch();
      setNewMember({
        name: "",
        relationship: "Owner",
        relationshipPercentage: 0,
        isCurrentResident: 0,
        isRepresentative: 0,
        isDeceased: 0,
        isContacted: 0,
        isOnBoard: 0,
        isNotOnBoard: 0,
      });
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    },
    onError: (error) => {
      toast.error("❌ Erro ao adicionar", {
        description: error.message || "Falha ao adicionar membro da família",
        duration: 2000,
      });
    },
  });

  const updateMutation = trpc.properties.updateFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Atualizado!", {
        duration: 1500,
      });
      refetch();
      setEditingId(null);
      setEditingField(null);
    },
    onError: (error) => {
      toast.error("❌ Erro ao atualizar", {
        description: error.message,
        duration: 2000,
      });
    },
  });

  const deleteMutation = trpc.properties.deleteFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Deletado!", {
        duration: 1500,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("❌ Erro ao deletar", {
        description: error.message,
        duration: 2000,
      });
    },
  });

  const handleSaveNewMember = async () => {
    if (!newMember.name.trim()) {
      toast.error("❌ Nome é obrigatório", { duration: 2000 });
      return;
    }

    createMutation.mutate({
      propertyId,
      name: newMember.name,
      relationship: newMember.relationship,
      relationshipPercentage: newMember.relationshipPercentage,
      isCurrentResident: newMember.isCurrentResident,
      isRepresentative: newMember.isRepresentative,
      isDeceased: newMember.isDeceased,
      isContacted: newMember.isContacted,
      isOnBoard: newMember.isOnBoard,
      isNotOnBoard: newMember.isNotOnBoard,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveNewMember();
    }
  };

  const handleEditCell = (memberId: number, field: string, value: any) => {
    updateMutation.mutate({
      id: memberId,
      [field]: value,
    });
  };

  const renderCellValue = (member: FamilyMember, field: string) => {
    switch (field) {
      case "relationshipPercentage":
        const percentage = member.relationshipPercentage ?? 0;
        return percentage === 0 ? "0%" : `${percentage}%`;
      case "isCurrentResident":
        return member.isCurrentResident === 1 ? "✓" : "";
      case "isRepresentative":
        return member.isRepresentative === 1 ? "✓" : "";
      case "isDeceased":
        return member.isDeceased === 1 ? "⚠️" : "";
      case "isContacted":
        return member.isContacted === 1 ? "✓" : "";
      case "isOnBoard":
        return member.isOnBoard === 1 ? (
          <span className="text-green-600 font-medium">✓</span>
        ) : null;
      case "isNotOnBoard":
        return member.isNotOnBoard === 1 ? (
          <span className="text-red-600 font-medium">✗</span>
        ) : null;
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Family Tree</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Esconder
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Mostrar
              </>
            )}
          </Button>
        </div>

        {isExpanded && (
          <>
            {/* Inline Entry Row */}
            <Card className="p-4 mb-4 bg-blue-50 border-2 border-blue-200">
              <div className="mb-2">
                <p className="text-xs font-semibold text-blue-900">➕ Adicionar novo membro da família</p>
              </div>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium">Nome *</label>
                  <Input
                    ref={nameInputRef}
                    placeholder="Digite o nome..."
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs font-medium">Relação *</label>
                  <Select value={newMember.relationship} onValueChange={(value) => setNewMember({ ...newMember, relationship: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map((rel) => (
                        <SelectItem key={rel} value={rel}>
                          {rel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="text-xs font-medium">Herança %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={newMember.relationshipPercentage}
                    onChange={(e) => setNewMember({ ...newMember, relationshipPercentage: parseInt(e.target.value) || 0 })}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">Current Resident</label>
                  <Checkbox
                    checked={newMember.isCurrentResident === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isCurrentResident: checked ? 1 : 0 })}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">Representative</label>
                  <Checkbox
                    checked={newMember.isRepresentative === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isRepresentative: checked ? 1 : 0 })}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">Deceased</label>
                  <Checkbox
                    checked={newMember.isDeceased === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isDeceased: checked ? 1 : 0 })}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">Contacted</label>
                  <Checkbox
                    checked={newMember.isContacted === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isContacted: checked ? 1 : 0 })}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">On Board</label>
                  <Checkbox
                    checked={newMember.isOnBoard === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isOnBoard: checked ? 1 : 0 })}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">NOT ON BOARD</label>
                  <Checkbox
                    checked={newMember.isNotOnBoard === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isNotOnBoard: checked ? 1 : 0 })}
                  />
                </div>
                <Button
                  onClick={handleSaveNewMember}
                  disabled={createMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </Card>

            {/* Family Members Table */}
            {familyMembers.length > 0 ? (
              <Card className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="px-4 py-2 text-left font-semibold">Name</th>
                      <th className="px-4 py-2 text-left font-semibold">Relationship</th>
                      <th className="px-4 py-2 text-left font-semibold">0/%</th>
                      <th className="px-4 py-2 text-left font-semibold">Current Resident</th>
                      <th className="px-4 py-2 text-left font-semibold">Representative</th>
                      <th className="px-4 py-2 text-left font-semibold">Deceased</th>
                      <th className="px-4 py-2 text-left font-semibold">Contacted</th>
                      <th className="px-4 py-2 text-left font-semibold">On Board</th>
                      <th className="px-4 py-2 text-left font-semibold">NOT ON BOARD</th>
                      <th className="px-4 py-2 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.map((member) => (
                      <tr key={member.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{member.name}</td>
                        <td className="px-4 py-2">{member.relationship}</td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => { setEditingId(member.id); setEditingField("relationshipPercentage"); setEditValue(member.relationshipPercentage); }}>
                          {editingId === member.id && editingField === "relationshipPercentage" ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={editValue}
                              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                              onBlur={() => { handleEditCell(member.id, "relationshipPercentage", editValue); setEditingId(null); }}
                              autoFocus
                              className="w-16"
                            />
                          ) : (
                            renderCellValue(member, "relationshipPercentage")
                          )}
                        </td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => handleEditCell(member.id, "isCurrentResident", member.isCurrentResident === 1 ? 0 : 1)}>
                          <Checkbox checked={member.isCurrentResident === 1} readOnly />
                        </td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => handleEditCell(member.id, "isRepresentative", member.isRepresentative === 1 ? 0 : 1)}>
                          <Checkbox checked={member.isRepresentative === 1} readOnly />
                        </td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => handleEditCell(member.id, "isDeceased", member.isDeceased === 1 ? 0 : 1)}>
                          {renderCellValue(member, "isDeceased")}
                        </td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => handleEditCell(member.id, "isContacted", member.isContacted === 1 ? 0 : 1)}>
                          <Checkbox checked={member.isContacted === 1} readOnly />
                        </td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => handleEditCell(member.id, "isOnBoard", member.isOnBoard === 1 ? 0 : 1)}>
                          {renderCellValue(member, "isOnBoard")}
                        </td>
                        <td className="px-4 py-2 cursor-pointer hover:bg-blue-100" onClick={() => handleEditCell(member.id, "isNotOnBoard", member.isNotOnBoard === 1 ? 0 : 1)}>
                          {renderCellValue(member, "isNotOnBoard")}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate({ id: member.id })}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card className="p-8 text-center mb-4">
                <p className="text-gray-500">Nenhum membro adicionado ainda</p>
                <p className="text-xs text-gray-400">Use o formulário acima para adicionar membros da família</p>
              </Card>
            )}

            {/* Family Tree Notes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Family Tree Notes</h4>
                {!notesEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNotesEditing(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>

              {notesEditing ? (
                <Card className="p-4">
                  <textarea
                    value={treeNotes}
                    onChange={(e) => setTreeNotes(e.target.value)}
                    placeholder="Add family tree notes..."
                    className="w-full h-24 p-2 border rounded resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => setNotesEditing(false)}
                    >
                      Done
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNotesEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 min-h-20 bg-gray-50">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {treeNotes || "No notes added yet"}
                  </p>
                </Card>
              )}
            </div>

            {/* SVG Family Tree Visualization */}
            {familyMembers.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Family Tree Visualization</h4>
                <Card className="p-4 bg-gray-50 overflow-x-auto">
                  <svg ref={svgRef} className="w-full" style={{ minHeight: "600px", border: "1px solid #e5e7eb" }} />
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
