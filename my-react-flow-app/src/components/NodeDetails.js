import React from 'react';
import styles from './MyComponent.module.css';

function NodeDetails({ nodeData, onClose }) {
  if (!nodeData) return null;

  return (
    <div className={styles.nodeDetailsContainer}>
      <div className={styles.nodeDetailsHeader}>
        <h3>Node Configiration</h3>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>
      <div className={styles.nodeDetailsContent}>
        <p><strong>Name:</strong> {nodeData.data?.label}</p>
        <p><strong>Type:</strong> {nodeData.type}</p>
{/*         
        {nodeData.data?.devicesdata && (
          <p><strong>Device Type:</strong> {nodeData.data.devicesdata.name}</p>
        )} */}
        <p><strong>Position:</strong> X: {nodeData.position?.x}, Y: {nodeData.position?.y}</p>
      </div>
    </div>
  );
}

export default NodeDetails;