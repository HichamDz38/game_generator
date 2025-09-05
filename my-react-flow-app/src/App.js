import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';
import Scenariopage from './components/Scenariopage';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';

function FlowEditorWrapper({ onFlowRunningChange }) {
  const { scenarioName } = useParams();
  const navigate = useNavigate();

  const handleScenarioSaved = () => {
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
        onFlowRunningChange={onFlowRunningChange}
      />
    </ReactFlowProvider>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [isFlowRunning, setIsFlowRunning] = useState(false);

  const handleReturnScenarioSelect = () => {
    if (!isFlowRunning) {
      navigate('/scenarios');
    }
  };

  return (
    <div className="app">
      <Navbar 
        onReturnScenarioSelect={handleReturnScenarioSelect}
        isFlowRunning={isFlowRunning}
      />
      <div style={{ display: 'flex' }}>
        <Routes>
          <Route 
            path="/scenarios" 
            element={
              <Scenariopage
                onScenarioSelect={(scenarioName) => navigate(`/flow/${scenarioName}`)}
                onCreateNew={() => navigate('/flow')} 
              />
            } 
          />
          <Route 
            path="/flow/:scenarioName?" 
            element={<FlowEditorWrapper onFlowRunningChange={setIsFlowRunning} />} 
          />
          <Route path="*" element={<Navigate to="/scenarios" replace />} />
        </Routes>
      </div>
    </div>
  );
}