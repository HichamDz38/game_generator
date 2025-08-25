import React, { useState, useEffect } from 'react';
import styles from './MyComponent.module.css';
import './style.css'
import DelayNode from '../components/DelayNode';

function Sidebar({ onLoadScenario , onNodeClick}) {
  const [devices, setDevices] = useState({});

  const onDragStart = (event, nodeType, label, config) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
    event.dataTransfer.setData('application/config', JSON.stringify(config));
    event.dataTransfer.effectAllowed = 'move';
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch('/get_devices');
      if (response.ok) {
        const devicesData = await response.text();
        try {
          const parsedDevices = JSON.parse(devicesData.replace(/'/g, '"'));
          setDevices(parsedDevices);
        } catch (parseError) {
          console.error('Error parsing devices data:', parseError);
        }
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);


  return (
    <aside className="sidebar">
      <div className={styles.sidenav}>
        <h3 className={styles.titledev}>Connected Devices</h3>
        <div className={styles.titledev2}>Drag devices to create Scenario</div>
        <br></br><br></br>
        {Object.keys(devices).length > 0 ? (
          Object.entries(devices).map(([deviceId, deviceData]) => (
            <div
              key={deviceId}
              className="dndnode device"
              onDragStart={(event) => onDragStart(event, 'device', `${deviceData.device_name}-${deviceId}`, deviceData.config)}
              draggable
            >
              {deviceData.device_name} - {deviceId}
            </div>
          ))
        ) : (
          <div className="no-devices">No devices connected</div>
          
        )}
        <br></br><br></br>
        <p className={styles.titledev2}>virtual nodes</p>
          <div
              className="dndnode device"
              onDragStart={(event) => onDragStart(event, 'default', 'Delay Node')} 
              draggable
            >
              Delay node
            </div>
        <div>
        
      </div>

      </div>

      

    </aside>
  );
}

export default Sidebar;