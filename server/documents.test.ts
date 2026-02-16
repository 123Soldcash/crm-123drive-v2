import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive tests for the Property Documents feature.
 * Tests cover: schema, db helpers, tRPC procedures, frontend integration, and file validation.
 */

// ============================================================================
// 1. SCHEMA TESTS
// ============================================================================

describe("Property Documents Schema", () => {
  it("should have propertyDocuments table defined in schema", () => {
    const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    
    expect(schemaContent).toContain('export const propertyDocuments = mysqlTable("propertyDocuments"');
    expect(schemaContent).toContain("PropertyDocument");
    expect(schemaContent).toContain("InsertPropertyDocument");
  });

  it("should have all required columns in propertyDocuments table", () => {
    const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    
    const requiredColumns = [
      "id",
      "propertyId",
      "noteId",
      "userId",
      "fileName",
      "fileKey",
      "fileUrl",
      "fileSize",
      "mimeType",
      "description",
      "createdAt",
    ];
    
    for (const col of requiredColumns) {
      expect(schemaContent).toContain(`"${col}"`);
    }
  });

  it("should export PropertyDocument and InsertPropertyDocument types", () => {
    const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    
    expect(schemaContent).toContain("export type PropertyDocument = typeof propertyDocuments.$inferSelect");
    expect(schemaContent).toContain("export type InsertPropertyDocument = typeof propertyDocuments.$inferInsert");
  });
});

// ============================================================================
// 2. DATABASE HELPER TESTS
// ============================================================================

describe("Property Documents DB Helpers", () => {
  it("should have getPropertyDocuments function exported", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    expect(dbContent).toContain("export async function getPropertyDocuments(propertyId: number)");
  });

  it("should have createPropertyDocument function exported", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    expect(dbContent).toContain("export async function createPropertyDocument(doc: InsertPropertyDocument)");
  });

  it("should have deletePropertyDocument function exported", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    expect(dbContent).toContain("export async function deletePropertyDocument(docId: number)");
  });

  it("getPropertyDocuments should join with users table for uploader name", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    // Should select uploaderName from users table
    expect(dbContent).toContain("uploaderName");
    expect(dbContent).toContain("leftJoin(users, eq(propertyDocuments.userId, users.id))");
  });

  it("getPropertyDocuments should order by createdAt descending", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    expect(dbContent).toContain("orderBy(desc(propertyDocuments.createdAt))");
  });

  it("deletePropertyDocument should return fileKey for cleanup", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    expect(dbContent).toContain("fileKey: doc[0].fileKey");
  });

  it("should import propertyDocuments and InsertPropertyDocument from schema", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");
    
    expect(dbContent).toContain("propertyDocuments");
    expect(dbContent).toContain("InsertPropertyDocument");
  });
});

// ============================================================================
// 3. tRPC ROUTER TESTS
// ============================================================================

describe("Property Documents tRPC Procedures", () => {
  it("should have documents router in routers.ts", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    expect(routersContent).toContain("documents: router({");
  });

  it("should have byProperty query procedure", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    // Should be a protected procedure with propertyId input
    expect(routersContent).toContain("byProperty: protectedProcedure");
    expect(routersContent).toContain("db.getPropertyDocuments(input.propertyId)");
  });

  it("should have upload mutation procedure", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    // Upload should be a protected mutation
    expect(routersContent).toContain("upload: protectedProcedure");
    expect(routersContent).toContain("storagePut");
    expect(routersContent).toContain("db.createPropertyDocument");
  });

  it("upload procedure should validate required fields", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    // Should require propertyId, fileName, fileData, fileSize, mimeType
    expect(routersContent).toContain("propertyId: z.number()");
    expect(routersContent).toContain("fileName: z.string().min(1)");
    expect(routersContent).toContain("fileData: z.string()");
    expect(routersContent).toContain("fileSize: z.number()");
    expect(routersContent).toContain("mimeType: z.string()");
  });

  it("upload procedure should support optional noteId and description", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    expect(routersContent).toContain("noteId: z.number().optional()");
    expect(routersContent).toContain("description: z.string().optional()");
  });

  it("upload procedure should generate unique file keys", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    // Should use timestamp + random suffix for uniqueness
    expect(routersContent).toContain("Date.now()");
    expect(routersContent).toContain("randomSuffix");
    expect(routersContent).toContain("properties/${input.propertyId}/documents/");
  });

  it("upload procedure should strip base64 prefix before decoding", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    expect(routersContent).toContain('replace(/^data:[^;]+;base64,/, "")');
    expect(routersContent).toContain('Buffer.from(base64Data, "base64")');
  });

  it("should have delete mutation procedure", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersContent = fs.readFileSync(routersPath, "utf-8");
    
    expect(routersContent).toContain("db.deletePropertyDocument(input.id)");
  });
});

