// Burraco game engine - authoritative game state and legal moves.
// Two-player variant: each player is their own team, each with their own pozzetto.
// Pure ESM, no side effects on I/O; the caller (client or server) drives it.

import { buildDeck, shuffle, cardValue, isJoker } from './cards.js';
import { validateMeld, validateAddition } from './rules.js';

let meldSeq = 1;
function newMeldId() { return `m${meldSeq++}`; }

export const TARGET_SCORE = 2005;

// ---- Setup ----------------------------------------------------------------

export function createMatch({ players, rng = Math.random, targetScore = TARGET_SCORE }) {
  // players: [{ id, name, isBot }]
  const match = {
    id: 'match-' + Math.floor(rng() * 1e9).toString(36),
    targetScore,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      index: i,
      totalScore: 0,
    })),
    handNumber: 0,
    hand: null,       // current hand state
    finished: false,
    winner: null,
    log: [],
  };
  startHand(match, rng);
  return match;
}

export function startHand(match, rng = Math.random) {
  match.handNumber += 1;
  const deck = shuffle(buildDeck(), rng);
  const hands = [[], []];
  // Deal 11 cards each.
  for (let i = 0; i < 11; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }
  // Two pozzetti of 11 cards each.
  const pozzetti = [[], []];
  for (let i = 0; i < 11; i++) { pozzetti[0].push(deck.pop()); }
  for (let i = 0; i < 11; i++) { pozzetti[1].push(deck.pop()); }
  // One card starts the discard pile.
  const discard = [deck.pop()];
  const stock = deck; // remaining

  // Dealer alternates; non-dealer starts.
  const starter = match.handNumber % 2 === 1 ? 0 : 1;

  match.hand = {
    hands,
    stock,
    discard,
    pozzetti,
    pozzettoTaken: [false, false],
    melds: [[], []],           // melds per player/team
    hasBurraco: [false, false],
    turn: starter,
    phase: 'draw',             // 'draw' | 'play'
    tookDiscardThisTurn: false,
    over: false,
    closedBy: null,
    lastAction: null,
    turnCount: 0,
  };
  sortHand(match.hand.hands[0]);
  sortHand(match.hand.hands[1]);
  match.log.push({ t: 'hand-start', hand: match.handNumber, starter });
  return match;
}

export function sortHand(hand) {
  // Group jokers last, then by suit then rank; twos kept in suit order.
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

// Public: is it legal for player p to act now?
function ensureTurn(h, p) {
  if (h.over) return 'La mano è terminata.';
  if (h.turn !== p) return 'Non è il tuo turno.';
  return null;
}

// ---- Actions --------------------------------------------------------------

// draw from 'stock' or take the whole 'discard' pile.
export function drawCard(match, p, source) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'draw') return { ok: false, error: 'Hai già pescato.' };

  if (source === 'stock') {
    if (h.stock.length === 0) {
      // Stock empty -> the hand ends (nobody can draw).
      return endHandEmptyStock(match);
    }
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

// Create a new meld from cards in hand.
export function createMeld(match, p, cardIds) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'play') return { ok: false, error: 'Devi prima pescare.' };
  const cards = findCards(h.hands[p], cardIds);
  if (!cards) return { ok: false, error: 'Carte non valide.' };
  const v = validateMeld(cards);
  if (!v.valid) return { ok: false, error: 'Combinazione non valida.' };

  const willEmpty = h.hands[p].length - cardIds.length === 0;
  if (willEmpty && h.pozzettoTaken[p] && !willHaveBurracoAfterNewMeld(h, p, v)) {
    return { ok: false, error: 'Devi tenere una carta per lo scarto (serve un burraco per chiudere).' };
  }

  removeCards(h.hands[p], cardIds);
  const meld = { id: newMeldId(), cards: cards.slice(), type: v.type };
  h.melds[p].push(meld);
  recomputeBurraco(h, p);
  match.log.push({ t: 'meld', player: p, meld: meld.id, type: v.type, len: cards.length });
  h.lastAction = { type: 'meld', player: p };
  afterHandChange(match, p);
  return { ok: true, meldId: meld.id };
}

