import React, { useState,Fragment} from 'react';
//import { Background } from 'reactflow';
import styles from './MyComponent.module.css';

//flex: 0 0 49%; gap: 5px;
function Sidenav() {
  const [scenarios, setScenarios] = useState([]);


  fetch('/flow_scenarios')
    .then(response => response.json())
    .then(data => {
      setScenarios(data);
    })


  const handleEdit = (scenarioName) => {
    console.log('Edit scenario:', scenarioName);
  };

  const handleDelete = (scenarioName) => {
    console.log('Delete scenario:', scenarioName);
  };
  return (
    <>
    <div className={styles.sidenav}>
      <h1 className={styles.title}>DASHBOARD SCENARIO</h1>
      <button>CREATE NEW SCENARIO</button>
      <h2 className={styles.secondtitle}>LISTE OF SCENARIOS :</h2>
        {scenarios.length > 0 ? (
        scenarios.map((scenario, index) => (
          <Fragment key={index}>
            <div className={styles.scenariosbox}>
              <p className={styles.name_scenario}>{scenario}</p>
              <div className={styles.buttonGroup}>
                <button onClick={() => handleEdit(scenario)}>EDIT</button>
                <button onClick={() => handleDelete(scenario)}>DELETE</button>
              </div>
            </div>
            <br />
          </Fragment>
            ))
          ) : (
            <p>No scenarios available</p>
          )}
        </div>
    </>
  );
}

export default Sidenav;