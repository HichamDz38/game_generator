import React from 'react';
import styles from './MyComponent.module.css';

function Navbarr({ onReturnScenarioSelect, isFlowRunning }) {
  const handleReturnScenarioClick = (e) => {
    if (isFlowRunning) {
      e.preventDefault();
      return;
    }
    
    if (onReturnScenarioSelect) {
      onReturnScenarioSelect();
    }
  };

  return (
    <>
      <nav className={styles.navbar}>
        <p className={styles.left}>ERPanel</p>
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
          <a href="/props">PROPS</a>
          <a href="/sound">SOUND</a>
          <a href="/settings">SETTINGS</a>
          <a href="/exit">EXIT</a>
        </ul>
      </nav>
    </>
  );
}

export default Navbarr;