import React from 'react';
import styles from './BatterySaverToggle.module.css';

const BatterySaverToggle = ({ enabled, onToggle }) => {
  return (
    <div className={styles.wrapper} onClick={onToggle}>
      <span className={styles.label}>🔋 Battery Saver</span>
      <div className={`${styles.switch} ${enabled ? styles.enabled : ''}`}>
        <div className={styles.knob}></div>
      </div>
    </div>
  );
};

export default BatterySaverToggle;