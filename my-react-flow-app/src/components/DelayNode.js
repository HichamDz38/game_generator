import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const DelayNode = ({ data, isConnectable, selected }) => {
  const [timeRemaining, setTimeRemaining] = useState(data?.delaySeconds || 0);
  const [isRunning, setIsRunning] = useState(false);
  const [originalDelay, setOriginalDelay] = useState(data?.delaySeconds || 0);

  useEffect(() => {
    if (data?.delaySeconds !== undefined) {
      setOriginalDelay(data.delaySeconds);
      if (!isRunning) {
        setTimeRemaining(data.delaySeconds);
      }
    }
  }, [data?.delaySeconds, isRunning]);

  useEffect(() => {
    if (data?.remainingTime !== undefined) {
      setTimeRemaining(data.remainingTime);
      setIsRunning(data.remainingTime > 0);
    }
  }, [data?.remainingTime]);

  useEffect(() => {
    let intervalId;
    
    if (isRunning && timeRemaining > 0) {
      intervalId = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (isRunning && timeRemaining <= 0) {
      setIsRunning(false);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, timeRemaining]);

  const startDelay = () => {
    if (originalDelay > 0) {
      setTimeRemaining(originalDelay);
      setIsRunning(true);
    }
  };

  const stopDelay = () => {
    setIsRunning(false);
    setTimeRemaining(originalDelay);
  };

  const resetDelay = () => {
    setIsRunning(false);
    setTimeRemaining(originalDelay);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTime = data?.remainingTime !== undefined ? data.remainingTime : timeRemaining;
  const showCountdown = isRunning || data?.remainingTime !== undefined;

  return (
    <div>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      
      <div style={{ 
        textAlign: 'center', 
        padding: '10px',
        minWidth: '120px',
        backgroundColor: data?.remainingTime !== undefined ? '#ffeb3b' : 'white'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          Delay Node
        </div>
        
        {showCountdown && (
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: '#ff5722',
            marginBottom: '5px'
          }}>
            {formatTime(displayTime)}
          </div>
        )}

        {!showCountdown && originalDelay > 0 && (
          <div style={{ 
            fontSize: '14px', 
            color: '#666',
            marginBottom: '5px'
          }}>
            Delay: {formatTime(originalDelay)}
          </div>
        )}

        {!data?.remainingTime && (
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
            <button 
              onClick={startDelay} 
              disabled={originalDelay <= 0 || isRunning}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: isRunning ? '#ccc' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              {isRunning ? 'Running' : 'Start'}
            </button>
            <button 
              onClick={resetDelay}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        )}

        {data?.remainingTime !== undefined && (
          <div style={{ 
            fontSize: '12px', 
            color: '#ff5722',
            fontWeight: 'bold'
          }}>
            Flow Executing...
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default DelayNode;