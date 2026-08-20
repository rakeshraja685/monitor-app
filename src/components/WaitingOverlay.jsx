import React from 'react';
import styles from './WaitingOverlay.module.css';

const WaitingOverlay = () => {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.spinner}></div>
        <p>⏳ Waiting for Rocky to start monitoring...</p>
      </div>
    </div>
  );
};

export default WaitingOverlay;