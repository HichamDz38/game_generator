import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
  Panel
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

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

let id = 0;
const getId = () => `dndnode_${id++}`;

const flowKey = 'example-flow';

const DnDFlow = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); 
  const [editValue, setEditValue] = useState(nodes.data);
  const [id, setId] = useState();
  const { setViewport } = useReactFlow();

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
    axios.post('/node-clicked', { 
      nodeId: val.id,
      nodeType: val.type 
    }).catch(console.error);
  };

   const onConnect = useCallback((params) => {
     setEdges((eds) => addEdge(params, eds));
     axios.post('/connection-made', params).catch(console.error);
   }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');

    if (typeof type === 'undefined' || !type) return;

    const position = rfInstance.project({
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
    axios.post('/node-created', newNode).catch(console.error);
  }, [rfInstance]);

  const onSave = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      localStorage.setItem(flowKey, JSON.stringify(flow));
    }
  }, [rfInstance]);
 
  const onRestore = useCallback(() => {
    const restoreFlow = async () => {
      const flow = JSON.parse(localStorage.getItem(flowKey));
 
      if (flow) {
        const { x = 0, y = 0, zoom = 1 } = flow.viewport;
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
        setViewport({ x, y, zoom });
      }
    };
 
    restoreFlow();
  }, [setNodes, setViewport]);

  return (
    <div className="dndflow">
      <Panel position="top-right">
        <button className="xy-theme__button" onClick={onSave}>
          save
        </button>
        <button className="xy-theme__button" onClick={onRestore}>
          restore
        </button>
      </Panel>

      <ReactFlowProvider>
        <div className="reactflow-wrapper" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
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





//   const saveFlowToBackend = async () => {
//   try {
//     const response = await axios.post('/api/save-flow', {
//       nodes,
//       edges
//     });
    
//     console.log('Flow saved with ID:', response.data.flow_id);
//     alert(`Flow saved! ID: ${response.data.flow_id}`);
    
//   } catch (error) {
//     console.error('Full error:', error.response?.data);
//     alert(`Save failed: ${error.response?.data?.message || error.message}`);
//   }
// };

//   const loadFlow = async (flowId) => {
//   try {
//     const response = await axios.get(`/api/load-flow/${flowId}`);
    
//     if (response.data.error) {
//       throw new Error(response.data.error);
//     }
    
//     setNodes(response.data.nodes || []);
//     setEdges(response.data.edges || []);
    
//     if (response.data.viewport && reactFlowInstance) {
//       reactFlowInstance.setViewport(response.data.viewport);
//     }
    
//     alert('Flow loaded successfully!');
//   } catch (error) {
//     console.error('Load error details:', error.response?.data);
//     alert(`Failed to load flow: ${error.response?.data?.error || 
//            error.response?.data?.message || 
//            error.message}`);
//   }
// };

// Usage example :
// loadFlow('668a2e9d-2292-45e6-b0db-165ebe69213c')