import React from 'react';
import StatusBadge from './StatusBadge';
import styles from './BottomInfoPanel.module.css';

const BottomInfoPanel = ({ status, lastSeen, distance, coords }) => {
  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <StatusBadge status={status} />
        <span className={styles.timestamp}>
          Last updated: {lastSeen ? lastSeen.toLocaleTimeString() : 'N/A'}
        </span>
      </div>
      
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Distance from start</span>
          <span className={styles.statValue}>{distance.toFixed(2)} km</span>
        </div>
        
        {coords && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Coordinates</span>
            <span className={`${styles.statValue} mono`}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomInfoPanel;