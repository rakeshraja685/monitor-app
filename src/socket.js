import { io } from 'socket.io-client';

// In production: same origin (Railway serves both Express + React on one URL)
// In development: Vite proxy forwards /socket.io to localhost:3001
// So window.location.origin is ALWAYS correct — no port logic needed.
const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;

console.log('[Socket] Connecting to:', serverUrl);

const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  withCredentials: false,
});

socket.on('connect', () => {
  console.log('[Socket] Connected:', socket.id, 'transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('[Socket] Disconnected:', reason);
});

export default socket;