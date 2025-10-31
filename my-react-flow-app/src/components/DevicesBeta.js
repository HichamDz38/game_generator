import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './MyComponent.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const DevicesBeta = () => {
  const [physicalDevices, setPhysicalDevices] = useState({});
  const [expandedDevices, setExpandedDevices] = useState({});
  const [deviceServices, setDeviceServices] = useState({});
  const [deviceMetrics, setDeviceMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const fetchPhysicalDevices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/physical-devices`);
      if (response.data) {
        setPhysicalDevices(response.data);
      }
    } catch (error) {
      console.error('Error fetching physical devices:', error);
    }
  };

  const fetchDeviceMetrics = async (deviceId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/physical-devices/${deviceId}/metrics`);
      if (response.data.status === 'success') {
        setDeviceMetrics(prev => ({
          ...prev,
          [deviceId]: response.data.data
        }));
      }
    } catch (error) {
      console.error(`Error fetching metrics for ${deviceId}:`, error);
    }
  };

  const fetchDeviceServices = async (deviceId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/physical-devices/${deviceId}/client-devices`);
      if (response.data.status === 'success') {
        setDeviceServices(prev => ({
          ...prev,
          [deviceId]: response.data.devices
        }));
      }
    } catch (error) {
      console.error(`Error fetching services for ${deviceId}:`, error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPhysicalDevices();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchPhysicalDevices();
      
      // Refresh metrics for expanded devices
      Object.keys(expandedDevices).forEach(deviceId => {
        if (expandedDevices[deviceId]) {
          fetchDeviceMetrics(deviceId);
        }
      });
    }, 10000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedDevices]);

  const toggleDevice = async (deviceId) => {
    const isExpanding = !expandedDevices[deviceId];
    
    setExpandedDevices(prev => ({
      ...prev,
      [deviceId]: isExpanding
    }));

    if (isExpanding) {
      // Fetch metrics and services when expanding
      await fetchDeviceMetrics(deviceId);
      await fetchDeviceServices(deviceId);
    }
  };

  const handleRestartPi = async (deviceId) => {
    if (!window.confirm(`⚠️ WARNING: This will RESTART the entire Raspberry Pi (${deviceId}).\n\nAll services will be stopped and the device will reboot.\n\nAre you sure?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/physical-devices/${deviceId}/restart-pi`,
        { confirm: true }
      );
      
      if (response.data.status === 'success') {
        alert('✓ Raspberry Pi restart initiated. Device will reconnect in ~60 seconds.');
      } else {
        alert(`✗ Failed to restart Pi: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error restarting Pi:', error);
      alert('✗ Error restarting Pi. Check console for details.');
    }
    setLoading(false);
  };

  const handleServiceAction = async (deviceId, serviceName, action) => {
    const actionText = action === 'restart' ? 'Restart' : action === 'stop' ? 'Stop' : 'Start';
    
    if (!window.confirm(`${actionText} service "${serviceName}" on ${deviceId}?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/physical-devices/${deviceId}/service/${action}`,
        { service_name: serviceName }
      );
      
      if (response.data.status === 'success') {
        alert(`✓ ${actionText} successful: ${response.data.message}`);
        // Refresh services list
        await fetchDeviceServices(deviceId);
      } else {
        alert(`✗ ${actionText} failed: ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error ${action} service:`, error);
      alert(`✗ Error ${action} service. Check console for details.`);
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
      <h1 className={styles.title}>Physical Devices Monitor (BETA)</h1>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          className={styles.theme__button}
          onClick={fetchPhysicalDevices}
          disabled={loading}
          style={{ fontSize: '16px', padding: '10px 30px' }}
        >
          🔄 Refresh Devices
        </button>
        <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
          Auto-refreshing every 10 seconds
        </div>
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
        Object.entries(physicalDevices).map(([deviceId, deviceInfo]) => {
          const isExpanded = expandedDevices[deviceId];
          const metrics = deviceMetrics[deviceId];
          const services = deviceServices[deviceId] || [];

          return (
            <div 
              key={deviceId} 
              className={styles.scenariosbox}
              style={{ 
                flexDirection: 'column',
                padding: '20px',
                marginBottom: '15px'
              }}
            >
              {/* Device Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                width: '100%'
              }}>
                <div style={{ flex: 1 }}>
                  <div className={styles.name_scenario} style={{ fontSize: '20px' }}>
                    🖥️ {deviceId}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    User: <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {deviceInfo.username || 'unknown'}
                    </span>
                  </div>
                  {deviceInfo.version && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '3px' }}>
                      Version: {deviceInfo.version}
                    </div>
                  )}
                </div>

                <div className={styles.buttongroupe} style={{ gap: '10px' }}>
                  <button 
                    className={styles.theme__button}
                    onClick={() => toggleDevice(deviceId)}
                    style={{ fontSize: '16px', padding: '10px 25px' }}
                  >
                    {isExpanded ? '▲ Collapse' : '▼ Expand'}
                  </button>
                  <button 
                    className={styles.delete}
                    onClick={() => handleRestartPi(deviceId)}
                    disabled={loading}
                    style={{ fontSize: '16px', padding: '10px 25px', backgroundColor: '#ff5722' }}
                  >
                    🔄 Restart Pi
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ 
                  marginTop: '20px', 
                  paddingTop: '20px', 
                  borderTop: '2px solid #e0e0e0' 
                }}>
                  {/* System Metrics */}
                  {metrics ? (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
                        📊 System Metrics
                      </h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '15px'
                      }}>
                        <div style={{ 
                          padding: '15px', 
                          background: '#f5f5f5', 
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getMetricColor(metrics.cpu_percent)}`
                        }}>
                          <div style={{ fontSize: '14px', color: '#666' }}>CPU Usage</div>
                          <div style={{ 
                            fontSize: '24px', 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.cpu_percent) 
                          }}>
                            {metrics.cpu_percent.toFixed(1)}%
                          </div>
                        </div>

                        <div style={{ 
                          padding: '15px', 
                          background: '#f5f5f5', 
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getMetricColor(metrics.temperature, { warning: 65, danger: 75 })}`
                        }}>
                          <div style={{ fontSize: '14px', color: '#666' }}>Temperature</div>
                          <div style={{ 
                            fontSize: '24px', 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.temperature, { warning: 65, danger: 75 }) 
                          }}>
                            {metrics.temperature.toFixed(1)}°C
                          </div>
                        </div>

                        <div style={{ 
                          padding: '15px', 
                          background: '#f5f5f5', 
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getMetricColor(metrics.memory_percent)}`
                        }}>
                          <div style={{ fontSize: '14px', color: '#666' }}>Memory</div>
                          <div style={{ 
                            fontSize: '24px', 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.memory_percent) 
                          }}>
                            {metrics.memory_percent.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                            {formatBytes(metrics.memory_used)} / {formatBytes(metrics.memory_total)}
                          </div>
                        </div>

                        <div style={{ 
                          padding: '15px', 
                          background: '#f5f5f5', 
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getMetricColor(metrics.disk_usage)}`
                        }}>
                          <div style={{ fontSize: '14px', color: '#666' }}>Disk Usage</div>
                          <div style={{ 
                            fontSize: '24px', 
                            fontWeight: 'bold', 
                            color: getMetricColor(metrics.disk_usage) 
                          }}>
                            {metrics.disk_usage.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                            {formatBytes(metrics.disk_used)} / {formatBytes(metrics.disk_total)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                      Loading metrics...
                    </div>
                  )}

                  {/* Client Services */}
                  <div>
                    <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
                      🔌 Client Services ({services.length})
                    </h3>
                    
                    {services.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '30px', 
                        background: '#f9f9f9',
                        borderRadius: '8px',
                        color: '#999'
                      }}>
                        No client device services found
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {services.map((service, idx) => (
                          <div 
                            key={idx}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '15px',
                              background: '#ffffff',
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontSize: '16px', 
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                color: '#333'
                              }}>
                                {service.device_name}
                              </div>
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#666', 
                                marginTop: '3px',
                                fontFamily: 'monospace'
                              }}>
                                {service.service_name}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className={styles.theme__button}
                                onClick={() => handleServiceAction(deviceId, service.service_name, 'start')}
                                disabled={loading}
                                style={{ 
                                  fontSize: '14px', 
                                  padding: '8px 20px',
                                  backgroundColor: '#4caf50'
                                }}
                              >
                                ▶️ Start
                              </button>
                              <button
                                className={styles.theme__button}
                                onClick={() => handleServiceAction(deviceId, service.service_name, 'stop')}
                                disabled={loading}
                                style={{ 
                                  fontSize: '14px', 
                                  padding: '8px 20px',
                                  backgroundColor: '#f44336'
                                }}
                              >
                                ⏹️ Stop
                              </button>
                              <button
                                className={styles.theme__button}
                                onClick={() => handleServiceAction(deviceId, service.service_name, 'restart')}
                                disabled={loading}
                                style={{ 
                                  fontSize: '14px', 
                                  padding: '8px 20px',
                                  backgroundColor: '#ff9800'
                                }}
                              >
                                🔄 Restart
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default DevicesBeta;
