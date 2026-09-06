import React from 'react';
import { SUIT_SYMBOL, SUIT_COLOR, RANK_LABEL } from '../engine/cards.js';

export function Card({ card, selected, onClick, small, dim, ghost }) {
  if (ghost || !card) {
    return <div className={`card card-empty ${small ? 'card-sm' : ''}`} />;
  }
  const isJoker = card.isJoker;
  const color = isJoker ? 'joker' : SUIT_COLOR[card.suit];
  const label = isJoker ? '★' : RANK_LABEL[card.rank];
  const symbol = isJoker ? 'JOLLY' : SUIT_SYMBOL[card.suit];
  return (
    <button
      type="button"
      className={`card card-${color} ${selected ? 'card-selected' : ''} ${small ? 'card-sm' : ''} ${dim ? 'card-dim' : ''}`}
      onClick={onClick}
      aria-label={isJoker ? 'Jolly' : `${label} ${symbol}`}
    >
      <span className="card-corner tl">
        <span className="card-rank">{label}</span>
        {!isJoker && <span className="card-suit">{symbol}</span>}
      </span>
      <span className="card-center">{isJoker ? '★' : symbol}</span>
      <span className="card-corner br">
        <span className="card-rank">{label}</span>
        {!isJoker && <span className="card-suit">{symbol}</span>}
      </span>
    </button>
  );
}

export function CardBack({ small, count, label }) {
  return (
    <div className={`card card-back ${small ? 'card-sm' : ''}`}>
      <div className="card-back-inner" />
      {typeof count === 'number' && <span className="card-back-count">{count}</span>}
      {label && <span className="card-back-label">{label}</span>}
    </div>
  );
}
