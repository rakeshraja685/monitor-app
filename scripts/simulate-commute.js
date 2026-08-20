/**
 * Commute Tracker - Live Trip Simulation Script
 * Simulates a real commute in Chennai from Guindy to Marina Beach via Anna Salai.
 * Usage: node scripts/simulate-commute.js [roomId]
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const roomId = process.argv[2] || 'CHENNAI-' + Math.floor(100 + Math.random() * 900);

console.log(`\n==============================================`);
console.log(`🚗 COMMUTE TRACKER TRIP SIMULATOR`);
console.log(`🌐 Server: ${SERVER_URL}`);
console.log(`📍 Room ID: ${roomId}`);
console.log(`👁️  Viewer URL: http://localhost:5173/viewer?room=${roomId}`);
console.log(`==============================================\n`);

const socket = io(SERVER_URL);

// Route points along Chennai: Guindy -> Saidapet -> T. Nagar -> Mount Road -> Marina Beach
const routeCoordinates = [
  { lat: 13.0067, lng: 80.2025, name: 'Guindy Junction' },
  { lat: 13.0134, lng: 80.2104, name: 'Saidapet Bridge' },
  { lat: 13.0238, lng: 80.2198, name: 'Nandanam Signal' },
  { lat: 13.0360, lng: 80.2312, name: 'Teynampet' },
  { lat: 13.0489, lng: 80.2467, name: 'Thousand Lights' },
  { lat: 13.0583, lng: 80.2642, name: 'Royapettah Clock Tower' },
  { lat: 13.0500, lng: 80.2824, name: 'Marina Beach Promenade' },
  { lat: 13.0382, lng: 80.2785, name: 'Santhome Cathedral (Destination)' }
];

socket.on('connect', () => {
  console.log(`[Simulator] Connected to Socket.IO server as Sender (Socket ID: ${socket.id})`);
  socket.emit('join-room', { roomId, role: 'sender' });
  console.log(`[Simulator] Joined room: ${roomId}`);

  let step = 0;

  const interval = setInterval(() => {
    if (step >= routeCoordinates.length) {
      console.log(`\n🏁 Arrived at destination! Stopping simulation.`);
      socket.emit('monitoring-stopped', { roomId });
      clearInterval(interval);
      setTimeout(() => {
        socket.disconnect();
        process.exit(0);
      }, 2000);
      return;
    }

    const currentPoint = routeCoordinates[step];
    const payload = {
      roomId,
      lat: currentPoint.lat,
      lng: currentPoint.lng,
      accuracy: 8.5 + (Math.random() * 5),
      speed: 35.0 + (Math.random() * 10),
      ts: Date.now()
    };

    console.log(`[${new Date().toLocaleTimeString()}] 📍 Step ${step + 1}/${routeCoordinates.length}: ${currentPoint.name} (${currentPoint.lat}, ${currentPoint.lng})`);
    socket.emit('location', payload);

    step++;
  }, 3000);
});

socket.on('connect_error', (err) => {
  console.error(`[Simulator] Connection Error: ${err.message}. Make sure backend is running on ${SERVER_URL}`);
});
