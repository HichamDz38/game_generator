import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './MyComponent.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const DevicesPage = () => {
  const [devices, setDevices] = useState({});
  const [serverStatus, setServerStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/devices`);
      if (response.data && response.data.connected_devices) {
        setDevices(response.data.connected_devices);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchServerStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tcp_server/status`);
      setServerStatus(response.data.status);
    } catch (error) {
      console.error('Error fetching server status:', error);
      setServerStatus('error');
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchServerStatus();
    
    // Poll for updates every 2 seconds
    const interval = setInterval(() => {
      fetchDevices();
      fetchServerStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleStartServer = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/tcp_server/start`);
      await fetchServerStatus();
      alert('TCP Server started successfully');
    } catch (error) {
      console.error('Error starting server:', error);
      alert('Failed to start server');
    }
    setLoading(false);
  };

  const handleStopServer = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/tcp_server/stop`);
      await fetchServerStatus();
      alert('TCP Server stopped successfully');
    } catch (error) {
      console.error('Error stopping server:', error);
      alert('Failed to stop server');
    }
    setLoading(false);
  };

  const handleDisconnectDevice = async (deviceId) => {
    if (!window.confirm(`Are you sure you want to disconnect ${deviceId}?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/devices/disconnect/${deviceId}`);
      alert(`Device ${deviceId} disconnected`);
      // Wait a moment then refresh
      setTimeout(fetchDevices, 1000);
    } catch (error) {
      console.error('Error disconnecting device:', error);
      alert('Failed to disconnect device');
    }
    setLoading(false);
  };

  const handleDisconnectAll = async () => {
    const deviceCount = Object.keys(devices).length;
    if (deviceCount === 0) {
      alert('No devices connected');
      return;
    }

    if (!window.confirm(`Are you sure you want to disconnect all ${deviceCount} devices?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/devices/disconnect_all`);
      alert(`All devices disconnected`);
      // Wait a moment then refresh
      setTimeout(fetchDevices, 1000);
    } catch (error) {
      console.error('Error disconnecting all devices:', error);
      alert('Failed to disconnect all devices');
    }
    setLoading(false);
  };

  const getStatusColor = () => {
    switch (serverStatus) {
      case 'running':
        return '#4caf50';
      case 'stopped':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Device Management</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: '10px 20px',
            background: '#f5f5f5',
            borderRadius: '5px'
          }}>
            <span style={{ fontWeight: 'bold' }}>Server Status:</span>
            <span style={{ 
              color: getStatusColor(),
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {serverStatus}
            </span>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        padding: '20px',
        background: '#f9f9f9',
        borderRadius: '8px'
      }}>
        {serverStatus === 'running' ? (
          <button 
            className={`${styles.theme__button} ${styles.stopButton}`}
            onClick={handleStopServer}
            disabled={loading}
          >
            STOP SERVER
          </button>
        ) : (
          <button 
            className={styles.theme__button}
            onClick={handleStartServer}
            disabled={loading}
          >
            START SERVER
          </button>
        )}
        
        <button 
          className={styles.theme__button}
          onClick={handleDisconnectAll}
          disabled={loading || Object.keys(devices).length === 0}
        >
          DISCONNECT ALL ({Object.keys(devices).length})
        </button>
      </div>

      <div className={styles.devicesGrid}>
        {Object.keys(devices).length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            fontSize: '18px'
          }}>
            No devices connected
          </div>
        ) : (
          Object.entries(devices).map(([deviceId, deviceInfo]) => (
            <div key={deviceId} className={styles.deviceCard}>
              <div className={styles.deviceHeader}>
                <h3>{deviceInfo.device_name || deviceId}</h3>
                <span className={styles.deviceId}>{deviceId}</span>
              </div>
              
              <div className={styles.deviceInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Type:</span>
                  <span className={styles.value}>{deviceInfo.node_type || 'Unknown'}</span>
                </div>
                
                {deviceInfo.num_nodes && deviceInfo.num_nodes > 1 && (
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Nodes:</span>
                    <span className={styles.value}>{deviceInfo.num_nodes}</span>
                  </div>
                )}
                
                {deviceInfo.config && Object.keys(deviceInfo.config).length > 0 && (
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Configuration:</span>
                    <div className={styles.configList}>
                      {Object.entries(deviceInfo.config).map(([key, value]) => (
                        <div key={key} className={styles.configItem}>
                          <span className={styles.configKey}>{key}:</span>
                          <span className={styles.configValue}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                className={`${styles.theme__button} ${styles.disconnectButton}`}
                onClick={() => handleDisconnectDevice(deviceId)}
                disabled={loading}
              >
                DISCONNECT
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DevicesPage;
