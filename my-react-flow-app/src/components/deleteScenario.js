import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const deleteScenario = async (
    currentScenarioName,
    setCurrentScenarioName,
    setNodes,
    setEdges,
    onScenarioSaved
) => {
  if (!currentScenarioName) {
    alert('No scenario ');
    return;
  }

  if (window.confirm(`Are you sure "${currentScenarioName}"?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/delete_scenario/${currentScenarioName}`);
        alert('Scenario deleted ');
        setCurrentScenarioName('');
        setNodes([]);
        setEdges([]);
        if (onScenarioSaved) {
          onScenarioSaved();
        }
      } catch (error) {
        console.error('Error deleting :', error);
      }
    }
  };
