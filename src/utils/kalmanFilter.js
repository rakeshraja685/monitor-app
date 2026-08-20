/**
 * 2D Kalman Filter for GPS Coordinate Smoothing
 * Reduces measurement noise, GPS jitter, and prevents sudden teleport jumps.
 */

export class GPSKalmanFilter {
  constructor(processNoise = 3) {
    this.processNoise = processNoise; // Decay / motion variance in meters/sec
    this.variance = -1; // Negative indicates uninitialized
    this.lat = 0;
    this.lng = 0;
    this.timestamp = 0;
    this.speed = 0;
  }

  /**
   * Resets the filter state
   */
  reset() {
    this.variance = -1;
    this.lat = 0;
    this.lng = 0;
    this.timestamp = 0;
    this.speed = 0;
  }

  /**
   * Process a new GPS measurement
   * @param {number} lat - Latitude in degrees
   * @param {number} lng - Longitude in degrees
   * @param {number} accuracy - Accuracy radius in meters (from geolocation API)
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {{ lat: number, lng: number, accuracy: number, filtered: boolean }}
   */
  process(lat, lng, accuracy, timestamp = Date.now()) {
    // If accuracy is completely invalid or huge (> 100m) on an established track, reject or penalize
    const rawAccuracy = Math.max(accuracy || 10, 1);

    if (this.variance < 0) {
      // First measurement initialization
      this.timestamp = timestamp;
      this.lat = lat;
      this.lng = lng;
      this.variance = rawAccuracy * rawAccuracy;
      return { lat, lng, accuracy: rawAccuracy, filtered: false };
    }

    const timeDelta = Math.max((timestamp - this.timestamp) / 1000, 0.001); // in seconds
    this.timestamp = timestamp;

    // Reject physical impossibilities (e.g. teleporting > 200m in < 1s => > 720 km/h)
    const distanceMeters = this.calculateDistanceMeters(this.lat, this.lng, lat, lng);
    const impliedSpeedKmh = (distanceMeters / timeDelta) * 3.6;

    if (distanceMeters > 300 && impliedSpeedKmh > 200 && rawAccuracy > 30) {
      // Ignore extreme glitch outlier
      console.warn(`[Kalman] Discarded extreme GPS glitch: ${distanceMeters.toFixed(1)}m in ${timeDelta.toFixed(1)}s`);
      return { lat: this.lat, lng: this.lng, accuracy: Math.sqrt(this.variance), filtered: true };
    }

    // Process Noise Covariance: timeDelta * (speed^2 or default process noise)
    const q = this.processNoise * this.processNoise * timeDelta;
    this.variance += q;

    // Measurement Noise Covariance
    const r = rawAccuracy * rawAccuracy;

    // Kalman Gain K
    const k = this.variance / (this.variance + r);

    // State update (estimate true lat/lng)
    this.lat += k * (lat - this.lat);
    this.lng += k * (lng - this.lng);

    // Covariance update
    this.variance = (1 - k) * this.variance;

    return {
      lat: Number(this.lat.toFixed(7)),
      lng: Number(this.lng.toFixed(7)),
      accuracy: Math.max(Math.round(Math.sqrt(this.variance)), 3),
      filtered: true
    };
  }

  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Calculates compass heading/bearing in degrees (0 - 360) between two points
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}
