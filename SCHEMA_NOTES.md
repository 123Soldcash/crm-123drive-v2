# Schema vs DB Discrepancies

## visits table
- DB has: id, propertyId, userId, latitude, longitude, checkInTime, notes, createdAt
- db.ts code references: visits.visitDate, visits.agentId (THESE DON'T EXIST IN DB OR SCHEMA!)
- Schema has: userId (not agentId), checkInTime (not visitDate)

## stageHistory table  
- DB has: id, propertyId, oldStage, newStage, changedBy, notes, daysInPreviousStage, changedAt, createdAt
- db.ts code references: stageHistory.agentId (DOESN'T EXIST - should be changedBy)
- Schema has: changedBy (not agentId)

## users table
- DB has: id, openId, name, email, phone, loginMethod, role (user/admin), createdAt, updatedAt, lastSignedIn
- Need to add: status, notes columns
- Need to change role enum: user → agent

## Data Migration
- agents table has 2 records (IDs 360027, 360028) that need to become users
- propertyAgents references agentIds 90005-90008 that don't exist anywhere (orphaned)
- properties.assignedAgentId references 0 and 2 that don't exist (orphaned)
