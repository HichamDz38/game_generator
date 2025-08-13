import React from 'react';
import styles from './MyComponent.module.css';

function Navbarr({ onReturnScenarioSelect }) {
  const handleReturnScenarioClick = () => {
    if (onReturnScenarioSelect) {
      onReturnScenarioSelect();
    }
  };

  return (
    <>
      <nav className={styles.navbar}>
        <p className={styles.left}>ERPanel</p>
        <ul className={styles.links}>
          <a href="#" onClick={handleReturnScenarioClick}>SCENARIOS</a>
          <a href="#">PROPS</a>
          <a href="#">SOUND</a>
          <a href="#">SETTINGS</a>
          <a href="#">EXIT</a>
        </ul>
      </nav>
    </>
  );
}

export default Navbarr;