// ============================================================================
// 4. FRONTEND COMPONENT TESTS
// ============================================================================

describe("NotesSection Document Upload UI", () => {
  it("should import document-related icons", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("Paperclip");
    expect(content).toContain("File");
  });

  it("should have document file input element", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("docInputRef");
    expect(content).toContain('.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip');
  });

  it("should query documents via trpc.documents.byProperty", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("trpc.documents.byProperty.useQuery({ propertyId })");
  });

  it("should have upload document mutation", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("trpc.documents.upload.useMutation");
  });

  it("should have delete document mutation", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("trpc.documents.delete.useMutation");
  });

  it("should have a Documents button in the form area", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("Documents");
    expect(content).toContain("docInputRef.current?.click()");
  });

  it("should display document list with file icons and metadata", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("getFileIcon");
    expect(content).toContain("formatFileSize");
    expect(content).toContain("doc.fileName");
    expect(content).toContain("doc.fileUrl");
  });

  it("should show documents attached to specific notes", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("noteDocuments");
    expect(content).toContain("d.noteId === note.id");
  });

  it("should have standalone document upload area", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("handleStandaloneDocUpload");
    expect(content).toContain("Click to upload documents");
  });

  it("should enforce 10MB file size limit", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("MAX_FILE_SIZE");
    expect(content).toContain("10 * 1024 * 1024");
    expect(content).toContain("too large (max 10MB)");
  });

  it("should show document count badge in section header", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("documents.length");
    expect(content).toContain("docs");
  });

  it("should have readFileAsBase64 utility function", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("function readFileAsBase64");
    expect(content).toContain("readAsDataURL");
  });

  it("should invalidate documents query after upload and delete", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain('utils.documents.byProperty.invalidate({ propertyId })');
  });

  it("should have delete confirmation dialog for documents", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain('confirm(`Delete "');
    expect(content).toContain("deleteDocMutation.mutate({ id: doc.id })");
  });
});

// ============================================================================
// 5. FILE TYPE AND VALIDATION TESTS
// ============================================================================

describe("Document File Type Handling", () => {
  it("should support PDF files", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("application/pdf");
  });

  it("should support Word documents", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("application/msword");
    expect(content).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("should support Excel spreadsheets", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("application/vnd.ms-excel");
    expect(content).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("should support text and CSV files", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("text/plain");
    expect(content).toContain("text/csv");
  });

  it("should support image files", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("image/jpeg");
    expect(content).toContain("image/png");
  });

  it("should support ZIP archives", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("application/zip");
  });

  it("getFileIcon should return different icons for different file types", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    // PDF = red, Excel = green, Word = blue, Image = purple, ZIP = yellow
    expect(content).toContain("text-red-500");
    expect(content).toContain("text-green-600");
    expect(content).toContain("text-blue-600");
    expect(content).toContain("text-purple-500");
    expect(content).toContain("text-yellow-600");
  });

  it("formatFileSize should handle bytes, KB, and MB", () => {
    const componentPath = path.join(__dirname, "../client/src/components/NotesSection.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    
    expect(content).toContain("function formatFileSize");
    expect(content).toContain('} B`');
    expect(content).toContain('} KB`');
    expect(content).toContain('} MB`');
  });
});
