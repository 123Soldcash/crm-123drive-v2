import React, { useState } from "react";
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
import { Trash2, Plus, Edit2, Check, X } from "lucide-react";
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

interface EditingCell {
  memberId: number;
  field: string;
  value: any;
}

interface FamilyTreeProps {
  propertyId: number;
}

export function FamilyTreeEnhanced({ propertyId }: FamilyTreeProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [formData, setFormData] = useState<Partial<FamilyMember>>({
    name: "",
    relationship: "Owner",
    phone: "",
    email: "",
    isRepresentative: 0,
    isDeceased: 0,
    isContacted: 0,
    isOnBoard: 0,
    isNotOnBoard: 0,
    relationshipPercentage: 0,
    isCurrentResident: 0,
    notes: "",
  });

  const { data: familyMembers = [], refetch } = trpc.properties.getFamilyMembers.useQuery({
    propertyId,
  });

  const createMutation = trpc.properties.createFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("Family member added successfully!");
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = trpc.properties.updateFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("Family member updated successfully!");
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = trpc.properties.deleteFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("Family member deleted successfully!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      relationship: "Owner",
      phone: "",
      email: "",
      isRepresentative: 0,
      isDeceased: 0,
      isContacted: 0,
      isOnBoard: 0,
      isNotOnBoard: 0,
      relationshipPercentage: 0,
      isCurrentResident: 0,
      notes: "",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...formData,
      } as any);
    } else {
      createMutation.mutate({
        propertyId,
        ...formData,
      } as any);
    }
  };

  const handleEdit = (member: FamilyMember) => {
    setFormData(member);
    setEditingId(member.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this family member?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleInlineEdit = (member: FamilyMember, field: string, value: any) => {
    setEditingCell({ memberId: member.id, field, value });
  };

  const handleInlineSave = (member: FamilyMember, field: string, value: any) => {
    const updates: any = { id: member.id };
    updates[field] = value;
    
    updateMutation.mutate(updates);
    setEditingCell(null);
  };

  const handleInlineCancel = () => {
    setEditingCell(null);
  };

  const renderCell = (member: FamilyMember, field: string) => {
    const isEditing = editingCell?.memberId === member.id && editingCell?.field === field;
    
    if (isEditing) {
      return renderEditingCell(member, field);
    }

    switch (field) {
      case "name":
        return member.name;
      case "relationship":
        return `${member.relationship} ${member.relationshipPercentage ? `[${member.relationshipPercentage}%]` : ""}`;
      case "isCurrentResident":
        return member.isCurrentResident === 1 ? "✓" : "";
      case "isRepresentative":
        return member.isRepresentative === 1 ? "✓" : "";
      case "isDeceased":
        return member.isDeceased === 1 ? "🕊" : "";
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

  const renderEditingCell = (member: FamilyMember, field: string) => {
    const value = editingCell?.value;

    switch (field) {
      case "relationshipPercentage":
        return (
          <div className="flex gap-1 items-center">
            <Input
              type="number"
              min="0"
              max="100"
              value={value || 0}
              onChange={(e) =>
                setEditingCell({
                  ...editingCell!,
                  value: parseInt(e.target.value) || 0,
                })
              }
              className="w-16 h-8"
            />
            <button
              onClick={() => handleInlineSave(member, field, value)}
              className="text-green-600 hover:text-green-800"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleInlineCancel}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      case "isCurrentResident":
      case "isRepresentative":
      case "isDeceased":
      case "isContacted":
      case "isOnBoard":
      case "isNotOnBoard":
        return (
          <div className="flex gap-1 items-center">
            <Checkbox
              checked={value === 1}
              onCheckedChange={(checked) => {
                const newValue = checked ? 1 : 0;
                handleInlineSave(member, field, newValue);
              }}
            />
          </div>
        );
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Family Tree</h3>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Family member name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Relationship *</label>
                <Select
                  value={formData.relationship || "Owner"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, relationship: value })
                  }
                >
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

              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Email address"
                  type="email"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Relationship %</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.relationshipPercentage || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, relationshipPercentage: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0-100"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.isRepresentative === 1}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isRepresentative: checked ? 1 : 0,
                    })
                  }
                />
                <label className="text-sm">Representative</label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.isDeceased === 1}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDeceased: checked ? 1 : 0 })
                  }
                />
                <label className="text-sm">🕊 Deceased</label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.isContacted === 1}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isContacted: checked ? 1 : 0 })
                  }
                />
                <label className="text-sm">Contacted</label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.isOnBoard === 1}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isOnBoard: checked ? 1 : 0 })
                  }
                />
                <label className="text-sm text-green-600">✓ ON BOARD</label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.isNotOnBoard === 1}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isNotOnBoard: checked ? 1 : 0,
                    })
                  }
                />
                <label className="text-sm text-red-600">✗ NOT ON BOARD</label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.isCurrentResident === 1}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isCurrentResident: checked ? 1 : 0 })
                  }
                />
                <label className="text-sm">Current Resident</label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  createMutation.isPending || updateMutation.isPending
                }
              >
                {editingId ? "Update Member" : "Add Member"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {familyMembers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No family members added yet
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Relationship [%]
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Current Resident
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Representative
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Deceased
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Contacted
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    ON BOARD
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    NOT ON BOARD
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {familyMembers.map((member) => (
                  <tr key={member.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{member.name}</td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(
                          member,
                          "relationshipPercentage",
                          member.relationshipPercentage
                        )
                      }
                    >
                      {renderCell(member, "relationship")}
                    </td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(
                          member,
                          "isCurrentResident",
                          member.isCurrentResident
                        )
                      }
                    >
                      {renderCell(member, "isCurrentResident")}
                    </td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(
                          member,
                          "isRepresentative",
                          member.isRepresentative
                        )
                      }
                    >
                      {renderCell(member, "isRepresentative")}
                    </td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(member, "isDeceased", member.isDeceased)
                      }
                    >
                      {renderCell(member, "isDeceased")}
                    </td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(
                          member,
                          "isContacted",
                          member.isContacted
                        )
                      }
                    >
                      {renderCell(member, "isContacted")}
                    </td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(member, "isOnBoard", member.isOnBoard)
                      }
                    >
                      {renderCell(member, "isOnBoard")}
                    </td>
                    <td
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                      onClick={() =>
                        handleInlineEdit(
                          member,
                          "isNotOnBoard",
                          member.isNotOnBoard
                        )
                      }
                    >
                      {renderCell(member, "isNotOnBoard")}
                    </td>
                    <td className="px-4 py-2 text-sm flex gap-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
