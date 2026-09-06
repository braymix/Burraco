// Burraco online server: Express static hosting + Socket.IO authoritative game.
// Accounts are anonymous (no email): the client sends a locally-generated userId
// and a chosen nickname. Simple stats persistence in a JSON file.

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

import {
  createMatch, startHand, viewFor, rawHand,
  drawCard, createMeld, addToMeld, discardCard,
} from '../src/engine/engine.js';
import { runBotTurn } from '../src/engine/bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

const PORT = process.env.PORT || 3001;

// ---- Profiles / stats ----------------------------------------------------

function loadProfiles() {
  try { return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')); }
  catch { return {}; }
}
function saveProfiles(p) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(p, null, 2));
  } catch (e) { console.error('saveProfiles', e.message); }
}
let profiles = loadProfiles();

function getProfile(userId, name) {
  if (!profiles[userId]) profiles[userId] = { name: name || 'Giocatore', wins: 0, losses: 0, games: 0, points: 0 };
  if (name) profiles[userId].name = name;
  return profiles[userId];
}
function recordResult(userId, name, won, points) {
  const p = getProfile(userId, name);
  p.games += 1;
  if (won) p.wins += 1; else p.losses += 1;
  p.points += points;
  saveProfiles(profiles);
}

// ---- Express -------------------------------------------------------------

const app = express();
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/leaderboard', (_req, res) => {
  const list = Object.entries(profiles)
    .map(([id, p]) => ({ id, name: p.name, wins: p.wins, losses: p.losses, games: p.games, points: p.points }))
    .sort((a, b) => b.wins - a.wins || b.points - a.points)
    .slice(0, 50);
  res.json(list);
});

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// ---- Game rooms ----------------------------------------------------------

// room: { id, code, match, seats:[{userId,name,socketId,connected,auto}], type:'quick'|'private', botTimer }
const rooms = new Map();          // roomId -> room
const userRoom = new Map();       // userId -> roomId (active match)
const socketUser = new Map();     // socketId -> userId
const quickQueues = { 2: [], 4: [] }; // size -> [{userId,name,socketId}]

let botCounter = 1;
const BOT_NAMES = ['Bot Bruno', 'Bot Bianca', 'Bot Carla', 'Bot Dario', 'Bot Elsa', 'Bot Furio'];
function makeBotSeat() {
  const name = BOT_NAMES[(botCounter - 1) % BOT_NAMES.length];
  return { userId: 'bot-' + (botCounter++), name, socketId: null, connected: false, auto: true, isBot: true };
}

function code4() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += s[Math.floor(Math.random() * s.length)];
  return c;
}

function makeRoom(type, code, size = 2) {
  const id = 'room-' + nanoid(8);
  const room = { id, code: code || null, type, size, match: null, seats: [], botTimer: null, started: false };
  rooms.set(id, room);
  return room;
}

function seatIndexOfUser(room, userId) {
  return room.seats.findIndex((s) => s.userId === userId);
}

function startRoomMatch(room) {
  const players = room.seats.map((s) => ({ id: s.userId, name: s.name, isBot: !!s.isBot }));
  room.match = createMatch({ players });
  room.started = true;
  for (const seat of room.seats) if (!seat.isBot) userRoom.set(seat.userId, room.id);
  broadcastRoom(room, 'match:start');
  maybeRunBots(room);
}

// Notify seated members about the current lobby (who's in, how many seats).
function broadcastLobby(room) {
  const info = {
    roomId: room.id, code: room.code, size: room.size,
    filled: room.seats.length,
    seats: room.seats.map((s) => ({ name: s.name, isBot: !!s.isBot })),
  };
  room.seats.forEach((seat, idx) => {
    if (seat.socketId && !seat.isBot) io.to(seat.socketId).emit('room:lobby', { ...info, seat: idx });
  });
}

function seatView(room, seatIdx) {
  if (!room.match) return null;
  return viewFor(room.match, seatIdx);
}

function broadcastRoom(room, event) {
  room.seats.forEach((seat, idx) => {
    if (seat.socketId && seat.connected) {
      io.to(seat.socketId).emit(event, {
        roomId: room.id,
        code: room.code,
        seat: idx,
        seats: room.seats.map((s) => ({ name: s.name, connected: s.connected, auto: s.auto })),
        view: seatView(room, idx),
      });
    }
  });
}

