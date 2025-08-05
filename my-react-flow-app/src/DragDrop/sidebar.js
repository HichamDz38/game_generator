import React from 'react';
import styles from './MyComponent.module.css';
function sidebar () {
  const onDragStart = (event, nodeType,label) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  fetch('/get_devices')
      .then(
        response => {
          console.log(response.json());
        })
  return (
    <aside>
      <div className="description">You can drag these nodes to the pane on the right.</div>
      <div className="dndnode input" onDragStart={(event) => onDragStart(event, 'input')} draggable>
        Input Node
      </div>
      <div className="dndnode" onDragStart={(event) => onDragStart(event, 'default')} draggable>
        Default Node
      </div>
      <div className="dndnode output" onDragStart={(event) => onDragStart(event, 'output')} draggable>
        Output Node
      </div>
      <div className="dndnode output" onDragStart={(event) => onDragStart(event, 'group')} draggable>
        Output Node
      </div>
    </aside>
  );
};
export default sidebar;