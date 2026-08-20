import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from '../socket';
import AppHeader from '../components/AppHeader';
import MapView from '../components/MapView';
import BottomInfoPanel from '../components/BottomInfoPanel';
import WaitingOverlay from '../components/WaitingOverlay';
import Toast from '../components/Toast';
import styles from './ViewerPage.module.css';

const ViewerPage = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  
  const [status, setStatus] = useState('waiting');
  const [lastCoords, setLastCoords] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [trailPoints, setTrailPoints] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [toasts, setToasts] = useState([]);
  
  const stationaryTimerRef = useRef(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Reset the stationary arrival timer on each movement update
  const resetStationaryTimer = () => {
    if (stationaryTimerRef.current) {
      clearTimeout(stationaryTimerRef.current);
    }
    // If no new movement is received for 120 seconds, mark as arrived
    stationaryTimerRef.current = setTimeout(() => {
      setStatus(prev => (prev === 'active' ? 'arrived' : prev));
      addToast('🔵 Rocky has arrived or stopped moving', 'info');
    }, 120 * 1000);
  };

  useEffect(() => {
    if (!roomId) return;

    // Join the specified room as a viewer
    socket.emit('join-room', { roomId, role: 'viewer' });

    const handleLocationUpdate = (data) => {
      const { lat, lng, ts = Date.now(), accuracy, speed, heading } = data || {};
      if (lat === undefined || lng === undefined) return;

      const newPoint = [lat, lng];
      setLastCoords({ lat, lng, accuracy, speed, heading });
      setLastSeen(new Date(ts));
      setStatus('active');
      
      setTrailPoints(prev => {
        const nextTrail = [...prev, newPoint];
        if (nextTrail.length > 1) {
          const start = nextTrail[0];
          const dist = calculateDistance(start[0], start[1], lat, lng);
          setDistanceKm(dist);
        }
        return nextTrail;
      });

      resetStationaryTimer();
    };

    const handleMonitoringStopped = () => {
      setStatus('stopped');
      if (stationaryTimerRef.current) clearTimeout(stationaryTimerRef.current);
      addToast('⚫ Monitoring Ended by Sender', 'info');
    };

    const handleLastKnown = (data) => {
      if (data && data.lat !== undefined && data.lng !== undefined) {
        const { lat, lng, ts, accuracy, speed, heading } = data;
        setLastCoords({ lat, lng, accuracy, speed, heading });
        setLastSeen(new Date(ts || Date.now()));
        setStatus('active');
        setTrailPoints([[lat, lng]]);
        resetStationaryTimer();
      }
    };

    const handleReconnect = () => {
      addToast('🔁 Reconnected to live stream', 'success');
      socket.emit('join-room', { roomId, role: 'viewer' });
    };

    socket.on('location-update', handleLocationUpdate);
    socket.on('monitoring-stopped', handleMonitoringStopped);
    socket.on('last-known', handleLastKnown);
    socket.on('connect', () => {
      socket.emit('join-room', { roomId, role: 'viewer' });
    });
    socket.on('reconnect', handleReconnect);

    return () => {
      if (stationaryTimerRef.current) clearTimeout(stationaryTimerRef.current);
      socket.off('location-update', handleLocationUpdate);
      socket.off('monitoring-stopped', handleMonitoringStopped);
      socket.off('last-known', handleLastKnown);
      socket.off('connect');
      socket.off('reconnect');
    };
  }, [roomId]);

  if (!roomId) {
    return (
      <div className={styles.errorFull}>
        <div className={styles.errorCard}>
          <h2>Missing Tracking Code</h2>
          <p>Please open the link shared by the sender or ask for a new invite code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <AppHeader roomId={roomId} />
      
      <div className={styles.mapWrapper}>
        <MapView 
          coords={lastCoords} 
          trail={trailPoints} 
          lastSeen={lastSeen}
        />
        {status === 'waiting' && <WaitingOverlay />}
      </div>

      <BottomInfoPanel 
        status={status}
        lastSeen={lastSeen}
        distance={distanceKm}
        coords={lastCoords}
      />

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} />
      ))}
    </div>
  );
};

export default ViewerPage;