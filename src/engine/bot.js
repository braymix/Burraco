// Heuristic bot for Burraco. Drives a full turn by calling engine actions.
// Not a perfect player, but plays sensibly: melds, extends, forms burracos,
// takes the discard pile when clearly useful, and discards safely.

import { isJoker, isTwo, cardValue } from './cards.js';
import { validateMeld, validateAddition } from './rules.js';
import { drawCard, createMeld, addToMeld, discardCard, rawHand, teamOf } from './engine.js';

// Try to find candidate new melds from a pool of cards (array of card objects).
// Returns array of card-id groups that validate as melds. Mutates nothing.
function findNewMelds(pool) {
  const groups = [];
  let remaining = pool.slice();

  // 1) Runs per suit.
  const bySuit = { C: [], D: [], H: [], S: [] };
  for (const c of remaining) if (!isJoker(c)) bySuit[c.suit].push(c);

  for (const suit of Object.keys(bySuit)) {
    const cards = bySuit[suit];
    if (cards.length < 3) continue;
    const byRank = new Map();
    for (const c of cards) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, []);
      byRank.get(c.rank).push(c);
    }
    // Walk ranks 1..13, capture consecutive stretches (also allow ace-high tail).
    let stretch = [];
    const flush = () => {
      if (stretch.length >= 3) {
        const g = stretch.map((r) => byRank.get(r)[0]);
        if (validateMeld(g).valid) groups.push(g.map((c) => c.id));
        // consume one card per rank
        for (const r of stretch) byRank.get(r).shift();
      }
      stretch = [];
    };
    for (let r = 1; r <= 13; r++) {
      if (byRank.has(r) && byRank.get(r).length > 0) stretch.push(r);
      else flush();
    }
    flush();
    // Try Q-K-A (ace high).
    if (byRank.get(1)?.length && byRank.get(13)?.length && byRank.get(12)?.length) {
      const g = [byRank.get(12)[0], byRank.get(13)[0], byRank.get(1)[0]];
      if (validateMeld(g).valid) {
        groups.push(g.map((c) => c.id));
        byRank.get(12).shift(); byRank.get(13).shift(); byRank.get(1).shift();
      }
    }
  }

  // Remove already-grouped ids from remaining.
  const used = new Set(groups.flat());
  remaining = remaining.filter((c) => !used.has(c.id));

  // 2) Sets by rank (non-joker, and twos can form a set of twos).
  const byRank = new Map();
  for (const c of remaining) {
    if (isJoker(c)) continue;
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }
  for (const [, cards] of byRank) {
    if (cards.length >= 3) {
      const g = cards.slice(0, cards.length);
      if (validateMeld(g).valid) {
        groups.push(g.map((c) => c.id));
        for (const c of g) used.add(c.id);
      }
    }
  }
  remaining = remaining.filter((c) => !used.has(c.id));

  // 3) Use a single wild (joker or spare two) to turn a pair into a meld of three.
  const wilds = remaining.filter((c) => isJoker(c));
  const nonWild = remaining.filter((c) => !isJoker(c));
  if (wilds.length > 0) {
    // pair of same rank
    const rankMap = new Map();
    for (const c of nonWild) {
      if (!rankMap.has(c.rank)) rankMap.set(c.rank, []);
      rankMap.get(c.rank).push(c);
    }
    let placed = false;
    for (const [, cards] of rankMap) {
      if (placed) break;
      if (cards.length >= 2) {
        const g = [cards[0], cards[1], wilds[0]];
        if (validateMeld(g).valid) {
          groups.push(g.map((c) => c.id));
          placed = true;
        }
      }
    }
    // consecutive pair same suit + wild
    if (!placed) {
      const suitMap = { C: [], D: [], H: [], S: [] };
      for (const c of nonWild) if (!isJoker(c)) suitMap[c.suit]?.push(c);
      for (const suit of Object.keys(suitMap)) {
        if (placed) break;
        const cs = suitMap[suit].sort((a, b) => a.rank - b.rank);
        for (let i = 0; i < cs.length - 1 && !placed; i++) {
          if (cs[i + 1].rank - cs[i].rank <= 2) {
            const g = [cs[i], cs[i + 1], wilds[0]];
            if (validateMeld(g).valid) { groups.push(g.map((c) => c.id)); placed = true; }
          }
        }
      }
    }
  }

  return groups;
}

// Try to lay off single cards from pool onto existing melds. Returns list of
// { meldId, ids } and the set of used card ids.
function findLayoffs(pool, melds) {
  const used = new Set();
  const layoffs = [];
  for (const meld of melds) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of pool) {
        if (used.has(c.id)) continue;
        const currentCards = meld.cards.concat(
          layoffs.filter((l) => l.meldId === meld.id).flatMap((l) => l.cardObjs || [])
        );
        if (validateAddition(currentCards, [c])) {
          let entry = layoffs.find((l) => l.meldId === meld.id);
          if (!entry) { entry = { meldId: meld.id, ids: [], cardObjs: [] }; layoffs.push(entry); }
          entry.ids.push(c.id);
          entry.cardObjs.push(c);
          used.add(c.id);
          changed = true;
        }
      }
    }
  }
  return { layoffs, used };
}

