import React, { useState } from 'react';
import './styles/styles.css'; 

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <h1 className="navbar-logo">Welcome</h1>
        <div className="menu-toggle" onClick={toggleMenu}>
          &#9776;
        </div>
        <ul className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <li className="nav-item">
            <a href="#" className="nav-links">PROPS</a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-links">SOUND</a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-links">SETTINGS</a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-links">EXIT</a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;