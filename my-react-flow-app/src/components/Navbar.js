import React from 'react';
import styles from './MyComponent.module.css';

function Navbar({ onReturnScenarioSelect }) {
  const handleReturnScenarioClick = () => {
    if (onReturnScenarioSelect) {
      onReturnScenarioSelect();
    }
  };

  return (
    <nav className={styles.navbar}>
      <p className={styles.left}>ERPanel</p>
      <ul className={styles.links}>
        <li>
          <button 
            className={styles.navButton} 
            onClick={handleReturnScenarioClick}
          >
            SCENARIOS
          </button>
        </li>
        <li>
          <button className={styles.navButton}>PROPS</button>
        </li>
        <li>
          <button className={styles.navButton}>SOUND</button>
        </li>
        <li>
          <button className={styles.navButton}>SETTINGS</button>
        </li>
        <li>
          <button className={styles.navButton}>EXIT</button>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;