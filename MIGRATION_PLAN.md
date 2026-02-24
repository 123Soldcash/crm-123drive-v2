# Unified User System Migration Plan

## Current State
- **`users` table**: Auth users who log in via OAuth. Has: id, openId, name, email, phone, loginMethod, role (user/admin), timestamps
- **`agents` table**: Manually created agent records. Has: id, name, email, phone, role (Birddog/Acq Manager/etc.), agentType (Internal/External/Birddog/Corretor), status (Active/Inactive/Suspended), notes, timestamps
- **`agentPermissions` table**: Granular permissions per agent
- **`leadAssignments` table**: References `agentId` (currently points to agents table OR users table depending on context)
- **`propertyAgents` table**: References `agentId` (points to users table)
- **`leadTransferHistory` table**: References fromAgentId, toAgentId
- **`properties.assignedAgentId`**: Points to users table

## Target State
- **`users` table**: Single source of truth for ALL people in the system
  - role: "admin" | "agent" (replaces the old "user" role with "agent")
  - New fields: status, notes (from agents table)
  - Remove: agentType (not needed - all are just users with roles)
- **`agents` table**: DEPRECATED - no longer used
- **`agentPermissions` table**: Keep but rename agentId → userId conceptually (still references users.id)
- **`leadAssignments.agentId`**: Points to users.id (already does in most cases)
- **`propertyAgents.agentId`**: Points to users.id (already does)

## Migration Steps

### 1. Schema Changes
- Add `status` (Active/Inactive/Suspended) to users table, default "Active"
- Add `notes` text field to users table
- Change role enum from ["user", "admin"] to ["admin", "agent"]
- Existing "user" role records → change to "agent"

### 2. Data Migration
- Any agents in the `agents` table that don't exist in `users` → create as users with role="agent"
- Update any leadAssignments/propertyAgents that reference agents.id to reference corresponding users.id

### 3. Backend Changes
- Remove `agentsRouter` (server/routers/agents.ts)
- Remove `agents.db.ts`
- Update `listAgents` in db.ts to return ALL users (both admin and agent)
- Create `listUsers` that returns all users with role info
- Update all routers to use users table only
- Consolidate users.* procedures

### 4. Frontend Changes
- Remove AgentManagement.tsx page
- Rewrite UserManagement.tsx as unified "User Management" with:
  - List all users (admin + agent)
  - Create new user (manual entry for agents who haven't logged in yet)
  - Edit user details + role
  - Delete user
  - Reassign properties
  - Invite link
- Update DashboardLayout sidebar: remove "Agent Management", keep "User Management"
- Update all agent references in UI to say "user" or keep contextual names
