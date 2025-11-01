# Stop/Cancel Implementation for OR Condition Nodes

## Overview
When an OR condition is satisfied (one parallel path completes), all other parallel paths must be stopped immediately by sending stop/cancel commands to the devices that are still executing.

## Architecture

### Backend (Flask - app.py)

#### New Endpoint: `/stop/<device_id>`
```python
@app.route('/stop/<device_id>', methods=['POST'])
def stop_device(device_id):
    """
    Send stop/cancel command to a device
    - Queues 'stop' command to Redis (device_id:commands)
    - Device will process command and update its status
    - Does NOT directly set status (device confirms cancellation)
    """
```

**Flow:**
1. Frontend sends POST to `/stop/<device_id>` with `{nodeId: "xxx"}`
2. Backend queues stop command to Redis: `{command: 'stop', node_id: 'xxx'}`
3. Device reads command from Redis queue
4. Device stops its operation
5. Device updates status to "cancelled" via `/send_status/<device_id>`
6. Frontend polls `/get_status/<node_id>` to confirm cancellation

### Frontend (React - DnDFlow.js)

#### State Management

**Added to executionState:**
```javascript
activeNodesByPath: {
  "path_123_abc": ["node1", "node2"],  // Device nodes actively executing on this path
  "path_123_abc_branch_0": ["node3"],
  "path_123_abc_branch_1": ["node4"]
}
```

**Added ref:**
```javascript
const executionStateRef = useRef(executionState);
```
- Keeps current state accessible in callbacks without stale closures

#### Tracking Active Device Nodes

**When node execution starts (executeNode):**
- If node is a device node, add it to `activeNodesByPath[pathId]`
- Virtual and condition nodes are NOT tracked (only devices need stopping)

**When node execution completes:**
- Remove node from `activeNodesByPath[pathId]`
- This ensures we only track actively running devices

#### Stopping Parallel Paths

**Function: `stopAllActiveExecutions(excludePaths = [])`**

**Purpose:** Stop all actively executing devices (except on excluded paths)

**Process:**
1. Collect all device nodes from `activeNodesByPath` (excluding paths in `excludePaths`)
2. For each device node:
   - Send POST to `/stop/<device_id>` with nodeId
   - Poll `/get_status/<node_id>` every 1 second
   - **Wait indefinitely** until status becomes: 'cancelled', 'completed', or 'failed'
   - No timeout - waits until device responds or communication fails
3. Update UI: orange border for successfully cancelled, red for communication failures

#### OR Condition Integration

**In executeConditionNode():**
```javascript
if (logicType === 'OR' && conditionMet) {
  console.log('OR condition met - stopping devices on other parallel paths');
  await stopAllActiveExecutions([]); // Stop ALL active devices
  // Devices that already completed won't be in activeNodesByPath
}
```

**Why pass empty array `[]`?**
- Completed devices are already removed from `activeNodesByPath`
- Only still-executing devices remain
- We want to stop ALL of them (no exclusions)

## Example Flow

### Scenario: Device1 → (Device2 || Device3) → OR Condition

**Timeline:**

```
T=0s:   Device1 completes
        → Device2 starts (path_A)
        → Device3 starts (path_B)
        activeNodesByPath = {
          "path_A": ["device2_node"],
          "path_B": ["device3_node"]
        }

T=5s:   Device2 completes
        → Removed from activeNodesByPath
        activeNodesByPath = {
          "path_B": ["device3_node"]
        }
        
        → OR Condition evaluates: 1 source completed ✓
        → Calls stopAllActiveExecutions([])
        
        → POST /stop/device3_id with {nodeId: "device3_node"}
        → Redis: device3_id:commands ← {"command": "stop", "node_id": "device3_node"}
        
T=5.1s: Device3 receives stop command
        → Device3 stops operation
        → POST /send_status/device3_id with {status: "cancelled"}
        → Redis: device3_id:status ← "cancelled"
        
T=5.2s: Frontend polls GET /get_status/device3_node
        → Receives {status: "cancelled"}
        → Confirms cancellation successful
        → Updates UI: Device3 node shows orange/cancelled
        
T=6s:   Flow continues past OR condition node
```

## Device Requirements

### Devices must implement:

1. **Command Processing:**
   - Read from Redis queue: `{device_id}:commands`
   - Handle commands: `start`, `stop`, `reset`, `finish`

2. **Stop Command Handler:**
   ```python
   if command_data['command'] == 'stop':
       # Stop current operation immediately
       self.cleanup()
       self.is_running = False
       
       # Confirm cancellation
       self.send_status('cancelled')
   ```

3. **Status Updates:**
   - Send status via POST `/send_status/{device_id}`
   - Valid statuses: `'in progress'`, `'completed'`, `'failed'`, `'cancelled'`

4. **Communication Reliability:**
   - Must send acknowledgment after receiving commands
   - TCP server expects JSON response: `{"status": "success", "node_id": "..."}`
   - Connection failures automatically mark operation as `'failed'`
   - Redis data cleaned up automatically on disconnect

## Status Flow

```
Device Lifecycle:
  started → in progress → [completed | failed | cancelled]

Frontend sends /start/{device_id}:
  → Backend sets status: 'in progress'
  → Backend queues: {command: 'start', config: {...}}
  → Device processes and updates status when done

Frontend sends /stop/{device_id}:
  → Backend queues: {command: 'stop'}
  → Device processes and updates status: 'cancelled'
```

## Testing Checklist

- [ ] OR condition with 2 parallel paths (one completes first)
- [ ] OR condition with 3+ parallel paths (verify all others stop)
- [ ] Device takes long time to complete (verify no timeout)
- [ ] Device doesn't respond to stop (verify waits indefinitely)
- [ ] User stops flow while waiting for device (verify immediate stop)
- [ ] Communication failure during status check (marked as failed)
- [ ] Device already completed before stop sent (no error)
- [ ] AND condition doesn't stop parallel paths (only OR does)
- [ ] UI correctly shows orange for cancelled nodes
- [ ] Multiple OR conditions in same flow
- [ ] Stop command arrives while device is starting up
- [ ] Device responds with 'failed' status (proper error handling)

## Configuration

**Backend:**
- Redis host: `redis` (Docker)
- Command queue: `{device_id}:commands`
- Status key: `{device_id}:status`
- Node status key: `flow_execution:{node_id}`

**Frontend:**
- API Base URL: from env `REACT_APP_API_BASE_URL`
- Status poll interval: 1 second
- **No timeout - waits indefinitely for device response**
- Only stops on user-initiated stop (Stop Flow button) or communication failure

## Error Handling

**Communication failure with device:**
- TCP server detects socket errors (ConnectionResetError, BrokenPipeError)
- All pending operations marked as `'failed'` in Redis
- Device status set to `'failed'`
- Redis data cleaned up automatically:
  - `{device_id}:commands` queue deleted
  - `{device_id}:status` deleted
  - `{device_id}:current_config` deleted
- Device removed from connected devices list
- Frontend receives `'failed'` status and marks node as red

**User stops flow execution:**
- All polling loops check `isRunningRef.current`
- If false, polling stops immediately
- All devices marked as cancelled

**Device reports 'failed' status:**
- Node execution throws error
- Node marked as red/failed in UI
- Error propagates up flow execution chain

**Network timeout (frontend to backend):**
- If frontend cannot reach backend API
- Status check throws fetch error
- Node marked as failed (red)
- Error logged to console
