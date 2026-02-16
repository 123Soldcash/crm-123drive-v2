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
import { Trash2, Edit2, Save, X } from "lucide-react";
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
      toast.success("✅ Family member added!", { duration: 2000 });
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
      toast.error("❌ Error adding family member", { duration: 2000 });
    },
  });

  const updateMutation = trpc.properties.updateFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Updated!", { duration: 1500 });
      refetch();
      setEditingId(null);
    },
    onError: (error) => {
      toast.error("❌ Error updating", { duration: 2000 });
    },
  });

  const deleteMutation = trpc.properties.deleteFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("✅ Deleted!", { duration: 1500 });
      refetch();
    },
    onError: (error) => {
      toast.error("❌ Error deleting", { duration: 2000 });
    },
  });

  const handleSaveNewMember = async () => {
    if (!newMember.name.trim()) {
      toast.error("❌ Name is required", { duration: 2000 });
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

  return (
    <div className="space-y-6">
      <div>
            <Card className="p-4 mb-4 bg-blue-50 border-2 border-blue-200">
              <div className="mb-2">
                <p className="text-xs font-semibold text-blue-900">➕ Add New Family Member</p>
              </div>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium">Name *</label>
                  <Input
                    ref={nameInputRef}
                    placeholder="Enter name..."
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs font-medium">Relationship *</label>
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
                <div className="flex-1 min-w-[80px]">
                  <label className="text-xs font-medium">Inheritance %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0.00"
                    value={newMember.relationshipPercentage}
                    onChange={(e) => setNewMember({ ...newMember, relationshipPercentage: parseFloat(e.target.value) || 0 })}
                    onKeyDown={handleKeyDown}
                    className="text-xs"
                  />
                </div>
                <div className="flex gap-1 items-end">
                  <Checkbox
                    checked={newMember.isCurrentResident === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isCurrentResident: checked ? 1 : 0 })}
                    title="Current Resident"
                  />
                  <span className="text-xs">Current Resident</span>
                </div>
                <div className="flex gap-1 items-end">
                  <Checkbox
                    checked={newMember.isRepresentative === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isRepresentative: checked ? 1 : 0 })}
                    title="Representative"
                  />
                  <span className="text-xs">Representative</span>
                </div>
                <div className="flex gap-1 items-end">
                  <Checkbox
                    checked={newMember.isDeceased === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isDeceased: checked ? 1 : 0 })}
                    title="Deceased"
                  />
                  <span className="text-xs">Deceased</span>
                </div>
                <div className="flex gap-1 items-end">
                  <Checkbox
                    checked={newMember.isContacted === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isContacted: checked ? 1 : 0 })}
                    title="Contacted"
                  />
                  <span className="text-xs">Contacted</span>
                </div>
                <div className="flex gap-1 items-end">
                  <Checkbox
                    checked={newMember.isOnBoard === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isOnBoard: checked ? 1 : 0 })}
                    title="On Board"
                  />
                  <span className="text-xs">On Board</span>
                </div>
                <div className="flex gap-1 items-end">
                  <Checkbox
                    checked={newMember.isNotOnBoard === 1}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isNotOnBoard: checked ? 1 : 0 })}
                    title="NOT ON BOARD"
                  />
                  <span className="text-xs">NOT ON BOARD</span>
                </div>
                <Button
                  onClick={handleSaveNewMember}
                  disabled={createMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </Card>

            {familyMembers.length > 0 ? (
              <Card className="p-4 mb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2 font-semibold">Name</th>
                      <th className="text-left p-2 font-semibold">Relationship</th>
                      <th className="text-left p-2 font-semibold">Inheritance %</th>
                      <th className="text-left p-2 font-semibold">Current Resident</th>
                      <th className="text-left p-2 font-semibold">Representative</th>
                      <th className="text-left p-2 font-semibold">Deceased</th>
                      <th className="text-left p-2 font-semibold">Contacted</th>
                      <th className="text-left p-2 font-semibold">On Board</th>
                      <th className="text-left p-2 font-semibold">NOT ON BOARD</th>
                      <th className="text-left p-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.map((member) => (
                      <tr key={member.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">
                          {editingId === member.id ? (
                            <Input
                              value={editData.name || member.name}
                              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                              placeholder="Name"
                              className="text-sm"
                            />
                          ) : (
                            member.name
                          )}
                        </td>
                        <td className="p-2">
                          {editingId === member.id ? (
                            <Select value={editData.relationship || member.relationship} onValueChange={(value) => setEditData({ ...editData, relationship: value })}>
                              <SelectTrigger className="text-sm">
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
                          ) : (
                            member.relationship
                          )}
                        </td>
                        <td className="p-2">
                          {editingId === member.id ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={editData.relationshipPercentage !== undefined ? editData.relationshipPercentage : member.relationshipPercentage || 0}
                              onChange={(e) => setEditData({ ...editData, relationshipPercentage: parseFloat(e.target.value) || 0 })}
                              className="text-xs w-20"
                            />
                          ) : (
                            `${(member.relationshipPercentage || 0).toFixed(2)}%`
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {editingId === member.id ? (
                            <Checkbox
                              checked={editData.isCurrentResident === 1}
                              onCheckedChange={(checked) => setEditData({ ...editData, isCurrentResident: checked ? 1 : 0 })}
                            />
                          ) : (
                            member.isCurrentResident === 1 && "✓"
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {editingId === member.id ? (
                            <Checkbox
                              checked={editData.isRepresentative === 1}
                              onCheckedChange={(checked) => setEditData({ ...editData, isRepresentative: checked ? 1 : 0 })}
                            />
                          ) : (
                            member.isRepresentative === 1 && "✓"
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {editingId === member.id ? (
                            <Checkbox
                              checked={editData.isDeceased === 1}
                              onCheckedChange={(checked) => setEditData({ ...editData, isDeceased: checked ? 1 : 0 })}
                            />
                          ) : (
                            member.isDeceased === 1 && "✓"
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {editingId === member.id ? (
                            <Checkbox
                              checked={editData.isContacted === 1}
                              onCheckedChange={(checked) => setEditData({ ...editData, isContacted: checked ? 1 : 0 })}
                            />
                          ) : (
                            member.isContacted === 1 && "✓"
                          )}
                        </td>
                        <td className="p-2 text-center text-green-600">
                          {editingId === member.id ? (
                            <Checkbox
                              checked={editData.isOnBoard === 1}
                              onCheckedChange={(checked) => setEditData({ ...editData, isOnBoard: checked ? 1 : 0 })}
                            />
                          ) : (
                            member.isOnBoard === 1 && "✓"
                          )}
                        </td>
                        <td className="p-2 text-center text-red-600">
                          {editingId === member.id ? (
                            <Checkbox
                              checked={editData.isNotOnBoard === 1}
                              onCheckedChange={(checked) => setEditData({ ...editData, isNotOnBoard: checked ? 1 : 0 })}
                            />
                          ) : (
                            member.isNotOnBoard === 1 && "✗"
                          )}
                        </td>
                        <td className="p-2 flex gap-1">
                          {editingId === member.id ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleEditSave(member.id)} className="gap-1">
                                <Save className="w-3 h-3" /> Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1">
                                <X className="w-3 h-3" /> Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setEditingId(member.id); setEditData(member); }} className="gap-1">
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate({ id: member.id })} className="gap-1 text-red-600">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card className="p-8 text-center mb-4">
                <p className="text-gray-500">No family members added yet</p>
                <p className="text-xs text-gray-400">Use the form above to add family members</p>
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
      </div>
    </div>
  );
}
