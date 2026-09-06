import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadProfile, setName as saveName } from './profile.js';
import { LocalController } from './game/LocalController.js';
import { OnlineController } from './game/OnlineController.js';
import { GameBoard } from './ui/GameBoard.jsx';
import { RulesModal } from './ui/Rules.jsx';

export default function App() {
  const [profile, setProfile] = useState(() => loadProfile());
  const [controller, setController] = useState(null);
  const [cstate, setCstate] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!controller) { setCstate(null); return; }
    unsubRef.current = controller.subscribe(setCstate);
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [controller]);

  const startLocal = () => {
    disposeController();
    setController(new LocalController({ playerName: profile.name, botName: 'Bot Bruno' }));
  };
  const startOnline = () => {
    disposeController();
    setController(new OnlineController({ profile }));
  };
  const disposeController = () => {
    if (controller) { try { controller.dispose(); } catch { /* ignore */ } }
  };
  const exitGame = () => { disposeController(); setController(null); };

  // Which screen?
  let screen = 'menu';
  if (controller) {
    if (controller.mode === 'local') screen = 'game';
    else if (cstate && cstate.view) screen = 'game';
    else screen = 'lobby';
  }

  return (
    <div className="app">
      {screen === 'menu' && (
        <Menu
          profile={profile}
          onName={(name) => setProfile(saveName(name))}
          onLocal={startLocal}
          onOnline={startOnline}
          onRules={() => setShowRules(true)}
        />
      )}
      {screen === 'lobby' && (
        <OnlineLobby controller={controller} state={cstate} onBack={exitGame} />
      )}
      {screen === 'game' && cstate && (
        <GameBoard controller={controller} state={cstate} onExit={exitGame} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function Menu({ profile, onName, onLocal, onOnline, onRules }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  return (
    <div className="menu">
      <div className="brand">
        <div className="brand-logo">
          <span className="suit red">♦</span><span className="suit black">♣</span>
        </div>
        <h1>Burraco</h1>
        <p className="tagline">Gioca contro i bot o online con gli amici</p>
      </div>

      <div className="profile-box">
        {editing ? (
          <form
            className="name-edit"
            onSubmit={(e) => { e.preventDefault(); onName(draft); setEditing(false); }}
          >
            <input
              autoFocus value={draft} maxLength={20}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Il tuo nome"
            />
            <button className="btn btn-small" type="submit">OK</button>
          </form>
        ) : (
          <div className="name-view">
            <span>Ciao, <b>{profile.name}</b></span>
            <button className="btn btn-ghost btn-small" onClick={() => { setDraft(profile.name); setEditing(true); }}>
              cambia nome
            </button>
          </div>
        )}
      </div>

      <div className="menu-actions">
        <button className="btn btn-big btn-primary" onClick={onLocal}>🤖 Gioca contro il Bot</button>
        <button className="btn btn-big" onClick={onOnline}>🌐 Gioca Online</button>
        <button className="btn btn-big btn-ghost" onClick={onRules}>📖 Come si gioca</button>
      </div>

      <footer className="menu-footer">
        <span>PWA · installabile · funziona offline contro il bot</span>
      </footer>
    </div>
  );
}

function OnlineLobby({ controller, state, onBack }) {
  const [tab, setTab] = useState('quick'); // quick | create | join
  const [code, setCode] = useState('');
  const mm = state?.matchmaking || 'idle';
  const conn = state?.connection;

  useEffect(() => {
    // reset to idle view when we come back
  }, []);

  const waiting = mm === 'queue';
  const room = mm === 'waiting-room';

  return (
    <div className="lobby">
      <div className="topbar">
        <button className="btn btn-ghost btn-small" onClick={onBack}>← Menu</button>
        <div className="topbar-center"><b>Gioca Online</b></div>
        <div className="conn"><span className={`dot ${conn === 'connected' ? 'on' : 'off'}`} /></div>
      </div>

      {conn !== 'connected' && <div className="lobby-note">Connessione al server…</div>}

      {waiting ? (
        <div className="lobby-panel center">
          <div className="spinner" />
          <h3>In cerca di un avversario…</h3>
          <p className="sub">Appena un altro giocatore entra in coda, la partita inizia.</p>
          <button className="btn btn-ghost" onClick={() => { controller.leaveQueue(); }}>Annulla</button>
        </div>
      ) : room ? (
        <div className="lobby-panel center">
          <h3>Stanza privata creata</h3>
          <p className="sub">Condividi questo codice con un amico:</p>
          <div className="room-code">{state.roomCode}</div>
          <div className="spinner small" />
          <p className="sub">In attesa che l'amico entri…</p>
          <button className="btn btn-ghost" onClick={() => controller.cancelRoom()}>Annulla stanza</button>
        </div>
      ) : (
        <div className="lobby-panel">
          <div className="tabs">
            <button className={`tab ${tab === 'quick' ? 'on' : ''}`} onClick={() => setTab('quick')}>Partita rapida</button>
            <button className={`tab ${tab === 'create' ? 'on' : ''}`} onClick={() => setTab('create')}>Crea stanza</button>
            <button className={`tab ${tab === 'join' ? 'on' : ''}`} onClick={() => setTab('join')}>Entra con codice</button>
          </div>

          {tab === 'quick' && (
            <div className="tab-body center">
              <p>Vieni abbinato automaticamente a un altro giocatore online.</p>
              <button className="btn btn-big btn-primary" disabled={conn !== 'connected'} onClick={() => controller.quickMatch()}>
                Cerca avversario
              </button>
            </div>
          )}
          {tab === 'create' && (
            <div className="tab-body center">
              <p>Crea una stanza privata e invita un amico con il codice.</p>
              <button className="btn btn-big btn-primary" disabled={conn !== 'connected'} onClick={() => controller.createRoom()}>
                Crea stanza
              </button>
            </div>
          )}
          {tab === 'join' && (
            <form className="tab-body center" onSubmit={(e) => { e.preventDefault(); controller.joinRoom(code); }}>
              <p>Inserisci il codice ricevuto dall'amico.</p>
              <input
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="ABCD"
              />
              <button className="btn btn-big btn-primary" type="submit" disabled={conn !== 'connected' || code.length < 4}>
                Entra
              </button>
            </form>
          )}
          {state?.error && <div className="lobby-error">{state.error}</div>}
        </div>
      )}
    </div>
  );
}
