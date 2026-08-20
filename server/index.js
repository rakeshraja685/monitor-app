import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import roomManager from './roomManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: CLIENT_URL === '*' ? '*' : CLIENT_URL.split(','),
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// REST Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
    stats: roomManager.getStats()
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found or expired' });
  }
  res.json({
    roomId: room.roomId,
    status: room.status,
    lastKnown: room.lastKnown,
    trailLength: room.trail.length,
    createdAt: room.createdAt,
    lastUpdated: room.lastUpdated
  });
});

// Socket.IO Lifecycle
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Handle client joining a room
  socket.on('join-room', ({ roomId, role = 'viewer' }) => {
    if (!roomId) return;

    socket.join(roomId);
    roomManager.joinRoom(roomId, role, socket.id);
    console.log(`[Socket] ${socket.id} (${role}) joined room: ${roomId}`);

    // If viewer joins late and we have a last known location, emit it immediately
    if (role === 'viewer') {
      const lastKnown = roomManager.getLastKnown(roomId);
      if (lastKnown) {
        socket.emit('last-known', lastKnown);
      }
    }
  });

  // Handle live location broadcasting
  socket.on('location', (data) => {
    const { roomId, lat, lng, ts = Date.now(), accuracy, speed } = data || {};
    if (!roomId || lat === undefined || lng === undefined) return;

    const cleanData = roomManager.updateLocation(roomId, { lat, lng, ts, accuracy, speed });
    if (cleanData) {
      // Broadcast location update to all clients in the room
      io.to(roomId).emit('location-update', cleanData);
    }
  });

  // Handle sender stopping tracking
  socket.on('monitoring-stopped', ({ roomId }) => {
    if (!roomId) return;
    console.log(`[Socket] Monitoring stopped for room: ${roomId}`);
    roomManager.stopMonitoring(roomId);
    io.to(roomId).emit('monitoring-stopped', { roomId });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket.id);
  });
});

// In production, serve the built Vite client application
const clientDistPath = path.join(__dirname, '../dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start Server
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Commute Tracker Backend is LIVE`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`📡 WebSocket: Enabled`);
  console.log(`========================================`);
});
