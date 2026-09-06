import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardBack } from './Card.jsx';
import { validateMeld } from '../engine/rules.js';
import { cardValue } from '../engine/cards.js';

export function GameBoard({ controller, state, onExit }) {
  const [selected, setSelected] = useState(() => new Set());
  const [toast, setToast] = useState(null);

  const view = state.view;
  useEffect(() => {
    if (state.error) {
      setToast(state.error);
      const t = setTimeout(() => setToast(null), 2600);
      return () => clearTimeout(t);
    }
  }, [state.error, state.view]);

  // Clear selection when it's no longer our turn / hand changes.
  useEffect(() => { setSelected(new Set()); }, [view?.hand?.turn, view?.hand?.over, view?.match?.handNumber]);

  if (!view || !view.hand) {
    return (
      <div className="board-loading">
        <div className="spinner" />
        <p>In attesa della partita…</p>
        <button className="btn btn-ghost" onClick={onExit}>Esci</button>
      </div>
    );
  }

  const h = view.hand;
  const m = view.match;
  const you = h.you;
  const opp = 1 - you;
  const isMyTurn = h.turn === you && !h.over && !m.finished;
  const phase = h.phase;

  const myHand = h.yourHand || [];
  const selectedCards = myHand.filter((c) => selected.has(c.id));

  const toggle = (id) => {
    if (!isMyTurn || phase !== 'play') return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const doDraw = (source) => {
    if (!isMyTurn || phase !== 'draw') return;
    controller.draw(source);
  };

  const selValidation = selectedCards.length >= 3 ? validateMeld(selectedCards) : null;

  const doCreateMeld = () => {
    if (selectedCards.length < 3) { setToast('Seleziona almeno 3 carte.'); return; }
    const r = controller.meld(selectedCards.map((c) => c.id));
    if (r && r.ok !== false) setSelected(new Set());
  };
  const doAddToMeld = (meldId) => {
    if (phase !== 'play' || !isMyTurn) return;
    if (selectedCards.length === 0) { setToast('Seleziona le carte da aggiungere.'); return; }
    const r = controller.addMeld(meldId, selectedCards.map((c) => c.id));
    if (r && r.ok !== false) setSelected(new Set());
  };
  const doDiscard = () => {
    if (selectedCards.length !== 1) { setToast('Seleziona una sola carta da scartare.'); return; }
    const r = controller.discard(selectedCards[0].id);
    if (r && r.ok !== false) setSelected(new Set());
  };

  const myMelds = h.melds[you] || [];
  const oppMelds = h.melds[opp] || [];

  const oppName = m.players[opp]?.name || 'Avversario';
  const myName = m.players[you]?.name || 'Tu';
  const oppSeat = state.seats?.[opp];
  const oppAuto = oppSeat?.auto || state.mode === 'local';
  const oppDisconnected = oppSeat && !oppSeat.connected && state.mode === 'online';

  return (
    <div className="board">
      <TopBar m={m} you={you} onExit={onExit} state={state} />

      {/* Opponent zone */}
      <div className={`player-zone opp ${h.turn === opp && !h.over ? 'active' : ''}`}>
        <div className="player-head">
          <span className="pname">
            {oppName}{' '}
            {oppDisconnected && <span className="badge warn">disconnesso</span>}
            {oppAuto && state.mode === 'online' && <span className="badge">bot</span>}
          </span>
          <span className="pscore">{m.players[opp]?.totalScore ?? 0} pt</span>
        </div>
        <div className="opp-hand">
          <CardBack small count={h.oppHandCount} />
          <div className="poz-info">
            <span title="Pozzetto">🎁 {h.pozzettoTaken[opp] ? 'preso' : (h.pozzettiCount[opp] || 0)}</span>
            {h.hasBurraco[opp] && <span className="badge good">burraco</span>}
          </div>
        </div>
        <MeldRow melds={oppMelds} interactive={false} />
      </div>

      {/* Center: piles */}
      <div className="center-row">
        <div className={`pile stock ${isMyTurn && phase === 'draw' ? 'pile-actionable' : ''}`}
             onClick={() => doDraw('stock')}>
          <CardBack count={h.stockCount} label="Tallone" />
        </div>
        <div className={`pile discard ${isMyTurn && phase === 'draw' && h.discard.length ? 'pile-actionable' : ''}`}
             onClick={() => doDraw('discard')}>
          {h.discard.length ? (
            <div className="discard-stack">
              <Card card={h.discard[0]} onClick={() => doDraw('discard')} />
              {h.discard.length > 1 && <span className="pile-count">{h.discard.length}</span>}
            </div>
          ) : (
            <div className="card card-empty"><span className="empty-label">Scarti</span></div>
          )}
        </div>
      </div>

      {/* My melds */}
      <div className="table-melds">
        <div className="melds-title">Le tue combinazioni {h.hasBurraco[you] && <span className="badge good">burraco ✓</span>}</div>
        <MeldRow
          melds={myMelds}
          interactive={isMyTurn && phase === 'play' && selectedCards.length > 0}
          onMeldClick={doAddToMeld}
        />
        {myMelds.length === 0 && <div className="empty-hint">Nessuna combinazione ancora</div>}
      </div>

      {/* My hand */}
      <div className={`player-zone me ${isMyTurn ? 'active' : ''}`}>
        <div className="player-head">
          <span className="pname">{myName}
            <span className="poz-info inline">🎁 {h.pozzettoTaken[you] ? 'preso' : (h.pozzettiCount[you] || 0)}</span>
          </span>
          <span className="pscore">{m.players[you]?.totalScore ?? 0} pt</span>
        </div>
        <div className="my-hand">
          {myHand.map((c) => (
            <Card key={c.id} card={c} selected={selected.has(c.id)} onClick={() => toggle(c.id)} />
          ))}
        </div>
      </div>

      {/* Action bar */}
      <ActionBar
        isMyTurn={isMyTurn}
        phase={phase}
        over={h.over}
        selectedCards={selectedCards}
        selValidation={selValidation}
        onCreateMeld={doCreateMeld}
        onDiscard={doDiscard}
        onClearSel={() => setSelected(new Set())}
        botThinking={state.botThinking}
        turnName={h.turn === you ? 'te' : oppName}
      />

      {toast && <div className="toast">{toast}</div>}

      {h.over && !m.finished && <HandOverOverlay h={h} m={m} you={you} controller={controller} mode={state.mode} />}
      {m.finished && <MatchOverOverlay m={m} you={you} onExit={onExit} />}
    </div>
  );
}

function TopBar({ m, you, onExit, state }) {
  return (
    <div className="topbar">
      <button className="btn btn-ghost btn-small" onClick={onExit}>← Menu</button>
      <div className="topbar-center">
        <span className="mano">Mano {m.handNumber}</span>
        <span className="target">obiettivo {m.targetScore}</span>
      </div>
      <div className="conn">
        {state.mode === 'online'
          ? <span className={`dot ${state.connection === 'connected' ? 'on' : 'off'}`} title={state.connection} />
          : <span className="badge">offline</span>}
      </div>
    </div>
  );
}

function MeldRow({ melds, interactive, onMeldClick }) {
  if (!melds || melds.length === 0) return null;
  return (
    <div className="meld-row">
      {melds.map((meld) => {
        const isBurraco = meld.cards.length >= 7;
        const v = validateMeld(meld.cards);
        const clean = v.valid ? v.clean : false;
        return (
          <div
            key={meld.id}
            className={`meld ${isBurraco ? (clean ? 'meld-burraco-clean' : 'meld-burraco-dirty') : ''} ${interactive ? 'meld-target' : ''}`}
            onClick={interactive ? () => onMeldClick(meld.id) : undefined}
          >
            <div className="meld-cards">
              {meld.cards.map((c) => <Card key={c.id} card={c} small />)}
            </div>
            {isBurraco && <span className="meld-tag">{clean ? 'Burraco pulito' : 'Burraco sporco'}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ActionBar({ isMyTurn, phase, over, selectedCards, selValidation, onCreateMeld, onDiscard, onClearSel, botThinking, turnName }) {
  if (over) return <div className="actionbar"><span className="hint">Mano terminata</span></div>;
  if (!isMyTurn) {
    return (
      <div className="actionbar">
        <span className="hint">{botThinking ? 'Il bot sta pensando…' : `Turno di ${turnName}…`}</span>
      </div>
    );
  }
  if (phase === 'draw') {
    return (
      <div className="actionbar">
        <span className="hint">Pesca: tocca il <b>tallone</b> o prendi gli <b>scarti</b>.</span>
      </div>
    );
  }
  // play phase
  const n = selectedCards.length;
  const points = selectedCards.reduce((s, c) => s + cardValue(c), 0);
  const meldOk = n >= 3 && selValidation?.valid;
  return (
    <div className="actionbar play">
      <div className="sel-info">
        {n === 0
          ? <span className="hint">Seleziona carte per combinare, aggiungere o scartare.</span>
          : <span className="hint">{n} selezionate · {points} pt {meldOk && <b className="ok">✓ {selValidation.type === 'run' ? 'scala' : 'tris'}{selValidation.isBurraco ? ' · burraco' : ''}</b>}</span>}
      </div>
      <div className="btn-row">
        <button className="btn" disabled={!meldOk} onClick={onCreateMeld}>Combina</button>
        <button className="btn btn-warn" disabled={n !== 1} onClick={onDiscard}>Scarta</button>
        {n > 0 && <button className="btn btn-ghost" onClick={onClearSel}>Deseleziona</button>}
      </div>
    </div>
  );
}

function HandOverOverlay({ h, m, you, controller, mode }) {
  const bd = h.breakdown;
  const opp = 1 - you;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>Fine mano {m.handNumber}</h2>
        {h.closedBy !== null
          ? <p className="sub">{m.players[h.closedBy].name} ha chiuso!</p>
          : <p className="sub">Tallone esaurito.</p>}
        <div className="score-table">
          <ScoreCol title={m.players[you].name + ' (tu)'} bd={bd?.[you]} total={m.players[you].totalScore} />
          <ScoreCol title={m.players[opp].name} bd={bd?.[opp]} total={m.players[opp].totalScore} />
        </div>
        {mode === 'local' && (
          <button className="btn btn-big" onClick={() => controller.nextHand()}>Mano successiva →</button>
        )}
        {mode === 'online' && <p className="sub small">La prossima mano inizierà a breve…</p>}
      </div>
    </div>
  );
}

function ScoreCol({ title, bd, total }) {
  if (!bd) return <div className="score-col"><h3>{title}</h3></div>;
  return (
    <div className="score-col">
      <h3>{title}</h3>
      <div className="score-line"><span>Combinazioni</span><span>+{bd.meldPoints}</span></div>
      <div className="score-line"><span>Burraco</span><span>+{bd.burracoBonus}</span></div>
      {bd.closeBonus > 0 && <div className="score-line"><span>Chiusura</span><span>+{bd.closeBonus}</span></div>}
      <div className="score-line neg"><span>Carte in mano</span><span>-{bd.handPenalty}</span></div>
      {bd.pozzettoPenalty > 0 && <div className="score-line neg"><span>Pozzetto</span><span>-{bd.pozzettoPenalty}</span></div>}
      <div className="score-line tot"><span>Mano</span><span>{bd.total >= 0 ? '+' : ''}{bd.total}</span></div>
      <div className="score-line grand"><span>Totale</span><span>{total}</span></div>
    </div>
  );
}

function MatchOverOverlay({ m, you, onExit }) {
  const won = m.winner === you;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>{won ? '🏆 Hai vinto!' : '😔 Hai perso'}</h2>
        <p className="sub">
          {m.players[0].name}: {m.players[0].totalScore} · {m.players[1].name}: {m.players[1].totalScore}
        </p>
        <button className="btn btn-big" onClick={onExit}>Torna al menu</button>
      </div>
    </div>
  );
}
