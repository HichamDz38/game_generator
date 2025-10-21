import { useCallback, useEffect, useState, useRef } from 'react';
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
  // delay: DelayNode, // Removed - component not available
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

const generateUniqueNodeId = (existingNodes = []) => {
  const usedIds = new Set(existingNodes.map(node => node.id));
  let newId;
  let counter = 1;
  
  do {
    newId = `N${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${counter++}`;
  } while (usedIds.has(newId));
  
  return newId;
};

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
  const [isPaused, setIsPaused] = useState(false);


  const customOnNodesChange = useCallback((changes) => {
  const filteredChanges = changes.filter(change => {
    if (change.type === 'remove') {
      const nodeToRemove = nodes.find(node => node.id === change.id);
      
      if (nodeToRemove && selectedNode && selectedNode.id === change.id) {
        setSelectedNode(null);
      }
      
      if (nodeToRemove && (nodeToRemove.type === 'input' || nodeToRemove.type === 'output')) {
        console.log('Cannot delete input or output nodes');
        return false;
      }
    }
    return true;
  });
  
  if (filteredChanges.length > 0) {
    onNodesChange(filteredChanges);
  }
}, [nodes, onNodesChange, selectedNode, setSelectedNode]);

  const customOnEdgesChange = useCallback((changes) => {
    if (!isEditable) {
      return;
    }
    onEdgesChange(changes);
  }, [isEditable, onEdgesChange]);


  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isEditable && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditable]);

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
  earlyCompletionReason: null,
  activeNodesByPath: {} // Track which nodes are actively executing on each path
});

