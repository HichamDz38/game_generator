// import React, { useState, useEffect, useRef } from 'react';
// import ReactDOM from 'react-dom';
// import styles from './MyComponent.module.css';
// import './style.css';

// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// function Sidebar({ nodeData, onLoadScenario, onNodeClick, existingNodes = [] }) {
//   const [devices, setDevices] = useState({});
//   const [dialogState, setDialogState] = useState({
//     visible: false,
//     x: 0,
//     y: 0,
//     deviceId: null,
//     configData: null,
//   });
//   const idCounter = useRef(0);

//   useEffect(() => {
//     if (existingNodes.length > 0) {
//       const maxId = existingNodes.reduce((max, node) => {
//         const match = node.id.match(/^N?(\d+)$/);
//         if (match) {
//           const nodeNum = parseInt(match[1], 10);
//           return Math.max(max, nodeNum);
//         }
//         return max;
//       }, 0);

//       idCounter.current = Math.max(idCounter.current, maxId);
//     }
//   }, [existingNodes]);

//   const isIdUnique = (id) => {
//     return !existingNodes.some(node =>
//       node.id === id.toString() ||
//       node.id === `N${id}` ||
//       node.data?.uniqueId === id
//     );
//   };

//   const generateUniqueId = () => {
//     let newId;
//     do {
//       idCounter.current++;
//       newId = idCounter.current;
//     } while (!isIdUnique(newId));

//     return newId;
//   };

//   const onDragStart = (event, nodeType, label, config, deviceData, uniqueId, deviceId) => {
//     event.dataTransfer.setData('application/reactflow', nodeType);
//     event.dataTransfer.setData('application/label', label);
//     event.dataTransfer.setData('application/config', JSON.stringify(config));
//     event.dataTransfer.setData('application/uniqueId', uniqueId);
//     event.dataTransfer.setData('application/deviceId', deviceId || '');
    
//     if (deviceData) {
//       event.dataTransfer.setData('application/deviceData', JSON.stringify(deviceData));
//     }
//     event.dataTransfer.effectAllowed = 'move';
//   };

//   const fetchDevices = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/get_devices`);
//       if (response.ok) {
//         const devicesData = await response.text();
//         try {
//           const parsedDevices = JSON.parse(devicesData.replace(/'/g, '"'));

//           const processedDevices = {};
//           Object.keys(parsedDevices).forEach(deviceId => {
//             const device = parsedDevices[deviceId];
//             if (device.config) {
//               const processedConfig = {};
//               Object.keys(device.config).forEach(fieldName => {
//                 const fieldConfig = device.config[fieldName];
//                 processedConfig[fieldName] = {
//                   ...fieldConfig,
//                   required: fieldConfig.required !== undefined ? fieldConfig.required : false
//                 };
//               });
//               processedDevices[deviceId] = {
//                 ...device,
//                 config: processedConfig
//               };
//             } else {
//               processedDevices[deviceId] = device;
//             }
//           });

//           setDevices(processedDevices);
//         } catch (parseError) {
//           console.error('Error parsing devices data:', parseError);
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching devices:', error);
//     }
//   };

//   useEffect(() => {
//     fetchDevices();
//   }, []);

//   // --- handle device click to show dialog ---
//  const handleDeviceClick = (event, deviceId, deviceConfig) => {
//   setDialogState({
//     visible: true,
//     x: event.clientX, // viewport X
//     y: event.clientY, // viewport Y
//     deviceId,
//     configData: deviceConfig,
//   });
// };


//   return (
//     <aside className="sidebar">
//       <div className={styles.sidenav}>
//         <h3 className={styles.titledev}>Connected Devices</h3>
//         <div className={styles.titledev2}>Drag devices to create Scenario</div>
//         <br /><br />

//         {Object.keys(devices).length > 0 ? (
//           Object.entries(devices).map(([deviceId, deviceData]) => {
//             const uniqueId = generateUniqueId();

//             return (
//               <div
//                 key={`device-${deviceId}-${uniqueId}`}
//                 className="dndnode device"
//                 draggable
//                 onDragStart={(event) =>
//                   onDragStart(
//                     event,
//                     'device',
//                     `${deviceData.device_name}-${uniqueId}`,
//                     deviceData.config,
//                     deviceData,
//                     uniqueId,
//                     deviceId
//                   )
//                 }
//                 onClick={(event) =>
//                   handleDeviceClick(event, deviceId, deviceData.config)
//                 }
//               >
//                 {deviceData.device_name}
//               </div>
//             );
//           })
//         ) : (
//           <div className="no-devices">No devices connected</div>
//         )}

//         <br /><br />
//         <p className={styles.titledev2}>Virtual Nodes</p>

//         {/* Timer node */}
//         <div
//           className="dndnode device"
//           onDragStart={(event) => {
//             const uniqueId = generateUniqueId();
//             onDragStart(
//               event,
//               'delay',
//               `Timer-${uniqueId}`,
//               { delaySeconds: { type: 'number', value: 3, required: true } },
//               { deviceType: 'delay' },
//               uniqueId,
//               null
//             );
//           }}
//           draggable
//         >
//           Timer
//         </div>

//         {/* Condition node */}
//         <div
//           className="dndnode device"
//           onDragStart={(event) => {
//             const uniqueId = generateUniqueId();
//             onDragStart(
//               event,
//               'condition',
//               `Condition-${uniqueId}`,
//               { logicType: { type: 'select', options: ['AND', 'OR'], value: 'AND', required: true, label: 'Logic Type' } },
//               { deviceType: 'condition' },
//               uniqueId,
//               null
//             );
//           }}
//           draggable
//         >
//           Condition
//         </div>

