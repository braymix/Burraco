// Burraco game engine - authoritative game state and legal moves.
// Supports 2 players (1v1) and 4 players (2v2, teams = seats {0,2} and {1,3}).
// Melds, burracos and pozzetti belong to the TEAM. There are always 2 teams and
// 2 pozzetti (one per team). Pure ESM, no I/O side effects.

import { buildDeck, shuffle, cardValue, isJoker } from './cards.js';
import { validateMeld, validateAddition } from './rules.js';

let meldSeq = 1;
function newMeldId() { return `m${meldSeq++}`; }

export const TARGET_SCORE = 2005;
export const NUM_TEAMS = 2;

export function teamOf(playerIndex) { return playerIndex % NUM_TEAMS; }

// ---- Setup ----------------------------------------------------------------

export function createMatch({ players, rng = Math.random, targetScore = TARGET_SCORE }) {
  // players: [{ id, name, isBot }] - length 2 or 4.
  const numPlayers = players.length;
  const match = {
    id: 'match-' + Math.floor(rng() * 1e9).toString(36),
    numPlayers,
    targetScore,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      index: i,
      team: teamOf(i),
    })),
    teamScores: [0, 0],
    handNumber: 0,
    hand: null,
    finished: false,
    winner: null,
    log: [],
  };
  startHand(match, rng);
  return match;
}

export function startHand(match, rng = Math.random) {
  match.handNumber += 1;
  const n = match.numPlayers;
  const deck = shuffle(buildDeck(), rng);
  const hands = Array.from({ length: n }, () => []);
  for (let i = 0; i < 11; i++) {
    for (let p = 0; p < n; p++) hands[p].push(deck.pop());
  }
  // Two pozzetti of 11 cards each (one per team).
  const pozzetti = [[], []];
  for (let t = 0; t < NUM_TEAMS; t++) {
    for (let i = 0; i < 11; i++) pozzetti[t].push(deck.pop());
  }
  const discard = [deck.pop()];
  const stock = deck;

  const starter = (match.handNumber - 1) % n;

  match.hand = {
    hands,
    stock,
    discard,
    pozzetti,
    pozzettoTaken: [false, false],   // per team
    melds: [[], []],                 // per team
    hasBurraco: [false, false],      // per team
    turn: starter,
    phase: 'draw',
    tookDiscardThisTurn: false,
    over: false,
    closedBy: null,                  // team index or null
    lastAction: null,
    turnCount: 0,
  };
  for (let p = 0; p < n; p++) sortHand(match.hand.hands[p]);
  match.log.push({ t: 'hand-start', hand: match.handNumber, starter });
  return match;
}

export function sortHand(hand) {
  hand.sort((a, b) => {
    if (a.isJoker !== b.isJoker) return a.isJoker ? 1 : -1;
    if (a.isJoker && b.isJoker) return 0;
    if (a.suit !== b.suit) return a.suit < b.suit ? -1 : 1;
    return a.rank - b.rank;
  });
}

// ---- Helpers --------------------------------------------------------------

function findCards(hand, ids) {
  const out = [];
  for (const id of ids) {
    const c = hand.find((x) => x.id === id);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

function removeCards(hand, ids) {
  for (const id of ids) {
    const idx = hand.findIndex((x) => x.id === id);
    if (idx >= 0) hand.splice(idx, 1);
  }
}

export function currentPlayer(match) {
  return match.hand ? match.hand.turn : -1;
}

function ensureTurn(h, p) {
  if (h.over) return 'La mano è terminata.';
  if (h.turn !== p) return 'Non è il tuo turno.';
  return null;
}

// ---- Actions --------------------------------------------------------------

export function drawCard(match, p, source) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'draw') return { ok: false, error: 'Hai già pescato.' };

  if (source === 'stock') {
    if (h.stock.length === 0) return endHandEmptyStock(match);
    const card = h.stock.pop();
    h.hands[p].push(card);
    sortHand(h.hands[p]);
    h.phase = 'play';
    h.tookDiscardThisTurn = false;
    h.lastAction = { type: 'draw', source: 'stock', player: p };
    match.log.push({ t: 'draw', player: p, source: 'stock' });
    return { ok: true };
  }

  if (source === 'discard') {
    if (h.discard.length === 0) return { ok: false, error: 'La pila degli scarti è vuota.' };
    const taken = h.discard.splice(0, h.discard.length);
    h.hands[p].push(...taken);
    sortHand(h.hands[p]);
    h.phase = 'play';
    h.tookDiscardThisTurn = true;
    h.lastAction = { type: 'draw', source: 'discard', player: p, count: taken.length };
    match.log.push({ t: 'draw', player: p, source: 'discard', count: taken.length });
    return { ok: true };
  }
  return { ok: false, error: 'Sorgente pesca non valida.' };
}

