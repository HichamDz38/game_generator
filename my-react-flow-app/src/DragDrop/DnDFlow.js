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

let idnumber = 2; 

const getId = (existingNodes = []) => {
  let newId;
  let isUnique = false;
  
  const checkIfIdExists = (idToCheck) => {
    return existingNodes.some(node => node.id === idToCheck);
  };
  
  while (!isUnique) {
    idnumber = idnumber + 1;
    newId = `N${idnumber}`;
    isUnique = !checkIfIdExists(newId);
  }
  
  return newId;
};

const DnDFlow = ({scenarioToLoad, onScenarioSaved, onFlowRunningChange }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [currentScenarioName, setCurrentScenarioName] = useState('');
  const [isEditable, setIsEditable] = useState(!scenarioToLoad);
  const [selectedNode, setSelectedNode] = useState(null);
  const [IsCreatingNew, setIsCreatingNew] = useState(!scenarioToLoad);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isStart, setisStart] = useState(false);
  const completionStateRef = useRef({ completedNodes: [], failedNodes: [] });

  const [executionState, setExecutionState] = useState({
  isRunning: false,
  currentNodes: [],
  completedNodes: [],
  failedNodes: [],
  executionLog: [],
  startTime: null,
  activePaths: new Set(),
  shouldStop: false, 
  globalError: null,
  shouldCompleteEarly: false, 
  earlyCompletionReason: null 
});

