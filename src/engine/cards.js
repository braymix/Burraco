// Pure ESM module - usable both in the browser (Vite) and in Node (server).
// Card model and deck utilities for Burraco.

export const SUITS = ['C', 'D', 'H', 'S']; // Clubs, Diamonds, Hearts, Spades
export const SUIT_SYMBOL = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const SUIT_COLOR = { C: 'black', S: 'black', D: 'red', H: 'red' };

// Ranks: 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. Jokers use rank 0.
export const RANK_LABEL = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

// Point value of a single card (used for scoring).
export function cardValue(card) {
  if (card.isJoker) return 30;      // Jolly
  if (card.rank === 2) return 20;   // Pinella
  if (card.rank === 1) return 15;   // Asso
  if (card.rank >= 8) return 10;    // 8,9,10,J,Q,K
  return 5;                          // 3,4,5,6,7
}

// A card is a "wild resource" candidate if it is a joker or a two.
// (A two can also be played naturally in a run of its suit or a set of twos.)
export function isJoker(card) { return !!card.isJoker; }
export function isTwo(card) { return !card.isJoker && card.rank === 2; }
export function isWildCandidate(card) { return isJoker(card) || isTwo(card); }

export function cardLabel(card) {
  if (card.isJoker) return '★';
  return RANK_LABEL[card.rank];
}

export function cardText(card) {
  if (card.isJoker) return 'Jolly';
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}

// Build the full Burraco deck: two standard 52-card decks + 4 jokers = 108 cards.
export function buildDeck() {
  const cards = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        cards.push({
          id: `d${d}-${suit}${rank}`,
          suit,
          rank,
          isJoker: false,
        });
      }
    }
    // Two jokers per deck.
    cards.push({ id: `d${d}-J0`, suit: null, rank: 0, isJoker: true });
    cards.push({ id: `d${d}-J1`, suit: null, rank: 0, isJoker: true });
  }
  return cards;
}

// Deterministic-ish shuffle using a provided rng (defaults to Math.random).
export function shuffle(cards, rng = Math.random) {
  const arr = cards.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sumValue(cards) {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}
