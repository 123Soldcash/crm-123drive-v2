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
import { Trash2, Plus, Edit2 } from "lucide-react";
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
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FamilyTreeProps {
  propertyId: number;
}

export function FamilyTree({ propertyId }: FamilyTreeProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  Relationship
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
                  On Board
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
                  <td className="px-4 py-2 text-sm">{member.relationship}</td>
                  <td className="px-4 py-2 text-sm">
                    {member.isRepresentative === 1 ? (
                      <Checkbox checked disabled />
                    ) : (
                      <Checkbox disabled />
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {member.isDeceased === 1 ? (
                      <span className="text-gray-500">🕊</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {member.isContacted === 1 ? (
                      <Checkbox checked disabled />
                    ) : (
                      <Checkbox disabled />
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {member.isOnBoard === 1 ? (
                      <span className="text-green-600 font-medium">✓</span>
                    ) : member.isNotOnBoard === 1 ? (
                      <span className="text-red-600 font-medium">✗</span>
                    ) : null}
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
        </Card>
      )}
    </div>
  );
}
