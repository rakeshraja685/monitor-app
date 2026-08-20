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
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Initialize Socket.IO — tuned for Railway's proxy
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // Railway's proxy needs generous timeouts
  pingTimeout: 60000,
  pingInterval: 25000,
  // Allow both transports — polling is the fallback
  transports: ['websocket', 'polling'],
  // Allow upgrades from polling to websocket
  allowUpgrades: true,
});

// ===================== REST Endpoints =====================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
    stats: roomManager.getStats()
  });
});

// Standard room info
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

// HTTP Polling fallback — viewer calls this every 5s when stuck in 'waiting'
// Returns full room state including last known location and trail
app.get('/api/room/:roomId/poll', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const snapshot = roomManager.getRoomSnapshot(roomId);
  
  if (!snapshot) {
    return res.json({
      exists: false,
      status: 'waiting',
      lastKnown: null,
      trail: [],
      senderConnected: false
    });
  }

  res.json({
    exists: true,
    roomId: snapshot.roomId,
    status: snapshot.status,
    lastKnown: snapshot.lastKnown,
    trail: snapshot.trail,
    senderConnected: snapshot.senderConnected,
    viewerCount: snapshot.viewerCount
  });
});

// ===================== Socket.IO Lifecycle =====================

io.on('connection', (socket) => {
  console.log(`[Socket] ✅ Client connected: ${socket.id} | transport: ${socket.conn.transport.name}`);

  // Handle client joining a room
  socket.on('join-room', ({ roomId, role = 'viewer' }) => {
    if (!roomId) return;

    const normalizedRoomId = roomId.toUpperCase();
    socket.join(normalizedRoomId);
    const room = roomManager.joinRoom(normalizedRoomId, role, socket.id);
    console.log(`[Socket] ${socket.id} (${role}) joined room: ${normalizedRoomId} | room status: ${room?.status} | hasLocation: ${!!room?.lastKnown}`);

    const snapshot = roomManager.getRoomSnapshot(normalizedRoomId);

    if (role === 'viewer') {
      // Send full initial state to viewer immediately
      socket.emit('room-init', snapshot);
      console.log(`[Socket] Sent room-init to viewer ${socket.id} | status: ${snapshot?.status} | hasLastKnown: ${!!snapshot?.lastKnown} | trail: ${snapshot?.trail?.length || 0}`);
      
      if (snapshot && snapshot.lastKnown) {
        socket.emit('last-known', { ...snapshot.lastKnown, trail: snapshot.trail });
      }
      // Inform everyone about viewer count
      io.to(normalizedRoomId).emit('viewer-count', snapshot ? snapshot.viewerCount : 1);
    } else if (role === 'sender') {
      // Inform viewers that sender is online
      io.to(normalizedRoomId).emit('sender-status', { connected: true, status: room ? room.status : 'waiting' });
    }
  });

  // Handle sender starting tracking
  socket.on('monitoring-started', ({ roomId }) => {
    if (!roomId) return;
    const normalizedRoomId = roomId.toUpperCase();
    console.log(`[Socket] 🟢 Monitoring started for room: ${normalizedRoomId}`);
    roomManager.startMonitoring(normalizedRoomId);
    io.to(normalizedRoomId).emit('monitoring-started', { roomId: normalizedRoomId });
  });

  // Handle live location broadcasting
  socket.on('location', (data) => {
    const { roomId, lat, lng, ts = Date.now(), accuracy, speed, heading } = data || {};
    if (!roomId || lat === undefined || lng === undefined) return;

    const normalizedRoomId = roomId.toUpperCase();
    
    // Auto-create room if it was garbage collected (defensive — prevents silent data loss)
    if (!roomManager.getRoom(normalizedRoomId)) {
      console.log(`[Socket] ⚠️ Room ${normalizedRoomId} not found during location event — auto-creating`);
      roomManager.joinRoom(normalizedRoomId, 'sender', socket.id);
      socket.join(normalizedRoomId);
    }

    const cleanData = roomManager.updateLocation(normalizedRoomId, { lat, lng, ts, accuracy, speed, heading });
    if (cleanData) {
      io.to(normalizedRoomId).emit('location-update', cleanData);
    }
  });

  // Handle sender stopping tracking
  socket.on('monitoring-stopped', ({ roomId }) => {
    if (!roomId) return;
    const normalizedRoomId = roomId.toUpperCase();
    console.log(`[Socket] ⚫ Monitoring stopped for room: ${normalizedRoomId}`);
    roomManager.stopMonitoring(normalizedRoomId);
    io.to(normalizedRoomId).emit('monitoring-stopped', { roomId: normalizedRoomId });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] ❌ Client disconnected: ${socket.id} | reason: ${reason}`);
    const info = roomManager.handleDisconnect(socket.id);
    if (info && info.role === 'sender') {
      io.to(info.roomId).emit('sender-status', { connected: false });
    } else if (info && info.role === 'viewer') {
      const snap = roomManager.getRoomSnapshot(info.roomId);
      if (snap) {
        io.to(info.roomId).emit('viewer-count', snap.viewerCount);
      }
    }
  });
});

// ===================== Static File Serving =====================

// In production, serve the built Vite client application
const clientDistPath = path.join(__dirname, '../dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ===================== Start Server =====================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`🚀 Commute Tracker Backend is LIVE`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`📡 WebSocket: Enabled (ws + polling)`);
  console.log(`🔗 Listening on: 0.0.0.0:${PORT}`);
  console.log(`========================================`);
});
