import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';
import Sidenav from './components/Sidenav';

export default function App() {
  const [refreshScenarios, setRefreshScenarios] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(null);

  const handleScenarioSelect = (scenarioName) => {
    setSelectedScenario(scenarioName);
  };

  const handleScenarioSaved = () => {
    setRefreshScenarios(prev => !prev);
    setSelectedScenario(null); 
  };

  return (
    <div className="app">
      <Navbar />
      <div style={{ display: 'flex' }}>
        <Sidenav 
          onScenarioSelect={handleScenarioSelect} 
          key={refreshScenarios}
        />
        <div className="main-content">
          <ReactFlowProvider>
            <DnDFlow 
              scenarioToLoad={selectedScenario}
              onScenarioSaved={handleScenarioSaved}
            />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}