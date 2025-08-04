import React from 'react';
import styles from './MyComponent.module.css';
function Navbarr() {
  return (
    <>
      <nav className={styles.navbar}>
        <p className={styles.left}>ERPanel</p>
        <ul className={styles.links}>
          <a href="#home">PROPS</a>
          <a href="#features">SOUND</a>
          <a href="#pricing">SETTINGS</a>
          <a href="#pricing">EXIT</a>
        </ul>
      </nav>
    </>
  );
}

export default Navbarr;