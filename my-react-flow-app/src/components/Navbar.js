import React from 'react';
import styles from './MyComponent.module.css';

function Navbarr({ onReturnScenarioSelect, onNavigateToDevices, onNavigateToDevicesBeta, isFlowRunning }) {
  const handleReturnScenarioClick = (e) => {
    if (isFlowRunning) {
      e.preventDefault();
      return;
    }
    
    if (onReturnScenarioSelect) {
      onReturnScenarioSelect();
    }
  };

  const handleDevicesClick = (e) => {
    e.preventDefault();
    if (isFlowRunning) {
      return;
    }
    
    if (onNavigateToDevices) {
      onNavigateToDevices();
    }
  };

  const handleDevicesBetaClick = (e) => {
    e.preventDefault();
    if (isFlowRunning) {
      return;
    }
    
    if (onNavigateToDevicesBeta) {
      onNavigateToDevicesBeta();
    }
  };

  return (
    <>
      <nav className={styles.navbar}>
        <p className={styles.left}>Raven Cube Project</p>
        <ul className={styles.links}>
          <a 
            href="/home" 
            onClick={handleReturnScenarioClick}
            className={isFlowRunning ? styles.disabled : ''}
            style={{
              cursor: isFlowRunning ? 'not-allowed' : 'pointer',
              opacity: isFlowRunning ? 0.5 : 1,
              pointerEvents: isFlowRunning ? 'none' : 'auto'
            }}
            title={isFlowRunning ? "Cannot navigate while flow is running" : "Return to scenarios"}
          >
            SCENARIOS
            {isFlowRunning && " (Disabled during execution)"}
          </a>
          <a 
            href="/devices"
            onClick={handleDevicesClick}
            className={isFlowRunning ? styles.disabled : ''}
            style={{
              cursor: isFlowRunning ? 'not-allowed' : 'pointer',
              opacity: isFlowRunning ? 0.5 : 1,
              pointerEvents: isFlowRunning ? 'none' : 'auto'
            }}
            title={isFlowRunning ? "Cannot navigate while flow is running" : "Manage devices"}
          >
            DEVICES
            {isFlowRunning && " (Disabled during execution)"}
          </a>
          <a 
            href="/devices-beta"
            onClick={handleDevicesBetaClick}
            className={isFlowRunning ? styles.disabled : ''}
            style={{
              cursor: isFlowRunning ? 'not-allowed' : 'pointer',
              opacity: isFlowRunning ? 0.5 : 1,
              pointerEvents: isFlowRunning ? 'none' : 'auto',
            }}
            title={isFlowRunning ? "Cannot navigate while flow is running" : "Physical devices monitor (Beta)"}
          >
            DEVICES BETA 🔥
            {isFlowRunning && " (Disabled)"}
          </a>
          <a href="/settings">SETTINGS</a>
        </ul>
      </nav>
    </>
  );
}

export default Navbarr;