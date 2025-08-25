import React, { useState, useEffect, useRef  } from 'react';
import styles from './MyComponent.module.css';
import axios from 'axios';

function Scenariopage({ onScenarioSelect, onCreateNew, scenarioName}) {  
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingScenario, setEditingScenario] = useState(null);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [copyingScenario, setCopyingScenario] = useState(null);
  const [copyName, setCopyName] = useState('');

  const myRef = useRef(null);

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

  useEffect(() => {
    if (myRef.current) {
      myRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scenarios]); 

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
  
  const onScenarioDeleted = () => {
  fetchScenarios();
};

  const handleDelete = async (scenarioName, e) => {
  e.stopPropagation(); 
  try {
    const response = await axios.delete(`http://localhost:5000/delete_scenario/${scenarioName}`);
    if (response.status === 200) {
      onScenarioDeleted(); 
    }
  } catch (error) {
    console.error('Error deleting ', error);
  }
};

const startRenaming = (scenarioName, e) => {
    e.stopPropagation();
    setEditingScenario(scenarioName);
    setNewScenarioName(scenarioName);
  };

  const handleRenameChange = (e) => {
    setNewScenarioName(e.target.value);
  };

  const handleRenameSubmit = async (oldName, e) => {
    e.stopPropagation();
    try {
      if (!newScenarioName) {
        alert("write a name");
        return;
      }

      if (newScenarioName === oldName) {
        alert("this name is already exist");
      }

      const response = await axios.put(
        `http://localhost:5000/rename_scenario/${oldName}/${newScenarioName}`
      );
      
      if (response.status === 200) {
        setEditingScenario(null);
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error renaming scenario:', error);
    }
  };

  const cancelRename = (e) => {
    e.stopPropagation();
    setEditingScenario(null);
  };
  var id = 0;
   const startCopying = (scenarioName, e) => {
    id++;
    e.stopPropagation();
    setCopyingScenario(scenarioName);
    setCopyName(`${scenarioName}_${id}`);
  };

  const handleCopyNameChange = (e) => {
    setCopyName(e.target.value);
  };

  const handleCopySubmit = async (originalName, e) => {
    e.stopPropagation();
    try {
      if (!copyName) {
        alert("The name is already taken");
        return;
      }

      const response = await axios.post(
        `http://localhost:5000/copy_scenario/${originalName}/${copyName}`
      );
      
      if (response.status === 200) {
        setCopyingScenario(null);
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error copying scenario:', error);
    }
  };

  const cancelCopy = (e) => {
    e.stopPropagation();
    setCopyingScenario(null);
  };

  

  return (
    <div className={styles.Scenariopp} ref={myRef}>
      <h1 className={styles.title}>DASHBOARD SCENARIO</h1>
      <button className={styles.create_button} onClick={handleCreateNew}>
        CREATE NEW SCENARIO
      </button>
      <h2 className={styles.secondtitle}></h2>
      {loading ? (
        <p>Loading scenarios...</p>
      ) : error ? (
        <p>Error loading scenarios: {error}</p>
      ) : scenarios.length > 0 ? (
        <div className={styles.scenariosContainer} >
          {scenarios.map((scenario, index) => (
            <div 
              key={index} 
              className={styles.scenariosbox}
              onClick={() => handleScenarioClick(scenario)}
              style={{ marginBottom: '10px', cursor: 'pointer' }}  
            >
              {editingScenario === scenario ? (
                <div className={styles.renameContainer}>
                  <input type="text" value={newScenarioName} onChange={handleRenameChange}
                    className={styles.renameInput} onClick={(e) => e.stopPropagation()}/>
                  <button className={styles.saveRename} onClick={(e) => handleRenameSubmit(scenario, e)}>Save</button>
                  <button className={styles.cancelRename}onClick={cancelRename}>Cancel</button>
                </div>
              ) : copyingScenario === scenario ? (
                <div className={styles.copyContainer}>
                  <input type="text" value={copyName} onChange={handleCopyNameChange}
                    className={styles.copyInput} onClick={(e) => e.stopPropagation()}/>
                  <button className={styles.saveCopy} onClick={(e) => handleCopySubmit(scenario, e)}>Copy</button>
                  <button className={styles.cancelCopy} onClick={cancelCopy} >Cancel</button>
                </div>
              ) : (
                <>
                  <p className={styles.name_scenario}>{scenario}</p>
                  <div className={styles.buttongroupe}>
                    <button className={styles.rename} onClick={(e) => startRenaming(scenario, e)}>rename</button>
                    <button className={styles.copy} onClick={(e) => startCopying(scenario, e)}>copy</button>
                    <button className={styles.delete} onClick={(e) => handleDelete(scenario, e)}>delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={myRef}></div>
        </div>
      ) : (
        <p>No scenarios available</p>
      )}
    </div>
  );
} 

export default Scenariopage;