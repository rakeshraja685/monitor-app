import React from 'react';
import styles from './WaitingOverlay.module.css';

const WaitingOverlay = ({ roomId, senderOnline }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.spinner}></div>
        <div className={styles.title}>
          {senderOnline ? '🟢 Rocky is Online' : '⏳ Waiting for Trip to Start'}
        </div>
        <p className={styles.subtitle}>
          {senderOnline 
            ? 'Waiting for Rocky to tap "Start Monitoring" and stream live GPS...' 
            : 'Rocky has not started tracking yet. This map will update live the moment he starts.'}
        </p>
        {roomId && (
          <div className={styles.roomTag}>
            Room: <span className="mono">{roomId}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitingOverlay;