import React, { useState, useEffect } from 'react';
import styles from './MyComponent.module.css';

function Sidenav() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchdata = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('http://localhost:5000/flow_scenarios');
        if (!response.ok) {
          throw new Error('response problem');
        }
        const data = await response.json();
        setScenarios(data);
      } catch (error) {
        console.error('Error in fetch', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchdata();
  }, []); 

  const handleEdit = (scenarioName) => {
    console.log('Edit scenario:', scenarioName);
  };

  const handleDelete = (scenarioName) => {
    console.log('Delete scenario:', scenarioName);
  };

  return (
    <div className={styles.sidenav}>
      <h1 className={styles.title}>DASHBOARD SCENARIO</h1>
      <button>CREATE NEW SCENARIO</button>
      <h2 className={styles.secondtitle}>LISTE OF SCENARIOS :</h2>
      
      {loading ? (
        <p>Loading scenarios...</p>
      ) : error ? (
        <p>Error loading scenarios: {error}</p>
      ) : scenarios.length > 0 ? (
        scenarios.map((scenario, index) => (
          <div key={index} className={styles.scenariosbox}>
            <p className={styles.name_scenario}>{scenario}</p>
            <div className={styles.buttonGroup}>
              <button onClick={() => handleEdit(scenario)}>EDIT</button>
              <button onClick={() => handleDelete(scenario)}>DELETE</button>
            </div>
            
          </div>
        ))
      ) : (
        <p>No scenarios available</p>
      )}
    </div>
  );
}

export default Sidenav;