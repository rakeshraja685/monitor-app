import React, { useState, useEffect } from 'react';
import socket from '../socket';
import styles from './ConnectionChip.module.css';

const ConnectionChip = () => {
  const [status, setStatus] = useState('connected');

  useEffect(() => {
    const handleConnect = () => setStatus('connected');
    const handleDisconnect = () => setStatus('disconnected');
    const handleReconnect = () => setStatus('reconnecting');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnect);
    };
  }, []);

  const getStatusLabel = () => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'reconnecting': return 'Reconnecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className={`${styles.chip} ${styles[status]}`}>
      <span className={styles.dot}></span>
      <span className={styles.label}>{getStatusLabel()}</span>
    </div>
  );
};

export default ConnectionChip;