import { describe, it, expect } from "vitest";

// Test the pipeline stage filtering logic (same as used in PipelineKanban.tsx)
const STAGE_CONFIGS = [
  { id: "NEW_LEAD", isPipeline: false, phase: "acquisition" },
  { id: "LEAD_IMPORTED", isPipeline: false, phase: "acquisition" },
  { id: "SKIP_TRACED", isPipeline: false, phase: "acquisition" },
  { id: "FIRST_CONTACT_MADE", isPipeline: false, phase: "seller" },
  { id: "ANALYZING_DEAL", isPipeline: true, phase: "seller" },
  { id: "OFFER_PENDING", isPipeline: true, phase: "seller" },
  { id: "FOLLOW_UP_ON_CONTRACT", isPipeline: true, phase: "seller" },
  { id: "UNDER_CONTRACT_A", isPipeline: true, phase: "seller" },
  { id: "MARKETING_TO_BUYERS", isPipeline: true, phase: "buyer" },
  { id: "BUYER_INTERESTED", isPipeline: true, phase: "buyer" },
  { id: "CLOSED_WON", isPipeline: true, phase: "complete" },
  { id: "DEAD_LOST", isPipeline: false, phase: "dead" },
];

const pipelineStageIds = STAGE_CONFIGS
  .filter((s) => s.isPipeline && s.phase !== "dead")
  .map((s) => s.id);

interface MockProperty {
  id: number;
  addressLine1: string;
  city: string;
  state: string;
  owner1Name: string | null;
  estimatedValue: number | null;
  dealStage: string;
  stageChangedAt: Date;
  leadTemperature: string | null;
  deskName: string | null;
  deskStatus: string | null;
}

const mockProperties: MockProperty[] = [
  {
    id: 1, addressLine1: "123 Main St", city: "Miami", state: "FL",
    owner1Name: "John Doe", estimatedValue: 500000, dealStage: "OFFER_PENDING",
    stageChangedAt: new Date("2026-03-10"), leadTemperature: "SUPER HOT",
    deskName: "DESK_CHRIS", deskStatus: "ACTIVE",
  },
  {
    id: 2, addressLine1: "456 Oak Ave", city: "Tampa", state: "FL",
    owner1Name: "Jane Smith", estimatedValue: 300000, dealStage: "ANALYZING_DEAL",
    stageChangedAt: new Date("2026-03-15"), leadTemperature: "HOT",
    deskName: "DESK_3", deskStatus: "ACTIVE",
  },
  {
    id: 3, addressLine1: "789 Pine Rd", city: "Orlando", state: "FL",
    owner1Name: "Bob Wilson", estimatedValue: 400000, dealStage: "NEW_LEAD",
    stageChangedAt: new Date("2026-03-20"), leadTemperature: "COLD",
    deskName: "DESK_CHRIS", deskStatus: "BIN",
  },
  {
    id: 4, addressLine1: "321 Elm St", city: "Jacksonville", state: "FL",
    owner1Name: "Alice Brown", estimatedValue: 600000, dealStage: "UNDER_CONTRACT_A",
    stageChangedAt: new Date("2026-03-01"), leadTemperature: "WARM",
    deskName: "DESK_CHRIS", deskStatus: "ACTIVE",
  },
  {
    id: 5, addressLine1: "654 Maple Dr", city: "Fort Lauderdale", state: "FL",
    owner1Name: "Charlie Green", estimatedValue: 250000, dealStage: "DEAD_LOST",
    stageChangedAt: new Date("2026-03-05"), leadTemperature: "DEAD",
    deskName: "DESK_3", deskStatus: "DEAD",
  },
  {
    id: 6, addressLine1: "987 Cedar Ln", city: "Naples", state: "FL",
    owner1Name: "Diana White", estimatedValue: 700000, dealStage: "CLOSED_WON",
    stageChangedAt: new Date("2026-03-18"), leadTemperature: "SUPER HOT",
    deskName: null, deskStatus: null,
  },
  {
    id: 7, addressLine1: "111 Birch Way", city: "Sarasota", state: "FL",
    owner1Name: "Eve Black", estimatedValue: null, dealStage: "OFFER_PENDING",
    stageChangedAt: new Date("2026-03-12"), leadTemperature: null,
    deskName: "DESK_3", deskStatus: "ACTIVE",
  },
];

// Replicate the filtering logic from PipelineKanban.tsx
function filterPipelineProperties(properties: MockProperty[], deskFilter: string) {
  let filtered = properties.filter((p) => pipelineStageIds.includes(p.dealStage));
  if (deskFilter !== "all") {
    filtered = filtered.filter((p) => p.deskName === deskFilter);
  }
  return filtered;
}

// Replicate the desk count logic
function getDeskCounts(properties: MockProperty[]) {
  const pipelineProps = properties.filter((p) => pipelineStageIds.includes(p.dealStage));
  const counts: Record<string, number> = {};
  pipelineProps.forEach((p) => {
    const desk = p.deskName || "NOT_ASSIGNED";
    counts[desk] = (counts[desk] || 0) + 1;
  });
  return counts;
}

type SortField = "address" | "owner" | "value" | "stage" | "daysInStage" | "desk" | "temperature";
type SortDir = "asc" | "desc";

