import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      {/* <div className="main-content">
        <ReactFlowProvider>
          <DnDFlow />
        </ReactFlowProvider>
      </div> */}
    </div>
  );
}

