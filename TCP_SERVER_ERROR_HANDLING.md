# TCP Server Communication Error Handling

## Overview
When there is a communication failure with a physical device, the TCP server now automatically:
1. Sets the device status to `'failed'`
2. Marks all pending operations as `'failed'`
3. Cleans up all Redis data for the device
4. Removes device from connected devices list

## Changes Made

### 1. Enhanced `process_command()` Function

**Added Error Handling:**
```python
def process_command(client_socket, command, index):
    node_id = None
    try:
        # Command processing...
        
    except (socket.error, ConnectionResetError, BrokenPipeError) as e:
        print(f"[!] Communication error with device: {e}")
        if node_id:
            r.set(f"flow_execution:{node_id}", "failed")
        raise
        
    except json.JSONDecodeError as e:
        print(f"[!] Invalid JSON from device: {e}")
        if node_id:
            r.set(f"flow_execution:{node_id}", "failed")
        raise
        
    except Exception as e:
        print(f"[!] Error processing command: {e}")
        if node_id:
            r.set(f"flow_execution:{node_id}", "failed")
        raise
```

**Error Types Handled:**
- `socket.error` - General socket communication errors
- `ConnectionResetError` - Device disconnected unexpectedly
- `BrokenPipeError` - Write to closed socket
- `json.JSONDecodeError` - Invalid response from device
- `ConnectionError` - No acknowledgment received from device

### 2. New `cleanup_redis_data()` Function

**Purpose:** Remove all Redis data when device disconnects

**Cleans Up:**
- Command queue: `{device_id}:commands`
- Status: `{device_id}:status`
- Configuration: `{device_id}:current_config`

**For Multi-Node Devices:**
Cleans up data for all instances (`device_id_1`, `device_id_2`, etc.)

```python
def cleanup_redis_data(device_id, num_nodes):
    """Clean up Redis data for device (commands, status, config)"""
    if num_nodes > 1:
        for i in range(num_nodes):
            instance_id = f"{device_id}_{i+1}"
            r.delete(f"{instance_id}:commands")
            r.delete(f"{instance_id}:status")
            r.delete(f"{instance_id}:current_config")
    else:
        r.delete(f"{device_id}:commands")
        r.delete(f"{device_id}:status")
        r.delete(f"{device_id}:current_config")
```

### 3. Enhanced `handle_client()` Function

**Communication Error Detection:**
```python
while True:
    try:
        command = get_command_for_device(device_id, num_nodes, index)
        
        if command:
            process_command(client_socket, command, index)
        
        if num_nodes > 1:
            index = (index+1) % num_nodes
            
    except (socket.error, ConnectionResetError, BrokenPipeError) as e:
        print(f"[!] Communication error with device {device_id}: {e}")
        print(f"[!] Marking all pending operations as failed")
        
        # Mark all pending commands as failed
        pending_cmds = r.lrange(f"{device_id}:commands", 0, -1)
        for cmd in pending_cmds:
            try:
                cmd_data = json.loads(cmd)
                if cmd_data.get('node_id'):
                    r.set(f"flow_execution:{cmd_data['node_id']}", "failed")
            except:
                pass
        
        client_socket.close()
        cleanup_device(device_id, num_nodes)
        break
```

**Multi-Node Support:**
For devices with multiple nodes, checks and marks failed operations for all instances.

## Error Flow

### Scenario: Device Disconnects During Operation

```
1. Frontend sends start command
   → Backend queues: {device_id}:commands ← {"command": "start", "node_id": "xxx"}
   → Backend sets: flow_execution:xxx ← "started"

2. TCP server sends command to device
   → Waits for acknowledgment

3. Device disconnects (cable unplugged, crash, etc.)
   → socket.recv() raises ConnectionResetError

4. TCP server catches error:
   → Sets: flow_execution:xxx ← "failed"
   → Calls cleanup_redis_data(device_id)
     - Deletes: {device_id}:commands
     - Deletes: {device_id}:status
     - Deletes: {device_id}:current_config
   → Removes device from connected_devices
   → Closes socket

5. Frontend polling detects 'failed' status
   → Marks node as red (failed)
   → Logs error to console
   → Flow continues with error handling
```

### Scenario: Multiple Pending Commands When Device Fails

```
Device has 3 commands queued:
  - {device_id}:commands = [cmd1, cmd2, cmd3]

Device fails while processing cmd1:
  1. TCP server catches communication error
  2. Reads all pending commands from Redis
  3. For each command:
     - Extracts node_id
     - Sets flow_execution:{node_id} = "failed"
  4. Cleans up all Redis data
  5. All 3 operations marked as failed
```

## Testing Scenarios

### Test 1: Device Crash During Execution
```bash
# Start flow with device node
# While device is executing, kill device process
# Expected: Node marked as failed, Redis cleaned up
```

### Test 2: Network Cable Disconnect
```bash
# Start flow with device node
# Unplug network cable from device
# Expected: Connection error detected, status = failed
```

### Test 3: Invalid Device Response
```bash
# Device sends malformed JSON
# Expected: JSONDecodeError caught, status = failed
```

### Test 4: Multi-Node Device Failure
```bash
# Device with num_nodes=3
# Device fails while processing node 2
# Expected: All 3 instances cleaned up from Redis
```

### Test 5: Device No Acknowledgment
```bash
# Device receives command but doesn't respond
# Expected: ConnectionError raised, status = failed
```

## Redis Keys Affected

**Before Device Connection:**
```
connected_devices = {}
```

**During Device Operation:**
```
connected_devices = {"192.168.1.10:device1": {...}}
192.168.1.10:device1:commands = ["cmd1", "cmd2"]
192.168.1.10:device1:status = "in progress"
192.168.1.10:device1:current_config = {...}
flow_execution:node_abc = "in progress"
```

**After Communication Failure:**
```
connected_devices = {}  // Device removed
// All device-specific keys deleted:
192.168.1.10:device1:commands = (deleted)
192.168.1.10:device1:status = (deleted)
192.168.1.10:device1:current_config = (deleted)
flow_execution:node_abc = "failed"  // Marked as failed
```

## Benefits

1. **Automatic Cleanup:** No manual intervention needed when devices fail
2. **Clear Status:** Frontend immediately sees 'failed' status
3. **No Stale Data:** Redis stays clean, no orphaned keys
4. **Multi-Node Support:** Handles complex device configurations
5. **Pending Operations:** All queued commands marked as failed, not left hanging
6. **Graceful Degradation:** Flow can continue with error handling

## Integration with Frontend

Frontend already has infinite polling that checks for status changes. When device fails:

```javascript
// Frontend executeDeviceNode polling loop
while (status === 'started' || status === 'in progress') {
  const statusResponse = await fetch(`${API_BASE_URL}/get_status/${node.id}`);
  const statusData = await statusResponse.json();
  status = statusData.status;
  
  if (status === 'failed') {
    throw new Error('Device execution failed');  // ✅ Caught here
  }
}
```

This ensures seamless error propagation from device → TCP server → backend → frontend → UI.