function sortProperties(properties: MockProperty[], sortField: SortField, sortDir: SortDir) {
  const sorted = [...properties];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "address":
        cmp = (a.addressLine1 || "").localeCompare(b.addressLine1 || "");
        break;
      case "owner":
        cmp = (a.owner1Name || "").localeCompare(b.owner1Name || "");
        break;
      case "desk":
        cmp = (a.deskName || "").localeCompare(b.deskName || "");
        break;
      case "value":
        cmp = (a.estimatedValue || 0) - (b.estimatedValue || 0);
        break;
      case "stage": {
        const stageOrder = STAGE_CONFIGS.map((s) => s.id);
        cmp = stageOrder.indexOf(a.dealStage) - stageOrder.indexOf(b.dealStage);
        break;
      }
      case "temperature": {
        const tempOrder = ["SUPER HOT", "HOT", "WARM", "COLD", "TBD", "DEAD"];
        cmp = tempOrder.indexOf(a.leadTemperature || "TBD") - tempOrder.indexOf(b.leadTemperature || "TBD");
        break;
      }
      case "daysInStage": {
        const daysA = Date.now() - new Date(a.stageChangedAt).getTime();
        const daysB = Date.now() - new Date(b.stageChangedAt).getTime();
        cmp = daysA - daysB;
        break;
      }
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

describe("Pipeline Stage Filtering", () => {
  it("should only include pipeline stages (not pre-pipeline or dead)", () => {
    expect(pipelineStageIds).toContain("ANALYZING_DEAL");
    expect(pipelineStageIds).toContain("OFFER_PENDING");
    expect(pipelineStageIds).toContain("CLOSED_WON");
    expect(pipelineStageIds).not.toContain("NEW_LEAD");
    expect(pipelineStageIds).not.toContain("LEAD_IMPORTED");
    expect(pipelineStageIds).not.toContain("SKIP_TRACED");
    expect(pipelineStageIds).not.toContain("DEAD_LOST");
  });

  it("should filter out non-pipeline properties when deskFilter is 'all'", () => {
    const result = filterPipelineProperties(mockProperties, "all");
    // Should include ids 1, 2, 4, 6, 7 (pipeline stages)
    // Should exclude ids 3 (NEW_LEAD) and 5 (DEAD_LOST)
    expect(result.length).toBe(5);
    expect(result.map((p) => p.id).sort()).toEqual([1, 2, 4, 6, 7]);
  });

  it("should filter by desk AND pipeline stage", () => {
    const result = filterPipelineProperties(mockProperties, "DESK_CHRIS");
    // DESK_CHRIS properties: id 1 (OFFER_PENDING), id 3 (NEW_LEAD), id 4 (UNDER_CONTRACT_A)
    // After pipeline filter: id 1 and id 4 only
    expect(result.length).toBe(2);
    expect(result.map((p) => p.id).sort()).toEqual([1, 4]);
  });

  it("should filter by DESK_3 and pipeline stage", () => {
    const result = filterPipelineProperties(mockProperties, "DESK_3");
    // DESK_3 properties: id 2 (ANALYZING_DEAL), id 5 (DEAD_LOST), id 7 (OFFER_PENDING)
    // After pipeline filter: id 2 and id 7 only
    expect(result.length).toBe(2);
    expect(result.map((p) => p.id).sort()).toEqual([2, 7]);
  });

  it("should return empty for desk with no pipeline properties", () => {
    const result = filterPipelineProperties(mockProperties, "DESK_5");
    expect(result.length).toBe(0);
  });
});

describe("Pipeline Desk Counts", () => {
  it("should count only pipeline properties per desk", () => {
    const counts = getDeskCounts(mockProperties);
    // DESK_CHRIS: id 1, 4 (pipeline) — id 3 is NEW_LEAD, excluded
    expect(counts["DESK_CHRIS"]).toBe(2);
    // DESK_3: id 2, 7 (pipeline) — id 5 is DEAD_LOST, excluded
    expect(counts["DESK_3"]).toBe(2);
    // null desk (id 6 CLOSED_WON) → NOT_ASSIGNED
    expect(counts["NOT_ASSIGNED"]).toBe(1);
  });

  it("should not count non-pipeline properties", () => {
    const counts = getDeskCounts(mockProperties);
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    // Total pipeline properties: 5
    expect(total).toBe(5);
  });
});

describe("Pipeline List View Sorting", () => {
  const pipelineProps = filterPipelineProperties(mockProperties, "all");

  it("should sort by address ascending", () => {
    const sorted = sortProperties(pipelineProps, "address", "asc");
    expect(sorted[0].addressLine1).toBe("111 Birch Way");
    expect(sorted[sorted.length - 1].addressLine1).toBe("987 Cedar Ln");
  });

  it("should sort by value descending", () => {
    const sorted = sortProperties(pipelineProps, "value", "desc");
    expect(sorted[0].estimatedValue).toBe(700000);
    expect(sorted[sorted.length - 1].estimatedValue).toBe(null);
  });

  it("should sort by stage ascending (pipeline order)", () => {
    const sorted = sortProperties(pipelineProps, "stage", "asc");
    expect(sorted[0].dealStage).toBe("ANALYZING_DEAL");
    expect(sorted[sorted.length - 1].dealStage).toBe("CLOSED_WON");
  });

  it("should sort by temperature ascending", () => {
    const sorted = sortProperties(pipelineProps, "temperature", "asc");
    expect(sorted[0].leadTemperature).toBe("SUPER HOT");
  });

  it("should sort by desk ascending", () => {
    const sorted = sortProperties(pipelineProps, "desk", "asc");
    // null desk sorts first (empty string)
    expect(sorted[0].deskName).toBeNull();
  });
});
