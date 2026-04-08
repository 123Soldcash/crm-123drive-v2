import { describe, it, expect } from "vitest";
import { buildDeskMap, getIconComponent, ICON_OPTIONS, type DeskFromDb } from "@/lib/deskUtils";

describe("deskUtils", () => {
  describe("getIconComponent", () => {
    it("returns a component for a known icon name", () => {
      const Icon = getIconComponent("rocket");
      expect(Icon).toBeDefined();
      expect(typeof Icon).toBe("object"); // Lucide icons are forwardRef objects in Node
    });

    it("returns FolderOpen for null", () => {
      const Icon = getIconComponent(null);
      expect(Icon).toBeDefined();
      const DefaultIcon = getIconComponent("folder");
      expect(Icon).toBe(DefaultIcon);
    });

    it("returns FolderOpen for undefined", () => {
      const Icon = getIconComponent(undefined);
      expect(Icon).toBeDefined();
    });

    it("returns FolderOpen for unknown icon name", () => {
      const Icon = getIconComponent("nonexistent-icon");
      const DefaultIcon = getIconComponent("folder");
      expect(Icon).toBe(DefaultIcon);
    });

    it("has 32 registered icons", () => {
      expect(ICON_OPTIONS.length).toBe(32);
    });

    it("returns correct icons for all registered names", () => {
      const knownNames = [
        "folder", "briefcase", "building", "building2", "home", "users",
        "user-check", "star", "heart", "flame", "rocket", "target",
        "trophy", "zap", "trending-up", "dollar", "shopping-cart",
        "phone", "mail", "megaphone", "globe", "map-pin", "landmark",
        "shield", "search", "file-text", "list-checks", "inbox",
        "layout-grid", "settings", "layers", "smile",
      ];
      for (const name of knownNames) {
        const Icon = getIconComponent(name);
        expect(Icon, `Icon for "${name}" should be defined`).toBeDefined();
        expect(typeof Icon, `Icon for "${name}" should be an object`).toBe("object");
      }
    });
  });

  describe("buildDeskMap", () => {
    it("returns empty object for null", () => {
      expect(buildDeskMap(null)).toEqual({});
    });

    it("returns empty object for undefined", () => {
      expect(buildDeskMap(undefined)).toEqual({});
    });

    it("returns empty object for empty array", () => {
      expect(buildDeskMap([])).toEqual({});
    });

    it("builds a map keyed by desk name", () => {
      const desks: DeskFromDb[] = [
        { id: 1, name: "DESK_CHRIS", color: "#f97316", icon: "flame" },
        { id: 2, name: "List", color: "#3b82f6", icon: "list-checks" },
        { id: 3, name: "BIN", color: "#9ca3af", icon: "inbox" },
      ];
      const map = buildDeskMap(desks);
      expect(Object.keys(map)).toHaveLength(3);
      expect(map["DESK_CHRIS"]).toEqual(desks[0]);
      expect(map["List"]).toEqual(desks[1]);
      expect(map["BIN"]).toEqual(desks[2]);
    });

    it("last desk wins for duplicate names", () => {
      const desks: DeskFromDb[] = [
        { id: 1, name: "DESK_1", color: "#ff0000", icon: "star" },
        { id: 2, name: "DESK_1", color: "#00ff00", icon: "heart" },
      ];
      const map = buildDeskMap(desks);
      expect(map["DESK_1"].color).toBe("#00ff00");
      expect(map["DESK_1"].icon).toBe("heart");
    });

    it("handles desks with null color and icon", () => {
      const desks: DeskFromDb[] = [
        { id: 1, name: "TEST", color: null, icon: null },
      ];
      const map = buildDeskMap(desks);
      expect(map["TEST"]).toBeDefined();
      expect(map["TEST"].color).toBeNull();
      expect(map["TEST"].icon).toBeNull();
    });
  });
});
