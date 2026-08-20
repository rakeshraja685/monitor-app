import { io } from 'socket.io-client';

const isDev = import.meta.env.DEV;
const defaultUrl = isDev 
  ? `${window.location.protocol}//${window.location.hostname}:3001` 
  : window.location.origin;

const serverUrl = import.meta.env.VITE_SERVER_URL || defaultUrl;

const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 15000,
});

export default socket;