import React from 'react';
//import { Background } from 'reactflow';
import styles from './MyComponent.module.css';

//flex: 0 0 49%; gap: 5px;
function Sidenav() {
  return (
    <>
    <div className={styles.sidenav}>
        <h1 className={styles.title}>DASHBOARD SCENARIO</h1>
        <button>CREATE NEW SCENARIO</button>
        <h2 className={styles.secondtitle}>LISTE OF SCENARIOS :</h2>
        <div className={styles.scenariosbox}>
          <p className={styles.name_scenario}>DEVICE ONE</p>
          <div className={styles.buttonGroup}>
            <button>EDIT</button>
            <button>DELETE</button>
          </div>
        </div>
        <br></br>
        <div className={styles.scenariosbox}>
          <p className={styles.name_scenario}>DEVICE ONE</p>
          <div className={styles.buttonGroup}>
            <button>EDIT</button>
            <button>DELETE</button>
          </div>
        </div>
        <br></br>
        <div className={styles.scenariosbox}>
          <p className={styles.name_scenario}>DEVICE ONE</p>
          <div className={styles.buttonGroup}>
            <button>EDIT</button>
            <button>DELETE</button>
          </div>
        </div>
    </div>
    </>
  );
}

export default Sidenav;