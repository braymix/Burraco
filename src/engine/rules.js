// Meld validation and scoring rules for Burraco.
// A meld is either a SET (same rank, 3+ cards) or a RUN (same suit, consecutive, 3+ cards).
// Wild cards are Jokers (always wild) and Twos used as wild ("pinelle").
// Standard rule enforced here: at most ONE wild per meld.

import { isJoker, isTwo, cardValue } from './cards.js';

const MAX_WILD = 1;

// ---------- SET validation ----------
// A set = 3+ cards of the same rank. Optionally one wild (joker or a two-as-wild).
// A set of twos is allowed: all twos count as natural, jokers as wild.
function validateSet(cards) {
  if (cards.length < 3) return null;
  const jokers = cards.filter(isJoker);
  const nonJokers = cards.filter((c) => !isJoker(c));
  if (nonJokers.length === 0) return null;

  // Case A: a set of twos (rank === 2). Twos natural, jokers wild.
  const allTwos = nonJokers.every((c) => c.rank === 2);
  if (allTwos) {
    const wildCount = jokers.length;
    if (wildCount > MAX_WILD) return null;
    if (cards.length - wildCount < 2) return null; // need >=2 naturals
    return meldResult('set', cards, wildCount, 2);
  }

  // Case B: a set of some rank R (!= 2). Twos here are wild.
  const naturals = nonJokers.filter((c) => c.rank !== 2);
  const twos = nonJokers.filter((c) => c.rank === 2);
  if (naturals.length === 0) return null;
  const rank = naturals[0].rank;
  if (!naturals.every((c) => c.rank === rank)) return null;
  const wildCount = jokers.length + twos.length;
  if (wildCount > MAX_WILD) return null;
  if (naturals.length < 2) return null; // need >=2 real naturals
  return meldResult('set', cards, wildCount, rank);
}

// ---------- RUN validation ----------
// A run = 3+ cards of the same suit in consecutive ranks. Ace can be low (A-2-3)
// or high (Q-K-A). No wrap-around. At most one wild.
function validateRun(cards) {
  if (cards.length < 3) return null;
  const jokers = cards.filter(isJoker);
  if (jokers.length > MAX_WILD) return null;

  const nonJokers = cards.filter((c) => !isJoker(c));
  const nonTwo = nonJokers.filter((c) => c.rank !== 2);
  if (nonTwo.length === 0) return null; // need a suit anchor
  const suit = nonTwo[0].suit;
  if (!nonTwo.every((c) => c.suit === suit)) return null;

  const twos = nonJokers.filter((c) => c.rank === 2);

  // Enumerate which twos are "natural" (must be of the run's suit) vs "wild".
  // With MAX_WILD = 1, the total wild count (jokers + wild-twos) must be <= 1.
  const jokerWild = jokers.length; // 0 or 1

  // Build candidate interpretations.
  const interpretations = [];
  if (jokerWild === 1) {
    // No two may be wild. All twos must be natural and of the run's suit.
    if (twos.every((t) => t.suit === suit)) {
      interpretations.push({ naturals: nonTwo.concat(twos), wilds: 1 });
    }
  } else {
    // jokerWild === 0. Either 0 wild-twos (all twos natural) or exactly one two wild.
    if (twos.every((t) => t.suit === suit)) {
      interpretations.push({ naturals: nonTwo.concat(twos), wilds: 0 });
    }
    if (twos.length >= 1) {
      // one two is wild; the remaining twos must be natural of the suit
      // (only meaningful if the remaining twos are of the suit)
      const rest = twos.slice(1);
      if (rest.every((t) => t.suit === suit)) {
        interpretations.push({ naturals: nonTwo.concat(rest), wilds: 1 });
      }
    }
  }

  for (const interp of interpretations) {
    const res = tryFormRun(interp.naturals, interp.wilds, suit, cards);
    if (res) return res;
  }
  return null;
}

// Natural cards (fixed suit), W wild slots (0 or 1). Try to make a consecutive run.
function tryFormRun(naturals, wilds, suit, allCards) {
  const n = naturals.length + wilds;
  if (n < 3) return null;

  // Aces can be low (1) or high (14). Enumerate ace assignments.
  const aceIdx = [];
  const baseRanks = [];
  naturals.forEach((c) => {
    if (c.rank === 1) { aceIdx.push(baseRanks.length); baseRanks.push(1); }
    else baseRanks.push(c.rank);
  });

  const combos = enumerateAceCombos(baseRanks, aceIdx);
  for (const ranks of combos) {
    const sorted = ranks.slice().sort((a, b) => a - b);
    // distinct
    let distinct = true;
    for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) { distinct = false; break; }
    if (!distinct) continue;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const span = max - min + 1;
    if (span > n) continue;
    const missingInside = span - sorted.length;
    if (missingInside > wilds) continue;
    const extraWild = wilds - missingInside;
    // extra wild must extend at an end and stay within [1,14]
    if (extraWild > 0) {
      const canLeft = min - 1 >= 1;
      const canRight = max + 1 <= 14;
      if (!canLeft && !canRight) continue;
    }
    // Success.
    return meldResult('run', allCards, wilds, null);
  }
  return null;
}

function enumerateAceCombos(baseRanks, aceIdx) {
  if (aceIdx.length === 0) return [baseRanks];
  const combos = [];
  const total = 1 << aceIdx.length;
  for (let mask = 0; mask < total; mask++) {
    const r = baseRanks.slice();
    for (let k = 0; k < aceIdx.length; k++) {
      r[aceIdx[k]] = (mask & (1 << k)) ? 14 : 1;
    }
    combos.push(r);
  }
  return combos;
}

function meldResult(type, cards, wildCount, rank) {
  const clean = wildCount === 0;
  const points = cards.reduce((s, c) => s + cardValue(c), 0);
  const isBurraco = cards.length >= 7;
  return {
    valid: true,
    type,
    clean,
    wildCount,
    rank,
    length: cards.length,
    points,
    isBurraco,
    burracoBonus: isBurraco ? (clean ? 200 : 100) : 0,
  };
}

// Public: validate an arbitrary set of cards as a meld. Tries set then run.
export function validateMeld(cards) {
  if (!cards || cards.length < 3) return { valid: false };
  const asSet = validateSet(cards);
  if (asSet) return asSet;
  const asRun = validateRun(cards);
  if (asRun) return asRun;
  return { valid: false };
}

// Public: can `cards` be added to an existing meld (of given existing cards)?
// Returns the new validation if the combined set is valid, else null.
export function validateAddition(existingCards, addedCards) {
  const combined = existingCards.concat(addedCards);
  const v = validateMeld(combined);
  if (v.valid) {
    // Extra guard: the meld type should not silently flip in a nonsensical way,
    // but validateMeld already picks a valid interpretation, so accept it.
    return v;
  }
  return null;
}
