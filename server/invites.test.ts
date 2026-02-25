import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Read source files for structural validation
const invitesRouterSrc = readFileSync(
  path.resolve(__dirname, "routers/invites.ts"),
  "utf-8"
);
const dbInvitesSrc = readFileSync(
  path.resolve(__dirname, "db-invites.ts"),
  "utf-8"
);
const schemaSrc = readFileSync(
  path.resolve(__dirname, "../drizzle/schema.ts"),
  "utf-8"
);
const userMgmtSrc = readFileSync(
  path.resolve(__dirname, "../client/src/pages/UserManagement.tsx"),
  "utf-8"
);
const inviteAcceptSrc = readFileSync(
  path.resolve(__dirname, "../client/src/pages/InviteAccept.tsx"),
  "utf-8"
);
const appTsxSrc = readFileSync(
  path.resolve(__dirname, "../client/src/App.tsx"),
  "utf-8"
);
const routersSrc = readFileSync(
  path.resolve(__dirname, "routers.ts"),
  "utf-8"
);

describe("Invite System - Schema", () => {
  it("should have invites table in schema", () => {
    expect(schemaSrc).toContain('export const invites = mysqlTable("invites"');
  });

  it("should have required columns: token, email, role, status, expiresAt, createdBy", () => {
    expect(schemaSrc).toContain("token:");
    expect(schemaSrc).toContain("email:");
    expect(schemaSrc).toContain("status:");
    expect(schemaSrc).toContain("expiresAt:");
    expect(schemaSrc).toContain("createdBy:");
  });

  it("should have status enum with pending, accepted, expired, cancelled", () => {
    expect(schemaSrc).toContain("pending");
    expect(schemaSrc).toContain("accepted");
    expect(schemaSrc).toContain("expired");
    expect(schemaSrc).toContain("cancelled");
  });
});

describe("Invite System - Database Helpers", () => {
  it("should export createInvite function", () => {
    expect(dbInvitesSrc).toContain("export async function createInvite");
  });

  it("should export getInviteByToken function", () => {
    expect(dbInvitesSrc).toContain("export async function getInviteByToken");
  });

  it("should export isInviteValid function", () => {
    expect(dbInvitesSrc).toContain("export async function isInviteValid");
  });

  it("should export acceptInvite function", () => {
    expect(dbInvitesSrc).toContain("export async function acceptInvite");
  });

  it("should export getPendingInvites function", () => {
    expect(dbInvitesSrc).toContain("export async function getPendingInvites");
  });

  it("should export cancelInvite function", () => {
    expect(dbInvitesSrc).toContain("export async function cancelInvite");
  });

  it("should generate secure random token", () => {
    expect(dbInvitesSrc).toContain("randomBytes(32)");
  });

  it("should set default expiration to 7 days", () => {
    expect(dbInvitesSrc).toContain("expiresInDays = 7");
  });

  it("should check status is pending and not expired in isInviteValid", () => {
    expect(dbInvitesSrc).toContain('invite.status !== "pending"');
    expect(dbInvitesSrc).toContain("new Date() > invite.expiresAt");
  });

  it("should auto-expire invites when validation finds them expired", () => {
    expect(dbInvitesSrc).toContain('.set({ status: "expired" })');
  });

  it("should create user with invite role on accept", () => {
    expect(dbInvitesSrc).toContain("role: invite.role");
  });

  it("should mark invite as accepted after user creation", () => {
    expect(dbInvitesSrc).toContain('.set({ status: "accepted"');
  });

  it("should set loginMethod to invite for invited users", () => {
    expect(dbInvitesSrc).toContain('loginMethod: "invite"');
  });
});

describe("Invite System - Router Endpoints", () => {
  it("should be wired into appRouter", () => {
    expect(routersSrc).toContain('import { invitesRouter }');
    expect(routersSrc).toContain("invites: invitesRouter");
  });

  it("should have create endpoint as adminProcedure", () => {
    expect(invitesRouterSrc).toContain("create: adminProcedure");
  });

  it("should have listPending endpoint as adminProcedure", () => {
    expect(invitesRouterSrc).toContain("listPending: adminProcedure");
  });

  it("should have validate endpoint as publicProcedure", () => {
    expect(invitesRouterSrc).toContain("validate: publicProcedure");
  });

  it("should have accept endpoint as publicProcedure", () => {
    expect(invitesRouterSrc).toContain("accept: publicProcedure");
  });

  it("should have cancel endpoint as adminProcedure", () => {
    expect(invitesRouterSrc).toContain("cancel: adminProcedure");
  });

  it("should validate role input as agent or admin", () => {
    expect(invitesRouterSrc).toContain('z.enum(["agent", "admin"])');
  });

  it("should require password minimum 6 characters on accept", () => {
    expect(invitesRouterSrc).toContain('z.string().min(6');
  });

  it("should require name on accept", () => {
    expect(invitesRouterSrc).toContain('z.string().min(1');
  });

  it("should validate invite before accepting", () => {
    expect(invitesRouterSrc).toContain("isInviteValid(input.token)");
  });

  it("should throw error for invalid invites on accept", () => {
    expect(invitesRouterSrc).toContain("Invite is expired, already used, or invalid");
  });

  it("should only allow cancelling pending invites", () => {
    expect(invitesRouterSrc).toContain('invite.status !== "pending"');
    expect(invitesRouterSrc).toContain("Only pending invites can be cancelled");
  });
});

