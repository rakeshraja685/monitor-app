/**
 * Commute Tracker - Room & Session State Manager
 * Handles in-memory session tracking, location history, and automatic garbage collection.
 */

class RoomManager {
  constructor(expiryMinutes = 60) {
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.expiryMinutes = expiryMinutes;

    // Run garbage collection periodically every 10 minutes
    setInterval(() => this.cleanupExpiredRooms(), 10 * 60 * 1000);
  }

  /**
   * Registers a socket connection to a room
   * @param {string} roomId 
   * @param {'sender'|'viewer'} role 
   * @param {string} socketId 
   */
  joinRoom(roomId, role, socketId) {
    if (!roomId) return null;

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        status: 'waiting',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        senderSocketId: null,
        viewerSocketIds: new Set(),
        lastKnown: null,
        trail: []
      };
      this.rooms.set(roomId, room);
    }

    if (role === 'sender') {
      room.senderSocketId = socketId;
      room.status = 'active';
    } else {
      room.viewerSocketIds.add(socketId);
    }

    room.lastUpdated = Date.now();
    this.socketToRoom.set(socketId, { roomId, role });
    return room;
  }

  /**
   * Updates location for an active room session
   * @param {string} roomId 
   * @param {object} locationData { lat, lng, ts, accuracy, speed }
   */
  updateLocation(roomId, locationData) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const { lat, lng, ts = Date.now(), accuracy, speed } = locationData;
    const cleanLocation = { lat, lng, ts, accuracy, speed };

    room.lastKnown = cleanLocation;
    room.status = 'active';
    room.lastUpdated = Date.now();
    room.trail.push([lat, lng]);

    // Keep trail manageable in memory (cap at 10,000 points per session)
    if (room.trail.length > 10000) {
      room.trail.shift();
    }

    return cleanLocation;
  }

  /**
   * Marks a session as stopped
   * @param {string} roomId 
   */
  stopMonitoring(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = 'stopped';
      room.lastUpdated = Date.now();
    }
    return room;
  }

  /**
   * Retrieves last known location for a room
   * @param {string} roomId 
   */
  getLastKnown(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.lastKnown : null;
  }

  /**
   * Retrieves complete room state
   * @param {string} roomId 
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Handles socket disconnection cleanup
   * @param {string} socketId 
   */
  handleDisconnect(socketId) {
    const info = this.socketToRoom.get(socketId);
    if (!info) return;

    const { roomId, role } = info;
    const room = this.rooms.get(roomId);
    if (room) {
      if (role === 'sender' && room.senderSocketId === socketId) {
        room.senderSocketId = null;
      } else if (role === 'viewer') {
        room.viewerSocketIds.delete(socketId);
      }
    }
    this.socketToRoom.delete(socketId);
  }

  /**
   * Automatically cleans up inactive rooms
   */
  cleanupExpiredRooms() {
    const now = Date.now();
    const expiryMs = this.expiryMinutes * 60 * 1000;
    let purgedCount = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastUpdated > expiryMs) {
        this.rooms.delete(roomId);
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      console.log(`[RoomManager] Garbage collected ${purgedCount} expired room(s).`);
    }
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      activeRooms: this.rooms.size,
      connectedSockets: this.socketToRoom.size,
      uptimeSeconds: process.uptime()
    };
  }
}

export default new RoomManager(parseInt(process.env.ROOM_EXPIRY_MIN || '60', 10));
