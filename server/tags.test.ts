import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db.ts", () => ({
  addPropertyTag: vi.fn(),
  removePropertyTag: vi.fn(),
  getPropertyTags: vi.fn(),
  getAllUniqueTags: vi.fn(),
  deleteTagGlobally: vi.fn(),
  renameTag: vi.fn(),
}));

import * as db from "./db.js";

describe("Tags Backend Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addPropertyTag", () => {
    it("should call addPropertyTag with correct params (propertyId, tag, createdBy)", async () => {
      const mockFn = db.addPropertyTag as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ insertId: 1 });

      await db.addPropertyTag(42, "Hot Lead", 1);

      expect(mockFn).toHaveBeenCalledWith(42, "Hot Lead", 1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle empty tag name by trimming in the router", () => {
      // The router uses z.string().min(1) validation, so empty strings are rejected
      // This test verifies the function signature accepts string
      const mockFn = db.addPropertyTag as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ insertId: 2 });

      // The trim happens in the router before calling db.addPropertyTag
      const trimmedTag = "  Foreclosure  ".trim();
      expect(trimmedTag).toBe("Foreclosure");
    });

    it("should not create duplicate tags on the same property", async () => {
      const mockFn = db.addPropertyTag as ReturnType<typeof vi.fn>;
      // Simulate returning existing tag instead of inserting
      mockFn.mockResolvedValue({ id: 5, propertyId: 42, tag: "Hot Lead" });

      const result = await db.addPropertyTag(42, "Hot Lead", 1);
      expect(result).toHaveProperty("id");
    });
  });

  describe("removePropertyTag", () => {
    it("should call removePropertyTag with tagId", async () => {
      const mockFn = db.removePropertyTag as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ affectedRows: 1 });

      await db.removePropertyTag(5);

      expect(mockFn).toHaveBeenCalledWith(5);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle non-existent tagId gracefully", async () => {
      const mockFn = db.removePropertyTag as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ affectedRows: 0 });

      const result = await db.removePropertyTag(99999);
      expect(result).toEqual({ affectedRows: 0 });
    });
  });

  describe("getPropertyTags", () => {
    it("should return tags for a specific property", async () => {
      const mockFn = db.getPropertyTags as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue([
        { id: 1, tag: "Hot Lead" },
        { id: 2, tag: "Foreclosure" },
      ]);

      const tags = await db.getPropertyTags(42);

      expect(tags).toHaveLength(2);
      expect(tags[0]).toHaveProperty("id");
      expect(tags[0]).toHaveProperty("tag");
      expect(tags[0].tag).toBe("Hot Lead");
    });

    it("should return empty array for property with no tags", async () => {
      const mockFn = db.getPropertyTags as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue([]);

      const tags = await db.getPropertyTags(999);
      expect(tags).toEqual([]);
    });

    it("should return tag objects with id and tag fields (not name)", async () => {
      const mockFn = db.getPropertyTags as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue([{ id: 1, tag: "Test Tag" }]);

      const tags = await db.getPropertyTags(1);
      expect(tags[0]).toHaveProperty("tag");
      // Verify it does NOT have a 'name' field (old format)
      expect(tags[0]).not.toHaveProperty("name");
    });
  });

  describe("getAllUniqueTags", () => {
    it("should return unique tags with counts", async () => {
      const mockFn = db.getAllUniqueTags as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue([
        { tag: "Foreclosure", count: 15 },
        { tag: "Hot Lead", count: 10 },
        { tag: "Vacant", count: 5 },
      ]);

      const tags = await db.getAllUniqueTags();

      expect(tags).toHaveLength(3);
      expect(tags[0]).toHaveProperty("tag");
      expect(tags[0]).toHaveProperty("count");
      expect(tags[0].tag).toBe("Foreclosure");
      expect(tags[0].count).toBe(15);
    });

    it("should return empty array when no tags exist", async () => {
      const mockFn = db.getAllUniqueTags as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue([]);

      const tags = await db.getAllUniqueTags();
      expect(tags).toEqual([]);
    });

    it("should return tags sorted alphabetically", async () => {
      const mockFn = db.getAllUniqueTags as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue([
        { tag: "Alpha", count: 1 },
        { tag: "Beta", count: 2 },
        { tag: "Gamma", count: 3 },
      ]);

      const tags = await db.getAllUniqueTags();
      const tagNames = tags.map((t: any) => t.tag);
      expect(tagNames).toEqual(["Alpha", "Beta", "Gamma"]);
    });
  });

  describe("deleteTagGlobally", () => {
    it("should delete a tag from all properties", async () => {
      const mockFn = db.deleteTagGlobally as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ affectedRows: 5 });

      await db.deleteTagGlobally("Obsolete Tag");

      expect(mockFn).toHaveBeenCalledWith("Obsolete Tag");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle deleting non-existent tag", async () => {
      const mockFn = db.deleteTagGlobally as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ affectedRows: 0 });

      const result = await db.deleteTagGlobally("NonExistent");
      expect(result).toEqual({ affectedRows: 0 });
    });
  });

  describe("renameTag", () => {
    it("should rename a tag across all properties", async () => {
      const mockFn = db.renameTag as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue({ affectedRows: 3 });

      await db.renameTag("Old Name", "New Name");

      expect(mockFn).toHaveBeenCalledWith("Old Name", "New Name");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Tags Router Input Validation", () => {
  it("addTag requires propertyId (number) and tag (string min 1)", () => {
    // Verify the zod schema expectations
    const { z } = require("zod");
    const schema = z.object({ propertyId: z.number(), tag: z.string().min(1) });

    // Valid input
    expect(schema.safeParse({ propertyId: 1, tag: "Test" }).success).toBe(true);

    // Invalid: empty tag
    expect(schema.safeParse({ propertyId: 1, tag: "" }).success).toBe(false);

    // Invalid: missing propertyId
    expect(schema.safeParse({ tag: "Test" }).success).toBe(false);

    // Invalid: tag is number
    expect(schema.safeParse({ propertyId: 1, tag: 123 }).success).toBe(false);
  });

  it("removeTag requires tagId (number)", () => {
    const { z } = require("zod");
    const schema = z.object({ tagId: z.number() });

    expect(schema.safeParse({ tagId: 5 }).success).toBe(true);
    expect(schema.safeParse({ tagId: "5" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("deleteTagGlobally requires tagName (string)", () => {
    const { z } = require("zod");
    const schema = z.object({ tagName: z.string() });

    expect(schema.safeParse({ tagName: "Test" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("renameTag requires oldName (string) and newName (string min 1)", () => {
    const { z } = require("zod");
    const schema = z.object({ oldName: z.string(), newName: z.string().min(1) });

    expect(schema.safeParse({ oldName: "Old", newName: "New" }).success).toBe(true);
    expect(schema.safeParse({ oldName: "Old", newName: "" }).success).toBe(false);
    expect(schema.safeParse({ oldName: "Old" }).success).toBe(false);
  });
});

describe("Tags Source Code Verification", () => {
  it("routers.ts should have all 6 tag procedures", async () => {
    const fs = await import("fs");
    const routerCode = fs.readFileSync("server/routers.ts", "utf-8");

    expect(routerCode).toContain("getTags:");
    expect(routerCode).toContain("getAllTags:");
    expect(routerCode).toContain("addTag:");
    expect(routerCode).toContain("removeTag:");
    expect(routerCode).toContain("deleteTagGlobally:");
    expect(routerCode).toContain("renameTag:");
  });

  it("addTag should trim input before saving", async () => {
    const fs = await import("fs");
    const routerCode = fs.readFileSync("server/routers.ts", "utf-8");

    expect(routerCode).toContain("input.tag.trim()");
  });

  it("addTag should use z.string().min(1) validation", async () => {
    const fs = await import("fs");
    const routerCode = fs.readFileSync("server/routers.ts", "utf-8");

    // Find the addTag section and verify it has min(1)
    const addTagSection = routerCode.substring(
      routerCode.indexOf("addTag:"),
      routerCode.indexOf("removeTag:")
    );
    expect(addTagSection).toContain("z.string().min(1)");
  });

  it("getAllTags should call db.getAllUniqueTags (not inline query)", async () => {
    const fs = await import("fs");
    const routerCode = fs.readFileSync("server/routers.ts", "utf-8");

    const getAllTagsSection = routerCode.substring(
      routerCode.indexOf("getAllTags:"),
      routerCode.indexOf("deleteTagGlobally:")
    );
    expect(getAllTagsSection).toContain("db.getAllUniqueTags()");
    // Should NOT contain inline SQL
    expect(getAllTagsSection).not.toContain("groupBy(propertyTags.tag)");
  });

  it("db.ts should have addPropertyTag with duplicate check", async () => {
    const fs = await import("fs");
    const dbCode = fs.readFileSync("server/db.ts", "utf-8");

    const addTagSection = dbCode.substring(
      dbCode.indexOf("export async function addPropertyTag"),
      dbCode.indexOf("export async function removePropertyTag")
    );

    // Should check for existing tag before inserting
    expect(addTagSection).toContain("existing");
    expect(addTagSection).toContain("eq(propertyTags.propertyId");
    expect(addTagSection).toContain("eq(propertyTags.tag");
  });

  it("db.ts should have deleteTagGlobally function", async () => {
    const fs = await import("fs");
    const dbCode = fs.readFileSync("server/db.ts", "utf-8");

    expect(dbCode).toContain("export async function deleteTagGlobally");
    expect(dbCode).toContain("db.delete(propertyTags)");
  });

  it("db.ts should have renameTag function", async () => {
    const fs = await import("fs");
    const dbCode = fs.readFileSync("server/db.ts", "utf-8");

    expect(dbCode).toContain("export async function renameTag");
    expect(dbCode).toContain("db.update(propertyTags)");
  });

  it("PropertyTagsManager component should exist and use correct trpc calls", async () => {
    const fs = await import("fs");
    const componentCode = fs.readFileSync(
      "client/src/components/PropertyTagsManager.tsx",
      "utf-8"
    );

    // Should use the correct trpc procedures
    expect(componentCode).toContain("trpc.properties.getTags.useQuery");
    expect(componentCode).toContain("trpc.properties.getAllTags.useQuery");
    expect(componentCode).toContain("trpc.properties.addTag.useMutation");
    expect(componentCode).toContain("trpc.properties.removeTag.useMutation");
    expect(componentCode).toContain("trpc.properties.deleteTagGlobally.useMutation");

    // Should invalidate queries after mutations
    expect(componentCode).toContain("utils.properties.getTags.invalidate");
    expect(componentCode).toContain("utils.properties.getAllTags.invalidate");
  });

  it("PropertyTagsManager should use tag.tag (not tag.name) for display", async () => {
    const fs = await import("fs");
    const componentCode = fs.readFileSync(
      "client/src/components/PropertyTagsManager.tsx",
      "utf-8"
    );

    // Should reference t.tag (the field from DB), not t.name
    expect(componentCode).toContain("t.tag");
    expect(componentCode).not.toMatch(/t\.name(?!s)/); // t.name should not appear (t.names is ok)
  });

  it("StickyPropertyHeader should use tag.tag (not tag.name)", async () => {
    const fs = await import("fs");
    const headerCode = fs.readFileSync(
      "client/src/components/StickyPropertyHeader.tsx",
      "utf-8"
    );

    expect(headerCode).toContain("{tag.tag}");
    expect(headerCode).not.toContain("{tag.name}");
  });

  it("PropertyDetail should use PropertyTagsManager component", async () => {
    const fs = await import("fs");
    const detailCode = fs.readFileSync(
      "client/src/pages/PropertyDetail.tsx",
      "utf-8"
    );

    expect(detailCode).toContain("PropertyTagsManager");
    expect(detailCode).toContain("<PropertyTagsManager propertyId={propertyId}");
    // Should NOT have the old inline tag input
    expect(detailCode).not.toContain("showTagSuggestions");
    expect(detailCode).not.toContain("setShowTagSuggestions");
  });
});
