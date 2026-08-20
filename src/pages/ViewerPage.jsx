import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const pollIntervalRef = useRef(null);
  const hasReceivedWebSocket = useRef(false);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Apply location data from any source (WebSocket or HTTP polling)
  const applyLocationData = useCallback((lat, lng, ts, accuracy, speed, heading, trail) => {
    setLastCoords({ lat, lng, accuracy, speed, heading });
    setLastSeen(new Date(ts || Date.now()));
    setStatus('active');
    setSenderOnline(true);
    
    if (trail && trail.length > 0) {
      setTrailPoints(trail);
      const start = trail[0];
      setDistanceKm(calculateDistance(start[0], start[1], lat, lng));
    } else {
      setTrailPoints(prev => {
        const nextTrail = [...prev, [lat, lng]];
        if (nextTrail.length > 1) {
          const start = nextTrail[0];
          setDistanceKm(calculateDistance(start[0], start[1], lat, lng));
        }
        return nextTrail;
      });
    }
  }, [calculateDistance]);

  // Reset the stationary arrival timer on each movement update
  const resetStationaryTimer = useCallback(() => {
    if (stationaryTimerRef.current) {
      clearTimeout(stationaryTimerRef.current);
    }
    stationaryTimerRef.current = setTimeout(() => {
      setStatus(prev => (prev === 'active' ? 'arrived' : prev));
      addToast('🔵 Rocky has arrived or stopped moving', 'info');
    }, 120 * 1000);
  }, [addToast]);

  // ========================
  // HTTP POLLING FALLBACK
  // Polls /api/room/:roomId/poll every 5 seconds while stuck in 'waiting'
  // Guarantees the viewer will NEVER be stuck forever even if WebSocket fails
  // ========================
  useEffect(() => {
    if (!roomId) return;

    const pollRoom = async () => {
      // Stop polling once real-time WebSocket events are flowing
      if (hasReceivedWebSocket.current) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      try {
        const res = await fetch(`/api/room/${roomId}/poll`);
        if (!res.ok) return;
        
        const data = await res.json();
        console.log('[Poll] Room state:', data.status, 'hasLocation:', !!data.lastKnown);
        
        if (data.lastKnown && data.lastKnown.lat !== undefined) {
          console.log('[Poll] ✅ Got location via HTTP fallback — WebSocket was not delivering');
          const { lat, lng, ts, accuracy, speed, heading } = data.lastKnown;
          applyLocationData(lat, lng, ts, accuracy, speed, heading, data.trail);
          resetStationaryTimer();
          addToast('📡 Connected via HTTP fallback', 'success');
          
          // Stop polling — we have data now
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (data.senderConnected) {
          setSenderOnline(true);
        }
      } catch (err) {
        console.warn('[Poll] HTTP fallback error:', err.message);
      }
    };

    // Start polling after 3 seconds if still waiting
    const startDelay = setTimeout(() => {
      pollRoom(); // first poll immediately
      pollIntervalRef.current = setInterval(pollRoom, 5000);
    }, 3000);

    return () => {
      clearTimeout(startDelay);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [roomId, applyLocationData, resetStationaryTimer, addToast]);

  // ========================
  // WEBSOCKET EVENT LISTENERS
  // ========================
  useEffect(() => {
    if (!roomId) return;

    const join = () => {
      console.log('[Viewer] Emitting join-room for:', roomId);
      socket.emit('join-room', { roomId, role: 'viewer' });
    };

    if (socket.connected) {
      join();
    }
    socket.on('connect', join);

    const handleRoomInit = (snapshot) => {
      console.log('[Viewer] Received room-init:', snapshot?.status, 'hasLocation:', !!snapshot?.lastKnown);
      if (!snapshot) return;
      hasReceivedWebSocket.current = true;
      setSenderOnline(!!snapshot.senderConnected);
      
      if (snapshot.lastKnown) {
        const { lat, lng, ts, accuracy, speed, heading } = snapshot.lastKnown;
        applyLocationData(lat, lng, ts, accuracy, speed, heading, snapshot.trail);
        resetStationaryTimer();
      } else if (snapshot.status && snapshot.status !== 'waiting') {
        setStatus(snapshot.status);
      }
    };

    const handleLocationUpdate = (data) => {
      const { lat, lng, ts = Date.now(), accuracy, speed, heading } = data || {};
      if (lat === undefined || lng === undefined) return;

      console.log('[Viewer] 📍 Live location-update received');
      hasReceivedWebSocket.current = true;

      setLastCoords({ lat, lng, accuracy, speed, heading });
      setLastSeen(new Date(ts));
      setStatus('active');
      setSenderOnline(true);
      
      setTrailPoints(prev => {
        const nextTrail = [...prev, [lat, lng]];
        if (nextTrail.length > 1) {
          const start = nextTrail[0];
          setDistanceKm(calculateDistance(start[0], start[1], lat, lng));
        }
        return nextTrail;
      });

      resetStationaryTimer();
    };

    const handleMonitoringStarted = () => {
      hasReceivedWebSocket.current = true;
      setSenderOnline(true);
      addToast('🚀 Rocky started monitoring!', 'info');
    };

    const handleMonitoringStopped = () => {
      hasReceivedWebSocket.current = true;
      setStatus('stopped');
      if (stationaryTimerRef.current) clearTimeout(stationaryTimerRef.current);
      addToast('⚫ Monitoring Ended by Sender', 'info');
    };

    const handleSenderStatus = (info) => {
      hasReceivedWebSocket.current = true;
      setSenderOnline(!!info?.connected);
      if (info?.connected) {
        addToast('🟢 Rocky is online', 'info');
      }
    };

    const handleLastKnown = (data) => {
      if (data && data.lat !== undefined && data.lng !== undefined) {
        hasReceivedWebSocket.current = true;
        const { lat, lng, ts, accuracy, speed, heading, trail } = data;
        applyLocationData(lat, lng, ts, accuracy, speed, heading, trail);
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
  }, [roomId, applyLocationData, resetStationaryTimer, addToast, calculateDistance]);

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