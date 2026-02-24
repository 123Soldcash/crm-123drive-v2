# Data Audit Results

## Users table (1 record)
- ID 1: Rosangela Russo (admin) - the only real logged-in user

## Agents table (2 records)
- ID 360027: TAYLOR (Birddog/Internal, drtaylor1050@gmail.com)
- ID 360028: 172 (Birddog/External, fortlauderdale172@gmail.com)

## propertyAgents references (7 unique agentIds)
- agentId=1 → Rosangela Russo (in users, NOT in agents)
- agentId=90005-90008 → NOT in users, NOT in agents (orphaned - old deleted users)
- agentId=360027 → TAYLOR (in agents, NOT in users)
- agentId=360028 → 172 (in agents, NOT in users)

## leadAssignments references
- agentId=360028 → 172 (in agents, NOT in users)

## properties.assignedAgentId references
- 0 → invalid
- 2 → NOT in users (orphaned)
- 360027 → TAYLOR (in agents)
- 360028 → 172 (in agents)

## Migration Actions Needed:
1. Insert TAYLOR and 172 into users table as role="agent" with new IDs
2. Update all propertyAgents, leadAssignments, properties.assignedAgentId to use new user IDs
3. Clean up orphaned references (90005-90008, 0, 2)
4. Add status and notes columns to users table