export function createMeld(match, p, cardIds) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'play') return { ok: false, error: 'Devi prima pescare.' };
  const t = teamOf(p);
  const cards = findCards(h.hands[p], cardIds);
  if (!cards) return { ok: false, error: 'Carte non valide.' };
  const v = validateMeld(cards);
  if (!v.valid) return { ok: false, error: 'Combinazione non valida.' };

  const willEmpty = h.hands[p].length - cardIds.length === 0;
  if (willEmpty && h.pozzettoTaken[t] && !willHaveBurracoAfterNewMeld(h, t, v)) {
    return { ok: false, error: 'Devi tenere una carta per lo scarto (serve un burraco per chiudere).' };
  }

  removeCards(h.hands[p], cardIds);
  const meld = { id: newMeldId(), cards: cards.slice(), type: v.type, owner: p };
  h.melds[t].push(meld);
  recomputeBurraco(h, t);
  match.log.push({ t: 'meld', player: p, team: t, meld: meld.id, type: v.type, len: cards.length });
  h.lastAction = { type: 'meld', player: p };
  afterHandChange(match, p);
  return { ok: true, meldId: meld.id };
}

export function addToMeld(match, p, meldId, cardIds) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'play') return { ok: false, error: 'Devi prima pescare.' };
  const t = teamOf(p);
  const meld = h.melds[t].find((m) => m.id === meldId);
  if (!meld) return { ok: false, error: 'Combinazione non trovata.' };
  const cards = findCards(h.hands[p], cardIds);
  if (!cards) return { ok: false, error: 'Carte non valide.' };
  const v = validateAddition(meld.cards, cards);
  if (!v) return { ok: false, error: 'Non puoi aggiungere queste carte.' };

  const willEmpty = h.hands[p].length - cardIds.length === 0;
  if (willEmpty && h.pozzettoTaken[t]) {
    const otherBurraco = h.melds[t].some((mm) => mm !== meld && mm.cards.length >= 7);
    const thisBurraco = meld.cards.length + cards.length >= 7;
    if (!otherBurraco && !thisBurraco) {
      return { ok: false, error: 'Devi tenere una carta per lo scarto (serve un burraco per chiudere).' };
    }
  }

  removeCards(h.hands[p], cardIds);
  meld.cards.push(...cards);
  meld.type = v.type;
  recomputeBurraco(h, t);
  match.log.push({ t: 'addmeld', player: p, team: t, meld: meldId, len: cards.length });
  h.lastAction = { type: 'addmeld', player: p };
  afterHandChange(match, p);
  return { ok: true };
}

function recomputeBurraco(h, t) {
  h.hasBurraco[t] = h.melds[t].some((m) => m.cards.length >= 7);
}

function willHaveBurracoAfterNewMeld(h, t, v) {
  if (v.length >= 7) return true;
  return h.melds[t].some((m) => m.cards.length >= 7);
}

// After melds change: if the player's hand is empty, take pozzetto or close.
function afterHandChange(match, p) {
  const h = match.hand;
  const t = teamOf(p);
  if (h.hands[p].length !== 0) return;
  if (!h.pozzettoTaken[t]) {
    takePozzetto(match, p, t);
    return;
  }
  if (h.hasBurraco[t]) closeHand(match, t);
}

function takePozzetto(match, p, t) {
  const h = match.hand;
  if (h.pozzettoTaken[t]) return;
  const poz = h.pozzetti[t];
  h.hands[p].push(...poz.splice(0, poz.length));
  sortHand(h.hands[p]);
  h.pozzettoTaken[t] = true;
  match.log.push({ t: 'pozzetto', player: p, team: t });
  h.lastAction = { type: 'pozzetto', player: p };
}

export function discardCard(match, p, cardId) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'play') return { ok: false, error: 'Devi prima pescare.' };
  const t = teamOf(p);
  const card = h.hands[p].find((x) => x.id === cardId);
  if (!card) return { ok: false, error: 'Carta non valida.' };

  const willEmpty = h.hands[p].length === 1;

  if (willEmpty) {
    if (!h.pozzettoTaken[t]) {
      removeCards(h.hands[p], [cardId]);
      h.discard.unshift(card);
      takePozzetto(match, p, t);
      match.log.push({ t: 'discard', player: p, card: card.id, tookPozzetto: true });
      h.lastAction = { type: 'discard', player: p, card: card.id };
      endTurn(match);
      return { ok: true, tookPozzetto: true };
    }
    if (h.hasBurraco[t]) {
      removeCards(h.hands[p], [cardId]);
      h.discard.unshift(card);
      closeHand(match, t);
      return { ok: true, closed: true };
    }
    return { ok: false, error: 'Non puoi chiudere senza aver fatto almeno un burraco.' };
  }

  removeCards(h.hands[p], [cardId]);
  h.discard.unshift(card);
  match.log.push({ t: 'discard', player: p, card: card.id });
  h.lastAction = { type: 'discard', player: p, card: card.id };
  endTurn(match);
  return { ok: true };
}

