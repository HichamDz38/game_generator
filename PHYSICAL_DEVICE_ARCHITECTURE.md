# Physical Device Monitoring Architecture

## Overview
The physical device monitoring system uses a **background polling + caching** architecture to provide instant API responses without timeouts.

## Architecture Flow

```
Monitor Device (Raspberry Pi)
    ↓ (socket connection)
TCP Server (Docker)
    ↓ (background polling every 10s)
Redis Cache
    ↓ (instant read)
Flask API
    ↓ (HTTP)
React Frontend
```

## Components

### 1. Monitor Device (`monitor_device/client.py`)
- Runs on Raspberry Pi as systemd service
- Connects to TCP server via socket
- Responds to commands:
  - `get_metrics` - System metrics (CPU, memory, disk, temperature)
  - `list_devices` - Client device services running on Pi
  - `restart_pi` - Restart the Raspberry Pi
  - `restart_device` - Restart a specific service
  - `stop_device` - Stop a service
  - `start_device` - Start a service

### 2. TCP Server (`tcp_server/server.py`)
- Runs in Docker container
- Maintains socket connections to all monitor devices
- **Background polling thread** (every 10 seconds):
  - Sends `get_metrics` command to each connected monitor
  - Sends `list_devices` command to each connected monitor
  - Caches results in Redis with 30-second TTL
  - Keys: `{device_id}:cached_metrics`, `{device_id}:cached_devices`
- Also handles on-demand commands from Flask API

### 3. Redis Cache
- Stores cached metrics and device lists
- TTL: 30 seconds (auto-expires if device disconnects)
- Keys:
  - `connected_physical_devices` - List of connected monitors
  - `{device_id}:cached_metrics` - Cached system metrics
  - `{device_id}:cached_devices` - Cached client device list
  - `{device_id}:physical_command` - Command queue (on-demand)
  - `{device_id}:physical_response` - Response queue (on-demand)

### 4. Flask API (`app.py`)
- `/api/physical-devices` - Get all monitors with cached data
- `/api/physical-devices/<id>/metrics` - Get metrics (cached)
- `/api/physical-devices/<id>/client-devices` - Get devices (cached)
- `/api/physical-devices/<id>/restart-pi` - Restart Pi (on-demand command)
- `/api/physical-devices/<id>/restart-device` - Restart service (on-demand)
- **Primary mode**: Read from Redis cache (instant, no timeout)
- **Fallback mode**: Send on-demand command if cache not available

### 5. React Frontend (`DevicesBeta.js`)
- Displays all connected monitors
- Shows real-time metrics (CPU, memory, disk, temperature)
- Lists client device services with status
- Provides control buttons (restart Pi, restart service)

## Benefits

### ✅ No Timeouts
- API reads from cache (instant response)
- No waiting for monitor device to process commands

### ✅ Better Performance
- Frontend loads instantly
- No 30-second waits for slow systemctl commands

### ✅ Resilient
- Cache has 30s TTL (auto-cleanup on disconnect)
- Fallback to on-demand query if cache unavailable
- Monitor devices only talk to TCP server (clean architecture)

### ✅ Scalable
- TCP server polls all monitors in background
- Adding more monitors doesn't slow down API
- Polling interval adjustable (currently 10s)

## Timing

- **Background polling**: Every 10 seconds
- **Cache TTL**: 30 seconds
- **On-demand timeout**: 10 seconds (fallback only)
- **API response**: < 10ms (reading from Redis)

## Deployment

### Update Monitor Device on Raspberry Pi
```bash
cd /home/hicham/ravenzaventem/monitor_device
./deploy.sh <raspberry_pi_ip> [username]

# Example:
./deploy.sh 192.168.1.100 pi
```

### Restart Docker Services
```bash
cd /home/hicham/ravenzaventem/game_generator
docker-compose restart tcp_server gamepanel
```

## Troubleshooting

### Check if monitor is connected
```bash
docker exec game_generator-redis-1 redis-cli GET connected_physical_devices
```

### Check cached metrics
```bash
docker exec game_generator-redis-1 redis-cli GET "raspberrypi:cached_metrics"
```

### Check TCP server logs
```bash
docker-compose logs -f tcp_server | grep "Polling physical"
```

### Check monitor device logs (on Raspberry Pi)
```bash
sudo journalctl -u Client_Device_monitor.service -f
```

## Configuration

### Change polling interval
Edit `tcp_server/server.py`, line ~555:
```python
time.sleep(10)  # Change to desired interval in seconds
```

### Change cache TTL
Edit `tcp_server/server.py`, lines ~510 and ~543:
```python
r.setex(metrics_cache_key, 30, ...)  # Change 30 to desired TTL
```
