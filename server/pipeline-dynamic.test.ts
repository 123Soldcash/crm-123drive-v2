import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive tests for Pipeline Dynamic Button & Display
 * 
 * Tests cover:
 * 1. Backend: getPropertyById returns dealStage and stageChangedAt
 * 2. Backend: getPropertiesByStage uses safe query building (no undefined in .where())
 * 3. Frontend: StickyPropertyHeader dynamic button text (Add/Update Pipeline)
 * 4. Frontend: PropertyDetail dialog shows dynamic title and description
 * 5. Frontend: PropertyDetail prevents selecting same stage (duplicate prevention)
 * 6. Frontend: PropertyDetail pre-selects current stage when opening dialog
 * 7. Frontend: PipelineKanban correctly filters and displays properties
 * 8. Frontend: Dynamic toast messages based on add vs update
 * 9. Integration: dealStage flows from DB → getById → PropertyDetail → StickyPropertyHeader
 */

const SERVER_DIR = path.resolve(__dirname);
const CLIENT_DIR = path.resolve(__dirname, "../client/src");

// ============================================================
// 1. Backend: getPropertyById returns dealStage and stageChangedAt
// ============================================================
describe("Pipeline Dynamic - getPropertyById includes dealStage", () => {
  it("should include dealStage in the first select (by leadId)", () => {
    const dbContent = fs.readFileSync(path.join(SERVER_DIR, "db.ts"), "utf-8");
    
    // Find the getPropertyById function
    const funcStart = dbContent.indexOf("export async function getPropertyById");
    expect(funcStart).toBeGreaterThan(-1);
    
    // Get the first select block (by leadId)
    const firstSelectBlock = dbContent.substring(funcStart, funcStart + 2000);
    expect(firstSelectBlock).toContain("dealStage: properties.dealStage");
    expect(firstSelectBlock).toContain("stageChangedAt: properties.stageChangedAt");
  });

  it("should include dealStage in the fallback select (by id)", () => {
    const dbContent = fs.readFileSync(path.join(SERVER_DIR, "db.ts"), "utf-8");
    
    // Find the fallback select section
    const fallbackIdx = dbContent.indexOf("If not found by leadId, try by database id");
    expect(fallbackIdx).toBeGreaterThan(-1);
    
    const fallbackBlock = dbContent.substring(fallbackIdx, fallbackIdx + 2000);
    expect(fallbackBlock).toContain("dealStage: properties.dealStage");
    expect(fallbackBlock).toContain("stageChangedAt: properties.stageChangedAt");
  });

  it("should have dealStage and stageChangedAt in both select blocks consistently", () => {
    const dbContent = fs.readFileSync(path.join(SERVER_DIR, "db.ts"), "utf-8");
    
    // Count occurrences of dealStage in the file
    const dealStageMatches = dbContent.match(/dealStage:\s*properties\.dealStage/g);
    expect(dealStageMatches).toBeTruthy();
    expect(dealStageMatches!.length).toBeGreaterThanOrEqual(2);
    
    const stageChangedMatches = dbContent.match(/stageChangedAt:\s*properties\.stageChangedAt/g);
    expect(stageChangedMatches).toBeTruthy();
    expect(stageChangedMatches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// 2. Backend: getPropertiesByStage safe query building
// ============================================================
describe("Pipeline Dynamic - getPropertiesByStage safe query building", () => {
  it("should build query without .where() when no conditions exist", () => {
    const stageContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    // Should have separate if blocks for conditions.length
    expect(stageContent).toContain("if (conditions.length === 1)");
    expect(stageContent).toContain("if (conditions.length > 1)");
  });

  it("should use conditional query building instead of passing undefined to .where()", () => {
    const stageContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    const funcStart = stageContent.indexOf("async function getPropertiesByStage");
    const funcCode = stageContent.substring(funcStart, funcStart + 3000);
    
    // Should use conditional if blocks to build query
    expect(funcCode).toContain("conditions.length === 1");
    expect(funcCode).toContain("conditions.length > 1");
  });

  it("should select lean fields for pipeline view performance", () => {
    const stageContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    // Should have selectFields with essential pipeline columns
    expect(stageContent).toContain("addressLine1: properties.addressLine1");
    expect(stageContent).toContain("dealStage: properties.dealStage");
    expect(stageContent).toContain("stageChangedAt: properties.stageChangedAt");
    expect(stageContent).toContain("estimatedValue: properties.estimatedValue");
    expect(stageContent).toContain("owner1Name: properties.owner1Name");
  });

  it("should still order by stageChangedAt descending", () => {
    const stageContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    expect(stageContent).toContain("desc(properties.stageChangedAt)");
  });
});

// ============================================================
// 3. Frontend: StickyPropertyHeader dynamic button text
// ============================================================
describe("Pipeline Dynamic - StickyPropertyHeader button", () => {
  it("should accept currentDealStage prop", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    expect(headerContent).toContain("currentDealStage");
  });

  it("should import getStageConfig and DealStage from stageConfig", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    expect(headerContent).toContain("getStageConfig");
    expect(headerContent).toContain("DealStage");
    expect(headerContent).toContain("stageConfig");
  });

  it("should show 'Add to Pipeline' when not in pipeline", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    expect(headerContent).toContain('"Add to Pipeline"');
  });

  it("should show pipeline stage short label when in pipeline", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    // Should use shortLabel from stageConfig
    expect(headerContent).toContain("shortLabel");
    expect(headerContent).toContain("Pipeline:");
  });

  it("should use emerald color when property is in pipeline", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    expect(headerContent).toContain("bg-emerald-600");
    expect(headerContent).toContain("bg-blue-600");
  });

  it("should check isPipeline flag to determine button state", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    expect(headerContent).toContain("isPipeline");
  });

  it("should have currentDealStage as optional prop (string | null | undefined)", () => {
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    expect(headerContent).toContain("currentDealStage?:");
  });
});