function endTurn(match) {
  const h = match.hand;
  h.turnCount = (h.turnCount || 0) + 1;
  h.turn = (h.turn + 1) % match.numPlayers;
  h.phase = 'draw';
  h.tookDiscardThisTurn = false;
  if (h.turnCount > 800 && !h.over) endHandEmptyStock(match);
}

// ---- Hand end / scoring ---------------------------------------------------

function closeHand(match, team) {
  const h = match.hand;
  h.over = true;
  h.closedBy = team;
  match.log.push({ t: 'close', team });
  scoreHand(match, team);
}

function endHandEmptyStock(match) {
  const h = match.hand;
  h.over = true;
  h.closedBy = null;
  match.log.push({ t: 'stock-empty' });
  scoreHand(match, null);
  return { ok: true, handOver: true };
}

export function scoreHand(match, closerTeam) {
  const h = match.hand;
  const n = match.numPlayers;
  const breakdown = [null, null];
  for (let t = 0; t < NUM_TEAMS; t++) {
    let meldPoints = 0;
    let burracoBonus = 0;
    let cleanBurracos = 0;
    let dirtyBurracos = 0;
    for (const m of h.melds[t]) {
      meldPoints += m.cards.reduce((s, c) => s + cardValue(c), 0);
      if (m.cards.length >= 7) {
        const v = validateMeld(m.cards);
        const isClean = v.valid ? v.clean : !m.cards.some((c) => isJoker(c));
        if (isClean) { burracoBonus += 200; cleanBurracos++; }
        else { burracoBonus += 100; dirtyBurracos++; }
      }
    }
    // Sum hand penalties for all players on this team.
    let handPenalty = 0;
    for (let p = 0; p < n; p++) {
      if (teamOf(p) === t) handPenalty += h.hands[p].reduce((s, c) => s + cardValue(c), 0);
    }
    const pozzettoPenalty = h.pozzettoTaken[t] ? 0 : 100;
    const closeBonus = closerTeam === t ? 100 : 0;
    const total = meldPoints + burracoBonus + closeBonus - handPenalty - pozzettoPenalty;
    breakdown[t] = {
      meldPoints, burracoBonus, cleanBurracos, dirtyBurracos,
      handPenalty, pozzettoPenalty, closeBonus, total,
    };
    match.teamScores[t] += total;
  }
  h.breakdown = breakdown;

  const s0 = match.teamScores[0];
  const s1 = match.teamScores[1];
  if ((s0 >= match.targetScore || s1 >= match.targetScore) && s0 !== s1) {
    match.finished = true;
    match.winner = s0 > s1 ? 0 : 1;
    match.log.push({ t: 'match-end', winner: match.winner });
  }
  return breakdown;
}

// ---- Views ----------------------------------------------------------------

export function viewFor(match, viewer) {
  const h = match.hand;
  if (!h) return { match: baseMatch(match), hand: null };
  const n = match.numPlayers;
  return {
    match: baseMatch(match),
    hand: {
      you: viewer,
      yourTeam: teamOf(viewer),
      turn: h.turn,
      phase: h.phase,
      over: h.over,
      closedBy: h.closedBy,
      yourHand: h.hands[viewer] || [],
      handCounts: Array.from({ length: n }, (_, p) => h.hands[p].length),
      stockCount: h.stock.length,
      discard: h.discard,
      melds: h.melds,
      pozzettoTaken: h.pozzettoTaken,
      pozzettiCount: h.pozzetti.map((x) => x.length),
      hasBurraco: h.hasBurraco,
      tookDiscardThisTurn: h.tookDiscardThisTurn,
      lastAction: h.lastAction,
      breakdown: h.breakdown || null,
    },
  };
}

function baseMatch(match) {
  return {
    id: match.id,
    numPlayers: match.numPlayers,
    targetScore: match.targetScore,
    handNumber: match.handNumber,
    finished: match.finished,
    winner: match.winner,
    teamScores: match.teamScores.slice(),
    players: match.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, index: p.index, team: p.team })),
  };
}

export function rawHand(match) { return match.hand; }