function broadcastState(room) {
  room.seats.forEach((seat, idx) => {
    if (seat.socketId && seat.connected) {
      io.to(seat.socketId).emit('game:state', {
        seat: idx,
        seats: room.seats.map((s) => ({ name: s.name, connected: s.connected, auto: s.auto })),
        view: seatView(room, idx),
      });
    }
  });
}

// Run bot moves for any "auto" (disconnected) player whose turn it is, and
// advance the game. Also handles hand transitions.
function maybeRunBots(room) {
  if (!room.match) return;
  clearTimeout(room.botTimer);
  const step = () => {
    const m = room.match;
    if (!m) return;
    if (m.finished) { finishMatch(room); return; }
    if (m.hand.over) {
      startHand(m);
      broadcastState(room);
      room.botTimer = setTimeout(step, 1500);
      return;
    }
    const turn = m.hand.turn;
    const seat = room.seats[turn];
    if (seat && seat.auto) {
      runBotTurn(m, turn);
      broadcastState(room);
      // continue if next is also a bot / hand ended
      room.botTimer = setTimeout(step, 1200);
    }
  };
  room.botTimer = setTimeout(step, 800);
}

function finishMatch(room) {
  if (room._finished) return;
  room._finished = true;
  const m = room.match;
  const winnerTeam = m.winner;
  room.seats.forEach((seat, idx) => {
    if (!seat.isBot) {
      const team = idx % 2;
      recordResult(seat.userId, seat.name, team === winnerTeam, m.teamScores[team]);
    }
  });
  broadcastState(room);
}

function applyActionResult(room, res, seat) {
  if (!res.ok) {
    if (seat.socketId) io.to(seat.socketId).emit('game:error', { error: res.error });
    return false;
  }
  return true;
}

// After a human action, advance hand transitions and run bots if needed.
function afterHumanAction(room) {
  const m = room.match;
  if (!m) return;
  if (m.finished) { finishMatch(room); return; }
  broadcastState(room);
  if (m.hand.over && !m.finished) {
    // new hand shortly
    setTimeout(() => {
      if (room.match && room.match.hand.over && !room.match.finished) {
        startHand(room.match);
        broadcastState(room);
        maybeRunBots(room);
      }
    }, 2500);
    return;
  }
  maybeRunBots(room);
}

// ---- Socket handlers -----------------------------------------------------

