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

const DnDFlow = ({ scenarioToLoad, onScenarioSaved }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [currentScenarioName, setCurrentScenarioName] = useState('');
  const { setViewport } = useReactFlow();

  const onNodeClick = (e, val) => {
    setEditValue(val.data.label);
    setSelectedNodeId(val.id);
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
    const label = event.dataTransfer.getData('application/label');

    if (typeof type === 'undefined' || !type) return;

    const position = rfInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    const newNode = {
      id: getId(),
      type: type === 'device' ? 'default' : type, 
      position,
      data: { 
        label: label || `${type} node`,
        deviceType: type === 'device' ? 'device' : type
      },
    };

    setNodes((nds) => nds.concat(newNode));
    axios.post('/node-created', newNode).catch(console.error);
  }, [rfInstance]);

  const saveFlowToBackend = async () => {
    const SC_Name = prompt("Enter the name of scenario: ");
    if (!SC_Name) return;
    
    try {
      let data = {
        "nodes": nodes,
        "edges": edges,
        "name": SC_Name
      };
      
      const response = await axios.post('/save_flow', data);
      console.log('Flow saved with ID:', response.data.flow_id);
      alert(`Flow saved! Name: ${SC_Name}`);
      setCurrentScenarioName(SC_Name);
      
      if (onScenarioSaved) {
        onScenarioSaved();
      }
    } catch (error) {
      console.error('Error saving flow:', error);
      alert('Failed to save flow');
    }
  };

  const loadFlowFromBackend = async (flowId) => {
    try {
      const response = await axios.get(`/load-flow/${flowId}`);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      setNodes(response.data.nodes || []);
      setEdges(response.data.edges || []);
      setCurrentScenarioName(flowId);
      
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

  const deleteScenario = async () => {
    if (!currentScenarioName) {
      alert('No scenario ');
      return;
    }

    if (window.confirm(`Are you sure "${currentScenarioName}"?`)) {
      try {
        await axios.delete(`/delete_scenario/${currentScenarioName}`);
        alert('Scenario deleted ');
        setCurrentScenarioName('');
        setNodes([]);
        setEdges([]);
        if (onScenarioSaved) {
          onScenarioSaved();
        }
      } catch (error) {
        console.error('Error deleting :', error);
        alert('Failed to delete ');
      }
    }
  };

  const clearFlow = () => {
    setNodes([]);
    setEdges([]);
    setCurrentScenarioName('');
  };

  const handleLoadScenario = (scenarioName) => {
    loadFlowFromBackend(scenarioName);
  };

  useEffect(() => {
    if (scenarioToLoad) {
      loadFlowFromBackend(scenarioToLoad);
    }
  }, [scenarioToLoad]);

  return (
    <div className="dndflow">
      <Panel position="top-right">
        <div className={styles.flowButtons}>
          <button className={styles.theme__button} onClick={saveFlowToBackend}>
            SAVE
          </button>
          <button className={styles.theme__button} >
            EDIT
          </button>
          <button className={styles.theme__button} onClick={deleteScenario}>
            DELETE
          </button>
        </div>
        {currentScenarioName && (
          <div className= {styles.scenarionnamebox}>
            <div className={styles.scenarionname}>
              scenario name: {currentScenarioName}
            </div>
          </div>
        )}
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
              color="#ccc" 
              variant={BackgroundVariant.Dots} 
            />  
            <Controls />
          </ReactFlow>
        </div>
        <Sidebar onLoadScenario={handleLoadScenario} />
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;






// Usage example :
// loadFlow('668a2e9d-2292-45e6-b0db-165ebe69213c')