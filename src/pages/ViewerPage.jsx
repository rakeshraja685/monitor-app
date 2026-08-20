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
  const rawRoomId = searchParams.get('room');
  const roomId = rawRoomId ? rawRoomId.toUpperCase() : null;
  
  const [status, setStatus] = useState('waiting');
  const [senderOnline, setSenderOnline] = useState(false);
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

    const join = () => {
      socket.emit('join-room', { roomId, role: 'viewer' });
    };

    if (socket.connected) {
      join();
    }
    socket.on('connect', join);

    const handleRoomInit = (snapshot) => {
      if (!snapshot) return;
      setSenderOnline(!!snapshot.senderConnected);
      
      if (snapshot.lastKnown) {
        const { lat, lng, ts, accuracy, speed, heading } = snapshot.lastKnown;
        setLastCoords({ lat, lng, accuracy, speed, heading });
        setLastSeen(new Date(ts || Date.now()));
        setStatus('active');
        if (snapshot.trail && snapshot.trail.length > 0) {
          setTrailPoints(snapshot.trail);
          const start = snapshot.trail[0];
          setDistanceKm(calculateDistance(start[0], start[1], lat, lng));
        }
        resetStationaryTimer();
      } else if (snapshot.status) {
        setStatus(snapshot.status);
      }
    };

    const handleLocationUpdate = (data) => {
      const { lat, lng, ts = Date.now(), accuracy, speed, heading } = data || {};
      if (lat === undefined || lng === undefined) return;

      const newPoint = [lat, lng];
      setLastCoords({ lat, lng, accuracy, speed, heading });
      setLastSeen(new Date(ts));
      setStatus('active');
      setSenderOnline(true);
      
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

    const handleMonitoringStarted = () => {
      setSenderOnline(true);
      addToast('🚀 Rocky started monitoring! Waiting for first GPS ping...', 'info');
    };

    const handleMonitoringStopped = () => {
      setStatus('stopped');
      if (stationaryTimerRef.current) clearTimeout(stationaryTimerRef.current);
      addToast('⚫ Monitoring Ended by Sender', 'info');
    };

    const handleSenderStatus = (info) => {
      setSenderOnline(!!info?.connected);
      if (info?.connected) {
        addToast('🟢 Rocky is online', 'info');
      }
    };

    const handleLastKnown = (data) => {
      if (data && data.lat !== undefined && data.lng !== undefined) {
        const { lat, lng, ts, accuracy, speed, heading, trail } = data;
        setLastCoords({ lat, lng, accuracy, speed, heading });
        setLastSeen(new Date(ts || Date.now()));
        setStatus('active');
        setSenderOnline(true);
        if (trail && trail.length > 0) {
          setTrailPoints(trail);
        } else {
          setTrailPoints(prev => prev.length > 0 ? prev : [[lat, lng]]);
        }
        resetStationaryTimer();
      }
    };

    const handleReconnect = () => {
      addToast('🔁 Reconnected to live stream', 'success');
      join();
    };

    socket.on('room-init', handleRoomInit);
    socket.on('location-update', handleLocationUpdate);
    socket.on('monitoring-started', handleMonitoringStarted);
    socket.on('monitoring-stopped', handleMonitoringStopped);
    socket.on('sender-status', handleSenderStatus);
    socket.on('last-known', handleLastKnown);
    socket.on('reconnect', handleReconnect);

    return () => {
      if (stationaryTimerRef.current) clearTimeout(stationaryTimerRef.current);
      socket.off('connect', join);
      socket.off('room-init', handleRoomInit);
      socket.off('location-update', handleLocationUpdate);
      socket.off('monitoring-started', handleMonitoringStarted);
      socket.off('monitoring-stopped', handleMonitoringStopped);
      socket.off('sender-status', handleSenderStatus);
      socket.off('last-known', handleLastKnown);
      socket.off('reconnect', handleReconnect);
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
        {status === 'waiting' && (
          <WaitingOverlay roomId={roomId} senderOnline={senderOnline} />
        )}
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