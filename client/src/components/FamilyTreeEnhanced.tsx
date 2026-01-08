'use client';

import { useState, useRef } from "react";
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
import { Trash2, ChevronDown, ChevronUp, Edit2, Save, X } from "lucide-react";
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
  parentId?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FamilyTreeProps {
  propertyId: number;
}

export function FamilyTreeEnhanced({ propertyId }: FamilyTreeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<FamilyMember>>({});
  const [treeNotes, setTreeNotes] = useState<string>("");
  const [notesEditing, setNotesEditing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
      toast.success("✅ Pessoa adicionada!", { duration: 2000 });
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
      toast.error("❌ Erro ao adicionar", { duration: 2000 });
    },
  });

  const updateMutation = trpc.properties.updateFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Atualizado!", { duration: 1500 });
      refetch();
      setEditingId(null);
    },
    onError: (error) => {
      toast.error("❌ Erro ao atualizar", { duration: 2000 });
    },
  });

  const deleteMutation = trpc.properties.deleteFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Deletado!", { duration: 1500 });
      refetch();
    },
    onError: (error) => {
      toast.error("❌ Erro ao deletar", { duration: 2000 });
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

  const handleEditSave = (memberId: number) => {
    updateMutation.mutate({
      id: memberId,
      ...editData,
    });
  };

  const buildHierarchy = (members: FamilyMember[], parentId: number | null = null, depth = 0): JSX.Element[] => {
    const children = members.filter(m => (m.parentId || null) === parentId);
    
    return children.map((member) => (
      <div key={member.id} style={{ marginLeft: `${depth * 20}px` }} className="border-l-2 border-blue-200 pl-4 py-2">
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded mb-2">
          <div className="flex-1">
            {editingId === member.id ? (
              <div className="space-y-2">
                <Input
                  value={editData.name || member.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Nome"
                  className="mb-1"
                />
                <Select value={editData.relationship || member.relationship} onValueChange={(value) => setEditData({ ...editData, relationship: value })}>
                  <SelectTrigger className="mb-1">
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
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editData.relationshipPercentage !== undefined ? editData.relationshipPercentage : member.relationshipPercentage || 0}
                  onChange={(e) => setEditData({ ...editData, relationshipPercentage: parseInt(e.target.value) || 0 })}
                  placeholder="Herança %"
                  className="mb-1"
                />
              </div>
            ) : (
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-gray-600">{member.relationship} {member.relationshipPercentage ? `(${member.relationshipPercentage}%)` : ""}</p>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {editingId === member.id ? (
              <>
                <Button size="sm" variant="outline" onClick={() => handleEditSave(member.id)} className="gap-1">
                  <Save className="w-3 h-3" /> Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1">
                  <X className="w-3 h-3" /> Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditingId(member.id); setEditData(member); }} className="gap-1">
                  <Edit2 className="w-3 h-3" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate({ id: member.id })} className="gap-1 text-red-600">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        {buildHierarchy(members, member.id, depth + 1)}
      </div>
    ));
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
                <Button
                  onClick={handleSaveNewMember}
                  disabled={createMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </Card>

            {familyMembers.length > 0 ? (
              <Card className="p-4 mb-4 bg-white">
                <h4 className="font-semibold mb-4">Árvore Genealógica Hierárquica</h4>
                <div className="space-y-2">
                  {buildHierarchy(familyMembers)}
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center mb-4">
                <p className="text-gray-500">Nenhum membro adicionado ainda</p>
                <p className="text-xs text-gray-400">Use o formulário acima para adicionar membros da família</p>
              </Card>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
