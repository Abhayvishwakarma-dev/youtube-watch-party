# YouTube Watch Party

A real-time collaborative YouTube watching system. Multiple users join a shared room and watch the same video in perfect synchronization — when the host pauses, seeks, or changes the video, everyone follows instantly.

Built with **React + TypeScript** on the frontend and **Node.js + Express + Socket.IO** on the backend, with **backend-enforced role-based access control** and optional **MongoDB** persistence.

---

## Table of Contents

- [Features](#features)
- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Role Permissions](#role-permissions)
- [WebSocket Events](#websocket-events)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Deployment](#deployment)
- [Database (Optional)](#database-optional)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)
- [Screenshots](#screenshots)

---

## Features

### Core
- **Room-based model** — create a room, get a unique 6-character code + shareable URL
- **Real-time playback sync** — play, pause, seek, and video change are broadcast to all participants within ~50ms
- **YouTube IFrame Player API** — supports `watch`, `youtu.be`, `embed`, `shorts`, and raw 11-char video IDs
- **WebSocket communication** — Socket.IO with automatic reconnection and polling fallback
- **Role-based access control** — Host / Moderator / Participant, **enforced on the backend** (not just UI)

### RBAC
- Host is auto-assigned to the room creator
- Host can promote participants to Moderator, demote them back, remove them, or transfer host
- Moderators can control playback but cannot manage participants
- Participants watch only — their controls are disabled *and* their events are rejected by the server
- Host auto-promotes the next moderator/participant on disconnect

### Bonus
- **Text chat** — real-time messages with auto-scroll and self-highlight
- **Emoji reactions** — 👍 ❤️ 😂 🔥 👏 float over the video, visible to everyone
- **Transfer host** — hand over host role with confirmation
- **OOP architecture** — `Room`, `Participant`, `RoomService`, `PermissionService`
- **Optional MongoDB persistence** — rooms survive server restarts
- **Type-safe everywhere** — shared types between frontend and backend, typed Socket.IO events

---

## Live Demo

- **Frontend:** https://your-app.onrender.com
- **Backend:** https://your-api.onrender.com
- **Health check:** https://your-api.onrender.com/api/health

### How to try it

1. Open the frontend URL
2. Enter a username → **Create Room**
3. Copy the invite link
4. Open it in a **different browser** (or incognito window) → join as participant
5. In the host tab, paste a YouTube URL → **Change Video**
6. Click **▶ Play** — both tabs start playing together
7. Try the emoji bar, chat, promote/demote, and transfer host

---

## Architecture