const isRunningRef = useRef(false);
const isPausedRef = useRef(false);
const executionStateRef = useRef(executionState);


  useEffect(() => {
  isPausedRef.current = isPaused;
}, [isPaused]);

  useEffect(() => {
    executionStateRef.current = executionState;
  }, [executionState]);

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
      if (configObj && typeof configObj === 'object') {
        if ('value' in configObj) {
          transformedConfig[key] = configObj.value;
        } else {
          transformedConfig[key] = "null";
        }
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

  if (isPausedRef.current) {
    console.log(`[${pathId}] Execution paused - waiting to resume`);
    
    while (isPausedRef.current && isRunningRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!isRunningRef.current) {
        throw new Error('Execution was stopped while paused');
      }
    }
    
    if (!isRunningRef.current) {
      throw new Error('Execution was stopped');
    }
    
    console.log(`[${pathId}] Execution resumed - continuing`);
  }
  
  updateExecutionState(prev => {
    const newActiveNodesByPath = { ...prev.activeNodesByPath };
    if (pathId) {
      if (!newActiveNodesByPath[pathId]) {
        newActiveNodesByPath[pathId] = [];
      }
      // Only track device nodes (not virtual or condition nodes)
      if (node.data.deviceType === 'device') {
        newActiveNodesByPath[pathId] = [...newActiveNodesByPath[pathId], node.id];
      }
    }
    
    return {
      ...prev,
      currentNodes: [...prev.currentNodes, node.id],
      activeNodesByPath: newActiveNodesByPath
    };
  });
  
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
      case 'condition':
        await executeConditionNode(node, pathId);
        break;
      case 'delay':
        // Timer node - wait for specified seconds then complete
        const delaySeconds = node.data.config?.delaySeconds?.value || node.data.config?.delaySeconds || 3;
        console.log(`[${pathId}] Timer node ${node.data.label} waiting for ${delaySeconds} seconds`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        console.log(`[${pathId}] Timer node ${node.data.label} completed after ${delaySeconds} seconds`);
        break;
      case 'input':
      case 'output':
        await new Promise(resolve => setTimeout(resolve, 500));
        break;
      default:
        console.warn(`Unknown node type: ${node.data.deviceType || node.type}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await new Promise(resolve => setTimeout(resolve, 50));
    
    updateExecutionState(prev => {
      const newCompletedNodes = [...prev.completedNodes];
      if (!newCompletedNodes.includes(node.id)) {
        newCompletedNodes.push(node.id);
      }
      
      const newCurrentNodes = prev.currentNodes.filter(id => id !== node.id);
      
      // Remove from activeNodesByPath tracking
      const newActiveNodesByPath = { ...prev.activeNodesByPath };
      if (pathId && newActiveNodesByPath[pathId]) {
        newActiveNodesByPath[pathId] = newActiveNodesByPath[pathId].filter(id => id !== node.id);
      }
      
      const newState = {
        completedNodes: newCompletedNodes,
        failedNodes: prev.failedNodes
      };
      
      completionStateRef.current = newState;
      
      console.log(`[${pathId}] Node ${node.data.label} marked as completed. Total completed: ${newCompletedNodes.length}`);
      
      return {
        ...prev,
        completedNodes: newCompletedNodes,
        currentNodes: newCurrentNodes,
        activeNodesByPath: newActiveNodesByPath,
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
      const newFailedNodes = [...prev.failedNodes];
      if (!newFailedNodes.includes(node.id)) {
        newFailedNodes.push(node.id);
      }
      
      const newCurrentNodes = prev.currentNodes.filter(id => id !== node.id);
      
      const newState = {
        completedNodes: prev.completedNodes,
        failedNodes: newFailedNodes
      };
      
      completionStateRef.current = newState;
      
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

      const cleanedConfig = {};
      for (const [key, value] of Object.entries(transformedConfig)) {
        if (value === undefined) {
          cleanedConfig[key] = "null"; 
        } else {
          cleanedConfig[key] = value; 
        }
      }
      
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
      const pollInterval = 1000;
      
      // Wait indefinitely until device reports final status (completed/failed/cancelled)
      while (status === 'started' || status === 'in progress') {
        if (!isRunningRef.current) {
          console.log('Execution was stopped by user - breaking polling loop');
          throw new Error('Execution was stopped by user');
        }

        if (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/get_status/${node.id}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            status = statusData.status;
            
            console.log(`Device ${node.id} status: ${status}`);
            
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
              throw new Error('Device execution failed');
            } else if (status === 'cancelled') {
              throw new Error('Device execution was cancelled');
            }
          }
        } catch (statusError) {
          if (statusError.message === 'Device execution failed' || statusError.message === 'Device execution was cancelled') {
            throw statusError; 
          }
          console.warn(`Status check failed for device ${originalDeviceId}:`, statusError);
        }
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

  const getNextNodes = useCallback((currentNodeId) => {
  const nextEdges = edges.filter(edge => edge.source === currentNodeId);
  return nextEdges.map(edge => nodes.find(node => node.id === edge.target)).filter(Boolean);
}, [edges, nodes]);

const checkConditionNodeLogic = useCallback((
  conditionNode, 
  completedNodes, 
  failedNodes,
  allNodes,
  allEdges
) => {
  const { config } = conditionNode.data;
  const logicType = (config.logicType?.value || 'AND').toString().toUpperCase();
  
  const connectedSourceIds = allEdges
    .filter(edge => edge.target === conditionNode.id)
    .map(edge => edge.source)
    .filter(sourceId => {
      const sourceNode = allNodes.find(n => n.id === sourceId);
      return sourceNode && sourceNode.type !== 'input';
    });
  
  const checkedSources = Object.entries(config)
    .filter(([key, configItem]) => {
      return key.startsWith('source_') && 
             (configItem.value === true || configItem.value === 'true' || configItem.checked === true);
    })
    .map(([key, configItem]) => configItem.sourceNodeId)
    .filter(sourceId => connectedSourceIds.includes(sourceId));
  
  const sourcesToMonitor = checkedSources.length === 0 ? connectedSourceIds : checkedSources;
  
  if (logicType === 'AND') {
    return sourcesToMonitor.every(sourceId => completedNodes.includes(sourceId));
  } else {
    return sourcesToMonitor.some(sourceId => completedNodes.includes(sourceId));
  }
}, []);

const canReachOutputFromStart = useCallback((
  outputNodeId, 
  conditionNodes, 
  completedNodes, 
  failedNodes,
  allNodes,
  allEdges
) => {
  const startNode = allNodes.find(node => node.type === 'input');
  if (!startNode) return false;
  
  const visited = new Set();
  const queue = [startNode.id];
  
  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    
    if (visited.has(currentNodeId)) continue;
    visited.add(currentNodeId);
    
    if (currentNodeId === outputNodeId) {
      return true;
    }
    
    const currentNode = allNodes.find(node => node.id === currentNodeId);
    
    if (failedNodes.includes(currentNodeId)) {
      continue;
    }
    
    if (currentNode.data.deviceType === 'condition') {
      if (!completedNodes.includes(currentNodeId)) {
        continue;
      }
      
      const canProceed = checkConditionNodeLogic(currentNode, completedNodes, failedNodes, allNodes, allEdges);
      if (!canProceed) {
        continue;
      }
    }
    
    const nextEdges = allEdges.filter(edge => edge.source === currentNodeId);
    const nextNodes = nextEdges.map(edge => allNodes.find(node => node.id === edge.target)).filter(Boolean);
    
    nextNodes.forEach(nextNode => {
      if (!visited.has(nextNode.id)) {
        queue.push(nextNode.id);
      }
    });
  }
  
  return false;
}, [checkConditionNodeLogic]);

const canFlowCompleteBasedOnConditions = useCallback((
  conditionNodes, 
  completedNodes, 
  failedNodes,
  allNodes,
  allEdges
) => {
  const outputNodes = allNodes.filter(node => node.type === 'output');
  
  return outputNodes.some(outputNode => {
    return canReachOutputFromStart(outputNode.id, conditionNodes, completedNodes, failedNodes, allNodes, allEdges);
  });
}, [canReachOutputFromStart]);

const checkForFlowCompletion = useCallback(() => {
  const conditionNodes = nodes.filter(node => node.data.deviceType === 'condition');
  const outputNodes = nodes.filter(node => node.type === 'output');
  
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
  
  console.log('Condition nodes found - checking condition-based completion');
  
  const anyOutputCompleted = outputNodes.some(outputNode => 
    executionState.completedNodes.includes(outputNode.id)
  );
  
  if (anyOutputCompleted) {
    console.log('Output node reached - flow can complete');
    return true;
  }
  
  const allConditionNodesResolved = conditionNodes.every(conditionNode => 
    executionState.completedNodes.includes(conditionNode.id) || 
    executionState.failedNodes.includes(conditionNode.id)
  );
  
  if (!allConditionNodesResolved) {
    console.log('Not all condition nodes have resolved yet');
    return false;
  }
  
  const canFlowComplete = canFlowCompleteBasedOnConditions(
    conditionNodes, 
    executionState.completedNodes, 
    executionState.failedNodes,
    nodes,
    edges
  );
  
  console.log('Flow completion based on conditions:', canFlowComplete);
  return canFlowComplete;
}, [nodes, edges, executionState.completedNodes, executionState.failedNodes, executionState.currentNodes,canFlowCompleteBasedOnConditions]);






const stopAllActiveExecutions = useCallback(async (excludePaths = []) => {
  console.log('Stopping all active executions on non-excluded paths');
  
  // Get all actively executing device nodes that are NOT on excluded paths
  const nodesToStop = [];
  const activeNodesByPath = executionStateRef.current.activeNodesByPath || {};
  
  for (const [pathId, nodeIds] of Object.entries(activeNodesByPath)) {
    if (!excludePaths.includes(pathId)) {
      nodesToStop.push(...nodeIds);
    }
  }
  
  if (nodesToStop.length === 0) {
    console.log('No active devices to stop');
    return;
  }
  
  console.log(`Stopping ${nodesToStop.length} device nodes:`, nodesToStop);
  
  // Send stop commands to all devices and wait for confirmation
  const stopPromises = nodesToStop.map(async (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.data.originalDeviceId) {
      try {
        console.log(`Sending stop command to device ${node.data.originalDeviceId} (node: ${node.data.label})`);
        
        // Send stop command
        const response = await fetch(`${API_BASE_URL}/stop/${node.data.originalDeviceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: node.id })
        });
        
        if (!response.ok) {
          console.warn(`Failed to send stop command to device ${node.data.originalDeviceId}:`, response.statusText);
          return { nodeId, success: false };
        }
        
        console.log(`Stop command sent to device ${node.data.originalDeviceId}, waiting for confirmation...`);
        
        // Poll for status confirmation - wait indefinitely until device responds
        const pollInterval = 1000;
        let status = 'in progress';
        
        // Wait indefinitely until device confirms with final status
        while (status === 'in progress' || status === 'started') {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          try {
            const statusResponse = await fetch(`${API_BASE_URL}/get_status/${node.id}`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              status = statusData.status;
              
              if (status === 'cancelled' || status === 'completed' || status === 'failed') {
                console.log(`Device ${node.data.originalDeviceId} confirmed status: ${status}`);
                return { nodeId, success: true, status };
              }
            }
          } catch (statusError) {
            console.warn(`Status check failed for device ${node.data.originalDeviceId}:`, statusError);
            // On communication failure, mark as failed
            return { nodeId, success: false, error: statusError, communicationFailed: true };
          }
        }
        
        return { nodeId, success: true, status };
        
      } catch (error) {
        console.error(`Error stopping device ${node.data.originalDeviceId}:`, error);
        return { nodeId, success: false, error };
      }
    }
    return { nodeId, success: false };
  });
  
  const results = await Promise.allSettled(stopPromises);
  
  // Update UI to show cancelled nodes
  setNodes(nds => nds.map(n => {
    if (nodesToStop.includes(n.id)) {
      const result = results.find(r => r.status === 'fulfilled' && r.value.nodeId === n.id);
      const success = result?.status === 'fulfilled' && result?.value?.success;
      
      return {
        ...n,
        style: { 
          ...n.style, 
          backgroundColor: success ? '#ff9800' : '#f44336', 
          border: success ? '2px solid #f57c00' : '2px solid #d32f2f',
          opacity: 0.7
        }
      };
    }
    return n;
  }));
  
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  console.log(`Successfully stopped ${successCount} of ${nodesToStop.length} devices`);
}, [nodes, setNodes]);

