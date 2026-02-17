import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive tests for Pipeline Stage Assignment
 * 
 * Tests cover:
 * 1. Backend: updateDealStage procedure input validation
 * 2. Backend: getPropertiesByStage handles empty conditions
 * 3. Backend: properties.create includes dealStage
 * 4. Frontend: PropertyDetail sends correct field names
 * 5. Frontend: QuickAddLeadDialog passes dealStage
 * 6. Frontend: PipelineKanban renders all stages
 * 7. Source code verification for correct patterns
 */

const SERVER_DIR = path.resolve(__dirname);
const CLIENT_DIR = path.resolve(__dirname, "../client/src");

// ============================================================
// 1. Backend: updateDealStage procedure validation
// ============================================================
describe("Pipeline - updateDealStage procedure", () => {
  it("should accept propertyId and newStage as input fields", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    // Find the updateDealStage procedure section
    const startIdx = routersContent.indexOf("updateDealStage:");
    expect(startIdx).toBeGreaterThan(-1);
    
    // Get a chunk of code after updateDealStage
    const procedureCode = routersContent.substring(startIdx, startIdx + 300);
    expect(procedureCode).toContain("propertyId: z.number()");
    expect(procedureCode).toContain("newStage: z.string()");
  });

  it("should call updatePropertyStage with correct arguments", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    // Should pass input.newStage (not input.stageId)
    expect(routersContent).toContain("input.newStage");
    expect(routersContent).toContain("updatePropertyStage(");
  });

  it("should import updatePropertyStage from db-stageManagement", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    expect(routersContent).toContain("import { updatePropertyStage");
    expect(routersContent).toContain('from "./db-stageManagement"');
  });
});

// ============================================================
// 2. Backend: getPropertiesByStage handles empty conditions
// ============================================================
describe("Pipeline - getPropertiesByStage empty conditions handling", () => {
  it("should handle empty conditions array without crashing", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    // Should have a check for conditions.length before calling and()
    expect(stageManagementContent).toContain("conditions.length");
  });

  it("should not call and() with empty array", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    // The getPropertiesByStage function should handle empty conditions
    const funcStart = stageManagementContent.indexOf("async function getPropertiesByStage");
    expect(funcStart).toBeGreaterThan(-1);
    
    const funcCode = stageManagementContent.substring(funcStart, funcStart + 3000);
    // Should have conditions.length check somewhere in the function
    expect(funcCode).toContain("conditions.length");
  });

  it("should build conditions only when stage or agentId is provided", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    // Should conditionally push to conditions array
    expect(stageManagementContent).toContain("if (stage)");
    expect(stageManagementContent).toContain("if (agentId)");
    expect(stageManagementContent).toContain("conditions.push(");
  });

  it("should return results ordered by stageChangedAt descending", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    expect(stageManagementContent).toContain("desc(properties.stageChangedAt)");
  });

  it("should catch errors and return empty array", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    expect(stageManagementContent).toContain("catch (error)");
    expect(stageManagementContent).toContain("return []");
  });
});

// ============================================================
// 3. Backend: properties.create includes dealStage
// ============================================================
describe("Pipeline - properties.create includes dealStage", () => {
  it("should accept dealStage as optional input in properties.create", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    // Find the properties create procedure input
    // dealStage should be in the input schema
    expect(routersContent).toContain("dealStage: z.string().optional()");
  });

  it("should include dealStage in the INSERT SQL statement", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    // The raw SQL INSERT should include dealStage column
    // Find the INSERT INTO properties section
    const insertMatch = routersContent.match(/INSERT INTO properties[\s\S]*?VALUES[\s\S]*?\)/);
    expect(insertMatch).toBeTruthy();
    
    const insertSQL = insertMatch![0];
    expect(insertSQL.toLowerCase()).toContain("dealstage");
  });
});

