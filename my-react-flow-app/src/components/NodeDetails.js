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
        <p><strong>ID:</strong> {nodeData.id}</p>
        <p><strong>Type:</strong> {nodeData.type}</p>
        <p><strong>Label:</strong> {nodeData.data?.label}</p>
        {nodeData.data?.deviceType && (
          <p><strong>Device Type:</strong> {nodeData.data.deviceType}</p>
        )}
        <p><strong>Position:</strong> X: {nodeData.position?.x}, Y: {nodeData.position?.y}</p>
      </div>
    </div>
  );
}

export default NodeDetails;