// Function to stop/clear all connected devices via backend broadcast
const stopAllDevices = useCallback(async () => {
  console.log('Broadcasting stop command to all connected devices...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/stop_all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.error('Failed to broadcast stop command to devices');
      return;
    }
    
    const result = await response.json();
    console.log(`Stop command broadcasted: ${result.message}`);
    
  } catch (error) {
    console.error('Error broadcasting stop to all devices:', error);
  }
}, []);

// Helper function to check if a node is downstream from specific source nodes
const isDownstreamFrom = (targetNodeId, sourceNodeIds, edges, nodes) => {
  const visited = new Set();
  const queue = [targetNodeId];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    // Check if we've reached one of the source nodes
    if (sourceNodeIds.includes(currentId)) {
      return true;
    }
    
    // Find all nodes that connect TO the current node (going backwards/upstream)
    const incomingEdges = edges.filter(edge => edge.target === currentId);
    for (const edge of incomingEdges) {
      if (!visited.has(edge.source)) {
        queue.push(edge.source);
      }
    }
  }
  
  return false;
};

const executeConditionNode = async (node, pathId = null) => {
  const { config } = node.data;
  
  let logicType = (config.logicType?.value || 'AND').toString().toUpperCase();
  
  if (!['AND', 'OR'].includes(logicType)) {
    console.warn(`Invalid logic type "${logicType}", defaulting to AND`);
    logicType = 'AND';
  }
  
  const connectedSourceIds = edges
    .filter(edge => edge.target === node.id)
    .map(edge => edge.source)
    .filter(sourceId => {
      const sourceNode = nodes.find(n => n.id === sourceId);
      return sourceNode && sourceNode.type !== 'input'; 
    });
  
  const allConnectedSources = connectedSourceIds.map(sourceId => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    return {
      nodeId: sourceId,
      label: sourceNode?.data?.label || `Node ${sourceId}`
    };
  });
  
  const checkedSources = Object.entries(config)
    .filter(([key, configItem]) => {
      return key.startsWith('source_') && 
             (configItem.value === true || configItem.value === 'true' || configItem.checked === true);
    })
    .map(([key, configItem]) => ({
      nodeId: configItem.sourceNodeId,
      label: configItem.sourceNodeLabel || configItem.label || `Node ${configItem.sourceNodeId}`
    }))
    .filter(source => connectedSourceIds.includes(source.nodeId));

  console.log(`[${pathId}] Condition node ${node.data.label} analysis:`, {
    logicType,
    allConnectedSources: allConnectedSources.map(s => s.label),
    checkedSources: checkedSources.map(s => s.label),
    totalConnected: allConnectedSources.length,
    totalChecked: checkedSources.length
  });

  if (allConnectedSources.length === 0) {
    console.log(`[${pathId}] No sources connected - condition node passes immediately`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return;
  }

  let sourcesToMonitor;
  let conditionDescription;
  
  if (checkedSources.length === 0) {
    sourcesToMonitor = allConnectedSources;
    conditionDescription = `all ${allConnectedSources.length} connected sources (none checked)`;
  } else {
    sourcesToMonitor = checkedSources;
    conditionDescription = `${checkedSources.length} checked source(s)`;
  }

  console.log(`[${pathId}] Condition node using ${logicType} logic - monitoring ${conditionDescription}`);
  console.log(`[${pathId}] Monitoring sources: ${sourcesToMonitor.map(s => s.label).join(', ')}`);

  const checkInterval = 100;
  let lastLogTime = 0;

  // Wait indefinitely until condition is satisfied (no timeout)
  while (true) {
    if (!isRunningRef.current) {
      throw new Error('Execution was stopped by user');
    }

    if (isPausedRef.current) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      continue;
    }
    
    const currentCompleted = [...completionStateRef.current.completedNodes];
    const currentFailed = [...completionStateRef.current.failedNodes];
    
    const completedMonitored = sourcesToMonitor.filter(source => 
      currentCompleted.includes(source.nodeId)
    );
    
    const failedMonitored = sourcesToMonitor.filter(source => 
      currentFailed.includes(source.nodeId)
    );
    
    const pendingMonitored = sourcesToMonitor.filter(source => 
      !currentCompleted.includes(source.nodeId) && 
      !currentFailed.includes(source.nodeId)
    );

    let conditionMet = false;
    let shouldFail = false;
    let failureReason = '';

    if (logicType === 'AND') {
      if (failedMonitored.length > 0) {
        shouldFail = true;
        failureReason = `AND condition failed - source(s) failed: ${failedMonitored.map(s => s.label).join(', ')}`;
      } else if (completedMonitored.length === sourcesToMonitor.length) {
        conditionMet = true;
      }
    } else if (logicType === 'OR') {
      if (completedMonitored.length > 0) {
        conditionMet = true;
      } else if (failedMonitored.length === sourcesToMonitor.length) {
        shouldFail = true;
        failureReason = `OR condition failed - all monitored source nodes failed: ${failedMonitored.map(s => s.label).join(', ')}`;
      }
    }

    if (shouldFail) {
      console.error(`[${pathId}] ${failureReason}`);
      throw new Error(failureReason);
    }
    
    if (conditionMet) {
      let successMessage;
      if (logicType === 'AND') {
        successMessage = `AND condition satisfied - all ${sourcesToMonitor.length} monitored sources completed`;
      } else {
        successMessage = `OR condition satisfied - ${completedMonitored.length} of ${sourcesToMonitor.length} monitored sources completed`;
        
        // For OR condition: stop actively executing devices that are downstream from pending (incomplete) sources
        console.log(`[${pathId}] OR condition met - stopping devices on other parallel source paths`);
        
        // Find source nodes that are still pending (not completed and not failed)
        const pendingSourceNodeIds = sourcesToMonitor
          .filter(source => !currentCompleted.includes(source.nodeId) && !currentFailed.includes(source.nodeId))
          .map(source => source.nodeId);
        
        if (pendingSourceNodeIds.length > 0) {
          console.log(`[${pathId}] Pending source nodes:`, pendingSourceNodeIds);
          
          // Get all currently active devices
          const activeNodesByPath = executionStateRef.current.activeNodesByPath || {};
          const allActiveNodes = [];
          for (const [path, nodeIds] of Object.entries(activeNodesByPath)) {
            allActiveNodes.push(...nodeIds);
          }
          
          // Filter active nodes to find those downstream from pending sources
          const nodesToStop = allActiveNodes.filter(activeNodeId => 
            isDownstreamFrom(activeNodeId, pendingSourceNodeIds, edges, nodes)
          );
          
          if (nodesToStop.length > 0) {
            console.log(`[${pathId}] Stopping ${nodesToStop.length} active devices from pending branches:`, nodesToStop);
            
            // Stop each device
            const stopPromises = nodesToStop.map(async (nodeId) => {
              const node = nodes.find(n => n.id === nodeId);
              if (node && node.data.originalDeviceId) {
                try {
                  console.log(`[${pathId}] Sending stop to device: ${node.data.label}`);
                  
                  const response = await fetch(`${API_BASE_URL}/stop/${node.data.originalDeviceId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodeId: node.id })
                  });
                  
                  if (!response.ok) {
                    console.warn(`Failed to stop device ${node.data.originalDeviceId}`);
                    return { nodeId, success: false };
                  }
                  
                  // Wait for status confirmation
                  let status = 'in progress';
                  while (status === 'in progress' || status === 'started') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    try {
                      const statusResponse = await fetch(`${API_BASE_URL}/get_status/${node.id}`);
                      if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        status = statusData.status;
                        
                        if (status === 'cancelled' || status === 'completed' || status === 'failed') {
                          console.log(`Device ${node.data.originalDeviceId} confirmed: ${status}`);
                          return { nodeId, success: true, status };
                        }
                      }
                    } catch (error) {
                      console.warn(`Status check failed for ${node.data.originalDeviceId}:`, error);
                      return { nodeId, success: false, error };
                    }
                  }
                  
                  return { nodeId, success: true, status };
                } catch (error) {
                  console.error(`Error stopping device ${node.data.originalDeviceId}:`, error);
                  return { nodeId, success: false, error };
                }
              }
              return { nodeId, success: false };
            });
            
            await Promise.allSettled(stopPromises);
            
            // Update UI to show cancelled nodes
            setNodes(nds => nds.map(n => {
              if (nodesToStop.includes(n.id)) {
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
          } else {
            console.log(`[${pathId}] No active devices found in pending branches`);
          }
        } else {
          console.log(`[${pathId}] No pending source nodes - all are completed or failed`);
        }
      }
      
      console.log(`[${pathId}] ${successMessage}!`);
      break;
    }

    const now = Date.now();
    if (now - lastLogTime > 5000) {
      console.log(`[${pathId}] Condition ${node.data.label} status - ${logicType} logic, monitoring ${sourcesToMonitor.length} source(s):`, {
        completed: completedMonitored.map(s => s.label),
        failed: failedMonitored.map(s => s.label),
        pending: pendingMonitored.map(s => s.label),
        completedCount: completedMonitored.length,
        requiredForSuccess: logicType === 'AND' ? sourcesToMonitor.length : 1
      });
      lastLogTime = now;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log(`[${pathId}] Condition node ${node.data.label} (${logicType}) satisfied - proceeding to next nodes`);
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
  // Stop all devices before starting
  console.log('Clearing all devices before starting scenario...');
  await stopAllDevices();
  
  setisStart(true);
  isRunningRef.current = true;
  
  completionStateRef.current = { completedNodes: [], failedNodes: [] };
  
  setNodes(nds => nds.map(n => ({
    ...n,
    style: { ...n.style, backgroundColor: undefined, border: undefined }
  })));
  
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

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const startNode = nodes.find(node => node.type === 'input');
    if (!startNode) {
      throw new Error('No start node found');
    }

    console.log('Starting traversal from node:', startNode.id);
    await traverseFlow(startNode.id);
    
    console.log('Flow execution completed normally');
    
    // Stop all devices when scenario completes
    console.log('Stopping all devices after scenario completion...');
    await stopAllDevices();
    
    setNodes(nds => nds.map(n => ({
      ...n,
      style: { ...n.style, backgroundColor: undefined, border: undefined }
    })));
    
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
    
    // Stop all devices when scenario fails or is stopped
    console.log('Stopping all devices after scenario error/stop...');
    await stopAllDevices();
    
    setNodes(nds => nds.map(n => ({
      ...n,
      style: { ...n.style, backgroundColor: undefined, border: undefined }
    })));
    
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
  setIsPaused(false);
  isPausedRef.current = false;
  
  setNodes(nds => nds.map(n => ({
    ...n,
    style: { ...n.style, backgroundColor: undefined, border: undefined }
  })));
  
  setExecutionState(prev => ({
    ...prev,
    isRunning: false,
    currentNodes: [],
    completedNodes: [],
    failedNodes: [],
    shouldStop: true,
    activePaths: new Set()
  }));
}, [setNodes]);



  const handleStopExecution = () => {
  setNodes(nds => nds.map(n => ({
    ...n,
    style: { ...n.style, backgroundColor: undefined, border: undefined }
  })));
  
  setIsPaused(false); 
  isPausedRef.current = false;
  
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

  const handlePauseExecution = async () => {
  if (isPaused) {
    console.log('Resuming execution...');
    setIsPaused(false);
    
    updateExecutionState(prev => ({
      ...prev,
      executionLog: [...prev.executionLog, {
        type: 'info',
        message: 'Execution resumed',
        timestamp: new Date()
      }]
    }));
    
  } else {
    console.log('Pausing execution...');
    setIsPaused(true);
    
    updateExecutionState(prev => ({
      ...prev,
      executionLog: [...prev.executionLog, {
        type: 'warning',
        message: 'Execution paused',
        timestamp: new Date()
      }]
    }));
  }
};


  const onNodeClick = (e, clickedNode) => {
  if (selectedNode && selectedNode.id === clickedNode.id) {
    setSelectedNode(null);
    return;
  }
  
  if (!(clickedNode.type === 'input' || clickedNode.type === 'output')) {
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

  const checkPathExists = (startId, endId, nodes, edges) => {
    const graph = {};
    
    nodes.forEach(node => {
      graph[node.id] = [];
    });

    edges.forEach(edge => {
      if (graph[edge.source]) {
        graph[edge.source].push(edge.target);
      }
    });

    const visited = {};
    const queue = [startId];
    visited[startId] = true;

    while (queue.length > 0) {
      const current = queue.shift();
      
      if (current === endId) {
        return true;
      }

      for (const neighbor of graph[current] || []) {
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          queue.push(neighbor);
        }
      }
    }

    return false;
  };

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
  const deviceId = event.dataTransfer.getData('application/deviceId');

  if (typeof type === 'undefined' || !type) return;

  const position = rfInstance.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  });
  
  const newNodeId = generateUniqueNodeId(nodes);

  let processedConfig = { ...config };
  if (type === 'condition' && config.logicType) {
    processedConfig = {
      ...config,
      logicType: {
        ...config.logicType,
        value: config.logicType.value || 'AND' 
      }
    };
  }

  const newNode = {
    id: newNodeId,
    type: 'default',
    position,
    data: { 
      label: label || `${type} node`,
      deviceType: type === 'device' ? 
        (deviceData?.node_type || 'device') : 
        type,
      config: processedConfig, 
      originalDeviceId: deviceId,
      deviceData: deviceData
    },
  };

  setNodes((nds) => nds.concat(newNode));
}, [rfInstance, isEditable, setNodes, nodes]);


const detectLoops = (nodes, edges) => {
  const graph = {};
  const visited = {};
  const recursionStack = {};
  const loops = [];

  nodes.forEach(node => {
    graph[node.id] = [];
  });

  edges.forEach(edge => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
    }
  });

  const dfs = (nodeId, path) => {
    if (recursionStack[nodeId]) {
      const loopStartIndex = path.indexOf(nodeId);
      if (loopStartIndex !== -1) {
        const loopPath = path.slice(loopStartIndex);
        loops.push([...loopPath, nodeId]);
      }
      return;
    }

    if (visited[nodeId]) {
      return;
    }

    visited[nodeId] = true;
    recursionStack[nodeId] = true;
    path.push(nodeId);

    for (const neighbor of graph[nodeId] || []) {
      dfs(neighbor, path);
    }

    path.pop();
    recursionStack[nodeId] = false;
  };

  Object.keys(graph).forEach(nodeId => {
    visited[nodeId] = false;
    recursionStack[nodeId] = false;
  });

  Object.keys(graph).forEach(nodeId => {
    if (!visited[nodeId]) {
      dfs(nodeId, []);
    }
  });

  return loops;
};


  const validateFlow = () => {
  const errors = [];
  
  if (nodes.length === 0) {
    errors.push("Flow must contain at least one node");
    return { isValid: false, errors };
  }
  
  const inputNodes = nodes.filter(node => node.type === 'input');
  const outputNodes = nodes.filter(node => node.type === 'output');
  
  if (inputNodes.length === 0 || inputNodes.length > 1) {
    errors.push("Flow must have exactly one input node");
  }
  if (outputNodes.length === 0 || outputNodes.length > 1) {
    errors.push("Flow must have exactly one output node");
  }
  
  const detectedLoops = detectLoops(nodes, edges);
  if (detectedLoops.length > 0) {
    errors.push("Circular dependency detected:");
  }
  
  outputNodes.forEach(outputNode => {
    const incomingEdgeCount = edges.filter(edge => edge.target === outputNode.id).length;
    if (incomingEdgeCount !== 1) {
      errors.push(`Output node must have exactly one incoming edge (currently has ${incomingEdgeCount})`);
    }
  });
  
  inputNodes.forEach(inputNode => {
    const hasOutgoingEdge = edges.some(edge => edge.source === inputNode.id);
    if (!hasOutgoingEdge) {
      errors.push(`Input node should have at least one outgoing edge`);
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

  if (isolatedNodes.length > 0) {
    const isolatedLabels = isolatedNodes.map(node => 
      node.data.label || node.id
    ).join(', ');
    errors.push(`Isolated nodes found: ${isolatedLabels}`);
  }
  
  const normalNodes = nodes.filter(node => 
    connectedNodeIds.has(node.id) && 
    node.type !== 'input' && 
    node.type !== 'output'
  );

  normalNodes.forEach(node => {
    const hasIncomingEdge = edges.some(edge => edge.target === node.id);
    const hasOutgoingEdge = edges.some(edge => edge.source === node.id);
    
    if (!hasIncomingEdge) {
      errors.push(`Node "${node.data.label || node.id}" has no incoming edges`);
    }
    if (!hasOutgoingEdge) {
      errors.push(`Node "${node.data.label || node.id}" has no outgoing edges`);
    }
  });
  
  if (inputNodes.length > 0 && outputNodes.length > 0) {
    const hasValidPath = checkPathExists(inputNodes[0].id, outputNodes[0].id, nodes, edges);
    if (!hasValidPath) {
      errors.push("No valid path exists from input to output node");
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
      console.log('FLOW COMPLETION DETECTED - Stopping execution');
      
      stopAllActiveExecutions();
      
      setNodes(nds => nds.map(n => ({
        ...n,
        style: { ...n.style, backgroundColor: undefined, border: undefined }
      })));
      
      updateExecutionState(prev => ({
        ...prev,
        isRunning: false,
        shouldStop: true,
        shouldCompleteEarly: false,
        currentNodes: [],
        activePaths: new Set(),
        earlyCompletionReason: 'Condition-based flow completion',
        executionLog: [...prev.executionLog, {
          type: 'success',
          message: 'Flow execution completed successfully based on condition outcomes',
          timestamp: new Date(),
          duration: new Date() - prev.startTime
        }]
      }));
      
      setisStart(false);
      isRunningRef.current = false;
      
      setTimeout(() => {
        alert('Flow execution completed successfully based on condition outcomes!');
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
  nodes,
  setNodes
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

          {!isEditable && executionState.isRunning && !isPaused &&(
            <button className={styles.theme__button}>
              SKIP
            </button>
          )}
          
          {!isEditable && executionState.isRunning && (
          <button 
            className={styles.theme__button} 
            onClick={handlePauseExecution}
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
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

          {isEditable && !IsCreatingNew &&(
            <button className={styles.theme__button} onClick={handleSave}>
              SAVE 
            </button>
          )}
          {isEditable && IsCreatingNew &&(
            <button className={styles.theme__button_new} onClick={handleSave}>
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
            onNodesChange={isEditable ? customOnNodesChange : undefined}
            onEdgesChange={isEditable ? customOnEdgesChange : undefined}
            onConnect={isEditable ? onConnect : undefined}
            onNodeClick={isEditable ? onNodeClick : undefined}
            onInit={setRfInstance}
            onDrop={isEditable ? onDrop : undefined}
            onDragOver={isEditable ? onDragOver : undefined}
            nodesDraggable={isEditable}
            nodesConnectable={isEditable}
            elementsSelectable={isEditable}
            edgesUpdatable={isEditable}
            edgesFocusable={isEditable}
            nodesFocusable={isEditable}
            panOnDrag={true}
            zoomOnDoubleClick={true}
            selectNodesOnDrag={isEditable}
            deleteKeyCode={isEditable ? 'Delete' : null}
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