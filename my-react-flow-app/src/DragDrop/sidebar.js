import React from 'react';
import styles from './MyComponent.module.css';
function sidebar () {
  const onDragStart = (event, nodeType,label) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  return (
    <aside className={styles.configside} 
    style = {{
      backgroundColor : '#eee6ff',
      width : '300px',
      height : '350px',
      }}>
      <div className="description"><p className={styles.title3} > You can drag these nodes to the pane on the left.</p></div>
      <br></br>
      <div className="dndnode input" onDragStart={(event) => onDragStart(event, 'input')} draggable>
        Input Node
      </div>
      <br></br>
      <div className="dndnode" onDragStart={(event) => onDragStart(event, 'default')} draggable>
        Default Node
      </div>
      <br></br>
      <div className="dndnode output" onDragStart={(event) => onDragStart(event, 'output')} draggable>
        Output Node
      </div>
    </aside>
  );
};

export default sidebar;