import React, { useRef } from 'react';
import styles from './MyComponent.module.css';

function NodeDetails({ nodeData, onClose }) {
  const containerRef = useRef(null);
  
  if (!nodeData) return null;

  const handleSave = async (e) => {
    
    e.preventDefault();
    if (!containerRef.current) {
      console.error('Container ref not ready');
      return;
    }
    
    const formElements = containerRef.current.querySelectorAll('input, select');
    formElements.forEach(element => {
      nodeData.data.config[element.name].value = element.value;
    });

  };

  return (
    <div className={styles.nodeDetailsContainer} ref={containerRef}>
        <div className={styles.nodeDetailsContent}>
            <p><strong>Name:</strong> {nodeData.data?.label}</p>
            <p><strong>Type:</strong> {nodeData.type}</p>
            <div className={styles.nodeDetailsConfig}>
                
                {Object.keys(nodeData.data.config).map((item) => {
                  const value = nodeData.data.config[item];
                 // console.log(item, value.type)
                 return (
                    <div key={item} >
                        <label>
                            <strong style={{color:'black'}}>{item }</strong> : {""}
                                {value.type === "select" ? (
                                <select name={item}>
                                  <option ></option>
                                  
                                    {value.options.map((option, i) => (
                                        (value.value === option)?
                                        <option key={i} value={option} selected>
                                            {option}
                                        </option>:
                                        <option key={i} value={option} >
                                            {option}
                                        </option>
                                        
                                    ))}
                                </select>
                            ) : (
                            <input name={item} type={value.type} value={value.value}/>
                            )}
                        </label>
                    </div>
                 );
                })}
                <div className={styles.configButtons}>
                  <button className={styles.theme__button} onClick={handleSave}>
                      save
                  </button>
                  <button onClick={onClose} className={styles.theme__button}>
                    close
                  </button>
                </div>
            </div>
        </div>
    </div>
);
}
export default NodeDetails;
