import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';
import Scenariopage from './components/Scenariopage';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';

function FlowEditorWrapper() {
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
      />
    </ReactFlowProvider>
  );
}

export default function App() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <Navbar onReturnScenarioSelect={() => navigate('/scenarios')} />
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
          <Route path="/flow/:scenarioName?" element={<FlowEditorWrapper />} />
          <Route path="*" element={<Navigate to="/scenarios" replace />} />
        </Routes>
      </div>
    </div>
  );
}