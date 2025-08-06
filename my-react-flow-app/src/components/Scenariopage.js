import React, { useState, useEffect } from 'react';
import styles from './MyComponent.module.css';
import ThreeDotsButtonWithIcon from './ThreeDotsButtonWithIcon';

function Scenariopage({ onScenarioSelect, onCreateNew }) {  
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScenarios = async () => {
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

  useEffect(() => {
    fetchScenarios();
  }, []); 

  const handleScenarioClick = (scenarioName) => {
    if (onScenarioSelect) {
      onScenarioSelect(scenarioName);
    }
  };
  
  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
  };

  return (
    <div className={styles.Scenariopp}>
      <h1 className={styles.title}>DASHBOARD SCENARIO</h1>
      <ThreeDotsButtonWithIcon />
      <button 
        className={styles.create_button}
        onClick={handleCreateNew}
      >
        CREATE NEW SCENARIO
      </button>
      <h2 className={styles.secondtitle}>LIST OF SCENARIOS:</h2>
      
      {loading ? (
        <p>Loading scenarios...</p>
      ) : error ? (
        <p>Error loading scenarios: {error}</p>
      ) : scenarios.length > 0 ? (
        <div className={styles.scenariosContainer}>
          {scenarios.map((scenario, index) => (
            <div 
              key={index} 
              className={styles.scenariosbox}
              onClick={() => handleScenarioClick(scenario)}
              style={{ marginBottom: '10px', cursor: 'pointer' }}  
            >
              <p className={styles.name_scenario}>{scenario}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No scenarios available</p>
      )}
    </div>
  );
}

export default Scenariopage;