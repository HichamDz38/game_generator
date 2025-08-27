import React, { useState, useEffect, useRef } from 'react';
import styles from './MyComponent.module.css';
import './style.css'

function Sidebar({nodeData, onLoadScenario  , onNodeClick}) {
  const [devices, setDevices] = useState({});
  const idCounter = useRef(0);

  const onDragStart = (event, nodeType, label, config, deviceData = null, uniqueId) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
    event.dataTransfer.setData('application/config', JSON.stringify(config));
    event.dataTransfer.setData('application/deviceId', uniqueId); 
    
    if (deviceData) {
      event.dataTransfer.setData('application/deviceData', JSON.stringify(deviceData));
    }
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
          Object.entries(devices).map(([deviceId, deviceData]) => {
            const uniqueId = idCounter.current;
            idCounter.current++;
            
            return (
              <div
                key={uniqueId}
                className="dndnode device"
                onDragStart={(event) => onDragStart(
                  event, 
                  'device', 
                  `${deviceData.device_name}-${deviceId}/${uniqueId}`, 
                  deviceData.config, 
                  deviceData,
                  uniqueId
                )}
                draggable
              >
                {deviceData.device_name} - {deviceId}
              </div>
            );
          })
        ) : (
          <div className="no-devices">No devices connected</div>
        )}
        <br></br><br></br>
        <p className={styles.titledev2}>virtual nodes</p>
        <div
          className="dndnode device"
          onDragStart={(event) => onDragStart(
            event,
            'virtual',
            `Timer-${idCounter.current++}`,
            {
              "speed":{
                    'type' : 'number'
                }
            },
            null, 
            idCounter.current
          )}
          draggable
        >
          Timer
        </div>
        <div
          className="dndnode device"
          onDragStart={(event) => onDragStart(
            event,
            'condition',
            `Condition-${idCounter.current++}`,
            {},
            null, 
            idCounter.current
          )}
          draggable
        >
          Condition
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;