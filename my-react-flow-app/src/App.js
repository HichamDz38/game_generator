import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';
import Scenariopage from './components/Scenariopage';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';

function FlowEditorWrapper() {
  const { scenarioName } = useParams();
  const navigate = useNavigate();
  const [refreshScenarios, setRefreshScenarios] = useState(false);

  const handleScenarioSaved = () => {
    setRefreshScenarios(prev => !prev);
    navigate('/scenarios');
  };

  const handleBackToList = () => {
    navigate('/scenarios');
  };

  return (
    <ReactFlowProvider>
      <DnDFlow 
        scenarioToLoad={scenarioName || null} 
        onScenarioSaved={handleScenarioSaved}
        onBackToList={handleBackToList}
      />
    </ReactFlowProvider>
  );
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <div style={{ display: 'flex' }}>
        <Routes>
          <Route 
            path="/scenarios" 
            element={
              <Scenariopage
                onScenarioSelect={(scenarioName) => {
                  window.location.href = `/flow/${scenarioName}`;
                }}
                onCreateNew={() => {
                  window.location.href = '/flow';
                }}
              />
            } 
          />
          <Route path="/flow/:scenarioName?" element={<FlowEditorWrapper />} />
          <Route path="*" element={<Navigate to="/scenarios" replace />} />
        </Routes>
      </div>
    </div>
  );
}