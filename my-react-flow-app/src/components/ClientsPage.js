import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './MyComponent.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ClientsPage = () => {
  const [devices, setDevices] = useState({});
  const [serverStatus, setServerStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/get_devices`);
      if (response.data) {
        setDevices(response.data);
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
    // Fetch on page load
    fetchDevices();
    fetchServerStatus();

    // Auto-refresh every 20 seconds for clients data
    // Faster than devices (20s vs 30s) since client states change more frequently
    const interval = setInterval(() => {
      fetchDevices();
      fetchServerStatus();
    }, 20000);

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshData = () => {
    fetchDevices();
    fetchServerStatus();
  };

  const handleStartServer = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/tcp_server/start`);
      refreshData();
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
      refreshData();
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
      // Refresh devices after disconnect
      setTimeout(refreshData, 1000);
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
      // Refresh devices after disconnect all
      setTimeout(refreshData, 1000);
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
    <div className={styles.Scenariopp}>
      <h1 className={styles.title}>Clients Management</h1>

      {/* Server Control Section */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '20px',
          padding: '15px 30px',
          background: '#f5f5f5',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Server Status:</span>
          <span style={{ 
            color: getStatusColor(),
            fontWeight: 'bold',
            fontSize: '18px',
            textTransform: 'uppercase'
          }}>
            {serverStatus}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          {serverStatus === 'running' ? (
            <button 
              className={`${styles.theme__button} ${styles.stopButton}`}
              onClick={handleStopServer}
              disabled={loading}
              style={{ fontSize: '20px', padding: '15px 40px' }}
            >
              STOP SERVER
            </button>
          ) : (
            <button 
              className={styles.theme__button}
              onClick={handleStartServer}
              disabled={loading}
              style={{ fontSize: '20px', padding: '15px 40px' }}
            >
              START SERVER
            </button>
          )}
          
          <button 
            className={styles.theme__button}
            onClick={handleDisconnectAll}
            disabled={loading || Object.keys(devices).length === 0}
            style={{ fontSize: '20px', padding: '15px 40px' }}
          >
            DISCONNECT ALL ({Object.keys(devices).length})
          </button>
        </div>
      </div>

      {/* Devices List */}
      <h2 className={styles.secondtitle}>Connected Devices</h2>

      {Object.keys(devices).length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px', 
          color: '#666',
          fontSize: '20px',
          fontStyle: 'italic'
        }}>
          No devices connected
        </div>
      ) : (
        Object.entries(devices)
          .sort(([_, dataA], [__, dataB]) => {
            // Sort by device_name (e.g., "EPAPER:9.7_2", "scoreboard_1", etc.)
            const nameA = (dataA.device_name || '').toLowerCase();
            const nameB = (dataB.device_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          })
          .map(([deviceId, deviceInfo]) => (
          <div key={deviceId} className={styles.scenariosbox}>
            <div style={{ flex: 1 }}>
              <div className={styles.name_scenario}>
                {deviceInfo.device_name || deviceId}
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px', fontFamily: 'monospace' }}>
                ID: {deviceId}
              </div>
              {deviceInfo.node_type && (
                <div style={{ fontSize: '14px', color: '#555', marginTop: '5px' }}>
                  Type: {deviceInfo.node_type}
                </div>
              )}
              {deviceInfo.num_nodes && deviceInfo.num_nodes > 1 && (
                <div style={{ fontSize: '14px', color: '#555' }}>
                  Nodes: {deviceInfo.num_nodes}
                </div>
              )}
            </div>
            <div className={styles.buttongroupe}>
              <button 
                className={styles.delete}
                onClick={() => handleDisconnectDevice(deviceId)}
                disabled={loading}
              >
                disconnect
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ClientsPage;
