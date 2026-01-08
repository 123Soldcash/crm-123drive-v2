import React, { useState, useEffect, useRef } from "react";
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
import { Trash2, Check, X } from "lucide-react";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [treeNotes, setTreeNotes] = useState<string>("");
  const [notesEditing, setNotesEditing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

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
      toast.success("Family member added!");
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
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = trpc.properties.updateFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("Updated!");
      refetch();
      setEditingId(null);
      setEditingField(null);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = trpc.properties.deleteFamilyMember.useMutation({
    onSuccess: () => {
      toast.success("Deleted!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleAddMember = () => {
    if (!newMember.name) {
      toast.error("Name is required");
      return;
    }

    createMutation.mutate({
      propertyId,
      ...newMember,
    } as any);
  };

  const handleEditStart = (member: FamilyMember, field: string) => {
    setEditingId(member.id);
    setEditingField(field);
    setEditValue((member as any)[field]);
  };

  const handleEditSave = (member: FamilyMember) => {
    if (editingField) {
      const updates: any = { id: member.id };
      updates[editingField] = editValue;
      updateMutation.mutate(updates);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue(null);
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this family member?")) {
      deleteMutation.mutate({ id });
    }
  };

  // Render SVG visualization (pure SVG, no d3)
  useEffect(() => {
    if (familyMembers.length === 0 || !svgRef.current) return;

    const width = 1000;
    const height = 600;
    const svg = svgRef.current;

    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Set SVG attributes
    svg.setAttribute("width", width.toString());
    svg.setAttribute("height", height.toString());
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // Create nodes from family members
    const nodeRadius = 40;
    const nodes = familyMembers.map((member, i) => ({
      id: member.id,
      name: member.name,
      relationship: member.relationship,
      percentage: member.relationshipPercentage || 0,
      x: (i % 4) * 220 + 100,
      y: Math.floor(i / 4) * 180 + 100,
    }));

    // Draw links (connections)
    if (nodes.length > 1) {
      for (let i = 1; i < nodes.length; i++) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", nodes[0].x.toString());
        line.setAttribute("y1", nodes[0].y.toString());
        line.setAttribute("x2", nodes[i].x.toString());
        line.setAttribute("y2", nodes[i].y.toString());
        line.setAttribute("stroke", "#d1d5db");
        line.setAttribute("stroke-width", "2");
        svg.appendChild(line);
      }
    }

    // Draw nodes
    nodes.forEach((node) => {
      // Circle background
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", node.x.toString());
      circle.setAttribute("cy", node.y.toString());
      circle.setAttribute("r", nodeRadius.toString());
      circle.setAttribute("fill", "#3b82f6");
      circle.setAttribute("opacity", "0.8");
      svg.appendChild(circle);

      // Name text
      const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      nameText.setAttribute("x", node.x.toString());
      nameText.setAttribute("y", (node.y - 10).toString());
      nameText.setAttribute("text-anchor", "middle");
      nameText.setAttribute("fill", "white");
      nameText.setAttribute("font-size", "12");
      nameText.setAttribute("font-weight", "bold");
      nameText.textContent = node.name.length > 12 ? node.name.substring(0, 12) + "..." : node.name;
      svg.appendChild(nameText);

      // Relationship text
      const relText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      relText.setAttribute("x", node.x.toString());
      relText.setAttribute("y", (node.y + 5).toString());
      relText.setAttribute("text-anchor", "middle");
      relText.setAttribute("fill", "white");
      relText.setAttribute("font-size", "10");
      relText.textContent = node.relationship;
      svg.appendChild(relText);

      // Percentage text
      if (node.percentage > 0) {
        const percText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        percText.setAttribute("x", node.x.toString());
        percText.setAttribute("y", (node.y + 20).toString());
        percText.setAttribute("text-anchor", "middle");
        percText.setAttribute("fill", "#fbbf24");
        percText.setAttribute("font-size", "11");
        percText.setAttribute("font-weight", "bold");
        percText.textContent = `${node.percentage}%`;
        svg.appendChild(percText);
      }
    });
  }, [familyMembers]);

  const renderEditCell = (member: FamilyMember, field: string) => {
    if (editingId !== member.id || editingField !== field) {
      return null;
    }

    switch (field) {
      case "relationshipPercentage":
        return (
          <div className="flex gap-1 items-center">
            <Input
              type="number"
              min="0"
              max="100"
              value={editValue || 0}
              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
              className="w-16 h-8"
            />
            <button
              onClick={() => handleEditSave(member)}
              className="text-green-600 hover:text-green-800"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleEditCancel}
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
              checked={editValue === 1}
              onCheckedChange={(checked) => {
                const newVal = checked ? 1 : 0;
                setEditValue(newVal);
                const updates: any = { id: member.id };
                updates[field] = newVal;
                updateMutation.mutate(updates);
              }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderCellValue = (member: FamilyMember, field: string) => {
    if (editingId === member.id && editingField === field) {
      return renderEditCell(member, field);
    }

    switch (field) {
      case "relationshipPercentage":
        return member.relationshipPercentage ? `${member.relationshipPercentage}%` : "-";
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Family Tree</h3>

        {/* Inline Entry Row */}
        <Card className="p-4 mb-4">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-medium">Name</label>
              <Input
                value={newMember.name}
                onChange={(e) =>
                  setNewMember({ ...newMember, name: e.target.value })
                }
                placeholder="Name"
                className="h-9"
              />
            </div>

            <div className="min-w-[150px]">
              <label className="text-xs font-medium">Relationship</label>
              <Select
                value={newMember.relationship}
                onValueChange={(value) =>
                  setNewMember({ ...newMember, relationship: value })
                }
              >
                <SelectTrigger className="h-9">
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

            <div className="min-w-[100px]">
              <label className="text-xs font-medium">0/%</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newMember.relationshipPercentage}
                onChange={(e) =>
                  setNewMember({
                    ...newMember,
                    relationshipPercentage: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="0"
                className="h-9"
              />
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox
                checked={newMember.isCurrentResident === 1}
                onCheckedChange={(checked) =>
                  setNewMember({
                    ...newMember,
                    isCurrentResident: checked ? 1 : 0,
                  })
                }
              />
              <span className="text-xs">Current Resident</span>
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox
                checked={newMember.isRepresentative === 1}
                onCheckedChange={(checked) =>
                  setNewMember({
                    ...newMember,
                    isRepresentative: checked ? 1 : 0,
                  })
                }
              />
              <span className="text-xs">Representative</span>
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox
                checked={newMember.isDeceased === 1}
                onCheckedChange={(checked) =>
                  setNewMember({
                    ...newMember,
                    isDeceased: checked ? 1 : 0,
                  })
                }
              />
              <span className="text-xs">Deceased</span>
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox
                checked={newMember.isContacted === 1}
                onCheckedChange={(checked) =>
                  setNewMember({
                    ...newMember,
                    isContacted: checked ? 1 : 0,
                  })
                }
              />
              <span className="text-xs">Contacted</span>
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox
                checked={newMember.isOnBoard === 1}
                onCheckedChange={(checked) =>
                  setNewMember({
                    ...newMember,
                    isOnBoard: checked ? 1 : 0,
                  })
                }
              />
              <span className="text-xs text-green-600">On Board</span>
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox
                checked={newMember.isNotOnBoard === 1}
                onCheckedChange={(checked) =>
                  setNewMember({
                    ...newMember,
                    isNotOnBoard: checked ? 1 : 0,
                  })
                }
              />
              <span className="text-xs text-red-600">NOT ON BOARD</span>
            </div>

            <Button
              size="sm"
              onClick={handleAddMember}
              disabled={createMutation.isPending}
            >
              Save
            </Button>
          </div>
        </Card>

        {/* Family Members Table */}
        {familyMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No family members added yet
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Relationship</th>
                    <th className="px-3 py-2 text-left font-medium">0/%</th>
                    <th className="px-3 py-2 text-left font-medium">Current Resident</th>
                    <th className="px-3 py-2 text-left font-medium">Representative</th>
                    <th className="px-3 py-2 text-left font-medium">Deceased</th>
                    <th className="px-3 py-2 text-left font-medium">Contacted</th>
                    <th className="px-3 py-2 text-left font-medium">On Board</th>
                    <th className="px-3 py-2 text-left font-medium">NOT ON BOARD</th>
                    <th className="px-3 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {familyMembers.map((member) => (
                    <tr key={member.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{member.name}</td>
                      <td className="px-3 py-2">{member.relationship}</td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() =>
                          handleEditStart(member, "relationshipPercentage")
                        }
                      >
                        {renderCellValue(member, "relationshipPercentage")}
                      </td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() =>
                          handleEditStart(member, "isCurrentResident")
                        }
                      >
                        {renderCellValue(member, "isCurrentResident")}
                      </td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() =>
                          handleEditStart(member, "isRepresentative")
                        }
                      >
                        {renderCellValue(member, "isRepresentative")}
                      </td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() => handleEditStart(member, "isDeceased")}
                      >
                        {renderCellValue(member, "isDeceased")}
                      </td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() => handleEditStart(member, "isContacted")}
                      >
                        {renderCellValue(member, "isContacted")}
                      </td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() => handleEditStart(member, "isOnBoard")}
                      >
                        {renderCellValue(member, "isOnBoard")}
                      </td>
                      <td
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                        onClick={() =>
                          handleEditStart(member, "isNotOnBoard")
                        }
                      >
                        {renderCellValue(member, "isNotOnBoard")}
                      </td>
                      <td className="px-3 py-2">
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
    </div>
  );
}