// Add cards from hand to an existing meld (own team's meld).
export function addToMeld(match, p, meldId, cardIds) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'play') return { ok: false, error: 'Devi prima pescare.' };
  const meld = h.melds[p].find((m) => m.id === meldId);
  if (!meld) return { ok: false, error: 'Combinazione non trovata.' };
  const cards = findCards(h.hands[p], cardIds);
  if (!cards) return { ok: false, error: 'Carte non valide.' };
  const v = validateAddition(meld.cards, cards);
  if (!v) return { ok: false, error: 'Non puoi aggiungere queste carte.' };

  const willEmpty = h.hands[p].length - cardIds.length === 0;
  if (willEmpty && h.pozzettoTaken[p]) {
    const otherBurraco = h.melds[p].some((m) => m !== meld && m.cards.length >= 7);
    const thisBurraco = meld.cards.length + cards.length >= 7;
    if (!otherBurraco && !thisBurraco) {
      return { ok: false, error: 'Devi tenere una carta per lo scarto (serve un burraco per chiudere).' };
    }
  }

  removeCards(h.hands[p], cardIds);
  meld.cards.push(...cards);
  meld.type = v.type;
  recomputeBurraco(h, p);
  match.log.push({ t: 'addmeld', player: p, meld: meldId, len: cards.length });
  h.lastAction = { type: 'addmeld', player: p };
  afterHandChange(match, p);
  return { ok: true };
}

function recomputeBurraco(h, p) {
  h.hasBurraco[p] = h.melds[p].some((m) => m.cards.length >= 7);
}

function willHaveBurracoAfterNewMeld(h, p, v) {
  if (v.length >= 7) return true;
  return h.melds[p].some((m) => m.cards.length >= 7);
}

// Called after melds change: if hand empty, take pozzetto, or close if allowed.
function afterHandChange(match, p) {
  const h = match.hand;
  if (h.hands[p].length !== 0) return;
  if (!h.pozzettoTaken[p]) {
    takePozzetto(match, p);
    return;
  }
  // Hand emptied via melds, pozzetto already taken: close in hand (needs a burraco).
  if (h.hasBurraco[p]) {
    closeHand(match, p);
  }
}

function takePozzetto(match, p) {
  const h = match.hand;
  if (h.pozzettoTaken[p]) return;
  const poz = h.pozzetti[p];
  h.hands[p].push(...poz.splice(0, poz.length));
  sortHand(h.hands[p]);
  h.pozzettoTaken[p] = true;
  match.log.push({ t: 'pozzetto', player: p });
  h.lastAction = { type: 'pozzetto', player: p };
}

// Discard one card, ending the turn. If it empties the hand and closing
// conditions are met, the hand closes.
export function discardCard(match, p, cardId) {
  const h = match.hand;
  const err = ensureTurn(h, p);
  if (err) return { ok: false, error: err };
  if (h.phase !== 'play') return { ok: false, error: 'Devi prima pescare.' };
  if (h.hands[p].length === 1 && !h.pozzettoTaken[p]) {
    // Discarding the last card would empty the hand; take pozzetto instead of ending.
    // Player must have a card to discard; here they still have one, so allow discard
    // only if this does not illegally close. We take pozzetto first.
  }
  const card = h.hands[p].find((x) => x.id === cardId);
  if (!card) return { ok: false, error: 'Carta non valida.' };

  const willEmpty = h.hands[p].length === 1;

  if (willEmpty) {
    if (!h.pozzettoTaken[p]) {
      // Discarding your last card empties the hand: take the pozzetto for next turn
      // and end the current turn.
      removeCards(h.hands[p], [cardId]);
      h.discard.unshift(card);
      takePozzetto(match, p);
      match.log.push({ t: 'discard', player: p, card: card.id, tookPozzetto: true });
      h.lastAction = { type: 'discard', player: p, card: card.id };
      endTurn(match);
      return { ok: true, tookPozzetto: true };
    }
    // Pozzetto already taken: can close if a burraco exists.
    if (h.hasBurraco[p]) {
      removeCards(h.hands[p], [cardId]);
      h.discard.unshift(card);
      closeHand(match, p);
      return { ok: true, closed: true };
    }
    // No burraco yet: cannot empty hand. Disallow this discard.
    return { ok: false, error: 'Non puoi chiudere senza aver fatto almeno un burraco.' };
  }

  // Normal discard.
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
  h.turn = 1 - h.turn;
  h.phase = 'draw';
  h.tookDiscardThisTurn = false;
  // Safety net: extremely long stalemates end the hand as if the stock ran out.
  if (h.turnCount > 400 && !h.over) {
    endHandEmptyStock(match);
  }
}

