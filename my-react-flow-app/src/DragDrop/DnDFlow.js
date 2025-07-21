import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios'; 
import Sidebar from './sidebar';
import './style.css';


const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'input node' },
    position: { x: 250, y: 5 },
  },
];

let id = 0;
const getId = () => `dndnode_${id++}`;

const DnDFlow = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // Add connection state
  const [editValue, setEditValue] = useState(nodes.data);
  const [id, setId] = useState();

  // Add this useEffect to check backend connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await axios.get('/ping');
        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const onNodeClick = (e, val) => {
    setEditValue(val.data.label);
    setId(val.id);
    
    // Example: Send node click event to Flask
    axios.post('/node-clicked', { 
      nodeId: val.id,
      nodeType: val.type 
    }).catch(console.error);
  };

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
    // Example: Send connection data to Flask
    axios.post('/connection-made', params).catch(console.error);
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');

    if (typeof type === 'undefined' || !type) return;

    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    const newNode = {
      id: getId(),
      type,
      position,
      data: { label: `${type} node` },
    };

    setNodes((nds) => nds.concat(newNode));
    
    // Example: Send new node data to Flask
    axios.post('/node-created', newNode).catch(console.error);
  }, [reactFlowInstance]);

  const saveFlowToBackend = async () => {
  try {
    const response = await axios.post('/api/save-flow', {
      nodes,
      edges
    });
    
    console.log('Flow saved with ID:', response.data.flow_id);
    alert(`Flow saved! ID: ${response.data.flow_id}`);
    
  } catch (error) {
    console.error('Full error:', error.response?.data);
    alert(`Save failed: ${error.response?.data?.message || error.message}`);
  }
};

  const loadFlow = async (flowId) => {
  try {
    const response = await axios.get(`/api/load-flow/${flowId}`);
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    setNodes(response.data.nodes || []);
    setEdges(response.data.edges || []);
    
    if (response.data.viewport && reactFlowInstance) {
      reactFlowInstance.setViewport(response.data.viewport);
    }
    
    alert('Flow loaded successfully!');
  } catch (error) {
    console.error('Load error details:', error.response?.data);
    alert(`Failed to load flow: ${error.response?.data?.error || 
           error.response?.data?.message || 
           error.message}`);
  }
};

// Usage example :
// loadFlow('668a2e9d-2292-45e6-b0db-165ebe69213c')

  return (
    <div className="dndflow">
      <button 
      onClick={saveFlowToBackend}
      style={{
        position: 'absolute',
        top: '50px',
        right: '50px',
        padding: '8px 16px',
        background: '#1b154dff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        zIndex: 1000,
        border: '2px solid red', 
        fontSize: '20px'
        }}
        >
        Save Flow
      </button>
      <div style={{ position: 'absolute', top: '5px', left: '18rem', zIndex: 1000 }}>
        <input 
          type="text" 
          placeholder="Paste Flow ID" 
          id="flowIdInput"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button 
          onClick={() => loadFlow(document.getElementById('flowIdInput').value)}
          style={{ padding: '5px 10px', background: '#1b154dff', color: 'white' }}
        >
          Load Flow
        </button>
      </div>
      <div className="connection-status" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : '#F44336',
        color: 'white',
        zIndex: 1000
      }}>
        Backend: {connectionStatus}
      </div>

      <ReactFlowProvider>
        <div className="reactflow-wrapper" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;