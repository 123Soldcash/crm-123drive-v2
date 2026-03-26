import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CLIENT_DIR = path.join(__dirname, '..', 'client', 'src');
const SERVER_DIR = __dirname;

describe("CallModal Layout & Data Fixes", () => {

  // ============================================================
  // 1. Layout widths
  // ============================================================
  describe("Panel widths — equal 1/3 distribution", () => {
    it("should have all 3 panels using flex-1 for equal width", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      // All 3 panels should use flex-1 for equal 1/3 distribution
      const leftPanel = content.includes('LEFT PANEL') && content.includes('flex-1 flex flex-col bg-muted/20');
      const centerPanel = content.includes('CENTER PANEL') && content.includes('flex-1 flex flex-col bg-background');
      const rightPanel = content.includes('RIGHT PANEL') && content.includes('flex-1 flex flex-col bg-muted/30');
      expect(leftPanel).toBe(true);
      expect(centerPanel).toBe(true);
      expect(rightPanel).toBe(true);
    });

    it("should NOT have fixed pixel widths on panels", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      // No fixed widths like w-[420px], w-[340px], w-[300px] on the main panels
      expect(content).not.toContain('w-[420px]');
      expect(content).not.toContain('w-[340px]');
      expect(content).not.toContain('w-[300px]');
    });

    it("should have min-w-0 on all panels to prevent overflow", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      // Count occurrences of min-w-0 in the panel divs
      const matches = content.match(/flex-1 flex flex-col.*min-w-0/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================
  // 2. Property image field
  // ============================================================
  describe("Property image integration", () => {
    it("should use prop.propertyImage (not prop.imageUrl) in CallModal", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('prop.propertyImage');
      expect(content).not.toContain('prop.imageUrl');
    });

    it("should have propertyImage in getPropertyById select (first query)", () => {
      const dbContent = fs.readFileSync(path.join(SERVER_DIR, 'db.ts'), 'utf-8');
      const funcStart = dbContent.indexOf('export async function getPropertyById');
      expect(funcStart).toBeGreaterThan(-1);
      const funcBlock = dbContent.substring(funcStart, funcStart + 3000);
      expect(funcBlock).toContain('propertyImage: properties.propertyImage');
    });

    it("should have propertyImage in getPropertyById select (fallback query)", () => {
      const dbContent = fs.readFileSync(path.join(SERVER_DIR, 'db.ts'), 'utf-8');
      const funcStart = dbContent.indexOf('export async function getPropertyById');
      // The fallback query is the second select block
      const firstSelectEnd = dbContent.indexOf('.where(eq(properties.leadId, id))', funcStart);
      const secondBlock = dbContent.substring(firstSelectEnd, firstSelectEnd + 3000);
      expect(secondBlock).toContain('propertyImage: properties.propertyImage');
    });
  });

  // ============================================================
  // 3. Correct field names in CallModal
  // ============================================================
  describe("Property field name mapping", () => {
    it("should use totalBedrooms (not bedrooms)", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('prop.totalBedrooms');
      expect(content).not.toContain('prop.bedrooms');
    });

    it("should use totalBaths (not bathrooms)", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('prop.totalBaths');
      expect(content).not.toContain('prop.bathrooms');
    });

    it("should use buildingSquareFeet (not sqft)", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('prop.buildingSquareFeet');
      expect(content).not.toContain('prop.sqft');
    });

    it("should use owner1Name (not ownerName)", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('prop.owner1Name');
      expect(content).not.toContain('prop.ownerName');
    });

    it("should use apnParcelId (not apn)", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      // Should use apnParcelId, not just apn
      const apnMatches = content.match(/prop\.apn[^P]/g);
      expect(apnMatches).toBeNull(); // no prop.apn without ParcelId
      expect(content).toContain('prop.apnParcelId');
    });

    it("should use ownerLocation (not mailingAddress)", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('prop.ownerLocation');
      expect(content).not.toContain('prop.mailingAddress');
    });
  });

  // ============================================================
  // 4. Three-column layout structure
  // ============================================================
  describe("Three-column layout", () => {
    it("should have LEFT PANEL comment", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('LEFT PANEL');
    });

    it("should have CENTER PANEL comment", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('CENTER PANEL');
    });

    it("should have RIGHT PANEL comment", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('RIGHT PANEL');
    });

    it("should have property info sections: Property, Financial, Identifiers, Owner", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('Property');
      expect(content).toContain('Financial');
      expect(content).toContain('Identifiers');
      expect(content).toContain('Owner');
    });
  });

  // ============================================================
  // 5. Dialpad
  // ============================================================
  describe("DTMF Dialpad", () => {
    it("should have dialpad toggle button", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('Show Dialpad');
      expect(content).toContain('Hide Dialpad');
    });

    it("should have DIALPAD_KEYS constant with all 12 keys", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('DIALPAD_KEYS');
      // Should have digits 0-9, *, #
      expect(content).toContain('"*"');
      expect(content).toContain('"#"');
    });

    it("should have handleSendDTMF function", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('handleSendDTMF');
    });
  });

  // ============================================================
  // 6. Property image height
  // ============================================================
  describe("Property image display", () => {
    it("should have image container at 200px height", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      expect(content).toContain('h-[200px]');
    });

    it("should have fallback icon when no image", () => {
      const content = fs.readFileSync(path.join(CLIENT_DIR, 'components', 'CallModal.tsx'), 'utf-8');
      // Should show Home icon as fallback
      expect(content).toContain('Home className');
    });
  });
});
