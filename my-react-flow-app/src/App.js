import React from 'react'
import { ReactFlowProvider } from 'reactflow';
import DnDFlow from './DragDrop/DnDFlow'
export default function App() {
  return (
    <div style={{width:'100%', height:'100vh'}}>
      <ReactFlowProvider>
        <DnDFlow />
      </ReactFlowProvider>
    </div>
  )
}
