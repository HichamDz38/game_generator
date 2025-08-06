import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';
import Scenariopage from './components/Scenariopage';

export default function App() {
  const [refreshScenarios, setRefreshScenarios] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [showFlowEditor, setShowFlowEditor] = useState(false);

  const handleScenarioSelect = (scenarioName) => {
    setSelectedScenario(scenarioName);
    setShowFlowEditor(true); 
  };

  const handleCreateNew = () => {
    setSelectedScenario(null); 
    setShowFlowEditor(true);
  };

  const handleScenarioSaved = () => {
    setRefreshScenarios(prev => !prev);
    setSelectedScenario(null);
    setShowFlowEditor(false); 
  };

  const handleBackToList = () => {
    setShowFlowEditor(false);
    setSelectedScenario(null);
  };

  return (
    <div className="app">
      <Navbar />
      <div style={{ display: 'flex' }}>
        {!showFlowEditor ? (
          <Scenariopage
            onScenarioSelect={handleScenarioSelect} 
            onCreateNew={handleCreateNew}
            key={refreshScenarios}
          />
        ) : (
          <div className="main-content">
            <ReactFlowProvider>
              <DnDFlow 
                scenarioToLoad={selectedScenario} 
                onScenarioSaved={handleScenarioSaved}
                onBackToList={handleBackToList}
              />
            </ReactFlowProvider>
          </div>
        )}
      </div>
    </div>
  );
}