const isRunningRef = useRef(false);

  useEffect(() => {
    isRunningRef.current = executionState.isRunning;
  }, [executionState.isRunning]);

  useEffect(() => {
    if (onFlowRunningChange) {
      onFlowRunningChange(isStart);
    }
  }, [isStart, onFlowRunningChange]);

  const updateExecutionState = useCallback((updater) => {
    setExecutionState(prev => updater(prev));
  }, []);

  const transformConfigForDevice = (config) => {
    const transformedConfig = {};
    
    for (const [key, configObj] of Object.entries(config)) {
      if (configObj && typeof configObj === 'object' && 'value' in configObj) {
        transformedConfig[key] = configObj.value;
      } else {
        transformedConfig[key] = configObj;
      }
    }
    
    console.log('Original config:', config);
    console.log('Transformed config:', transformedConfig);
    return transformedConfig;
  };

  const executeNode = async (node, pathId = null) => {
  console.log(`[${pathId}] Executing node: ${node.id} - ${node.data.label}`);
  
  updateExecutionState(prev => ({
    ...prev,
    currentNodes: [...prev.currentNodes, node.id]
  }));
  
  setNodes(nds => nds.map(n => ({
    ...n,
    style: n.id === node.id 
      ? { ...n.style, backgroundColor: '#ffeb3b', border: '2px solid #ff9800' }
      : n.style
  })));

  try {
    switch (node.data.deviceType || node.type) {
      case 'device':
        await executeDeviceNode(node, pathId);
        break;
      case 'virtual':
        await executeVirtualNode(node);
        break;
      case 'delay':
        await executeDelayNode(node);
        break;
      case 'condition':
        await executeConditionNode(node);
        break;
      case 'input':
      case 'output':
        await new Promise(resolve => setTimeout(resolve, 500));
        break;
      default:
        console.warn(`Unknown node type: ${node.data.deviceType || node.type}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await new Promise(resolve => setTimeout(resolve, 10));
    
    updateExecutionState(prev => {
      const newCompletedNodes = [...prev.completedNodes, node.id];
      const newCurrentNodes = prev.currentNodes.filter(id => id !== node.id);
      
      completionStateRef.current = {
        completedNodes: newCompletedNodes,
        failedNodes: prev.failedNodes
      };
      
      console.log(`[${pathId}] Node ${node.data.label} marked as completed. Total completed: ${newCompletedNodes.length}`);
      
      return {
        ...prev,
        completedNodes: newCompletedNodes,
        currentNodes: newCurrentNodes,
        executionLog: [...prev.executionLog, {
          type: 'success',
          nodeId: node.id,
          nodeName: node.data.label,
          timestamp: new Date(),
          message: `Successfully executed ${node.data.label}`,
          pathId: pathId
        }]
      };
    });

    setNodes(nds => nds.map(n => ({
      ...n,
      style: n.id === node.id 
        ? { ...n.style, backgroundColor: '#4caf50', border: '2px solid #2e7d32' }
        : n.style
    })));

    return true;

  } catch (error) {
    console.error(`[${pathId}] Error executing node ${node.id}:`, error);
    
    updateExecutionState(prev => {
      const newFailedNodes = [...prev.failedNodes, node.id];
      const newCurrentNodes = prev.currentNodes.filter(id => id !== node.id);
      
      completionStateRef.current = {
        completedNodes: prev.completedNodes,
        failedNodes: newFailedNodes
      };
      
      return {
        ...prev,
        failedNodes: newFailedNodes,
        currentNodes: newCurrentNodes,
        executionLog: [...prev.executionLog, {
          type: 'error',
          nodeId: node.id,
          nodeName: node.data.label,
          timestamp: new Date(),
          message: `Failed to execute ${node.data.label}: ${error.message}`,
          pathId: pathId
        }]
      };
    });

    setNodes(nds => nds.map(n => ({
      ...n,
      style: n.id === node.id 
        ? { ...n.style, backgroundColor: '#f44336', border: '2px solid #d32f2f' }
        : n.style
    })));

    throw error;
  }
};


  const executeDeviceNode = async (node, pathId = null) => {
    const { config, originalDeviceId } = node.data;
    
    try {
      const transformedConfig = transformConfigForDevice(config);
      
      const response = await fetch(`${API_BASE_URL}/start/${originalDeviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: transformedConfig,
          nodeId: node.id,
          scenarioName: currentScenarioName
        })
      });

      if (!response.ok) {
        throw new Error(`Device start failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Device start result:', result);
      
      let status = 'started';
      let attempts = 0;
      const maxAttempts = 300;
      const pollInterval = 1000;
      
      while (status === 'started' && attempts < maxAttempts) {
        if (!isRunningRef.current) {
          console.log('Execution was stopped - breaking polling loop');
          throw new Error('Execution was stopped by user');
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/get_status/${node.id}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            status = statusData.status;
            
            console.log(`Device ${node.id} status: ${status} (attempt ${attempts})`);
            
            const updateNodeStyle = (currentStatus) => {
              setNodes(nds => nds.map(n => {
                if (n.id === node.id) {
                  let backgroundColor, borderColor;
                  switch (currentStatus) {
                    case 'in progress':
                      backgroundColor = '#ffeb3b';
                      borderColor = '#ff9800';
                      break;
                    case 'completed':
                      backgroundColor = '#4caf50';
                      borderColor = '#2e7d32';
                      break;
                    case 'failed':
                      backgroundColor = '#f44336';
                      borderColor = '#d32f2f';
                      break;
                    default:
                      backgroundColor = '#ffeb3b';
                      borderColor = '#ff9800';
                  }
                  
                  return {
                    ...n,
                    style: { ...n.style, backgroundColor, border: `2px solid ${borderColor}` }
                  };
                }
                return n;
              }));
            };

            updateNodeStyle(status);
            
            if (status === 'completed') {
              console.log(`Device ${originalDeviceId} completed successfully`);
              return result;
            } else if (status === 'failed') {
              throw new Error('Device failed');
            }
          }
        } catch (statusError) {
          if (statusError.message === 'Device failed') {
            throw statusError; 
          }
          console.warn(`Status check failed for device ${originalDeviceId}:`, statusError);
        }
        
        attempts++;
        
        if (attempts % 10 === 0) {
          console.log(`Waiting for device ${originalDeviceId}... (${attempts}s elapsed)`);
        }
      }
      
      if (status === 'in progress') {
        throw new Error(`Device ${originalDeviceId} timeout after ${maxAttempts} seconds`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Device execution error:', error);
      
      setNodes(nds => nds.map(n => {
        if (n.id === node.id) {
          return {
            ...n,
            style: { ...n.style, backgroundColor: '#f44336', border: '2px solid #d32f2f' }
          };
        }
        return n;
      }));
      
      throw error;
    }
  };

  const executeVirtualNode = async (node) => {
    const speed = node.data.config?.speed?.value || 3000;
    console.log(`Virtual node waiting for ${speed}ms`);
    await new Promise(resolve => setTimeout(resolve, parseInt(speed)));
  };

  const executeDelayNode = async (node) => {
  const delaySeconds = node.data.config?.delaySeconds?.value || node.data.delaySeconds || 3;
  console.log(`Timer node ${node.data.label} starting ${delaySeconds} second delay`);
  
  const delayMs = parseInt(delaySeconds) * 1000;
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkExecution = () => {
      if (!isRunningRef.current) {
        reject(new Error('Execution was stopped by user'));
        return;
      }
      
      const elapsed = Date.now() - startTime;
      if (elapsed >= delayMs) {
        console.log(`Timer node ${node.data.label} completed after ${delaySeconds} seconds`);
        resolve();
      } else {
        setTimeout(checkExecution, 100);
      }
    };
    
    checkExecution();
  });
};


  const getNextNodes = useCallback((currentNodeId) => {
  const nextEdges = edges.filter(edge => edge.source === currentNodeId);
  return nextEdges.map(edge => nodes.find(node => node.id === edge.target)).filter(Boolean);
}, [edges, nodes]);

  const checkForFlowCompletion = useCallback(() => {
  const conditionNodes = nodes.filter(node => node.data.deviceType === 'condition');
  
  if (conditionNodes.length === 0) {
    console.log('No condition nodes found - waiting for ALL nodes to complete');
    
    if (executionState.currentNodes.length > 0) {
      console.log('Nodes still executing:', executionState.currentNodes);
      return false;
    }
    
    const nodesToComplete = nodes.filter(node => 
      node.type !== 'input' && node.type !== 'output'
    );
    
    const allNodesCompleted = nodesToComplete.every(node => 
      executionState.completedNodes.includes(node.id)
    );
    
    const anyNodesFailed = nodesToComplete.some(node => 
      executionState.failedNodes.includes(node.id)
    );
    
    if (anyNodesFailed) {
      console.log('Some nodes failed - flow cannot complete');
      return false;
    }
    
    return allNodesCompleted;
  }
  
  console.log('Condition nodes found - checking only condition logic (ignoring parallel nodes)');
  
  for (const conditionNode of conditionNodes) {
    const { config } = conditionNode.data;
    
    if (!config) {
      console.log(`Condition node ${conditionNode.data.label} has no config`);
      continue;
    }
    
    
    const checkedSources = Object.keys(config)
      .filter(key => key.startsWith('source_') && config[key].value === true)
      .map(key => config[key].sourceNodeId);
    
    console.log(`Condition node ${conditionNode.data.label}:`, {
      checkedSources: checkedSources.length,
      checkedSourceIds: checkedSources
    });
    
    if (checkedSources.length === 0) {
      console.log(`Condition node ${conditionNode.data.label} has no checked sources - passes automatically`);
      continue;
    }
    
    const anyCheckedFailed = checkedSources.some(sourceId => 
      executionState.failedNodes.includes(sourceId)
    );
    
    if (anyCheckedFailed) {
      console.log(`Condition node ${conditionNode.data.label} - required sources failed`);
      return false;
    }
    
    const allCheckedCompleted = checkedSources.every(sourceId => 
      executionState.completedNodes.includes(sourceId)
    );
    
    if (!allCheckedCompleted) {
      const completedSources = checkedSources.filter(sourceId => 
        executionState.completedNodes.includes(sourceId)
      );
      console.log(`Condition node ${conditionNode.data.label} - waiting for CHECKED sources: ${completedSources.length}/${checkedSources.length} completed`);
      return false;
    }
    
    console.log(`Condition node ${conditionNode.data.label} - all CHECKED sources completed`);
    
    if (!executionState.completedNodes.includes(conditionNode.id)) {
      console.log(`Condition node ${conditionNode.data.label} ready to execute`);
      return false;
    }
    
    console.log(`Condition node ${conditionNode.data.label} completed`);
  }
  
  const outputNodes = nodes.filter(node => node.type === 'output');
  const allOutputsCompleted = outputNodes.every(outputNode => 
    executionState.completedNodes.includes(outputNode.id)
  );
  
  if (allOutputsCompleted) {
    console.log('All condition requirements satisfied and output nodes completed - flow can finish');
    return true;
  }
  
  console.log('Condition requirements satisfied but output nodes not completed yet');
  return false;
}, [nodes, executionState.completedNodes, executionState.failedNodes, executionState.currentNodes]);


const stopAllActiveExecutions = useCallback(() => {
  console.log('Stopping all active executions for early completion');
  
  setNodes(nds => nds.map(n => {
    if (executionState.currentNodes.includes(n.id)) {
      return {
        ...n,
        style: { 
          ...n.style, 
          backgroundColor: '#ff9800', 
          border: '2px solid #f57c00',
          opacity: 0.7
        }
      };
    }
    return n;
  }));
}, [executionState.currentNodes, setNodes]);


  const executeConditionNode = async (node) => {
  const { config } = node.data;
  
  if (!config) {
    console.log(`Condition node ${node.data.label} has no config - passing through`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return;
  }
  
  const sourceConfigs = Object.keys(config)
    .filter(key => key.startsWith('source_'))
    .map(key => ({
      key,
      sourceNodeId: config[key].sourceNodeId,
      isChecked: config[key].value === true
    }));
  
  const checkedSources = sourceConfigs
    .filter(source => source.isChecked)
    .map(source => source.sourceNodeId);
  
  console.log(`Condition node ${node.data.label} analysis:`);
  console.log('- All sources:', sourceConfigs.map(s => ({id: s.sourceNodeId, checked: s.isChecked})));
  console.log('- Checked sources (must complete):', checkedSources);
  
  if (checkedSources.length === 0) {
    console.log('No sources checked - condition node passes immediately');
    await new Promise(resolve => setTimeout(resolve, 100));
    return;
  }
  
  console.log(`Waiting for ${checkedSources.length} checked source(s) to complete...`);
  
  let attempts = 0;
  const maxAttempts = 6000; 
  const checkInterval = 100; 
  
  while (attempts < maxAttempts) {
    if (!isRunningRef.current) {
      throw new Error('Execution was stopped by user');
    }
    
    const currentCompleted = completionStateRef.current.completedNodes;
    const currentFailed = completionStateRef.current.failedNodes;
    
    const failedSources = checkedSources.filter(sourceId => 
      currentFailed.includes(sourceId)
    );
    
    if (failedSources.length > 0) {
      throw new Error(`Required source node(s) failed: ${failedSources.join(', ')}`);
    }
    
    const completedSources = checkedSources.filter(sourceId => 
      currentCompleted.includes(sourceId)
    );
    
    const allCheckedSourcesCompleted = completedSources.length === checkedSources.length;
    
    if (allCheckedSourcesCompleted) {
      console.log(`All ${checkedSources.length} checked source nodes completed - condition satisfied!`);
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    attempts++;
    
    if (attempts % 50 === 0 && attempts > 0) {
      console.log(`Condition ${node.data.label} waiting: ${completedSources.length}/${checkedSources.length} sources completed`);
      console.log('Completed sources:', completedSources);
      console.log('Still waiting for:', checkedSources.filter(id => !currentCompleted.includes(id)));
    }
  }
  
  if (attempts >= maxAttempts) {
    const incompleteSources = checkedSources.filter(sourceId => 
      !completionStateRef.current.completedNodes.includes(sourceId)
    );
    throw new Error(`Timeout waiting for checked source nodes: ${incompleteSources.join(', ')}`);
  }
  
  console.log(`Condition node ${node.data.label} satisfied - proceeding to next nodes`);
};
  

  const generatePathId = () => {
    return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const traverseFlow = async (startNodeId, pathId = null) => {
  if (!pathId) {
    pathId = generatePathId();
    updateExecutionState(prev => ({
      ...prev,
      activePaths: new Set([...prev.activePaths, pathId])
    }));
  }

  const startNode = nodes.find(node => node.id === startNodeId);
  if (!startNode) {
    console.error(`Node with id ${startNodeId} not found`);
    return;
  }

  try {
    console.log(`Starting execution of node ${startNode.data.label} in path ${pathId}`);

    
    await executeNode(startNode, pathId);
    
    // if (executionState.shouldCompleteEarly) {
    //   console.log(`Early completion detected - stopping path ${pathId}`);
    //   updateExecutionState(prev => ({
    //     ...prev,
    //     activePaths: new Set([...prev.activePaths].filter(p => p !== pathId))
    //   }));
    //   return 'EARLY_COMPLETE';
    // }
    
    const nextNodes = getNextNodes(startNodeId);
    
    if (nextNodes.length === 0) {
      console.log(`Path ${pathId} completed - no more nodes from ${startNode.data.label}`);
      updateExecutionState(prev => ({
        ...prev,
        activePaths: new Set([...prev.activePaths].filter(p => p !== pathId))
      }));
      return;
    }

    if (nextNodes.length === 1) {
      const nextNode = nextNodes[0];
      console.log(`Continuing to single next node: ${nextNode.data.label}`);
      const result = await traverseFlow(nextNode.id, pathId);
      if (result === 'EARLY_COMPLETE') {
        return 'EARLY_COMPLETE';
      }
    } else {
      console.log(`Branching into ${nextNodes.length} paths from ${startNode.data.label}`);
      
      const branchPromises = nextNodes.map(async (nextNode, index) => {
        const branchPathId = `${pathId}_branch_${index}`;
        updateExecutionState(prev => ({
          ...prev,
          activePaths: new Set([...prev.activePaths, branchPathId])
        }));
        
        try {
          const result = await traverseFlow(nextNode.id, branchPathId);
          console.log(`Branch ${index} to ${nextNode.data.label} completed`);
          return result;
        } catch (error) {
          console.error(`Branch ${index} to ${nextNode.data.label} failed:`, error);
          throw error;
        }
      });

      const results = await Promise.allSettled(branchPromises);
      
      const hasEarlyComplete = results.some(result => 
        result.status === 'fulfilled' && result.value === 'EARLY_COMPLETE'
      );
      
      if (hasEarlyComplete) {
        console.log('Early completion detected in branch');
        updateExecutionState(prev => ({
          ...prev,
          activePaths: new Set([...prev.activePaths].filter(p => p !== pathId))
        }));
        return 'EARLY_COMPLETE';
      }
      
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error(`${failures.length} branch(es) failed:`, failures);
        failures.forEach((failure, index) => {
          console.error(`Branch ${index} failure:`, failure.reason);
        });
      }
      
      updateExecutionState(prev => ({
        ...prev,
        activePaths: new Set([...prev.activePaths].filter(p => p !== pathId))
      }));
    }
    
  } catch (error) {
    console.error(`Flow traversal error in path ${pathId}:`, error);
    updateExecutionState(prev => ({
      ...prev,
      activePaths: new Set([...prev.activePaths].filter(p => p !== pathId))
    }));
    throw error;
  }
};

  const handleStartExecution = async () => {
  setisStart(true);
  isRunningRef.current = true;
  
  completionStateRef.current = { completedNodes: [], failedNodes: [] };
  
  setExecutionState({
    isRunning: true,
    currentNodes: [],
    completedNodes: [],
    failedNodes: [],
    executionLog: [{
      type: 'info',
      message: 'Flow execution started',
      timestamp: new Date()
    }],
    startTime: new Date(),
    activePaths: new Set(),
    shouldStop: false,
    globalError: null,
    shouldCompleteEarly: false,
    earlyCompletionReason: null
  });

  setNodes(nds => nds.map(n => ({
    ...n,
    style: { ...n.style, backgroundColor: undefined, border: undefined }
  })));

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const startNode = nodes.find(node => node.type === 'input');
    if (!startNode) {
      throw new Error('No start node found');
    }

    console.log('Starting traversal from node:', startNode.id);
    await traverseFlow(startNode.id);
    
    console.log('Flow execution completed normally');
    updateExecutionState(prev => ({
      ...prev,
      isRunning: false,
      executionLog: [...prev.executionLog, {
        type: 'success',
        message: 'Flow execution completed successfully',
        timestamp: new Date(),
        duration: new Date() - prev.startTime
      }]
    }));
    
    alert('Flow execution completed successfully!');

  } catch (error) {
    console.error('Flow execution failed:', error);
    
    if (error.message.includes('stopped by user')) {
      console.log('Flow stopped by user');
    } else {
      alert(`Flow execution failed: ${error.message}`);
    }
  } finally {
    setisStart(false);
    isRunningRef.current = false;
    
    updateExecutionState(prev => ({
      ...prev,
      isRunning: false,
      shouldStop: true
    }));
  }
};

  const resetFlowState = useCallback(() => {
  setisStart(false);
  isRunningRef.current = false;
  
  setExecutionState(prev => ({
    ...prev,
    isRunning: false,
    currentNodes: [],
    completedNodes: [],
    failedNodes: [],
    shouldStop: true,
    activePaths: new Set()
  }));
  
  setNodes(nds => nds.map(n => ({
    ...n,
    style: { ...n.style, backgroundColor: undefined, border: undefined }
  })));
}, [setNodes]);



  const handleStopExecution = () => {
  resetFlowState();
  
  updateExecutionState(prev => ({
    ...prev,
    executionLog: [...prev.executionLog, {
      type: 'warning',
      message: 'Flow execution stopped by user',
      timestamp: new Date()
    }]
  }));

  console.log('Flow execution stopped by user');
};

  const onNodeClick = (e, clickedNode) => {
    if (clickedNode.data.deviceType === 'delay') {
      setSelectedNode(clickedNode);
    } else if (!(clickedNode.type === 'input' || clickedNode.type === 'output')) {
      setSelectedNode(clickedNode);
    }
  };


  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: newData }
          : node
      )
    );
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
  const config = JSON.parse(event.dataTransfer.getData('application/config') || '{}');
  const deviceDataStr = event.dataTransfer.getData('application/deviceData');
  const deviceData = deviceDataStr ? JSON.parse(deviceDataStr) : null;
  const uniqueId = event.dataTransfer.getData('application/uniqueId');
  const deviceId = event.dataTransfer.getData('application/deviceId');

  if (typeof type === 'undefined' || !type) return;

  const position = rfInstance.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  });
  
  const newNodeId = getId(nodes); 

  const newNode = {
    id: newNodeId, 
    type: 'default',
    position,
    data: { 
      label: label || `${type} node`,
      deviceType: type === 'device' ? 
        (deviceData?.node_type || 'device') : 
        type,
      config: config,
      uniqueId: uniqueId, 
      originalDeviceId: deviceId,
      deviceData: deviceData
    },
  };

  setNodes((nds) => nds.concat(newNode));
}, [rfInstance, isEditable, setNodes, nodes]); 


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
    setIsCreatingNew(false);
    setIsEditable(false);
    
    if (response.data.nodes && response.data.nodes.length > 0) {
      const maxId = response.data.nodes.reduce((max, node) => {
        const match = node.id.match(/^N?(\d+)$/);
        if (match) {
          const nodeNum = parseInt(match[1], 10);
          return Math.max(max, nodeNum);
        }
        return max;
      }, 2); 
      
      idnumber = maxId;
    }
    
    if (response.data.viewport && rfInstance) {
      rfInstance.setViewport(response.data.viewport);
    }
    
   } catch (error) {
  console.error('Load error details:', error.response?.data);
}
}, [rfInstance, setNodes, setEdges, setCurrentScenarioName, setIsEditable]);

  useEffect(() => {
    if (!hasInitialized) {
      if (scenarioToLoad) {
        loadFlowFromBackend(scenarioToLoad);
        setIsEditable(false);
        setIsCreatingNew(false);
      } else {
        setIsEditable(true);
        setIsCreatingNew(true);
        setNodes(initialNodes);
        setEdges([]);
        setCurrentScenarioName('');
      }
      setHasInitialized(true);
    }
  }, [scenarioToLoad, hasInitialized, loadFlowFromBackend, setIsEditable, setIsCreatingNew, setNodes, setEdges, setCurrentScenarioName]);

useEffect(() => {
  if (hasInitialized && scenarioToLoad) {
    loadFlowFromBackend(scenarioToLoad);
  }
}, [scenarioToLoad, hasInitialized, loadFlowFromBackend]);

  useEffect(() => {
  completionStateRef.current = {
    completedNodes: executionState.completedNodes,
    failedNodes: executionState.failedNodes
  };
  
  if (executionState.isRunning && 
      !executionState.shouldCompleteEarly && 
      !executionState.shouldStop) {
    
    const shouldComplete = checkForFlowCompletion();
    
    if (shouldComplete) {
      console.log('AUTOMATIC FLOW COMPLETION DETECTED - Stopping execution');
      
      const hasConditionNodes = nodes.some(node => node.data.deviceType === 'condition');
      
      if (hasConditionNodes) {
        stopAllActiveExecutions();
      }
      
      updateExecutionState(prev => ({
        ...prev,
        isRunning: false,
        shouldStop: true,
        shouldCompleteEarly: false, 
        currentNodes: hasConditionNodes ? [] : prev.currentNodes,
        activePaths: hasConditionNodes ? new Set() : prev.activePaths,
        earlyCompletionReason: hasConditionNodes ? 'Condition-based completion' : 'Full flow completion',
        executionLog: [...prev.executionLog, {
          type: 'success',
          message: `Flow execution completed successfully (${hasConditionNodes ? 'Condition-based' : 'Full flow'})`,
          timestamp: new Date(),
          duration: new Date() - prev.startTime
        }]
      }));
      
      setisStart(false);
      isRunningRef.current = false;
      
      setTimeout(() => {
        alert(`Flow execution completed successfully! ${hasConditionNodes ? 'Condition requirements satisfied.' : 'All devices completed.'}`);
      }, 300);
    }
  }
}, [
  executionState.completedNodes, 
  executionState.failedNodes, 
  executionState.isRunning, 
  executionState.shouldCompleteEarly,
  executionState.shouldStop,
  checkForFlowCompletion, 
  updateExecutionState,
  stopAllActiveExecutions,
  nodes
]);

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
          {!isEditable && !executionState.isRunning && (
            <button 
              className={styles.theme__button} 
              onClick={handleStartExecution}
            >
              START
            </button>
          )}

          {!isEditable && executionState.isRunning && (
            <button 
              className={`${styles.theme__button} ${styles.stopButton}`} 
              onClick={handleStopExecution}
            >
              STOP
            </button>
          )}

          {!isEditable && executionState.isRunning && (
            <button className={styles.theme__button}>
              SKIP
            </button>
          )}
          
          {!isEditable && executionState.isRunning && (
            <button className={styles.theme__button}>
              PAUSE
            </button>
          )}

          {isEditable && !IsCreatingNew && (
            <button className={styles.theme__button} onClick={handleSaveAsAndStayEditable}>
              SAVE AS
            </button>
          )}

          {!isEditable && !executionState.isRunning && (
          <button className={styles.theme__button} onClick={handleEdit}>
            EDIT
          </button>
          )}

          {isEditable && (
            <button className={styles.theme__button} onClick={handleSave}>
              SAVE 
            </button>
          )}

          {!isEditable && !executionState.isRunning && (
          <button className={styles.theme__button} onClick={handledeleteScenario}>
            DELETE
          </button>
          )}
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
          <Sidebar 
            onLoadScenario={handleLoadScenario} 
            existingNodes={nodes}
          />
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