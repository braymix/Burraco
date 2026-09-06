import React, { useEffect, useState } from 'react';
import { Card, CardBack } from './Card.jsx';
import { validateMeld } from '../engine/rules.js';
import { cardValue } from '../engine/cards.js';
import { teamOf } from '../engine/engine.js';

export function GameBoard({ controller, state, onExit }) {
  const [selected, setSelected] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [showDiscards, setShowDiscards] = useState(false);

  const view = state.view;
  useEffect(() => {
    if (state.error) {
      setToast(state.error);
      const t = setTimeout(() => setToast(null), 2600);
      return () => clearTimeout(t);
    }
  }, [state.error, state.view]);

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
  const n = m.numPlayers;
  const you = h.you;
  const yourTeam = h.yourTeam;
  const oppTeam = 1 - yourTeam;
  const isMyTurn = h.turn === you && !h.over && !m.finished;
  const phase = h.phase;

  const myHand = h.yourHand || [];
  const selectedCards = myHand.filter((c) => selected.has(c.id));

  const toggle = (id) => {
    if (!isMyTurn || phase !== 'play') return;
    setSelected((prev) => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id); else nx.add(id);
      return nx;
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

  const myMelds = h.melds[yourTeam] || [];
  const oppMelds = h.melds[oppTeam] || [];

  // Other players in play order starting right after "you".
  const others = [];
  for (let k = 1; k < n; k++) {
    const idx = (you + k) % n;
    others.push(idx);
  }

  return (
    <div className={`board board-${n}p`}>
      <TopBar m={m} yourTeam={yourTeam} onExit={onExit} state={state} />

      <PlayersBar
        others={others} h={h} m={m} you={you} yourTeam={yourTeam} state={state}
      />

      {/* Center: piles */}
      <div className="center-row">
        <div className={`pile stock ${isMyTurn && phase === 'draw' ? 'pile-actionable' : ''}`}
             onClick={() => doDraw('stock')}>
          <CardBack count={h.stockCount} label="Tallone" />
        </div>
        <div className="discard-wrap">
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
          {h.discard.length > 0 && (
            <button className="see-discards" onClick={() => setShowDiscards(true)}>👁 scarti</button>
          )}
        </div>
      </div>

      {/* Opponents' melds */}
      <MeldSection
        title={`Avversari${h.hasBurraco[oppTeam] ? '' : ''}`}
        badge={h.hasBurraco[oppTeam] ? 'burraco' : null}
        melds={oppMelds}
        interactive={false}
        empty="Nessuna combinazione avversaria"
      />

      {/* My team melds */}
      <MeldSection
        title={n === 4 ? 'La tua squadra' : 'Le tue combinazioni'}
        badge={h.hasBurraco[yourTeam] ? 'burraco ✓' : null}
        melds={myMelds}
        interactive={isMyTurn && phase === 'play' && selectedCards.length > 0}
        onMeldClick={doAddToMeld}
        empty="Nessuna combinazione ancora"
      />

      {/* My hand */}
      <div className={`player-zone me ${isMyTurn ? 'active' : ''}`}>
        <div className="player-head">
          <span className="pname">
            <span className={`team-dot t${yourTeam}`} />
            {m.players[you]?.name || 'Tu'}
            <span className="poz-info inline">🎁 {h.pozzettoTaken[yourTeam] ? 'preso' : (h.pozzettiCount[yourTeam] || 0)}</span>
          </span>
          <span className="pscore">Voi {m.teamScores[yourTeam]} · Loro {m.teamScores[oppTeam]}</span>
        </div>
        <div className="my-hand">
          {myHand.map((c) => (
            <Card key={c.id} card={c} selected={selected.has(c.id)} onClick={() => toggle(c.id)} />
          ))}
        </div>
      </div>

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
        turnName={h.turn === you ? 'te' : (m.players[h.turn]?.name || 'avversario')}
      />

      {toast && <div className="toast">{toast}</div>}
      {showDiscards && <DiscardViewer discard={h.discard} onClose={() => setShowDiscards(false)} />}
      {h.over && !m.finished && <HandOverOverlay h={h} m={m} yourTeam={yourTeam} controller={controller} mode={state.mode} />}
      {m.finished && <MatchOverOverlay m={m} yourTeam={yourTeam} onExit={onExit} />}
    </div>
  );
}

function TopBar({ m, yourTeam, onExit, state }) {
  return (
    <div className="topbar">
      <button className="btn btn-ghost btn-small" onClick={onExit}>← Menu</button>
      <div className="topbar-center">
        <span className="mano">Mano {m.handNumber} · {m.numPlayers === 4 ? '2 vs 2' : '1 vs 1'}</span>
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

function PlayersBar({ others, h, m, you, yourTeam, state }) {
  return (
    <div className="players-bar">
      {others.map((idx) => {
        const p = m.players[idx];
        const t = teamOf(idx);
        const isPartner = t === yourTeam;
        const isTurn = h.turn === idx && !h.over;
        const seat = state.seats?.[idx];
        const disconnected = seat && seat.connected === false && state.mode === 'online';
        const isBotSeat = (seat && seat.auto) || (state.mode === 'local' && p.isBot);
        return (
          <div key={idx} className={`pchip ${isTurn ? 'turn' : ''} ${isPartner ? 'partner' : 'rival'}`}>
            <div className="pchip-top">
              <span className={`team-dot t${t}`} />
              <span className="pchip-name">{p?.name || `P${idx}`}</span>
              {isTurn && <span className="turn-arrow">▶</span>}
            </div>
            <div className="pchip-sub">
              <span className="hand-pill">🂠 {h.handCounts[idx]}</span>
              {isPartner && m.numPlayers === 4 && <span className="badge">compagno</span>}
              {isBotSeat && <span className="badge">bot</span>}
              {disconnected && <span className="badge warn">off</span>}
              <span className="poz-mini">🎁{h.pozzettoTaken[t] ? '✓' : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MeldSection({ title, badge, melds, interactive, onMeldClick, empty }) {
  return (
    <div className="table-melds">
      <div className="melds-title">
        {title} {badge && <span className="badge good">{badge}</span>}
      </div>
      {melds && melds.length > 0
        ? <MeldRow melds={melds} interactive={interactive} onMeldClick={onMeldClick} />
        : <div className="empty-hint">{empty}</div>}
    </div>
  );
}

function MeldRow({ melds, interactive, onMeldClick }) {
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
  const nSel = selectedCards.length;
  const points = selectedCards.reduce((s, c) => s + cardValue(c), 0);
  const meldOk = nSel >= 3 && selValidation?.valid;
  return (
    <div className="actionbar play">
      <div className="sel-info">
        {nSel === 0
          ? <span className="hint">Seleziona le carte, poi <b>Combina</b>, oppure tocca una tua combinazione per <b>aggiungere</b> (anche una matta), o <b>Scarta</b>.</span>
          : <span className="hint">{nSel} selezionate · {points} pt {meldOk && <b className="ok">✓ {selValidation.type === 'run' ? 'scala' : 'tris'}{selValidation.isBurraco ? ' · burraco' : ''}</b>} · <b>tocca una tua combinazione</b> per aggiungerle</span>}
      </div>
      <div className="btn-row">
        <button className="btn" disabled={!meldOk} onClick={onCreateMeld}>Combina</button>
        <button className="btn btn-warn" disabled={nSel !== 1} onClick={onDiscard}>Scarta</button>
        {nSel > 0 && <button className="btn btn-ghost" onClick={onClearSel}>Deseleziona</button>}
      </div>
    </div>
  );
}

function DiscardViewer({ discard, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card discard-viewer" onClick={(e) => e.stopPropagation()}>
        <h2>Carte scartate</h2>
        <p className="sub">{discard.length} carte · la più recente in alto a sinistra</p>
        <div className="discard-grid">
          {discard.map((c, i) => (
            <div key={c.id} className={`dv-item ${i === 0 ? 'top' : ''}`}>
              <Card card={c} small />
              {i === 0 && <span className="dv-label">top</span>}
            </div>
          ))}
        </div>
        <button className="btn btn-big btn-primary" onClick={onClose}>Chiudi</button>
      </div>
    </div>
  );
}

function HandOverOverlay({ h, m, yourTeam, controller, mode }) {
  const bd = h.breakdown;
  const oppTeam = 1 - yourTeam;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>Fine mano {m.handNumber}</h2>
        {h.closedBy !== null
          ? <p className="sub">{h.closedBy === yourTeam ? 'La tua squadra ha' : 'Gli avversari hanno'} chiuso!</p>
          : <p className="sub">Tallone esaurito.</p>}
        <div className="score-table">
          <ScoreCol title={m.numPlayers === 4 ? 'La tua squadra' : 'Tu'} bd={bd?.[yourTeam]} total={m.teamScores[yourTeam]} highlight />
          <ScoreCol title={m.numPlayers === 4 ? 'Avversari' : 'Avversario'} bd={bd?.[oppTeam]} total={m.teamScores[oppTeam]} />
        </div>
        {mode === 'local' && (
          <button className="btn btn-big btn-primary" onClick={() => controller.nextHand()}>Mano successiva →</button>
        )}
        {mode === 'online' && <p className="sub small">La prossima mano inizierà a breve…</p>}
      </div>
    </div>
  );
}

function ScoreCol({ title, bd, total, highlight }) {
  if (!bd) return <div className="score-col"><h3>{title}</h3></div>;
  return (
    <div className={`score-col ${highlight ? 'me' : ''}`}>
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

function MatchOverOverlay({ m, yourTeam, onExit }) {
  const won = m.winner === yourTeam;
  const oppTeam = 1 - yourTeam;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>{won ? '🏆 Avete vinto!' : '😔 Avete perso'}</h2>
        <p className="sub">
          Voi: {m.teamScores[yourTeam]} · Loro: {m.teamScores[oppTeam]}
        </p>
        <button className="btn btn-big btn-primary" onClick={onExit}>Torna al menu</button>
      </div>
    </div>
  );
}
