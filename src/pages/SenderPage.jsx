import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import AppHeader from '../components/AppHeader';
import MonitorButton from '../components/MonitorButton';
import BatterySaverToggle from '../components/BatterySaverToggle';
import CopyLinkButton from '../components/CopyLinkButton';
import Toast from '../components/Toast';
import { GPSKalmanFilter } from '../utils/kalmanFilter';
import styles from './SenderPage.module.css';

const SenderPage = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [batterySaver, setBatterySaver] = useState(false);
  const [status, setStatus] = useState('idle');
  const [startTime, setStartTime] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [roomId] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [toasts, setToasts] = useState([]);
  
  const watchId = useRef(null);
  const kalmanFilter = useRef(new GPSKalmanFilter(2.5));

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleToggleMonitoring = () => {
    if (!isMonitoring) {
      if (!navigator.geolocation) {
        setGpsError('GPS geolocation is not supported in this browser.');
        addToast('GPS not available in this browser', 'error');
        return;
      }

      setGpsError(null);
      setStartTime(new Date());
      setStatus('monitoring');
      setIsMonitoring(true);
      kalmanFilter.current.reset();
      
      socket.emit('join-room', { roomId, role: 'sender' });
      addToast('📍 High-Precision GPS Started', 'success');

      // Request continuous high-accuracy position updates
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy: rawAcc, speed, heading } = pos.coords;

          // Apply 2D Kalman filter to eliminate GPS noise, jitter, and multipath drift
          const smoothed = kalmanFilter.current.process(latitude, longitude, rawAcc, pos.timestamp || Date.now());

          setCurrentCoords({ lat: smoothed.lat, lng: smoothed.lng });
          setAccuracy(smoothed.accuracy);
          setGpsError(null);
          
          socket.emit('location', { 
            roomId, 
            lat: smoothed.lat, 
            lng: smoothed.lng, 
            accuracy: smoothed.accuracy,
            rawAccuracy: rawAcc,
            speed: speed || 0,
            heading: heading || null,
            ts: Date.now() 
          });
          setLastSentTime(new Date());
        },
        (err) => {
          console.error('Geolocation watch error:', err);
          if (err.code === 1) {
            setGpsError('Location permission was denied. Please allow location access in your browser settings.');
            addToast('Location permission denied', 'error');
          } else if (err.code === 2) {
            setGpsError('GPS signal weak or unavailable. Retrying with satellite lock...');
            addToast('GPS signal weak', 'warning');
          } else {
            addToast('GPS Error: ' + err.message, 'error');
          }
        },
        { 
          enableHighAccuracy: true, // Forces dedicated GNSS/GPS hardware
          timeout: 15000, 
          maximumAge: batterySaver ? 15000 : 0 // 0 forces immediate satellite refresh without cached stale data
        }
      );
    } else {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setIsMonitoring(false);
      setStatus('stopped');
      kalmanFilter.current.reset();
      socket.emit('monitoring-stopped', { roomId });
      addToast('⚫ Monitoring Stopped', 'info');
    }
  };

  const handleWhatsAppShare = () => {
    const viewerUrl = `${window.location.origin}/viewer?room=${roomId}`;
    const text = encodeURIComponent(`Hi Mom, track my live commute here on Commute Tracker:\n${viewerUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAccuracy = (acc) => {
    if (!acc) return '';
    if (acc >= 1000) return `±${(acc / 1000).toFixed(1)}km`;
    return `±${acc}m`;
  };

  const getAccuracyColor = () => {
    if (!accuracy) return styles.accNeutral;
    if (accuracy < 20) return styles.accGood;
    if (accuracy < 100) return styles.accWarning;
    return styles.accPoor;
  };

  // Cleanup GPS watcher on unmount
  useEffect(() => {
    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <AppHeader roomId={roomId} />
      
      <main className={styles.content}>
        {gpsError && (
          <div className={styles.errorBanner}>
            <span>⚠️ {gpsError}</span>
          </div>
        )}

        {isMonitoring && accuracy && (
          <div className={`${styles.accuracyChip} ${getAccuracyColor()}`}>
            <span className={styles.accuracyDot}></span>
            <span>
              {accuracy < 100 ? '🛰️ GPS Precision: ' : '⚠️ Est. IP/Wi-Fi: '}
              <strong>{formatAccuracy(accuracy)}</strong>
            </span>
          </div>
        )}

        {isMonitoring && accuracy && accuracy > 100 && (
          <div className={styles.ipWarning}>
            <div className={styles.ipWarningTitle}>⚠️ Inaccurate Location Detected ({formatAccuracy(accuracy)})</div>
            <p>
              Laptops & PCs lack GPS satellite hardware and use <strong>ISP IP Geolocation</strong>, which often places you at telecom gateway servers (e.g. Madurai or Coimbatore) instead of Chennai.
            </p>
            <p>
              👉 For real street-level tracking, open this page on your <strong>Smartphone</strong> with GPS turned on.
            </p>
          </div>
        )}

        <MonitorButton 
          active={isMonitoring} 
          onClick={handleToggleMonitoring} 
        />

        <div className={styles.statusLine}>
          {status === 'monitoring' && (
            <span className={styles.activeText}>
              🟢 High-Precision Tracking Active — {formatTime(startTime)}
            </span>
          )}
          {status === 'stopped' && (
            <span className={styles.stoppedText}>
              ⚫ Stopped — last sent at {formatTime(lastSentTime)}
            </span>
          )}
          {status === 'idle' && (
            <span className={styles.idleText}>
              Ready to start real-time tracking
            </span>
          )}
        </div>

        {isMonitoring && (
          <div className={styles.screenWarning}>
            🛰️ <strong>GPS Optimization:</strong> Utilizing hardware GNSS with active Kalman noise filtering. Keep screen unlocked for uninterrupted tracking.
          </div>
        )}

        {isMonitoring && currentCoords && (
          <div className={styles.coords}>
            📍 <span className="mono">{currentCoords.lat.toFixed(5)}° N, {currentCoords.lng.toFixed(5)}° E</span>
          </div>
        )}

        <div className={styles.actions}>
          <button 
            type="button" 
            className={styles.whatsappButton}
            onClick={handleWhatsAppShare}
          >
            💬 Share via WhatsApp
          </button>

          <CopyLinkButton roomId={roomId} onCopy={() => addToast('✅ Link Copied to Clipboard', 'success')} />

          <BatterySaverToggle 
            enabled={batterySaver} 
            onToggle={() => setBatterySaver(!batterySaver)} 
          />
        </div>
      </main>

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} />
      ))}
    </div>
  );
};

export default SenderPage;