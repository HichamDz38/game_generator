import React from 'react';
//import Container from 'react-bootstrap/Container';
//import Nav from 'react-bootstrap/Nav';
//import Navbar from 'react-bootstrap/Navbar';
//import styled from 'styled-components';
//import { Background } from 'reactflow';
import styles from './MyComponent.module.css';

// const stylednavbar = styled.p`
//       background-color: red;
//       height: 80px;
//       display: flex;
//       justify-content: center;
//       align-items: center;
//       font-size: 1.2rem;
//       position: sticky;
//       top: 0;
//       z-index: 999;
//     `;

function Navbarr() {
  return (
    <>
      <nav className={styles.navbar}>
        <p className={styles.left}>ERPanel</p>
        <ul className={styles.links}>
          <a href="#home">PROPS</a>
          <a href="#features">SOUND</a>
          <a href="#pricing">SETTINGS</a>
          <a href="#pricing">EXIT</a>
        </ul>
      </nav>
    </>
  );
}

export default Navbarr;