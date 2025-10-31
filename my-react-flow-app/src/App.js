import React, { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import DnDFlow from "./DragDrop/DnDFlow";
import Navbar from "./components/Navbar";
import Scenariopage from "./components/Scenariopage";
import DevicesPage from "./components/DevicesPage";
import DevicesBeta from "./components/DevicesBeta";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";

function FlowEditorWrapper({ onFlowRunningChange }) {
  const { scenarioName } = useParams();
  const navigate = useNavigate();

  const handleScenarioSaved = () => {
    navigate("/scenarios");
  };

  const handleBackToList = () => {
    navigate("/scenarios");
  };

  return (
    // 👇 Ensure React Flow has a full-size container
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlowProvider>
        <DnDFlow
          scenarioToLoad={scenarioName || null}
          onScenarioSaved={handleScenarioSaved}
          onBackToList={handleBackToList}
          onFlowRunningChange={onFlowRunningChange}
        />
      </ReactFlowProvider>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [isFlowRunning, setIsFlowRunning] = useState(false);

  const handleReturnScenarioSelect = () => {
    if (!isFlowRunning) {
      navigate("/scenarios");
    }
  };

  const handleNavigateToDevices = () => {
    if (!isFlowRunning) {
      navigate("/devices");
    }
  };

  const handleNavigateToDevicesBeta = () => {
    if (!isFlowRunning) {
      navigate("/devices-beta");
    }
  };

  return (
    <div className="app">
      <Navbar
        onReturnScenarioSelect={handleReturnScenarioSelect}
        onNavigateToDevices={handleNavigateToDevices}
        onNavigateToDevicesBeta={handleNavigateToDevicesBeta}
        isFlowRunning={isFlowRunning}
      />
      <div style={{ display: "flex", flex: 1 }}>
        <Routes>
          <Route
            path="/scenarios"
            element={
              <Scenariopage
                onScenarioSelect={(scenarioName) =>
                  navigate(`/flow/${scenarioName}`)
                }
                onCreateNew={() => navigate("/flow")}
              />
            }
          />
          <Route
            path="/devices"
            element={<DevicesPage />}
          />
          <Route
            path="/devices-beta"
            element={<DevicesBeta />}
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

// import React, { useState } from 'react';
// import { ReactFlowProvider } from 'reactflow';
// import DnDFlow from './DragDrop/DnDFlow';
// import Navbar from './components/Navbar';
// import Scenariopage from './components/Scenariopage';
// import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';

// function FlowEditorWrapper({ onFlowRunningChange }) {
//   const { scenarioName } = useParams();
//   const navigate = useNavigate();

//   const handleScenarioSaved = () => {
//     navigate('/scenarios');
//   };

//   const handleBackToList = () => {
//     navigate('/scenarios');
//   };

//   return (
//     <ReactFlowProvider>
//       <DnDFlow 
//         scenarioToLoad={scenarioName || null} 
//         onScenarioSaved={handleScenarioSaved}
//         onBackToList={handleBackToList}
//         onFlowRunningChange={onFlowRunningChange}
//       />
//     </ReactFlowProvider>
//   );
// }

// export default function App() {
//   const navigate = useNavigate();
//   const [isFlowRunning, setIsFlowRunning] = useState(false);

//   const handleReturnScenarioSelect = () => {
//     if (!isFlowRunning) {
//       navigate('/scenarios');
//     }
//   };

//   return (
//     <div className="app">
//       <Navbar 
//         onReturnScenarioSelect={handleReturnScenarioSelect}
//         isFlowRunning={isFlowRunning}
//       />
//       <div style={{ display: 'flex' }}>
//         <Routes>
//           <Route 
//             path="/scenarios" 
//             element={
//               <Scenariopage
//                 onScenarioSelect={(scenarioName) => navigate(`/flow/${scenarioName}`)}
//                 onCreateNew={() => navigate('/flow')} 
//               />
//             } 
//           />
//           <Route 
//             path="/flow/:scenarioName?" 
//             element={<FlowEditorWrapper onFlowRunningChange={setIsFlowRunning} />} 
//           />
//           <Route path="*" element={<Navigate to="/scenarios" replace />} />
//         </Routes>
//       </div>
//     </div>
//   );
// }