// ============================================================
// 4. Frontend: PropertyDetail sends correct field names
// ============================================================
describe("Pipeline - PropertyDetail pipeline stage assignment", () => {
  it("should send newStage (not stageId) in updateDealStage mutation", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Should use newStage, NOT stageId
    const mutateCall = propertyDetailContent.match(/updateDealStage\.mutate\(\{[\s\S]*?\}\)/);
    expect(mutateCall).toBeTruthy();
    
    const mutateCode = mutateCall![0];
    expect(mutateCode).toContain("newStage:");
    expect(mutateCode).not.toContain("stageId:");
  });

  it("should NOT send stageId field in the mutation", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Make sure the old stageId pattern is completely gone from the mutation call
    const handleAddToPipeline = propertyDetailContent.match(
      /handleAddToPipeline[\s\S]*?updateDealStage\.mutate\(\{[\s\S]*?\}\)/
    );
    expect(handleAddToPipeline).toBeTruthy();
    expect(handleAddToPipeline![0]).not.toContain("stageId:");
  });

  it("should have a pipeline dialog with Select component for stage selection", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(propertyDetailContent).toContain("Add to Deal Pipeline");
    expect(propertyDetailContent).toContain("selectedPipelineStage");
    expect(propertyDetailContent).toContain("setSelectedPipelineStage");
    expect(propertyDetailContent).toContain("<Select");
    expect(propertyDetailContent).toContain("<SelectItem");
  });

  it("should filter STAGE_CONFIGS to show only pipeline stages", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(propertyDetailContent).toContain("STAGE_CONFIGS.filter(s => s.isPipeline)");
  });

  it("should disable Add to Pipeline button when no stage is selected", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(propertyDetailContent).toContain("disabled={!selectedPipelineStage}");
  });

  it("should invalidate property data and close dialog on success", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Should invalidate getById query
    expect(propertyDetailContent).toContain("utils.properties.getById.invalidate");
    // Should close dialog
    expect(propertyDetailContent).toContain("setPipelineDialogOpen(false)");
    // Should reset selection
    expect(propertyDetailContent).toContain('setSelectedPipelineStage("")');
  });

  it("should show success toast on pipeline stage update", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    expect(propertyDetailContent).toContain("toast.success");
    expect(propertyDetailContent).toMatch(/Pipeline.*success/i);
  });
});

// ============================================================
// 5. Frontend: QuickAddLeadDialog passes dealStage
// ============================================================
describe("Pipeline - QuickAddLeadDialog passes dealStage", () => {
  it("should include dealStage in the create property mutation call", () => {
    const quickAddContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/QuickAddLeadDialog.tsx"), "utf-8"
    );
    
    // Should pass dealStage in the mutation
    expect(quickAddContent).toContain("dealStage:");
  });

  it("should receive dealStage as a prop", () => {
    const quickAddContent = fs.readFileSync(
      path.join(CLIENT_DIR, "components/QuickAddLeadDialog.tsx"), "utf-8"
    );
    
    // Should have dealStage in props
    expect(quickAddContent).toContain("dealStage");
  });
});

// ============================================================
// 6. Frontend: PipelineKanban renders all stages
// ============================================================
describe("Pipeline - PipelineKanban page", () => {
  it("should import and use STAGE_CONFIGS", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("STAGE_CONFIGS");
  });

  it("should call getPropertiesByStage tRPC query", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    expect(kanbanContent).toContain("getPropertiesByStage");
  });

  it("should filter stages to show only pipeline stages", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    // Should filter for isPipeline
    expect(kanbanContent).toContain("isPipeline");
  });

  it("should have drag and drop functionality for moving properties between stages", () => {
    const kanbanContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PipelineKanban.tsx"), "utf-8"
    );
    
    // Should have drag-related code
    expect(kanbanContent).toMatch(/drag|onDrag|draggable/i);
  });
});

