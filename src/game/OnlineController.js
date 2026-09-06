// Online controller: talks to the server over Socket.IO. The server is
// authoritative; this just relays actions and forwards state.

import { io } from 'socket.io-client';

export class OnlineController {
  constructor({ profile }) {
    this.mode = 'online';
    this.profile = profile;
    this.listeners = new Set();
    this.state = {
      mode: 'online',
      connection: 'connecting',
      seat: -1,
      seats: [],
      view: null,
      roomCode: null,
      matchmaking: 'idle', // idle | queue | waiting-room | in-game | finished
      error: null,
    };
    this.disposed = false;

    const url = import.meta.env.DEV ? 'http://localhost:3001' : undefined;
    this.socket = io(url, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this._patch({ connection: 'connected' });
      this.socket.emit('hello', { userId: profile.userId, name: profile.name });
    });
    this.socket.on('disconnect', () => this._patch({ connection: 'disconnected' }));

    this.socket.on('hello:ok', () => {});
    this.socket.on('queue:waiting', () => this._patch({ matchmaking: 'queue' }));
    this.socket.on('queue:left', () => this._patch({ matchmaking: 'idle' }));

    this.socket.on('room:created', ({ code, seat }) =>
      this._patch({ matchmaking: 'waiting-room', roomCode: code, seat }));
    this.socket.on('room:cancelled', () =>
      this._patch({ matchmaking: 'idle', roomCode: null }));
    this.socket.on('room:error', ({ error }) => this._patch({ error }));
    this.socket.on('room:rejoined', (d) =>
      this._patch({ matchmaking: 'in-game', seat: d.seat, seats: d.seats, view: d.view, roomCode: d.code }));

    const onStart = (d) => this._patch({
      matchmaking: 'in-game', seat: d.seat, seats: d.seats, view: d.view, roomCode: d.code,
    });
    this.socket.on('match:start', onStart);

    this.socket.on('game:state', (d) => {
      const finished = d.view?.match?.finished;
      this._patch({
        matchmaking: finished ? 'finished' : 'in-game',
        seat: d.seat, seats: d.seats, view: d.view,
      });
    });
    this.socket.on('game:error', ({ error }) => this._patchTransientError(error));
  }

  subscribe(cb) {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }
  _emit() { for (const cb of this.listeners) cb(this.state); }
  _patch(p) { this.state = { ...this.state, ...p, error: p.error ?? null }; this._emit(); }
  _patchTransientError(error) { this.state = { ...this.state, error }; this._emit(); }

  getState() { return this.state; }

  // ---- matchmaking ----
  quickMatch() { this.socket.emit('queue:join'); this._patch({ matchmaking: 'queue' }); }
  leaveQueue() { this.socket.emit('queue:leave'); }
  createRoom() { this.socket.emit('room:create'); }
  joinRoom(code) { this.socket.emit('room:join', { code: (code || '').toUpperCase().trim() }); }
  cancelRoom() { this.socket.emit('room:cancel'); }

  // ---- game actions ----
  draw(source) { this.socket.emit('game:action', { type: 'draw', source }); return { ok: true }; }
  meld(cardIds) { this.socket.emit('game:action', { type: 'meld', cardIds }); return { ok: true }; }
  addMeld(meldId, cardIds) { this.socket.emit('game:action', { type: 'addmeld', meldId, cardIds }); return { ok: true }; }
  discard(cardId) { this.socket.emit('game:action', { type: 'discard', cardId }); return { ok: true }; }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
    try { this.socket.close(); } catch { /* ignore */ }
  }
}