// ============================================================
// 4. Frontend: PropertyDetail dialog dynamic title and description
// ============================================================
describe("Pipeline Dynamic - PropertyDetail dialog", () => {
  it("should show 'Update Pipeline Stage' title when property is in pipeline", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("Update Pipeline Stage");
  });

  it("should show 'Add to Deal Pipeline' title when property is NOT in pipeline", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("Add to Deal Pipeline");
  });

  it("should display current stage name in description when updating", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("Currently in:");
  });

  it("should show current stage badge with icon when in pipeline", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("Current Stage:");
    expect(detailContent).toContain("bg-emerald-50");
    expect(detailContent).toContain("border-emerald-200");
  });

  it("should mark current stage with (current) label in dropdown", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("(current)");
  });

  it("should have isInPipeline computed variable", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("const isInPipeline");
    expect(detailContent).toContain("STAGE_CONFIGS.some");
  });
});

// ============================================================
// 5. Frontend: Duplicate prevention - disable button for same stage
// ============================================================
describe("Pipeline Dynamic - Duplicate prevention", () => {
  it("should disable Update Stage button when same stage is selected", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Should check if selectedPipelineStage === property.dealStage
    expect(detailContent).toContain("selectedPipelineStage === property?.dealStage");
  });

  it("should disable button when no stage is selected", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("!selectedPipelineStage");
  });

  it("should show 'Update Stage' button text when in pipeline", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain('"Update Stage"');
  });

  it("should show 'Add to Pipeline' button text when NOT in pipeline", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain('"Add to Pipeline"');
  });
});

// ============================================================
// 6. Frontend: Pre-select current stage when opening dialog
// ============================================================
describe("Pipeline Dynamic - Pre-select current stage", () => {
  it("should set selectedPipelineStage to current dealStage when opening dialog", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Should have logic to pre-select current stage
    expect(detailContent).toContain("setSelectedPipelineStage(property.dealStage)");
  });

  it("should only pre-select if the current stage is a pipeline stage", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Should check isPipeline before pre-selecting
    expect(detailContent).toContain("s.isPipeline");
  });

  it("should pass currentDealStage to StickyPropertyHeader", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("currentDealStage={property.dealStage}");
  });
});

// ============================================================
// 7. Frontend: Dynamic toast messages
// ============================================================
describe("Pipeline Dynamic - Toast messages", () => {
  it("should show different toast for add vs update", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Should have conditional toast
    expect(detailContent).toContain("Pipeline stage updated!");
    expect(detailContent).toContain("Property added to Pipeline!");
  });

  it("should invalidate getPropertiesByStage on success to refresh Kanban", () => {
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(detailContent).toContain("utils.properties.getPropertiesByStage.invalidate()");
  });
});

