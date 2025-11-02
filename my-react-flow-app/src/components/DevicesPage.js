import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './MyComponent.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const DevicesPage = () => {
  const [physicalDevices, setPhysicalDevices] = useState({});
  const [expandedDevices, setExpandedDevices] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchAllDeviceData = async () => {
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

    // Auto-refresh every 30 seconds for stability
    // Post-command refresh ensures immediate updates in Redis cache
    // So slower polling is safe and reduces server load
    const interval = setInterval(() => {
      fetchAllDeviceData();
    }, 30000);

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
    console.log('[DEBUG] handleRestartPi called with deviceId:', deviceId);
    console.log('[DEBUG] API_BASE_URL:', API_BASE_URL);
    
    if (!window.confirm(`⚠️ WARNING: This will RESTART the entire Raspberry Pi (${deviceId}).\n\nAll services will be stopped and the device will reboot.\n\nAre you sure?`)) {
      console.log('[DEBUG] User cancelled restart');
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

  const handleBulkServiceAction = async (action) => {
    // Collect all services from all devices
    const allServices = [];
    Object.entries(physicalDevices).forEach(([deviceId, deviceData]) => {
      const services = Array.isArray(deviceData.services) ? deviceData.services : [];
      services.forEach(service => {
        allServices.push({ deviceId, service });
      });
    });

    if (allServices.length === 0) {
      alert('No services found to control');
      return;
    }

    const actionText = action === 'restart' ? 'Restart' : action === 'stop' ? 'Stop' : 'Start';
    
    if (!window.confirm(`${actionText} ALL ${allServices.length} service(s) across ${Object.keys(physicalDevices).length} device(s)?\n\nThis will affect all client devices.`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const { deviceId, service } of allServices) {
      try {
        console.log(`Sending ${action} command to ${deviceId} for service: ${service.service_name}`);
        const response = await axios.post(
          `${API_BASE_URL}/api/physical-devices/${deviceId}/service/${action}`,
          { service_name: service.service_name }
        );
        
        if (response.data.status === 'success') {
          successCount++;
        } else {
          failCount++;
          errors.push(`${deviceId}/${service.device_name}: ${response.data.message}`);
        }
      } catch (error) {
        failCount++;
        errors.push(`${deviceId}/${service.device_name}: ${error.response?.data?.message || error.message}`);
      }
    }

    setLoading(false);

    // Show results
    let message = `${actionText} completed:\n✓ Success: ${successCount}\n✗ Failed: ${failCount}`;
    if (errors.length > 0 && errors.length <= 5) {
      message += '\n\nErrors:\n' + errors.join('\n');
    } else if (errors.length > 5) {
      message += '\n\nShowing first 5 errors:\n' + errors.slice(0, 5).join('\n');
    }
    alert(message);

    // Refresh all data
    await fetchAllDeviceData();
  };

  const handleRestartAllPis = async () => {
    // Only restart CLIENT devices, SKIP server
    const clientDeviceIds = Object.entries(physicalDevices)
      .filter(([_, data]) => data.device_type !== "server")
      .map(([deviceId, _]) => deviceId);
    
    if (clientDeviceIds.length === 0) {
      alert('No client devices to restart');
      return;
    }

    if (!window.confirm(`⚠️ WARNING: This will RESTART ALL ${clientDeviceIds.length} Raspberry Pi device(s).\n\nAll services on client devices will be stopped and devices will reboot.\n\n✓ Central server will NOT be affected\n\nAre you sure?`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const deviceId of clientDeviceIds) {
      try {
        console.log(`Sending restart Pi command to ${deviceId}...`);
        const response = await axios.post(
          `${API_BASE_URL}/api/physical-devices/${deviceId}/restart-pi`,
          { confirm: true }
        );
        
        if (response.data.status === 'success') {
          successCount++;
        } else {
          failCount++;
          errors.push(`${deviceId}: ${response.data.message}`);
        }
      } catch (error) {
        failCount++;
        errors.push(`${deviceId}: ${error.response?.data?.message || error.message}`);
      }
    }

    setLoading(false);

    // Show results
    let message = `Restart All Client Pis completed:\n✓ Success: ${successCount}\n✗ Failed: ${failCount}`;
    if (errors.length > 0 && errors.length <= 5) {
      message += '\n\nErrors:\n' + errors.join('\n');
    } else if (errors.length > 5) {
      message += '\n\nShowing first 5 errors:\n' + errors.slice(0, 5).join('\n');
    }
    message += '\n\n✓ Central server was NOT restarted\n\nClient devices will reconnect in ~60 seconds.';
    alert(message);

    // Refresh all data
    await fetchAllDeviceData();
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

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          className={styles.theme__button}
          onClick={fetchAllDeviceData}
          disabled={loading}
          style={{ fontSize: '16px', padding: '10px 30px' }}
        >
          🔄 Refresh Devices
        </button>
        <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
          Auto-refreshing every 30 seconds (immediate update after commands)
        </div>
      </div>

      {/* Bulk Control Buttons */}
      {Object.keys(physicalDevices).length > 0 && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '20px',
          padding: '15px',
          background: '#f5f5f5',
          borderRadius: '8px',
          border: '2px solid #ddd'
        }}>
          {/* Client Services Control */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              color: '#333',
              marginBottom: '10px'
            }}>
              🎛️ Control All Client Services
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button 
                className={styles.theme__button}
                onClick={() => handleBulkServiceAction('start')}
                disabled={loading}
                style={{ 
                  fontSize: '14px', 
                  padding: '8px 20px',
                  background: '#4caf50',
                  minWidth: '120px'
                }}
              >
                ▶️ Start All
              </button>
              <button 
                className={styles.theme__button}
                onClick={() => handleBulkServiceAction('restart')}
                disabled={loading}
                style={{ 
                  fontSize: '14px', 
                  padding: '8px 20px',
                  background: '#ff9800',
                  minWidth: '120px'
                }}
              >
                🔄 Restart All
              </button>
              <button 
                className={styles.delete}
                onClick={() => handleBulkServiceAction('stop')}
                disabled={loading}
                style={{ 
                  fontSize: '14px', 
                  padding: '8px 20px',
                  minWidth: '120px'
                }}
              >
                ⏹️ Stop All
              </button>
            </div>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '12px', 
              color: '#666',
              fontStyle: 'italic'
            }}>
              These actions will affect all client services across all connected devices
            </div>
          </div>

          {/* Separator */}
          <div style={{ 
            height: '1px', 
            background: '#ddd', 
            margin: '15px 0'
          }}></div>

          {/* Physical Device Control */}
          <div>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              color: '#d32f2f',
              marginBottom: '10px'
            }}>
              🖥️ Control Physical Devices (Pi)
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button 
                className={styles.delete}
                onClick={handleRestartAllPis}
                disabled={loading}
                style={{ 
                  fontSize: '14px', 
                  padding: '8px 20px',
                  minWidth: '140px'
                }}
              >
                ⚠️ Restart All Pis
              </button>
            </div>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '12px', 
              color: '#d32f2f',
              fontStyle: 'italic',
              fontWeight: 'bold'
            }}>
              ⚠️ WARNING: This will reboot all client Raspberry Pi(s) immediately!
              <br />
              ✓ Central server will NOT be affected
            </div>
          </div>
        </div>
      )}

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
        Object.entries(physicalDevices)
          .sort(([_, dataA], [__, dataB]) => {
            // Sort by hostname (e.g., "pi-gaming-1", "pi-gaming-2", etc.)
            const hostnameA = (dataA.hostname || '').toLowerCase();
            const hostnameB = (dataB.hostname || '').toLowerCase();
            return hostnameA.localeCompare(hostnameB);
          })
          .map(([deviceId, deviceData]) => {
          const isExpanded = expandedDevices[deviceId];
          const metrics = deviceData.metrics;
          // Ensure services is always an array
          const services = Array.isArray(deviceData.services) ? deviceData.services : [];

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
