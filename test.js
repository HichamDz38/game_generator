
import React, { useState, useEffect } from 'react';

const NodeDetails = ({ nodeData, onClose, onUpdate }) => {
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [otherConfigs, setOtherConfigs] = useState({});

  useEffect(() => {
    if (nodeData?.data?.config) {
      if (nodeData.data.deviceType === 'delay') {
        setDelaySeconds(nodeData.data.config.delaySeconds || 0);
      } else {
        setOtherConfigs(nodeData.data.config);
      }
    }
  }, [nodeData]);

  const handleSave = () => {
    let updatedConfig;
    
    if (nodeData.data.deviceType === 'delay') {
      updatedConfig = {
        ...nodeData.data.config,
        delaySeconds: delaySeconds
      };
    } else {
      updatedConfig = otherConfigs;
    }

    onUpdate(nodeData.id, {
      ...nodeData.data,
      config: updatedConfig,
      ...(nodeData.data.deviceType === 'delay' && { delaySeconds: delaySeconds })
    });
    
    onClose();
  };

  const handleOtherConfigChange = (key, value) => {
    setOtherConfigs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!nodeData) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      border: '1px solid #ccc',
      padding: '20px',
      zIndex: 1000,
      minWidth: '300px'
    }}>
      <h3>Node Details</h3>
      <p>Node ID: {nodeData.id}</p>
      <p>Type: {nodeData.data.deviceType || nodeData.type}</p>
      
      {/* Delay Node Configuration */}
      {nodeData.data.deviceType === 'delay' && (
        <div>
          <h4>Delay Configuration</h4>
          <div>
            <label>Delay (seconds):</label>
            <input
              type="number"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
        </div>
      )}
      
      {/* Other Device Configurations */}
      {nodeData.data.deviceType !== 'delay' && nodeData.data.config && (
        <div>
          <h4>Device Configuration</h4>
          {Object.entries(nodeData.data.config).map(([key, configItem]) => (
            <div key={key} style={{ marginBottom: '10px' }}>
              <label>{key}:</label>
              {configItem.type === 'number' && (
                <input
                  type="number"
                  value={otherConfigs[key] || ''}
                  onChange={(e) => handleOtherConfigChange(key, parseInt(e.target.value) || 0)}
                />
              )}
              {configItem.type === 'text' && (
                <input
                  type="text"
                  value={otherConfigs[key] || ''}
                  onChange={(e) => handleOtherConfigChange(key, e.target.value)}
                />
              )}
              {configItem.type === 'select' && (
                <select
                  value={otherConfigs[key] || ''}
                  onChange={(e) => handleOtherConfigChange(key, e.target.value)}
                >
                  <option value="">Select...</option>
                  {configItem.options?.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={onClose} style={{ marginLeft: '10px' }}>Close</button>
      </div>
    </div>
  );
};

export default NodeDetails;