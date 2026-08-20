import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateBearing } from '../utils/kalmanFilter';
import styles from './MapView.module.css';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to auto-pan smoothly
const MapController = ({ coords }) => {
  const map = useMap();

  useEffect(() => {
    if (coords && coords.lat && coords.lng) {
      map.panTo([coords.lat, coords.lng], {
        animate: true,
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [coords, map]);

  return null;
};

const RecenterButton = ({ coords }) => {
  const map = useMap();
  if (!coords) return null;

  return (
    <button 
      type="button"
      className={styles.recenterBtn}
      onClick={() => map.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.5 })}
      title="Recenter Location"
      aria-label="Recenter Location"
    >
      🎯
    </button>
  );
};

const MapView = ({ coords, trail = [], lastSeen }) => {
  // Calculate dynamic bearing/heading angle
  let headingAngle = 0;
  if (coords?.heading !== null && coords?.heading !== undefined) {
    headingAngle = coords.heading;
  } else if (trail.length >= 2) {
    const prev = trail[trail.length - 2];
    const curr = trail[trail.length - 1];
    headingAngle = calculateBearing(prev[0], prev[1], curr[0], curr[1]);
  }

  const customIcon = L.divIcon({
    className: styles.customMarker,
    html: `
      <div class="${styles.markerWrapper}">
        <div class="${styles.pulse}"></div>
        <div class="${styles.dot}">
          <div class="${styles.arrow}" style="transform: rotate(${headingAngle}deg);"></div>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // Default to Chennai coordinates if no location has been received yet
  const defaultChennaiCoords = [13.0827, 80.2707];
  const center = coords ? [coords.lat, coords.lng] : defaultChennaiCoords;
  const accuracyRadius = Math.max(coords?.accuracy || 15, 5);

  return (
    <div className={styles.mapContainer}>
      <MapContainer 
        center={center} 
        zoom={15} 
        className={styles.map}
        zoomControl={false}
      >
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          maxZoom={19}
        />
        
        {coords && coords.lat && coords.lng && (
          <>
            {/* Real-world GPS Accuracy Uncertainty Ring */}
            <Circle
              center={[coords.lat, coords.lng]}
              radius={accuracyRadius}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.14,
                weight: 1.5,
                dashArray: '4, 4'
              }}
            />

            {/* High-Precision Live Location Marker */}
            <Marker position={[coords.lat, coords.lng]} icon={customIcon}>
              <Popup>
                <div style={{ fontWeight: 700, color: '#1b2a4a', fontSize: '14px' }}>
                  📍 Rocky (Live)
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Accuracy: ±{Math.round(accuracyRadius)}m
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Updated: {lastSeen ? lastSeen.toLocaleTimeString() : 'Just now'}
                </div>
              </Popup>
            </Marker>

            <MapController coords={coords} />
            <RecenterButton coords={coords} />
          </>
        )}

        {/* High-visibility Smooth Route Trail */}
        {trail && trail.length > 1 && (
          <Polyline 
            positions={trail} 
            color="#2563EB" 
            weight={5} 
            opacity={0.75}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;