//         {/* --- DYNAMIC CONFIG DIALOG USING PORTAL --- */}
//         {dialogState.visible &&
//           ReactDOM.createPortal(
//             <div
//               style={{
//         position: 'absolute',
//         left: dialogState.x + 10,
//         top: dialogState.y + 10,
//         background: '#333',
//         color: 'white',
//         border: '1px solid #555',
//         padding: '10px',
//         zIndex: 1000,
//         minWidth: '200px',
//         maxWidth: '300px',
//       }}
//             >
//               {dialogState.configData &&
//                 Object.entries(dialogState.configData).map(([key, conf]) => (
//                   <div key={key} style={{ marginBottom: '5px' }}>
//                     <label>{key}:</label>
//                     {conf.type === 'select' && (
//                       <select defaultValue={conf.value || ''}>
//                         {conf.options.map((opt) => (
//                           <option key={opt} value={opt}>{opt}</option>
//                         ))}
//                       </select>
//                     )}
//                     {conf.type === 'text' && (
//                       <input type="text" defaultValue={conf.value || ''} />
//                     )}
//                     {conf.type === 'checkbox' && (
//                       <input type="checkbox" defaultChecked={conf.value || false} />
//                     )}
//                     {conf.type === 'number' && (
//                       <input type="number" defaultValue={conf.value || 0} />
//                     )}
//                   </div>
//                 ))}
//               <button
//                 onClick={() => setDialogState({ ...dialogState, visible: false })}
//                 style={{ marginTop: '5px' }}
//               >
//                 Close
//               </button>
//             </div>,
//             document.body
//           )}
//       </div>
//     </aside>
//   );
// }

// export default Sidebar;


import React, { useState, useEffect, useRef } from 'react';
import styles from './MyComponent.module.css';
import './style.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function Sidebar({nodeData, onLoadScenario, onNodeClick, existingNodes = []}) {
  const [devices, setDevices] = useState({});
  const idCounter = useRef(0);

  useEffect(() => {
    if (existingNodes.length > 0) {
      const maxId = existingNodes.reduce((max, node) => {
        const match = node.id.match(/^N?(\d+)$/);
        if (match) {
          const nodeNum = parseInt(match[1], 10);
          return Math.max(max, nodeNum);
        }
        return max;
      }, 0);
      
      idCounter.current = Math.max(idCounter.current, maxId);
    }
  }, [existingNodes]);

  const isIdUnique = (id) => {
    return !existingNodes.some(node => 
      node.id === id.toString() || 
      node.id === `N${id}` || 
      node.data?.uniqueId === id
    );
  };

  const generateUniqueId = () => {
    let newId;
    do {
      idCounter.current++;
      newId = idCounter.current;
    } while (!isIdUnique(newId));
    
    return newId;
  };

  const onDragStart = (event, nodeType, label, config, deviceData, uniqueId, deviceId) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
    event.dataTransfer.setData('application/config', JSON.stringify(config));
    event.dataTransfer.setData('application/uniqueId', uniqueId);
    event.dataTransfer.setData('application/deviceId', deviceId || ''); 
    
    if (deviceData) {
      event.dataTransfer.setData('application/deviceData', JSON.stringify(deviceData));
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/get_devices`);
      if (response.ok) {
        const devicesData = await response.text();
        try {
          const parsedDevices = JSON.parse(devicesData.replace(/'/g, '"'));
          
          const processedDevices = {};
          Object.keys(parsedDevices).forEach(deviceId => {
            const device = parsedDevices[deviceId];
            if (device.config) {
              const processedConfig = {};
              Object.keys(device.config).forEach(fieldName => {
                const fieldConfig = device.config[fieldName];
                processedConfig[fieldName] = {
                  ...fieldConfig,
                  required: fieldConfig.required !== undefined ? fieldConfig.required : false
                };
              });
              processedDevices[deviceId] = {
                ...device,
                config: processedConfig
              };
            } else {
              processedDevices[deviceId] = device;
            }
          });
          
          setDevices(processedDevices);
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
            const uniqueId = generateUniqueId();
            
            return (
              <div
                key={`device-${deviceId}-${uniqueId}`}
                className="dndnode device"
                onDragStart={(event) => onDragStart(
                  event, 
                  'device', 
                  `${deviceData.device_name}`, 
                  // `${deviceData.device_name}-${deviceId}/${uniqueId}`, 
                  deviceData.config, 
                  deviceData,
                  uniqueId, 
                  deviceId 
                )}
                draggable
              >
                {/* {deviceData.device_name} - {deviceId} */}
                {deviceData.device_name}
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
          onDragStart={(event) => {
            const uniqueId = generateUniqueId();
            onDragStart(
              event,
              'delay',  
              `Timer-${uniqueId}`,
              {
                "delaySeconds": {
                  'type': 'number',
                  'value': 3,
                  'required': true  
                }
              },
              { deviceType: 'delay' }, 
              uniqueId,
              null
            );
          }}
          draggable
        >
          Timer
        </div>
        <div
  className="dndnode device"
  onDragStart={(event) => {
    const uniqueId = generateUniqueId();
    onDragStart(
      event,
      'condition',
      `Condition-${uniqueId}`,
      {
        "logicType": {
          'type': 'select',
          'options': ['AND', 'OR'],
          'value': 'AND', 
          'required': true,
          'label': 'Logic Type'
        }
      },
      { deviceType: 'condition' }, 
      uniqueId,
      null
    );
    }}
        draggable
      > 
        Condition
      </div>
      </div>
    </aside>
  );
}

export default Sidebar;