// ============================================================
// 7. Stage configuration validation
// ============================================================
describe("Pipeline - Stage configuration", () => {
  it("should have stageConfig file with STAGE_CONFIGS export", () => {
    const stageConfigContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    expect(stageConfigContent).toContain("export const STAGE_CONFIGS");
  });

  it("should have isPipeline flag on each stage config", () => {
    const stageConfigContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    expect(stageConfigContent).toContain("isPipeline");
  });

  it("should have pipeline stages like Analyzing, Offer Pending, etc.", () => {
    const stageConfigContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    expect(stageConfigContent).toContain("Analyzing");
    expect(stageConfigContent).toContain("Offer Pending");
    expect(stageConfigContent).toContain("Closing");
  });

  it("should have id, label, icon, and isPipeline fields for each stage", () => {
    const stageConfigContent = fs.readFileSync(
      path.join(CLIENT_DIR, "lib/stageConfig.ts"), "utf-8"
    );
    
    // Each stage should have these fields
    expect(stageConfigContent).toMatch(/id:\s*["']/);
    expect(stageConfigContent).toMatch(/label:\s*["']/);
    expect(stageConfigContent).toMatch(/icon:\s*["']/);
    expect(stageConfigContent).toMatch(/isPipeline:\s*(true|false)/);
  });
});

// ============================================================
// 8. Backend: updatePropertyStage function
// ============================================================
describe("Pipeline - updatePropertyStage function", () => {
  it("should exist in db-stageManagement.ts", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    expect(stageManagementContent).toContain("export async function updatePropertyStage");
  });

  it("should accept propertyId, newStage, userId, and optional notes", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    const funcSignature = stageManagementContent.match(
      /export async function updatePropertyStage\([\s\S]*?\)/
    );
    expect(funcSignature).toBeTruthy();
    
    const signature = funcSignature![0];
    expect(signature).toContain("propertyId");
    expect(signature).toContain("newStage");
    expect(signature).toContain("userId");
  });

  it("should update the dealStage column on the properties table", () => {
    const stageManagementContent = fs.readFileSync(
      path.join(SERVER_DIR, "db-stageManagement.ts"), "utf-8"
    );
    
    expect(stageManagementContent).toContain("dealStage");
    expect(stageManagementContent).toMatch(/update|UPDATE/);
  });
});

// ============================================================
// 9. Integration: Full flow validation
// ============================================================
describe("Pipeline - Full flow integration checks", () => {
  it("should have consistent field naming across frontend and backend (newStage)", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Backend expects newStage
    expect(routersContent).toContain("newStage: z.string()");
    
    // Frontend sends newStage
    const mutateCall = propertyDetailContent.match(/updateDealStage\.mutate\(\{[\s\S]*?\}\)/);
    expect(mutateCall![0]).toContain("newStage:");
  });

  it("should NOT have any references to stageId in pipeline mutation calls", () => {
    const propertyDetailContent = fs.readFileSync(
      path.join(CLIENT_DIR, "pages/PropertyDetail.tsx"), "utf-8"
    );
    
    // Extract only the handleAddToPipeline function
    const handleFunc = propertyDetailContent.match(
      /const handleAddToPipeline[\s\S]*?(?=\n\s*(?:const|if|return|\/\/))/
    );
    expect(handleFunc).toBeTruthy();
    expect(handleFunc![0]).not.toContain("stageId");
  });

  it("should have getPropertiesByStage procedure accepting optional stage and agentId", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    // Find the getPropertiesByStage procedure section
    const startIdx = routersContent.indexOf("getPropertiesByStage:");
    expect(startIdx).toBeGreaterThan(-1);
    
    const procedureCode = routersContent.substring(startIdx, startIdx + 300);
    expect(procedureCode).toContain("stage: z.string().optional()");
    expect(procedureCode).toContain("agentId: z.number().optional()");
  });

  it("should have bulkUpdateStages procedure for batch operations", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    expect(routersContent).toContain("bulkUpdateStages:");
    expect(routersContent).toContain("propertyIds: z.array(z.number())");
  });

  it("should have getStageHistory procedure for viewing stage change history", () => {
    const routersContent = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
    
    expect(routersContent).toContain("getStageHistory:");
    expect(routersContent).toContain("getPropertyStageHistory");
  });
});