// ---- Hand end / scoring ---------------------------------------------------

function closeHand(match, p) {
  const h = match.hand;
  h.over = true;
  h.closedBy = p;
  match.log.push({ t: 'close', player: p });
  scoreHand(match, p);
}

function endHandEmptyStock(match) {
  const h = match.hand;
  h.over = true;
  h.closedBy = null;
  match.log.push({ t: 'stock-empty' });
  scoreHand(match, null);
  return { ok: true, handOver: true };
}

export function scoreHand(match, closerP) {
  const h = match.hand;
  const breakdown = [null, null];
  for (let p = 0; p < 2; p++) {
    let meldPoints = 0;
    let burracoBonus = 0;
    let cleanBurracos = 0;
    let dirtyBurracos = 0;
    for (const m of h.melds[p]) {
      meldPoints += m.cards.reduce((s, c) => s + cardValue(c), 0);
      if (m.cards.length >= 7) {
        // A burraco is clean (200) when it contains no wild card, else dirty (100).
        const v = validateMeld(m.cards);
        const isClean = v.valid ? v.clean : !m.cards.some((c) => isJoker(c));
        if (isClean) { burracoBonus += 200; cleanBurracos++; }
        else { burracoBonus += 100; dirtyBurracos++; }
      }
    }
    const handPenalty = h.hands[p].reduce((s, c) => s + cardValue(c), 0);
    const pozzettoPenalty = h.pozzettoTaken[p] ? 0 : 100;
    const closeBonus = closerP === p ? 100 : 0;

    const total = meldPoints + burracoBonus + closeBonus - handPenalty - pozzettoPenalty;
    breakdown[p] = {
      meldPoints, burracoBonus, cleanBurracos, dirtyBurracos,
      handPenalty, pozzettoPenalty, closeBonus, total,
    };
    match.players[p].totalScore += total;
  }
  h.breakdown = breakdown;

  // Check match end.
  const s0 = match.players[0].totalScore;
  const s1 = match.players[1].totalScore;
  if ((s0 >= match.targetScore || s1 >= match.targetScore) && s0 !== s1) {
    match.finished = true;
    match.winner = s0 > s1 ? 0 : 1;
    match.log.push({ t: 'match-end', winner: match.winner });
  }
  return breakdown;
}

// ---- Views ----------------------------------------------------------------

// Produce a redacted view for a specific viewer (hides opponents' hands and stock).
export function viewFor(match, viewer) {
  const h = match.hand;
  if (!h) return { match: baseMatch(match), hand: null };
  return {
    match: baseMatch(match),
    hand: {
      you: viewer,
      turn: h.turn,
      phase: h.phase,
      over: h.over,
      closedBy: h.closedBy,
      yourHand: h.hands[viewer] || [],
      oppHandCount: h.hands[1 - viewer] ? h.hands[1 - viewer].length : 0,
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
    targetScore: match.targetScore,
    handNumber: match.handNumber,
    finished: match.finished,
    winner: match.winner,
    players: match.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, index: p.index, totalScore: p.totalScore })),
  };
}

// Full (unredacted) engine access for bots / server-side AI.
export function rawHand(match) { return match.hand; }
