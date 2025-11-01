// Mock data for DevicesBeta testing without backend
export const mockPhysicalDevices = {
  "192.168.16.195": {
    "type": "physical",
    "hostname": "raspberrypi1",
    "version": "1.0.0",
    "capabilities": ["system_metrics", "restart_pi", "list_devices"],
    "metrics": {
      "cpu_percent": 23.5,
      "memory_percent": 45.2,
      "memory_used": 1932735283,  // ~1.8 GB
      "memory_total": 4294967296,  // 4 GB
      "disk_usage": 67.8,
      "disk_used": 27917287219,  // ~26 GB
      "disk_total": 41174138880,  // ~38 GB
      "temperature": 42.5,
      "uptime_seconds": 345600,
      "uptime_hours": 96.0
    },
    "services": [
      {
        "service_name": "Client_Device_epaper.service",
        "device_name": "epaper",
        "status": "active/running",
        "active": true,
        "running": true,
        "description": "E-Paper Display Client Device"
      },
      {
        "service_name": "Client_Device_led_matrix.service",
        "device_name": "led_matrix",
        "status": "active/running",
        "active": true,
        "running": true,
        "description": "LED Matrix Display Client Device"
      },
      {
        "service_name": "Client_Device_scoreboard.service",
        "device_name": "scoreboard",
        "status": "inactive/dead",
        "active": false,
        "running": false,
        "description": "Scoreboard Display Client Device"
      }
    ]
  },
  "192.168.16.208": {
    "type": "physical",
    "hostname": "raspberrypi2",
    "version": "1.0.0",
    "capabilities": ["system_metrics", "restart_pi", "list_devices"],
    "metrics": {
      "cpu_percent": 12.3,
      "memory_percent": 32.1,
      "memory_used": 1374389535,  // ~1.3 GB
      "memory_total": 4294967296,  // 4 GB
      "disk_usage": 45.6,
      "disk_used": 18778931814,  // ~17.5 GB
      "disk_total": 41174138880,  // ~38 GB
      "temperature": 38.2,
      "uptime_seconds": 234567,
      "uptime_hours": 65.2
    },
    "services": [
      {
        "service_name": "Client_Device_router.service",
        "device_name": "router",
        "status": "active/running",
        "active": true,
        "running": true,
        "description": "Router Control Client Device"
      }
    ]
  },
  "192.168.16.236": {
    "type": "physical",
    "hostname": "unknown",
    "version": "1.0.0",
    "capabilities": ["system_metrics", "restart_pi", "list_devices"],
    "metrics": {
      "cpu_percent": 85.4,
      "memory_percent": 78.9,
      "memory_used": 3385089229,  // ~3.15 GB
      "memory_total": 4294967296,  // 4 GB
      "disk_usage": 92.3,
      "disk_used": 38001736094,  // ~35.4 GB
      "disk_total": 41174138880,  // ~38 GB
      "temperature": 72.8,
      "uptime_seconds": 12345,
      "uptime_hours": 3.4
    },
    "services": []
  },
  "172.19.0.1": {
    "type": "physical",
    "hostname": "unknown",
    "version": "1.0.0",
    "capabilities": ["system_metrics", "restart_pi", "list_devices"],
    "metrics": {
      "cpu_percent": 0.0,
      "memory_percent": 15.2,
      "memory_used": 652835028,  // ~622 MB
      "memory_total": 4294967296,  // 4 GB
      "disk_usage": 25.1,
      "disk_used": 10334748876,  // ~9.6 GB
      "disk_total": 41174138880,  // ~38 GB
      "temperature": 42.5,
      "uptime_seconds": 987654,
      "uptime_hours": 274.3
    },
    "services": [
      {
        "service_name": "Client_Device_access_control.service",
        "device_name": "access_control",
        "status": "active/running",
        "active": true,
        "running": true,
        "description": "Access Control Keypad Device"
      },
      {
        "service_name": "Client_Device_fake_os.service",
        "device_name": "fake_os",
        "status": "active/running",
        "active": true,
        "running": true,
        "description": "Fake OS Desktop Device"
      },
      {
        "service_name": "Client_Device_contact_list.service",
        "device_name": "contact_list",
        "status": "inactive/dead",
        "active": false,
        "running": false,
        "description": "Contact List Touch Device"
      }
    ]
  }
};
