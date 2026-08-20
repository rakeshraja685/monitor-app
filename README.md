# 📍 Commute Tracker — Real-Time Location Sharing

A lightweight, zero-install, real-time commute monitoring web application. Built with **React 18**, **Leaflet**, **Node.js/Express**, and **Socket.io**.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Fullstack Dev Environment
Runs both the **Express/Socket.io backend** (`http://localhost:3001`) and the **Vite React frontend** (`http://localhost:5173`) simultaneously:
```bash
npm run dev
```

### 3. Open the App
- **Sender (Rocky's Phone)**: [http://localhost:5173/sender](http://localhost:5173/sender)
- **Live Viewer (Mom's Device)**: [http://localhost:5173/viewer?room=ROOM_CODE](http://localhost:5173/viewer)

---

## 🧪 Simulation Testing (No need to walk outside!)

With the server running (`npm run server` or `npm run dev`), launch the Chennai commute simulation script in a separate terminal:
```bash
npm run simulate
```
It will output a room code and live coordinates along Anna Salai to Marina Beach, allowing you to test live marker movements, route polylines, and distance calculations on the Viewer page.

---

## 📁 Architecture & Folder Structure

```
monitor project/
├── server/
│   ├── index.js          # Express + Socket.io Server (Entry Point)
│   └── roomManager.js    # In-memory room sessions, history & GC
├── src/
│   ├── components/
│   │   ├── AppHeader.jsx & .module.css
│   │   ├── BatterySaverToggle.jsx & .module.css
│   │   ├── BottomInfoPanel.jsx & .module.css
│   │   ├── ConnectionChip.jsx & .module.css
│   │   ├── CopyLinkButton.jsx & .module.css
│   │   ├── MapView.jsx & .module.css
│   │   ├── MonitorButton.jsx & .module.css
│   │   ├── StatusBadge.jsx & .module.css
│   │   ├── Toast.jsx & .module.css
│   │   └── WaitingOverlay.jsx & .module.css
│   ├── pages/
│   │   ├── SenderPage.jsx & .module.css
│   │   └── ViewerPage.jsx & .module.css
│   ├── socket.js         # Socket.io Client singleton
│   ├── App.jsx           # React Router (/sender, /viewer)
│   ├── index.css         # Design Tokens & Theme
│   └── main.jsx          # Entry point
├── scripts/
│   └── simulate-commute.js # Trip simulator for testing
├── public/
│   └── manifest.json     # PWA Configuration
├── index.html
├── vite.config.js
└── package.json
```

---

## 🚀 Deployment Guide (Railway)

1. Push this repository to GitHub.
2. In [Railway.app](https://railway.app), create a new project from your repo.
3. Railway automatically runs `npm install` and `npm start` (`node server/index.js`).
4. Set Environment Variables in Railway:
   - `PORT`: `3001` (or let Railway auto-assign)
   - `NODE_ENV`: `production`
5. The single Express server serves both the React production bundle and WebSocket connections on the same HTTPS/WSS URL!
