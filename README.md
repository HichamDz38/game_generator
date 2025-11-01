# Game Generator System

Escape room game flow designer and execution system with real-time device control.

## Architecture

- **Flask API** (Port 5000) - Backend REST API
- **React Frontend** (Port 3000) - Flow designer UI
- **TCP Server** (Port 65432) - Device communication
- **Redis** (Port 6379) - State management and message queue
- **Prometheus** (Port 9090) - Metrics collection
- **Grafana** (Port 3001) - Monitoring dashboards

## Quick Start

```bash
# Clone and navigate to project
cd /home/hicham/ravenzaventem/game_generator

# Start all services
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## Access Points

- **Game Designer:** http://localhost:3000
- **API:** http://localhost:5000
- **Grafana:** http://localhost:3001 (admin/admin)
- **Prometheus:** http://localhost:9090

## Development Workflow

### Recommended Bash Aliases

Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
# Docker Compose shortcuts for game_generator
alias dc-rebuild='docker-compose down --rmi all && docker-compose up -d --build'
alias dc-fresh='docker-compose down -v --rmi all && docker-compose up -d --build'
alias dc-logs='docker-compose logs -f'
alias dc-clean='docker system prune -a'
```

Apply aliases:
```bash
source ~/.bashrc
```

### Daily Development Commands

#### Normal Rebuild (Keeps Redis Data) ✅ Recommended
```bash
dc-rebuild
# or manually:
docker-compose down --rmi all
docker-compose up -d --build
```

**What it does:**
- ✅ Stops all containers
- ✅ Removes old images (frees space)
- ✅ Rebuilds with latest code
- ✅ **KEEPS Redis data, Grafana dashboards, Prometheus metrics**

---

#### Fresh Start (Removes ALL Data) ⚠️ Use with Caution
```bash
dc-fresh
# or manually:
docker-compose down -v --rmi all
docker-compose up -d --build
```

**What it does:**
- ⚠️ Stops all containers
- ⚠️ Removes all images
- ⚠️ **DELETES all volumes (Redis data, scenarios, device configs)**
- ⚠️ Starts from scratch

---

#### Watch Logs
```bash
dc-logs
# or manually:
docker-compose logs -f

# Watch specific service
docker-compose logs -f gamepanel
docker-compose logs -f tcp_server
docker-compose logs -f redis
```

---

#### Clean Up Docker System
```bash
dc-clean
# or manually:
docker system prune -a

# Check disk usage
docker system df
```

**What it does:**
- 🧹 Removes unused images
- 🧹 Removes stopped containers
- 🧹 Removes unused networks
- 🧹 Frees up disk space

---

## Data Persistence

### Volumes (Persist Between Rebuilds)

The following data is preserved when using `dc-rebuild`:

- `redis_data` - Game scenarios, device configurations, flow state
- `grafana_data` - Dashboards, settings, user preferences
- `prometheus_data` - Historical metrics

### Backup Redis Data

```bash
# Create backup
docker exec game_generator-redis-1 redis-cli SAVE
docker cp game_generator-redis-1:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb

# Restore backup
docker cp redis_backup_YYYYMMDD.rdb game_generator-redis-1:/data/dump.rdb
docker-compose restart redis
```

---

## Common Issues

### Port Already in Use

```bash
# Check what's using a port
sudo lsof -i :3000
sudo lsof -i :5000

# Kill process
sudo kill -9 <PID>
```

### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up everything (⚠️ removes unused volumes)
docker system prune -a --volumes

# Remove specific volume
docker volume rm game_generator_redis_data
```

### Container Won't Start

```bash
# Check logs for specific service
docker-compose logs gamepanel
docker-compose logs tcp_server

# Restart specific service
docker-compose restart gamepanel

# Full restart
docker-compose down
docker-compose up -d
```

---

## Services

### Flask API (gamepanel)
- Backend REST API
- Scenario management
- Device control
- File uploads

### React Frontend
- Visual flow designer
- Drag-and-drop nodes
- Real-time execution
- Device monitoring

### TCP Server
- Manages device connections
- Command routing
- Status tracking
- Heartbeat monitoring

### Redis
- Message queue for commands
- Device state storage
- Scenario data
- Execution state

### Prometheus
- Collects metrics from services
- Time-series data storage
- Alerting rules

### Grafana
- Visual dashboards
- Real-time monitoring
- Historical analysis
- Custom alerts

---

## Environment Variables

Create `.env` file in project root:

```bash
REACT_APP_API_BASE_URL=http://localhost:5000
PORT=5000
FLASK_ENV=production
```

---

## Project Structure

```
game_generator/
├── app.py                  # Flask API main file
├── docker-compose.yml      # Docker services configuration
├── prometheus.yml          # Prometheus configuration
├── requirements.txt        # Python dependencies
├── Dockerfile             # Flask API container
├── static/                # Uploaded images/files
├── templates/             # HTML templates
├── tcp_server/            # TCP server for devices
│   ├── server.py
│   └── Dockerfile
├── my-react-flow-app/     # React frontend
│   ├── src/
│   ├── package.json
│   └── Dockerfile
└── client_device/         # Device client examples
```

---

## Contributing

1. Make changes to code
2. Run `dc-rebuild` to test
3. Check logs with `dc-logs`
4. Commit changes
5. Push to repository

---

## Support

For issues or questions, check:
- Docker logs: `dc-logs`
- Service status: `docker-compose ps`
- Redis data: `docker exec -it game_generator-redis-1 redis-cli`

---

## License

[Add your license here]
