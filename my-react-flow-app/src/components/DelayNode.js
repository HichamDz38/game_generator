
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



  return (
    <div>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      
      <div style={{ textAlign: 'center' }}>
        <div>
          Delay Node
        </div>
        
        {/* <div>
          {formatTime(timeRemaining)}
        </div> */}
        {/* <div>
            <button onClick={startDelay} disabled={originalDelay <= 0}>
                S
            </button>
            <button onClick={resetDelay}>
                R
            </button>
        </div> */}

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