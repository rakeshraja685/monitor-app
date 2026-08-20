import React from 'react';
import styles from './MonitorButton.module.css';

const MonitorButton = ({ active, onClick }) => {
  return (
    <button 
      className={`${styles.button} ${active ? styles.active : styles.idle}`}
      onClick={onClick}
    >
      <span className={styles.symbol}>{active ? '■' : '●'}</span>
      {active ? 'Stop Monitoring' : 'Start Monitoring'}
    </button>
  );
};

export default MonitorButton;