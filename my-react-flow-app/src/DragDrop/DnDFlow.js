import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './MyComponent.module.css';
import { deleteScenario } from '../components/deleteScenario';
import NodeDetails from '../components/NodeDetails';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Panel,
  BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios'; 
import Sidebar from './sidebar';
import './style.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const nodeTypes = {
  delay: DelayNode,
};



const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'start' },
    position: { x: 250, y: 5 },
  },
  {
    id: '2',
    type: 'output',
    data: { label: 'end' },
    position: { x: 250, y: 200 },
  },
];

var idnumber = 0;
const getId = () => `N${idnumber}`;


const DnDFlow = ({nodeData, scenarioToLoad, onScenarioSaved }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [currentScenarioName, setCurrentScenarioName] = useState('');
  const [isEditable, setIsEditable] = useState(!scenarioToLoad);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showDelayConfig, setShowDelayConfig] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(!scenarioToLoad);

  const onNodeClick = (e, clickedNode) => {
  if (clickedNode.data.deviceType === 'delay') {
    setSelectedNode(clickedNode);
    setShowDelayConfig(true);
  } else if (!(clickedNode.type === 'input' || clickedNode.type === 'output')) {
    setSelectedNode(clickedNode);
  }
};

    const closeDelayConfig = () => {
      setShowDelayConfig(false);
      setSelectedNode(null);
    };

    const updateNodeData = (nodeId, newData) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: newData }
            : node
        )
      );
      setShowDelayConfig(false);
      setSelectedNode(null);
    };


  const closeNodeDetails = () => {
    setSelectedNode(null);
  }

  const onConnect = useCallback((params) => {
    if (isEditable) {
      setEdges((eds) => addEdge(params, eds));
    }
  }, [isEditable, setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);


  const onDrop = useCallback((event) => {
    if (!isEditable) return;
    
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    const label = event.dataTransfer.getData('application/label');
    const config = JSON.parse(event.dataTransfer.getData('application/config'));
    const deviceDataStr = event.dataTransfer.getData('application/deviceData');
    const deviceData = deviceDataStr ? JSON.parse(deviceDataStr) : null;
    const deviceId = event.dataTransfer.getData('application/deviceId'); 

    if (typeof type === 'undefined' || !type) return;

    const position = rfInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    const newNodeId = deviceId || getId();
    
    if (!deviceId) {
      idnumber = idnumber + 1;
    }

    const newNode = {
      id: newNodeId,
      type: type === 'device' ? 'default' : type, 
      position,
      data: { 
        label: label || `${type} node`,
        deviceType: type === 'device' ? 
          (deviceData?.node_type || 'device') : 
          type,
        config: config,
        originalDeviceId: deviceData ? Object.keys(deviceData)[0] : null 
      },
    };
    
    setNodes((nds) => nds.concat(newNode));
  }, [rfInstance, isEditable, setNodes]);
  



   const validateFlow = () => {
    const errors = [];
    if (nodes.length === 0) {
      errors.push("Flow must contain at least one node");
      return { isValid: false, errors };
    }
    
    const inputNodes = nodes.filter(node => node.type === 'input');
    const outputNodes = nodes.filter(node => node.type === 'output');
    
    if (inputNodes.length === 0 || inputNodes.length > 1) {
      errors.push("Flow must have one input node");
    }
    if (outputNodes.length === 0 || outputNodes.length > 1) {
      errors.push("Flow must have one output node");
    }
    
    outputNodes.forEach(outputNode => {
      const hasIncomingEdge = edges.some(edge => edge.target === outputNode.id);
      if (!hasIncomingEdge) {
        errors.push(`Output node must have at least one incoming Edge`);
      }
    });
    inputNodes.forEach(inputNode => {
      const hasOutgoingEdge = edges.some(edge => edge.source === inputNode.id);
      if (!hasOutgoingEdge) {
        errors.push(`Input node should have at least one outgoing Edge`);
      }
    });
    

    const connectedNodeIds = new Set();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    
    const isolatedNodes = nodes.filter(node => 
      !connectedNodeIds.has(node.id) && 
      node.type !== 'input' && 
      node.type !== 'output'
    );

    const NormalNodes = nodes.filter(node => 
      connectedNodeIds.has(node.id) && 
      node.type !== 'input' && 
      node.type !== 'output'
    )

    NormalNodes.forEach(NormalNodes => {
      const hasIncomingEdge = edges.some(edge => edge.target === NormalNodes.id);
      const hasOutgoingEdge = edges.some(edge => edge.source === NormalNodes.id);
      if (!hasIncomingEdge || !hasOutgoingEdge) {
        errors.push(`each node must have at least one incoming edge and one outgoing edge`);
        return ;
      }
    });
    
    if (isolatedNodes.length > 0) {
      errors.push(`Found a node with no edeges`);
    }
    
    if (inputNodes.length > 0 && outputNodes.length> 0) {
      const hasValidPath = outputNodes.some(outputNode => {
        const reachableFromInput = edges.some(edge => 
          edge.target === outputNode.id || 
          inputNodes.some(inputNode => edge.source === inputNode.id)
        );
        return reachableFromInput;
      });
      
      if (!hasValidPath && edges.length > 0) {
        errors.push("must have path from input to output nodes");
      }
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const saveFlowToBackend = async () => {

    const validation = validateFlow();
    
    if (!validation.isValid) {
      const errorMessage = "Cannot save flow due to the following issues:\n\n" + 
        validation.errors.map((error, index) => `${index + 1}. ${error}`).join('\n') +
        "\n\nPlease fix these issues before saving.";
      
      alert(errorMessage);
      return false; 
    }

    if (currentScenarioName) {
      try {
        let data = {
          "nodes": nodes,
          "edges": edges,
          "name": currentScenarioName
        };
        
        await axios.post(`${API_BASE_URL}/save_flow`, data);
        return true;
        
      } catch (error) {
        console.error('Error saving flow:', error);
      }
    } else {
      const SC_Name = prompt("Enter the name of scenario: ");
      if (!SC_Name) return;
      
      try {
        let data = {
          "nodes": nodes,
          "edges": edges,
          "name": SC_Name
        };
        
        await axios.post(`${API_BASE_URL}/save_flow`, data);
        setCurrentScenarioName(SC_Name);
        
        if (onScenarioSaved) {
          onScenarioSaved();
        }
      } catch (error) {
        console.error('Error saving flow:', error);
      }
    }
  };

  const loadFlowFromBackend = useCallback(async (flowId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/load-flow/${flowId}`);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      setNodes(response.data.nodes || []);
      setEdges(response.data.edges || []);
      setCurrentScenarioName(flowId);
      
      setIsEditable(false);
      setIsCreatingNew(false);
      
      if (response.data.viewport && rfInstance) {
        rfInstance.setViewport(response.data.viewport);
      }
      
     } catch (error) {
    console.error('Load error details:', error.response?.data);
  }
}, [rfInstance, setNodes, setEdges, setCurrentScenarioName, setIsEditable]);

  useEffect(() => {
  if (scenarioToLoad) {
    loadFlowFromBackend(scenarioToLoad);
  } else {
      setIsEditable(true);
      setIsCreatingNew(true);
      setNodes(initialNodes);
      setEdges([]);
      setCurrentScenarioName('');
    }
}, [scenarioToLoad, currentScenarioName, isCreatingNew, loadFlowFromBackend, setNodes, setIsEditable, setCurrentScenarioName]);
 

  const handleSaveAs = async () => {
    const newScenarioName = prompt("Enter a new name for this scenario:");
    
    if (!newScenarioName) {
      return; 
    }

    try {
      const data = {
        nodes: nodes,
        edges: edges,
        name: newScenarioName
      };

      const response = await axios.post(`${API_BASE_URL}/save_flow`, data);
      
      if (response.status === 200) {
        setCurrentScenarioName(newScenarioName);
        
        if (onScenarioSaved) {
          onScenarioSaved(); 
        }
      }
    } catch (error) {
      console.error('Error saving scenario:', error);
    }
  };

  const handleLoadScenario = (scenarioName) => {
    loadFlowFromBackend(scenarioName);
  };

  const handleEdit = () => {
    setIsEditable(true);
  };

  const handleSave = async () => {
    const saveSuccess = await saveFlowToBackend();
    if (saveSuccess) {
      setIsEditable(false);
    }
  };

  const handleSaveAsAndStayEditable = async () => {
    const validation = validateFlow();
    if (!validation.isValid) {
      const errorMessage = "Cannot save flow due to the following issues:\n\n" + 
      validation.errors.map((error, index) => `${index + 1}. ${error}`).join('\n') +
      "\n\nPlease fix these issues before saving.";
      alert(errorMessage);
      return;
    }
    await handleSaveAs();
  };

  const handledeleteScenario = () => {
    deleteScenario(
      currentScenarioName,
      setCurrentScenarioName,
      setNodes,
      setEdges, 
      onScenarioSaved
    )
  }

  return (
    <div className="dndflow">
      <Panel position="top-right">
        <div className={styles.flowButtons}>
          {!isEditable && (
            <button className={styles.theme__button}>
              START
            </button>
          )}
          
          {isEditable && (
            <button className={styles.theme__button} onClick={handleSaveAsAndStayEditable}>
              SAVE AS
            </button>
          )}

          <button className={styles.theme__button} onClick={isEditable ? handleSave : handleEdit}>
            {isEditable ? 'SAVE' : 'EDIT'}
          </button>

          <button className={styles.theme__button} onClick={handledeleteScenario}>
            DELETE
          </button>
        </div>
        {currentScenarioName && (
          <div className={styles.scenarionnamebox}>
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
            nodeTypes={nodeTypes}  
            onNodesChange={isEditable ? onNodesChange : undefined}
            onEdgesChange={isEditable ? onEdgesChange : undefined}
            onConnect={isEditable ? onConnect : undefined}
            onNodeClick={onNodeClick}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodesDraggable={isEditable}
            nodesConnectable={isEditable}
            elementsSelectable={isEditable}
            edgesUpdatable={isEditable}
            edgesFocusable={isEditable}
            nodesFocusable={isEditable}
            panOnDrag={true}
            zoomOnDoubleClick={true}
            selectNodesOnDrag={isEditable}
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
        {isEditable && ( 
          <Sidebar onLoadScenario={handleLoadScenario} />
        )}

        {isEditable && (
          <NodeDetails 
            nodeData={selectedNode} 
            onClose={closeNodeDetails}
            onUpdate={updateNodeData}
            scenarioName={currentScenarioName}
            nodes={nodes}
            edges={edges}
          />
        )}
        
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;