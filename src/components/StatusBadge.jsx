import React from 'react';
import styles from './StatusBadge.module.css';

const StatusBadge = ({ status }) => {
  const getLabel = () => {
    switch (status) {
      case 'active': return '🟢 Monitoring Active';
      case 'stopped': return '⚫ Stopped';
      case 'arrived': return '🔵 Arrived';
      case 'waiting': return '⏳ Waiting...';
      default: return '';
    }
  };

  return (
    <div className={`${styles.badge} ${styles[status]}`}>
      {getLabel()}
    </div>
  );
};

export default StatusBadge;