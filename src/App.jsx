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

  const startLocal = (numPlayers = 2) => {
    disposeController();
    setController(new LocalController({ playerName: profile.name, numPlayers }));
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
        <div className="mode-group">
          <div className="mode-label">🤖 Contro il Bot</div>
          <div className="mode-buttons">
            <button className="btn btn-big btn-primary" onClick={() => onLocal(2)}>1 vs 1</button>
            <button className="btn btn-big btn-primary" onClick={() => onLocal(4)}>2 vs 2</button>
          </div>
        </div>
        <button className="btn btn-big" onClick={onOnline}>🌐 Gioca Online</button>
        <button className="btn btn-big btn-ghost" onClick={onRules}>📖 Come si gioca</button>
      </div>

      <MenuFooter />
    </div>
  );
}

const FOOTER_PHRASES = [
  'Occhio alla Pinella! 🃏',
  'Un burraco pulito vale 200 punti ✨',
  'Prendi il pozzetto al momento giusto 🎁',
  'Il Jolly è tuo amico… quasi sempre 😉',
  'Per chiudere serve almeno un burraco 🔒',
  'Le scale dello stesso seme fanno la differenza',
  'Non regalare carte utili agli avversari 🤫',
  'Gioca con un amico: crea una stanza privata 👫',
  'In 2 vs 2 il compagno conta più di tutto 🤝',
  'A volte prendere gli scarti è la mossa vincente',
  'Tieni le matte per i colpi grossi 💥',
  'Buona fortuna e buon divertimento! 🍀',
];

function MenuFooter() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FOOTER_PHRASES.length));
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % FOOTER_PHRASES.length);
        setShow(true);
      }, 400);
    }, 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="menu-footer">
      <span className="footer-fixed">App creata per poter giocare a Burraco gratuitamente online e senza pubblicità</span>
      <span className={`footer-rotate ${show ? 'in' : 'out'}`}>{FOOTER_PHRASES[idx]}</span>
    </footer>
  );
}

function OnlineLobby({ controller, state, onBack }) {
  const [tab, setTab] = useState('quick'); // quick | create | join
  const [code, setCode] = useState('');
  const [size, setSize] = useState(2);
  const mm = state?.matchmaking || 'idle';
  const conn = state?.connection;

  const waiting = mm === 'queue';
  const room = mm === 'waiting-room';

  const SizePicker = () => (
    <div className="size-picker">
      <button className={`size-opt ${size === 2 ? 'on' : ''}`} onClick={() => setSize(2)}>1 vs 1</button>
      <button className={`size-opt ${size === 4 ? 'on' : ''}`} onClick={() => setSize(4)}>2 vs 2</button>
    </div>
  );

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
          <h3>In cerca di giocatori…</h3>
          <p className="sub">Modalità {state.roomSize === 4 ? '2 vs 2' : '1 vs 1'}. La partita inizia appena la coda è completa.</p>
          <button className="btn btn-ghost" onClick={() => { controller.leaveQueue(); }}>Annulla</button>
        </div>
      ) : room ? (
        <div className="lobby-panel center">
          <h3>Stanza privata</h3>
          <p className="sub">Condividi il codice con {state.roomSize === 4 ? 'i tuoi amici' : 'un amico'}:</p>
          <div className="room-code">{state.roomCode}</div>
          <p className="sub">{state.lobbyFilled || 1} / {state.roomSize} giocatori nella stanza</p>
          {(state.lobbySeats && state.lobbySeats.length > 0) && (
            <div className="lobby-seats">
              {state.lobbySeats.map((s, i) => <span key={i} className="seat-chip">{s.name}</span>)}
            </div>
          )}
          <div className="spinner small" />
          <p className="sub">In attesa degli altri giocatori…</p>
          {state.isHost && (
            <button className="btn btn-big btn-primary" onClick={() => controller.startWithBots()}>
              Inizia ora {state.lobbyFilled < state.roomSize ? '(riempi con i bot)' : ''}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => controller.cancelRoom()}>Annulla stanza</button>
        </div>
      ) : (
        <div className="lobby-panel">
          <div className="tabs">
            <button className={`tab ${tab === 'quick' ? 'on' : ''}`} onClick={() => setTab('quick')}>Rapida</button>
            <button className={`tab ${tab === 'create' ? 'on' : ''}`} onClick={() => setTab('create')}>Crea stanza</button>
            <button className={`tab ${tab === 'join' ? 'on' : ''}`} onClick={() => setTab('join')}>Codice</button>
          </div>

          {tab === 'quick' && (
            <div className="tab-body center">
              <p>Vieni abbinato automaticamente ad altri giocatori online.</p>
              <SizePicker />
              <button className="btn btn-big btn-primary" disabled={conn !== 'connected'} onClick={() => controller.quickMatch(size)}>
                Cerca giocatori
              </button>
            </div>
          )}
          {tab === 'create' && (
            <div className="tab-body center">
              <p>Crea una stanza privata e invita gli amici con il codice.</p>
              <SizePicker />
              <button className="btn btn-big btn-primary" disabled={conn !== 'connected'} onClick={() => controller.createRoom(size)}>
                Crea stanza
              </button>
            </div>
          )}
          {tab === 'join' && (
            <form className="tab-body center" onSubmit={(e) => { e.preventDefault(); controller.joinRoom(code); }}>
              <p>Inserisci il codice ricevuto dagli amici.</p>
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
