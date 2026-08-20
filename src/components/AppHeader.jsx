import React from 'react';
import ConnectionChip from './ConnectionChip';
import styles from './AppHeader.module.css';

const AppHeader = ({ roomId }) => {
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.icon}>📍</span>
        <h1 className={styles.title}>Commute Tracker</h1>
      </div>
      
      <div className={styles.meta}>
        {roomId && (
          <button className={styles.roomPill} onClick={copyRoomId}>
            <span className="mono">{roomId}</span>
          </button>
        )}
        <ConnectionChip />
      </div>
    </header>
  );
};

export default AppHeader;