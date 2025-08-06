import React, { useState } from 'react';
import { FaEllipsisH } from 'react-icons/fa'; 

function ThreeDotsButtonWithIcon() {
  const [showMenu, setShowMenu] = useState(false);

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  return (
    <div>
      <button onClick={toggleMenu} aria-label="More options">
        <FaEllipsisH /> 
      </button>
      {showMenu && (
        <div className="dropdown-menu">
          <p>Option A</p>
          <p>Option B</p>
        </div>
      )}
    </div>
  );
}

export default ThreeDotsButtonWithIcon;