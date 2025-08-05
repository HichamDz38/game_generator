import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './MyComponent.module.css';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
  Panel,
  BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios'; 
import Sidebar from './sidebar';
import './style.css';

var statett = "Hello"; 

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
  const [editValue, setEditValue] = useState(nodes.data);
  const [id, setId] = useState();
  const { setViewport } = useReactFlow();

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
 const saveFlowToBackend = async () => {
  
  // try {
    let data = {
       "nodes" : nodes,
        "edges":edges,
        "name" : "NODE_"
      };
    //  data = JSON.stringify(data);
     const response = await axios.post('/save_flow', data);
    
     console.log('Flow saved with ID:', "HElllo");
     console.log(response);
     console.log(response.data);
     alert(`Flow saved! ID: ${response.data.flow_id}`);
 };
  const loadFlowfrombackend = async (flowId) => {
   try {
     const response = await axios.get(`/load-flow/${flowId}`);
    
     if (response.data.error) {
       throw new Error(response.data.error);
     }
    
     setNodes(response.data.nodes || []);
     setEdges(response.data.edges || []);
    
     if (response.data.viewport && rfInstance) {
       rfInstance.setViewport(response.data.viewport);
     }
    
     alert('Flow loaded successfully!');
   } catch (error) {
     console.error('Load error details:', error.response?.data);
     alert(`Failed to load flow: ${error.response?.data?.error || 
            error.response?.data?.message || 
            error.message}`);
   }
 };
 
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
        <button className={styles.savebtn}
         onClick={saveFlowToBackend}>
          Saveflow
        </button>
        <div>
        <input 
          type="text" 
          placeholder="Paste Flow ID" 
          id="flowIdInput"
          className={styles.plcinput}
        />
        <button className={styles.loadbtn}
          onClick={() => loadFlowfrombackend(document.getElementById('flowIdInput').value)}
        >
          Load Flow
        </button>
        </div>
        
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
            <Background 
              id="my-background" 
              gap={15} 
              color="#hhh" 
              variant={BackgroundVariant.Dots} 
            />
            <Controls />
          </ReactFlow>
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;






// Usage example :
// loadFlow('668a2e9d-2292-45e6-b0db-165ebe69213c')