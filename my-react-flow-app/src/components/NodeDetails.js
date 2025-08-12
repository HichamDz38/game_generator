import React, { useRef } from 'react';
import styles from './MyComponent.module.css';
import axios from 'axios';

function NodeDetails({ nodeData, onClose }) {
  const containerRef = useRef(null);
  
  if (!nodeData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!containerRef.current) {
      console.error('Container ref not ready');
      return;
    }
    
    const formElements = containerRef.current.querySelectorAll('input, select');
    const config = {};

    formElements.forEach(element => {
      config[element.name] = element.value;
    });

    try {
      const response = await axios.post('/node_configiration', {
        nodeId: nodeData.id,
        config: config
      });
      
      console.log('Configuration saved:', response.data);
      onClose();
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  return (
    <div className={styles.nodeDetailsContainer} ref={containerRef}>
        <div className={styles.nodeDetailsHeader}>
            <h4>Node informations</h4>
            <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.nodeDetailsContent}>
            <p><strong>Name:</strong> {nodeData.data?.label}</p>
            <p><strong>Type:</strong> {nodeData.type}</p>
            <div>
                <div className={styles.nodeDetailsHeader2}>
                    <h4>Node configiration</h4>
                </div>
                {nodeData.data?.config?.map((item, index) => (
                    <div key={index} >
                    {/* <p><strong>Name {i++} : </strong>{item.name}, Type: {item.type}</p>
                    {item.options && (
                    <p><strong>Options: </strong>{item.options.join(', ')}</p>
                    )} */}
                        <label>
                            <strong style={{color:'black'}}>{item.name }</strong> : {""}
                                {item.type === "select" ? (
                                <select name={item.name}>
                                    {item.options?.length > 0 ? (
                                      item.options.map((option, i) => (
                                        <option key={i} value={option}>
                                            {option}
                                        </option>
                                    ))
                                ) : (
                                    <option disabled>(No options)</option>
                                )}
                                </select>
                            ) : (
                            <input name={item.name} type={item.type}/>
                            )}
                        </label>
                    </div>
                ))}
                <button className={styles.theme__button} onClick={handleSubmit}>
                    Submit
                </button>
            </div>
        {/* <p><strong>Position:</strong> X: {nodeData.position?.x}, Y: {nodeData.position?.y}</p> */}
        </div>
    </div>
);
}
export default NodeDetails;
