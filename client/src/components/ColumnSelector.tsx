import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Settings } from "lucide-react";

export interface ColumnVisibility {
  leadId: boolean;
  address: boolean;
  ownerName: boolean;
  deskName: boolean;
  statusTags: boolean;
  market: boolean;
  ownerLocation: boolean;
  agents: boolean;
  value: boolean;
  equity: boolean;
  entryDate: boolean;
}

export type SortOption = "value_desc" | "newest" | "oldest" | "address_asc";

interface ColumnSelectorProps {
  columns: ColumnVisibility;
  onColumnChange: (columns: ColumnVisibility) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

export function ColumnSelector({ columns, onColumnChange, sortBy, onSortChange }: ColumnSelectorProps) {
  const columnOptions = [
    { key: "leadId" as const, label: "Lead ID" },
    { key: "address" as const, label: "Address" },
    { key: "ownerName" as const, label: "Owner Name" },
    { key: "deskName" as const, label: "Desk Name" },
    { key: "statusTags" as const, label: "Status Tags" },
    { key: "market" as const, label: "Market Status" },
    { key: "ownerLocation" as const, label: "Owner Location" },
    { key: "agents" as const, label: "Agents" },
    { key: "value" as const, label: "Property Value" },
    { key: "equity" as const, label: "Equity %" },
    { key: "entryDate" as const, label: "Entry Date" },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "value_desc", label: "Highest Value" },
    { value: "address_asc", label: "Address A-Z" },
  ];

  const toggleColumn = (key: keyof ColumnVisibility) => {
    onColumnChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {sortBy !== undefined && onSortChange && (
          <>
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <div className="space-y-1 p-2">
              {sortOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sort-${option.value}`}
                    checked={sortBy === option.value}
                    onCheckedChange={() => onSortChange(option.value)}
                  />
                  <label
                    htmlFor={`sort-${option.value}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-2 p-2">
          {columnOptions.map((option) => (
            <div key={option.key} className="flex items-center space-x-2">
              <Checkbox
                id={option.key}
                checked={columns[option.key]}
                onCheckedChange={() => toggleColumn(option.key)}
              />
              <label
                htmlFor={option.key}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