// ============================================================
// 8. Frontend: PipelineKanban display verification
// ============================================================
describe("Pipeline Dynamic - PipelineKanban display", () => {
  it("should filter properties by dealStage for each column", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("p.dealStage === stage");
  });

  it("should exclude dead/lost stages from pipeline view", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain('s.phase !== "dead"');
  });

  it("should show lead count per stage column", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("properties.length");
    expect(kanbanContent).toContain("lead");
  });

  it("should show total estimated value per stage column", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("totalValue");
    expect(kanbanContent).toContain("estimatedValue");
  });

  it("should have drag and drop to move properties between stages", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("DndContext");
    expect(kanbanContent).toContain("handleDragEnd");
    expect(kanbanContent).toContain("updateStageMutation");
  });

  it("should navigate to property detail when clicking a card", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("setLocation(`/properties/${property.id}`)");
  });

  it("should show days in stage for each property card", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("daysInStage");
  });
});

// ============================================================
// 9. Stage Config: getStageConfig helper
// ============================================================
describe("Pipeline Dynamic - stageConfig helpers", () => {
  it("should export getStageConfig function", () => {
    const stageContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    expect(stageContent).toContain("export function getStageConfig");
  });

  it("should have shortLabel for each stage", () => {
    const stageContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    // Every stage config should have shortLabel
    const shortLabelCount = (stageContent.match(/shortLabel:/g) || []).length;
    // Should have at least 17 pipeline stages + pre-pipeline + dead
    expect(shortLabelCount).toBeGreaterThanOrEqual(20);
  });

  it("should have pre-pipeline stages marked as isPipeline: false", () => {
    const stageContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    // NEW_LEAD should be isPipeline: false
    const newLeadIdx = stageContent.indexOf('id: "NEW_LEAD"');
    const analyzingIdx = stageContent.indexOf('id: "ANALYZING_DEAL"');
    expect(newLeadIdx).toBeGreaterThan(-1);
    expect(analyzingIdx).toBeGreaterThan(-1);
    
    const prePipelineSection = stageContent.substring(newLeadIdx, analyzingIdx);
    expect(prePipelineSection).toContain("isPipeline: false");
    expect(prePipelineSection).not.toContain("isPipeline: true");
  });

  it("should have ANALYZING_DEAL as the first pipeline stage", () => {
    const stageContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    // ANALYZING_DEAL should be the first stage with isPipeline: true
    const analyzingIdx = stageContent.indexOf('id: "ANALYZING_DEAL"');
    expect(analyzingIdx).toBeGreaterThan(-1);
    
    // Check that ANALYZING_DEAL has isPipeline: true and is marked as entry point
    const analyzingBlock = stageContent.substring(analyzingIdx, analyzingIdx + 300);
    expect(analyzingBlock).toContain("isPipeline: true");
    expect(analyzingBlock).toContain("PIPELINE ENTRY POINT");
  });
});

// ============================================================
// 10. Integration: Full dynamic pipeline flow
// ============================================================
describe("Pipeline Dynamic - Full flow integration", () => {
  it("should have dealStage in schema as mysqlEnum", () => {
    const schemaContent = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"), "utf-8"
    );
    
    expect(schemaContent).toContain('dealStage: mysqlEnum("dealStage"');
    expect(schemaContent).toContain("ANALYZING_DEAL");
    expect(schemaContent).toContain("OFFER_PENDING");
    expect(schemaContent).toContain("CLOSING");
    expect(schemaContent).toContain("CLOSED_WON");
  });

  it("should have stageChangedAt as timestamp in schema", () => {
    const schemaContent = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"), "utf-8"
    );
    
    expect(schemaContent).toContain('stageChangedAt: timestamp("stageChangedAt")');
  });

  it("should have consistent stage IDs between schema and stageConfig", () => {
    const schemaContent = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"), "utf-8"
    );
    const stageContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    // Key stages should exist in both
    const stages = ["ANALYZING_DEAL", "OFFER_PENDING", "UNDER_CONTRACT_A", "CLOSING", "CLOSED_WON"];
    for (const stage of stages) {
      expect(schemaContent).toContain(stage);
      expect(stageContent).toContain(stage);
    }
  });

  it("should have the full data flow: getById → PropertyDetail → StickyPropertyHeader", () => {
    const dbContent = fs.readFileSync(path.join(SERVER_DIR, "db.ts"), "utf-8");
    const detailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    const headerContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/StickyPropertyHeader.tsx"), "utf-8"
    );
    
    // DB returns dealStage
    expect(dbContent).toContain("dealStage: properties.dealStage");
    
    // PropertyDetail reads property.dealStage
    expect(detailContent).toContain("property.dealStage");
    expect(detailContent).toContain("property?.dealStage");
    
    // PropertyDetail passes to StickyPropertyHeader
    expect(detailContent).toContain("currentDealStage={property.dealStage}");
    
    // StickyPropertyHeader uses currentDealStage
    expect(headerContent).toContain("currentDealStage");
  });
});
