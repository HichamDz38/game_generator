import React, { useState, useEffect } from 'react';
import styles from './MyComponent.module.css';
import './style.css'

function Sidebar({ onLoadScenario }) {
  const [devices, setDevices] = useState({});

  const onDragStart = (event, nodeType, label) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
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
     {/* <div className="section">
        <h3>Node Types</h3>
        <div className="description">You can drag these nodes to the pane on the right.</div>
        <div className="dndnode input" onDragStart={(event) => onDragStart(event, 'input', 'Input Node')} draggable>
          Input Node
        </div>
        <div className="dndnode" onDragStart={(event) => onDragStart(event, 'default', 'Default Node')} draggable>
          Default Node
        </div> 
        <div className="dndnode output" onDragStart={(event) => onDragStart(event, 'output', 'Output Node')} draggable>
          Output Node
        </div>
        <div className="dndnode output" onDragStart={(event) => onDragStart(event, 'group', 'Group Node')} draggable>
          Group Node
        </div>
      </div> */}
      <div className={styles.sidenav}>
        <h3 className={styles.titledev}>Connected Devices</h3>
        <div className={styles.titledev2}>Drag devices to create Scenario</div>
        <br></br><br></br>
        {Object.keys(devices).length > 0 ? (
          Object.entries(devices).map(([deviceId, deviceData]) => (
            <div
              key={deviceId}
              className="dndnode device"
              onDragStart={(event) => onDragStart(event, 'device', `Device: ${deviceId}`)}
              draggable
            >
              {deviceData.device_name} 
            </div>
          ))
        ) : (
          <div className="no-devices">No devices connected</div>
        )}
      </div>

    </aside>
  );
}

export default Sidebar;