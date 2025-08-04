import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow';
import Navbar from './components/Navbar';
import Sidenav from './components/Sidenav'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <Sidenav />
      {/* <div className="main-content">
        <ReactFlowProvider>
          <DnDFlow />
        </ReactFlowProvider>
      </div> */}
    </div>
  );
}