// Decide whether to take the discard pile. Returns 'discard' or 'stock'.
// Biased toward drawing from the stock so the hand always progresses toward
// stock exhaustion; only takes the pile when the TOP card yields real value.
function decideDraw(h, p) {
  if (h.stock.length === 0) return 'stock'; // engine will end hand
  if (h.discard.length === 0) return 'stock';
  const top = h.discard[0];
  const hand = h.hands[p];
  const team = teamOf(p);
  const pileSize = h.discard.length;
  if (pileSize > 15) return 'stock';

  const base = new Set(findNewMelds(hand).flat());
  const withTop = new Set(findNewMelds(hand.concat([top])).flat());
  const topEnablesMeld = withTop.has(top.id) && !base.has(top.id);

  const withPile = new Set(findNewMelds(hand.concat(h.discard)).flat());
  const gain = withPile.size - base.size;

  // Also useful if the top card lays off onto our team's melds.
  const topLayoff = h.melds[team].some((m) => validateAddition(m.cards, [top]));

  if (topEnablesMeld && gain >= 2 && pileSize <= 12) return 'discard';
  if (topLayoff && pileSize <= 8) return 'discard';
  if (gain >= pileSize + 2 && pileSize <= 6) return 'discard';
  return 'stock';
}

// Choose a card to discard from the hand (must leave a legal state).
function chooseDiscard(h, p) {
  const hand = h.hands[p];
  // Never discard the only card if it would empty hand without close ability.
  const scores = hand.map((c) => ({ c, keep: keepScore(hand, c, h, p) }));
  scores.sort((a, b) => a.keep - b.keep || cardValue(b.c) - cardValue(a.c));
  // pick lowest keep; but avoid giving opponent an obvious layoff on their melds
  for (const s of scores) {
    if (!feedsOpponent(h, p, s.c)) return s.c.id;
  }
  return scores[0].c.id;
}

function keepScore(hand, card, h, p) {
  if (isJoker(card)) return 1000;      // never discard jokers
  if (isTwo(card)) return 500;         // keep pinelle
  let score = 0;
  // same rank partners
  const sameRank = hand.filter((x) => x !== card && !x.isJoker && x.rank === card.rank).length;
  score += sameRank * 30;
  // suit neighbours
  const neighbours = hand.filter(
    (x) => x !== card && !x.isJoker && x.suit === card.suit && Math.abs(x.rank - card.rank) <= 2
  ).length;
  score += neighbours * 20;
  // lower point cards are safer to keep? we mildly prefer discarding high singletons
  score -= cardValue(card) * 0.1;
  return score;
}

function feedsOpponent(h, p, card) {
  const oppTeam = 1 - teamOf(p);
  return h.melds[oppTeam].some((m) => validateAddition(m.cards, [card]));
}

// Run the bot's entire turn. Returns a list of action summaries.
export function runBotTurn(match, p) {
  const actions = [];
  const h = rawHand(match);
  if (!h || h.over || h.turn !== p) return actions;
  const team = teamOf(p);

  // 1) Draw.
  const src = decideDraw(h, p);
  const dr = drawCard(match, p, src);
  actions.push({ type: 'draw', source: src });
  if (!dr.ok || match.hand.over) return actions;

  // 2) Meld / layoff loop until no improvement.
  // Never reduce our hand to exactly 1 card unless the move legally closes or
  // refills from the pozzetto - otherwise we'd be unable to discard.
  const safeToApply = (count) => {
    const len = match.hand.hands[p].length;
    const newLen = len - count;
    if (newLen === 1) return false;                       // dead-end: can't discard later
    if (newLen === 0) {
      if (!match.hand.pozzettoTaken[team]) return true;   // emptying refills from pozzetto
      return match.hand.hasBurraco[team] || (count >= 7); // legal close needs a burraco
    }
    return true;
  };

  let progressed = true;
  let guard = 0;
  while (progressed && guard++ < 20 && !match.hand.over) {
    progressed = false;

    // Layoffs first (cheap points and helps reach burraco).
    const { layoffs } = findLayoffs(match.hand.hands[p], match.hand.melds[team]);
    for (const lo of layoffs) {
      let ids = lo.ids;
      // Trim so we don't get stuck on exactly 1 card.
      while (ids.length > 0 && !safeToApply(ids.length)) ids = ids.slice(0, -1);
      if (ids.length === 0) continue;
      const r = addToMeld(match, p, lo.meldId, ids);
      if (r.ok) { actions.push({ type: 'addmeld', meldId: lo.meldId, count: ids.length }); progressed = true; }
      if (match.hand.over) return actions;
    }

    // New melds.
    const groups = findNewMelds(match.hand.hands[p]);
    for (const g of groups) {
      if (!safeToApply(g.length)) continue;
      const r = createMeld(match, p, g);
      if (r.ok) { actions.push({ type: 'meld', count: g.length }); progressed = true; }
      if (match.hand.over) return actions;
    }
  }

  if (match.hand.over) return actions;

  // 3) Discard (and possibly close).
  const hand = match.hand.hands[p];
  if (hand.length === 0) {
    // Shouldn't happen (pozzetto auto-taken), but guard anyway.
    return actions;
  }
  // If we can close (pozzetto taken + burraco) prefer discarding a card to close.
  const cardId = chooseDiscard(match.hand, p);
  const d = discardCard(match, p, cardId);
  if (d.ok) actions.push({ type: 'discard', card: cardId, closed: !!d.closed, tookPozzetto: !!d.tookPozzetto });
  else {
    // Fallback: discard any non-emptying card.
    const alt = hand.find((c) => match.hand.hands[p].length > 1) || hand[0];
    const d2 = discardCard(match, p, alt.id);
    if (d2.ok) actions.push({ type: 'discard', card: alt.id });
  }
  return actions;
}
