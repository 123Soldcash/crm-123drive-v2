# TypeScript Error Audit - 298 errors

## Dead Files to Remove
- `server/agents.db.ts` (5 errors) — not imported anywhere
- `client/src/pages/AgentManagement.tsx` (3 errors) — not imported anywhere

## Server Files (73 errors)
### server/routers.ts (26 errors)
- Missing db functions: generateZillowUrl, toggleOwnerVerified, getPropertyStats, addPropertyAgent, createLeadTransfer, getPendingTransfersForAgent, deleteProperty, getPropertiesWithFilters, bulkAssignAgentToProperties, getRecentVisits, createVisit, createSavedSearch, deleteSavedSearch, updateSavedSearch, updateNote
- Missing properties: lat/lng/status on Property type
- Argument count: mapDealMachineRow (line 3165), importDealMachineProperties (line 3199)

### server/db.ts (17 errors)
- visits table: visitDate, agentId don't exist (use checkInTime, userId)
- photos table: url, description don't exist (use fileUrl, caption)
- stageHistory: stage, agentId don't exist (use newStage, changedBy)
- taskComments: content, authorId don't exist (use comment, userId)
- leadTransfers: newAgentId doesn't exist (use toAgentId)
- Type mismatches: status enum, temperature enum
- insertId not on MySqlRawQueryResult

### server/communication.ts (15 errors)
- contactAddresses: address doesn't exist (use addressLine1)
- contactPhones: number doesn't exist (use phoneNumber)
- contacts: type doesn't exist

### server/db-automated-followups.ts (6 errors) — insertId issues
### server/db-stageManagement.ts (5 errors) — properties/stageHistory not imported
### server/agents.db.ts (5 errors) — DEAD FILE
### server/db-deal-calculator.ts (4 errors) — apn doesn't exist on properties
### server/db-duplicates-dashboard.ts (2 errors) — gpsLatitude/gpsLongitude
### server/db-dealmachine-import.ts (2 errors) — overload mismatch
### server/db-buyers.ts (2 errors) — insertId + type mismatch

## Client Files (99 errors)
### client/src/pages/Properties.tsx (39 errors) — property field name mismatches
### client/src/pages/ImportDealMachine.tsx (7 errors)
### client/src/components/VisitHistory.tsx (8 errors)
### client/src/components/ContactsSection.tsx (4 errors)
### client/src/pages/ActivityTracking.tsx (4 errors)
### client/src/components/FamilyTreeRedesigned.tsx (3 errors)
### client/src/pages/AgentManagement.tsx (3 errors) — DEAD FILE
### Various other components (2 each)

## Test Files (126 errors)
### CallTrackingTable.test.tsx (67 errors)
### DealCalculator.test.tsx (29 errors)
### NotesSection.test.tsx (19 errors)
### DeskChrisNotes.test.tsx (11 errors)