describe("Invite System - Frontend: UserManagement Modal", () => {
  it("should have invite dialog state", () => {
    expect(userMgmtSrc).toContain("inviteDialogOpen");
  });

  it("should have invite role selector", () => {
    expect(userMgmtSrc).toContain("inviteRole");
    expect(userMgmtSrc).toContain('setInviteRole');
  });

  it("should have invite email input (optional)", () => {
    expect(userMgmtSrc).toContain("inviteEmail");
  });

  it("should call trpc.invites.create mutation", () => {
    expect(userMgmtSrc).toContain("trpc.invites.create.useMutation");
  });

  it("should call trpc.invites.listPending query", () => {
    expect(userMgmtSrc).toContain("trpc.invites.listPending.useQuery");
  });

  it("should call trpc.invites.cancel mutation", () => {
    expect(userMgmtSrc).toContain("trpc.invites.cancel.useMutation");
  });

  it("should generate invite link with token", () => {
    expect(userMgmtSrc).toContain("/invite/${data.token}");
  });

  it("should have copy link functionality", () => {
    expect(userMgmtSrc).toContain("navigator.clipboard.writeText(createdInviteLink)");
  });

  it("should show pending invites list", () => {
    expect(userMgmtSrc).toContain("pendingInvites");
    expect(userMgmtSrc).toContain("Pending Invites");
  });

  it("should show link expires in 7 days message", () => {
    expect(userMgmtSrc).toContain("expires in 7 days");
  });

  it("should have Generate Another Invite button", () => {
    expect(userMgmtSrc).toContain("Generate Another Invite");
  });
});

describe("Invite System - Frontend: InviteAccept Page", () => {
  it("should exist and be routed at /invite/:token", () => {
    expect(appTsxSrc).toContain('path="/invite/:token"');
    expect(appTsxSrc).toContain("InviteAccept");
  });

  it("should extract token from URL", () => {
    expect(inviteAcceptSrc).toContain('useRoute("/invite/:token")');
  });

  it("should validate invite token on load", () => {
    expect(inviteAcceptSrc).toContain("trpc.invites.validate.useQuery");
  });

  it("should have name, phone, password, confirmPassword fields", () => {
    expect(inviteAcceptSrc).toContain("name:");
    expect(inviteAcceptSrc).toContain("phone:");
    expect(inviteAcceptSrc).toContain("password:");
    expect(inviteAcceptSrc).toContain("confirmPassword:");
  });

  it("should call trpc.invites.accept mutation on submit", () => {
    expect(inviteAcceptSrc).toContain("trpc.invites.accept.useMutation");
  });

  it("should validate password match before submit", () => {
    expect(inviteAcceptSrc).toContain("form.password !== form.confirmPassword");
  });

  it("should validate password minimum length", () => {
    expect(inviteAcceptSrc).toContain("form.password.length < 6");
  });

  it("should show loading state while validating", () => {
    expect(inviteAcceptSrc).toContain("Validating invite");
  });

  it("should show error state for invalid/expired invites", () => {
    expect(inviteAcceptSrc).toContain("Invalid Invite");
    expect(inviteAcceptSrc).toContain("expired, already used, or invalid");
  });

  it("should show success state after account creation", () => {
    expect(inviteAcceptSrc).toContain("Account Created");
    expect(inviteAcceptSrc).toContain("Go to Login");
  });

  it("should display the assigned role badge", () => {
    expect(inviteAcceptSrc).toContain("invite.role");
    expect(inviteAcceptSrc).toContain("Admin");
    expect(inviteAcceptSrc).toContain("Agent");
  });

  it("should NOT render inside DashboardLayout (standalone page)", () => {
    expect(appTsxSrc).toContain('<Route path="/invite/:token" component={() => <InviteAccept />} />');
    // Should NOT be wrapped in DashboardLayout
    expect(appTsxSrc).not.toContain("DashboardLayout><InviteAccept");
  });
});
