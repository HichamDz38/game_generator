import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './MyComponent.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Set to true to use mock data (for testing without backend)
const USE_MOCK_DATA = !API_BASE_URL || API_BASE_URL === '';

// Mock data for development (inline)
const mockPhysicalDevices = USE_MOCK_DATA ? {
  "192.168.16.195": {
    "hostname": "raspberrypi1",
    "version": "1.0.0",
    "metrics": {
      "cpu_percent": 23.5,
      "memory_percent": 45.2,
      "memory_used": 1932735283,
      "temperature": 42.5,
      "disk_usage": 67.8,
      "disk_used": 27917287219
    },
    "services": [
      { "service_name": "Client_Device_epaper.service", "device_name": "epaper", "status": "active/running" }
    ]
  }
} : {};

const DevicesPage = () => {
  const [physicalDevices, setPhysicalDevices] = useState({});
  const [expandedDevices, setExpandedDevices] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchAllDeviceData = async () => {
    // Use mock data if backend not available
    if (USE_MOCK_DATA) {
      console.log('Using MOCK data (no backend connection)');
      setPhysicalDevices(mockPhysicalDevices);
      return;
    }

    try {
      console.log('Fetching all physical devices with full data (single API call)...');
      const response = await axios.get(`${API_BASE_URL}/api/physical-devices`);
      
      if (!response.data) {
        console.log('No physical devices found');
        setPhysicalDevices({});
        return;
      }

      const devices = response.data;
      console.log('Loaded devices with full data:', Object.keys(devices));
      
      // Data already includes metrics and services from backend
      setPhysicalDevices(devices);
      
    } catch (error) {
      console.error('Error fetching physical devices:', error);
      setPhysicalDevices({});
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAllDeviceData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchAllDeviceData();
    }, 10000);

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDevice = (deviceId) => {
    setExpandedDevices(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };

  const handleRestartPi = async (deviceId) => {
    if (USE_MOCK_DATA) {
      alert('⚠️ MOCK MODE: Would restart Raspberry Pi ' + deviceId);
      return;
    }

    if (!window.confirm(`⚠️ WARNING: This will RESTART the entire Raspberry Pi (${deviceId}).\n\nAll services will be stopped and the device will reboot.\n\nAre you sure?`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`Sending restart Pi command to ${deviceId}...`);
      const response = await axios.post(
        `${API_BASE_URL}/api/physical-devices/${deviceId}/restart-pi`,
        { confirm: true }
      );
      console.log('Restart Pi response:', response.data);
      
      if (response.data.status === 'success') {
        alert('✓ Raspberry Pi restart initiated. Device will reconnect in ~60 seconds.');
      } else {
        alert(`✗ Failed to restart Pi: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error restarting Pi:', error);
      console.error('Error details:', error.response?.data);
      alert(`✗ Error restarting Pi: ${error.response?.data?.message || error.message}`);
    }
    setLoading(false);
  };

  const handleServiceAction = async (deviceId, serviceName, action) => {
    console.log('=== handleServiceAction called ===');
    console.log('Device ID:', deviceId);
    console.log('Service Name:', serviceName);
    console.log('Action:', action);
    console.log('USE_MOCK_DATA:', USE_MOCK_DATA);
    console.log('API_BASE_URL:', API_BASE_URL);
    
    if (USE_MOCK_DATA) {
      alert(`⚠️ MOCK MODE: Would ${action} service "${serviceName}" on ${deviceId}`);
      // Update mock data to simulate change
      setPhysicalDevices(prev => {
        const updated = { ...prev };
        if (updated[deviceId]?.services) {
          updated[deviceId].services = updated[deviceId].services.map(s => {
            if (s.service_name === serviceName) {
              if (action === 'start') {
                return { ...s, status: 'active/running', active: true, running: true };
              } else if (action === 'stop') {
                return { ...s, status: 'inactive/dead', active: false, running: false };
              }
            }
            return s;
          });
        }
        return updated;
      });
      return;
    }

    const actionText = action === 'restart' ? 'Restart' : action === 'stop' ? 'Stop' : 'Start';
    
    if (!window.confirm(`${actionText} service "${serviceName}" on ${deviceId}?`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`Sending ${action} command to ${deviceId} for service: ${serviceName}`);
      const response = await axios.post(
        `${API_BASE_URL}/api/physical-devices/${deviceId}/service/${action}`,
        { service_name: serviceName }
      );
      
      console.log('Service action response:', response.data);
      
      if (response.data.status === 'success') {
        alert(`✓ ${actionText} successful: ${response.data.message}`);
        // Refresh all data to update service status
        await fetchAllDeviceData();
      } else {
        alert(`✗ ${actionText} failed: ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error ${action} service:`, error);
      console.error('Error response:', error.response?.data);
      alert(`✗ Error ${action} service: ${error.response?.data?.message || error.message}`);
    }
    setLoading(false);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMetricColor = (value, thresholds = { warning: 70, danger: 85 }) => {
    if (value >= thresholds.danger) return '#f44336';
    if (value >= thresholds.warning) return '#ff9800';
    return '#4caf50';
  };

  return (
    <div className={styles.Scenariopp}>
      <h1 className={styles.title}>Devices Management</h1>

      {USE_MOCK_DATA && (
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#856404'
        }}>
          🧪 MOCK DATA MODE - Using sample data (no backend connection)
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          className={styles.theme__button}
          onClick={fetchAllDeviceData}
          disabled={loading}
          style={{ fontSize: '16px', padding: '10px 30px' }}
        >
          🔄 Refresh Devices
        </button>
        {!USE_MOCK_DATA && (
          <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
            Auto-refreshing every 10 seconds
          </div>
        )}
      </div>

      <h2 className={styles.secondtitle}>
        Connected Physical Devices ({Object.keys(physicalDevices).length})
      </h2>

      {Object.keys(physicalDevices).length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px', 
          color: '#666',
          fontSize: '18px',
          fontStyle: 'italic'
        }}>
          No physical devices connected
        </div>
      ) : (
        Object.entries(physicalDevices).map(([deviceId, deviceData]) => {
          const isExpanded = expandedDevices[deviceId];
          const metrics = deviceData.metrics;
          const services = deviceData.services || [];

          return (
            <div 
              key={deviceId} 
              style={{ marginBottom: '15px' }}
            >
              {/* Main device card */}
              <div className={styles.scenariosbox}>
                {/* Left side - Device info and metrics */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* IP and hostname - clean layout */}
                  <div style={{ marginBottom: '8px' }}>
                    <div className={styles.name_scenario} style={{ marginBottom: '4px' }}>
                      🖥️ {deviceId}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#888',
                      fontFamily: 'monospace'
                    }}>
                      {deviceData.hostname || 'unknown'} • v{deviceData.version || '1.0.0'}
                    </div>
                  </div>
                  
                  {/* Metrics inline - compact display */}
                  {metrics && metrics.cpu_percent !== undefined ? (
                    <div style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      marginTop: '8px',
                      fontSize: '13px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ 
                        padding: '4px 10px', 
                        background: '#f5f5f5', 
                        borderRadius: '4px',
                        borderLeft: `3px solid ${getMetricColor(metrics.cpu_percent)}`,
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{ color: '#666' }}>CPU: </span>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: getMetricColor(metrics.cpu_percent) 
                        }}>
                          {metrics.cpu_percent.toFixed(1)}%
                        </span>
                      </div>

                      {metrics.temperature !== undefined && metrics.temperature !== null && (
                        <div style={{ 
                          padding: '4px 10px', 
                          background: '#f5f5f5', 
                          borderRadius: '4px',
                          borderLeft: `3px solid ${getMetricColor(metrics.temperature, { warning: 65, danger: 75 })}`,
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{ color: '#666' }}>Temp: </span>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.temperature, { warning: 65, danger: 75 }) 
                          }}>
                            {metrics.temperature.toFixed(1)}°C
                          </span>
                        </div>
                      )}

                      {metrics.memory_percent !== undefined && (
                        <div style={{ 
                          padding: '4px 10px', 
                          background: '#f5f5f5', 
                          borderRadius: '4px',
                          borderLeft: `3px solid ${getMetricColor(metrics.memory_percent)}`,
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{ color: '#666' }}>RAM: </span>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.memory_percent) 
                          }}>
                            {metrics.memory_percent.toFixed(1)}%
                          </span>
                          {metrics.memory_used !== undefined && (
                            <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>
                              ({formatBytes(metrics.memory_used)})
                            </span>
                          )}
                        </div>
                      )}

                      {metrics.disk_usage !== undefined && (
                        <div style={{ 
                          padding: '4px 10px', 
                          background: '#f5f5f5', 
                          borderRadius: '4px',
                          borderLeft: `3px solid ${getMetricColor(metrics.disk_usage)}`,
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{ color: '#666' }}>Disk: </span>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.disk_usage) 
                          }}>
                            {metrics.disk_usage.toFixed(1)}%
                          </span>
                          {metrics.disk_used !== undefined && (
                            <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>
                              ({formatBytes(metrics.disk_used)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: '10px', color: '#999', fontSize: '14px' }}>
                      {deviceData.error ? `Error: ${deviceData.error}` : 'Loading metrics...'}
                    </div>
                  )}
                </div>

                {/* Right side - Buttons */}
                <div className={styles.buttongroupe}>
                  <button 
                    className={styles.theme__button}
                    onClick={() => toggleDevice(deviceId)}
                    style={{ fontSize: '14px' }}
                  >
                    {isExpanded ? '▲ hide services' : `▼ show services (${services.length})`}
                  </button>
                  <button 
                    className={styles.delete}
                    onClick={() => handleRestartPi(deviceId)}
                    disabled={loading}
                    style={{ fontSize: '14px' }}
                  >
                    🔄 restart pi
                  </button>
                </div>
              </div>

              {/* Expanded Services Section - BELOW and CENTERED like main cards */}
              {isExpanded && (
                <div style={{
                  marginTop: '10px'
                }}>
                  <h3 style={{ 
                    fontSize: '15px', 
                    color: '#666', 
                    marginBottom: '10px',
                    marginLeft: '20px',
                    fontWeight: 'normal',
                    display: 'flex',
                    justifyContent: 'center',
                  }}>
                    🔌 Client Services ({services.length})
                  </h3>

                  {services.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '20px', 
                      background: '#f9f9f9',
                      borderRadius: '8px',
                      color: '#999',
                      fontSize: '14px',
                      marginLeft: '20px'
                    }}>
                      No client device services found
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      paddingLeft: '20px',
                      alignItems: 'center'
                    }}>
                      {services.map((service, idx) => (
                        <div 
                          key={idx}
                          className={styles.scenariosbox}
                          style={{ 
                            padding: '10px 15px',
                            margin: 0
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <div style={{ 
                                fontSize: '15px', 
                                fontWeight: 'bold',
                                color: '#333'
                              }}>
                                {service.device_name}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontWeight: 'bold',
                                backgroundColor: service.running ? '#4caf50' : '#999',
                                color: 'white'
                              }}>
                                {service.running ? '● RUNNING' : '○ STOPPED'}
                              </div>
                            </div>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#666', 
                              marginTop: '3px',
                              fontFamily: 'monospace'
                            }}>
                              {service.service_name}
                            </div>
                          </div>

                          <div className={styles.buttongroupe} style={{ gap: '5px' }}>
                            {!service.running && (
                              <button
                                className={styles.theme__button}
                                onClick={() => handleServiceAction(deviceId, service.service_name, 'start')}
                                disabled={loading}
                                style={{ 
                                  fontSize: '12px',
                                  padding: '6px 12px',
                                  backgroundColor: '#4caf50'
                                }}
                              >
                                ▶️ start
                              </button>
                            )}
                            {service.running && (
                              <button
                                className={styles.theme__button}
                                onClick={() => handleServiceAction(deviceId, service.service_name, 'stop')}
                                disabled={loading}
                                style={{ 
                                  fontSize: '12px',
                                  padding: '6px 12px',
                                  backgroundColor: '#f44336'
                                }}
                              >
                                ⏹️ stop
                              </button>
                            )}
                            <button
                              className={styles.theme__button}
                              onClick={() => handleServiceAction(deviceId, service.service_name, 'restart')}
                              disabled={loading || !service.active}
                              style={{ 
                                fontSize: '12px',
                                padding: '6px 12px',
                                backgroundColor: '#ff9800',
                                opacity: service.active ? 1 : 0.5
                              }}
                            >
                              🔄 restart
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default DevicesPage;
