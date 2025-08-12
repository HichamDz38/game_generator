import React from 'react';
import styles from './MyComponent.module.css';

function NodeDetails({ nodeData, onClose , OnDrop}) {
  if (!nodeData) return null;

  var i=1;

  return (
    <div className={styles.nodeDetailsContainer}>
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
                            {item.name}:
                                {item.type === "select" ? (
                                <select name={item.name}>
                                    {item.option?.map((option, i) => (
                                        <option key={i} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                            <input name={item.name} type={item.type}/>
                            )}
                        </label>
                    </div>
                ))}
            </div>
        {/* <p><strong>Position:</strong> X: {nodeData.position?.x}, Y: {nodeData.position?.y}</p> */}
        </div>
    </div>
  );
}

export default NodeDetails;