// Singleplayer controller: runs the full engine in the browser, human = seat 0,
// bot = seat 1. Works fully offline (PWA).

import {
  createMatch, startHand, viewFor, rawHand,
  drawCard, createMeld, addToMeld, discardCard,
} from '../engine/engine.js';
import { runBotTurn } from '../engine/bot.js';

export class LocalController {
  constructor({ playerName = 'Tu', botName = 'Bot', targetScore } = {}) {
    this.mode = 'local';
    this.you = 0;
    this.listeners = new Set();
    this.disposed = false;
    this.botThinking = false;
    this.match = createMatch({
      players: [
        { id: 'you', name: playerName, isBot: false },
        { id: 'bot', name: botName, isBot: true },
      ],
      targetScore,
    });
    // If the bot starts, let it play.
    setTimeout(() => this._maybeBot(), 500);
  }

  subscribe(cb) {
    this.listeners.add(cb);
    cb(this.getState());
    return () => this.listeners.delete(cb);
  }

  _emit() {
    const s = this.getState();
    for (const cb of this.listeners) cb(s);
  }

  getState() {
    return {
      mode: 'local',
      connection: 'local',
      seat: this.you,
      seats: [
        { name: this.match.players[0].name, connected: true, auto: false },
        { name: this.match.players[1].name, connected: true, auto: true },
      ],
      view: viewFor(this.match, this.you),
      botThinking: this.botThinking,
    };
  }

  _afterAction() {
    const m = this.match;
    this._emit();
    if (m.finished) return;
    if (m.hand.over) {
      // Auto-start next hand after a pause.
      setTimeout(() => {
        if (this.disposed || this.match.finished) return;
        if (this.match.hand.over) { startHand(this.match); this._emit(); this._maybeBot(); }
      }, 3000);
      return;
    }
    this._maybeBot();
  }

  _maybeBot() {
    const m = this.match;
    if (this.disposed || m.finished || m.hand.over) return;
    if (m.hand.turn !== 1) return; // not the bot's turn
    this.botThinking = true;
    this._emit();
    // Small delay so the human can follow the bot's moves.
    setTimeout(() => {
      if (this.disposed) return;
      const h = rawHand(m);
      if (!h || h.over || h.turn !== 1) { this.botThinking = false; this._emit(); return; }
      runBotTurn(m, 1);
      this.botThinking = false;
      this._afterAction();
    }, 900);
  }

  // ---- actions (human) ----
  draw(source) {
    const r = drawCard(this.match, this.you, source);
    if (r.ok) this._afterAction(); else this._emitError(r.error);
    return r;
  }
  meld(cardIds) {
    const r = createMeld(this.match, this.you, cardIds);
    if (r.ok) this._afterAction(); else this._emitError(r.error);
    return r;
  }
  addMeld(meldId, cardIds) {
    const r = addToMeld(this.match, this.you, meldId, cardIds);
    if (r.ok) this._afterAction(); else this._emitError(r.error);
    return r;
  }
  discard(cardId) {
    const r = discardCard(this.match, this.you, cardId);
    if (r.ok) this._afterAction(); else this._emitError(r.error);
    return r;
  }
  nextHand() {
    if (this.match.hand.over && !this.match.finished) {
      startHand(this.match); this._emit(); this._maybeBot();
    }
  }

  _emitError(error) {
    for (const cb of this.listeners) cb({ ...this.getState(), error });
  }

  dispose() { this.disposed = true; this.listeners.clear(); }
}
