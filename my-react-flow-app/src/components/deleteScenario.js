import axios from 'axios'
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
        await axios.delete(`/delete_scenario/${currentScenarioName}`);
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