io.on('connection', (socket) => {
  socket.data.userId = null;

  socket.on('hello', ({ userId, name }) => {
    if (!userId) return;
    socket.data.userId = userId;
    socket.data.name = name || 'Giocatore';
    socketUser.set(socket.id, userId);
    getProfile(userId, name);
    saveProfiles(profiles);

    // Reconnect to an active room?
    const roomId = userRoom.get(userId);
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const idx = seatIndexOfUser(room, userId);
      if (idx >= 0) {
        room.seats[idx].socketId = socket.id;
        room.seats[idx].connected = true;
        room.seats[idx].auto = false;
        socket.emit('room:rejoined', {
          roomId: room.id, code: room.code, seat: idx,
          seats: room.seats.map((s) => ({ name: s.name, connected: s.connected, auto: s.auto })),
          view: seatView(room, idx),
        });
        maybeRunBots(room);
      }
    }
    socket.emit('hello:ok', { profile: getProfile(userId, name) });
  });

  socket.on('queue:join', ({ size } = {}) => {
    const userId = socket.data.userId;
    if (!userId) return;
    if (userRoom.has(userId)) return; // already in a game
    const sz = size === 4 ? 4 : 2;
    quickQueues[2] = quickQueues[2].filter((q) => q.userId !== userId);
    quickQueues[4] = quickQueues[4].filter((q) => q.userId !== userId);
    quickQueues[sz].push({ userId, name: socket.data.name, socketId: socket.id });
    socket.emit('queue:waiting', { size: sz, waiting: quickQueues[sz].length });

    if (quickQueues[sz].length >= sz) {
      const picked = quickQueues[sz].splice(0, sz);
      const room = makeRoom('quick', null, sz);
      room.seats = picked.map((q) => ({ userId: q.userId, name: q.name, socketId: q.socketId, connected: true, auto: false }));
      startRoomMatch(room);
    }
  });

  socket.on('queue:leave', () => {
    const userId = socket.data.userId;
    quickQueues[2] = quickQueues[2].filter((q) => q.userId !== userId);
    quickQueues[4] = quickQueues[4].filter((q) => q.userId !== userId);
    socket.emit('queue:left', {});
  });

  socket.on('room:create', ({ size } = {}) => {
    const userId = socket.data.userId;
    if (!userId) return;
    if (userRoom.has(userId)) return;
    const sz = size === 4 ? 4 : 2;
    let code = code4();
    let guard = 0;
    while ([...rooms.values()].some((r) => r.code === code) && guard++ < 50) code = code4();
    const room = makeRoom('private', code, sz);
    room.seats = [{ userId, name: socket.data.name, socketId: socket.id, connected: true, auto: false }];
    userRoom.set(userId, room.id);
    socket.emit('room:created', { roomId: room.id, code: room.code, seat: 0, size: sz, filled: 1 });
  });

  socket.on('room:join', ({ code }) => {
    const userId = socket.data.userId;
    if (!userId) return;
    if (userRoom.has(userId)) return;
    const room = [...rooms.values()].find((r) => r.code === code && r.seats.length < r.size && !r.started);
    if (!room) { socket.emit('room:error', { error: 'Codice non valido o stanza piena.' }); return; }
    room.seats.push({ userId, name: socket.data.name, socketId: socket.id, connected: true, auto: false });
    userRoom.set(userId, room.id);
    if (room.seats.length >= room.size) startRoomMatch(room);
    else broadcastLobby(room);
  });

  // Private-room host fills remaining seats with bots and starts now.
  socket.on('room:startbots', () => {
    const userId = socket.data.userId;
    const roomId = userRoom.get(userId);
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.started || room.seats[0]?.userId !== userId) return;
    while (room.seats.length < room.size) room.seats.push(makeBotSeat());
    startRoomMatch(room);
  });

  socket.on('room:cancel', () => {
    const userId = socket.data.userId;
    const roomId = userRoom.get(userId);
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (!room.started) {
        for (const s of room.seats) if (!s.isBot) userRoom.delete(s.userId);
        rooms.delete(roomId);
        socket.emit('room:cancelled', {});
      }
    }
  });

  socket.on('game:action', (msg) => {
    const userId = socket.data.userId;
    const roomId = userRoom.get(userId);
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    const idx = seatIndexOfUser(room, userId);
    if (idx < 0 || !room.match) return;
    const seat = room.seats[idx];
    const m = room.match;
    let res;
    switch (msg.type) {
      case 'draw': res = drawCard(m, idx, msg.source); break;
      case 'meld': res = createMeld(m, idx, msg.cardIds); break;
      case 'addmeld': res = addToMeld(m, idx, msg.meldId, msg.cardIds); break;
      case 'discard': res = discardCard(m, idx, msg.cardId); break;
      default: res = { ok: false, error: 'Azione sconosciuta.' };
    }
    if (applyActionResult(room, res, seat)) afterHumanAction(room);
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    socketUser.delete(socket.id);
    quickQueues[2] = quickQueues[2].filter((q) => q.socketId !== socket.id);
    quickQueues[4] = quickQueues[4].filter((q) => q.socketId !== socket.id);
    if (!userId) return;
    const roomId = userRoom.get(userId);
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const idx = seatIndexOfUser(room, userId);
      if (idx >= 0) {
        room.seats[idx].connected = false;
        // Grace period, then let a bot take over so the game continues.
        setTimeout(() => {
          const r = rooms.get(roomId);
          if (!r) return;
          const s = r.seats[idx];
          if (s && !s.connected) {
            s.auto = true;
            broadcastState(r);
            maybeRunBots(r);
          }
        }, 20000);
        broadcastState(room);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Burraco server in ascolto sulla porta ${PORT}`);
  if (!fs.existsSync(DIST)) console.log('(build client con "npm run build" per servire la PWA)');
});
