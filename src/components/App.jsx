import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import SharePanel from './SharePanel';
import ChatPanel from './ChatPanel';
import PictionaryPanel from './PictionaryPanel';
import ColorWarPanel from './ColorWarPanel';
import GameOverlay from './GameOverlay';
import { PALETTE, isLight } from '../lib/colors';
import { WORDS } from '../lib/words';

const BASE = 'https://pws-wobbuffet.github.io/peerdraw';
const TOTAL_ROUNDS = 5;
const ROUND_SECS = 60;
const WAR_SECS = 90;
const WAR_BOMBS = 3;
const WAR_COLORS = ['#1aa05a', '#e85d1f', '#7c3aed', '#0891b2'];

function randomWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }
function randomWarColors() {
  const a = Math.floor(Math.random() * WAR_COLORS.length);
  let b = (a + 1 + Math.floor(Math.random() * (WAR_COLORS.length - 1))) % WAR_COLORS.length;
  return [WAR_COLORS[a], WAR_COLORS[b]];
}
function countColor(canvas, hex) {
  if (!canvas) return 0;
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  let n = 0;
  for (let i = 0; i < d.length; i += 16)
    if (Math.abs(d[i]-r)<40 && Math.abs(d[i+1]-g)<40 && Math.abs(d[i+2]-b)<40) n++;
  return n;
}

export default function App() {
  // ── Theme ───────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('peerdraw.theme');
    return s || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('peerdraw.theme', theme);
  }, [theme]);

  // ── Identity ─────────────────────────────────────────────────────────
  const [myName, setMyName] = useState(() => localStorage.getItem('peerdraw.name') || '');
  const [myColor, setMyColor] = useState(() => localStorage.getItem('peerdraw.color') || PALETTE[0]);
  const myNameRef = useRef(myName);
  const myColorRef = useRef(myColor);
  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  const [peerName, setPeerName] = useState('');
  const [peerColor, setPeerColor] = useState('');
  const peerNameRef = useRef('');

  // ── Drawing ──────────────────────────────────────────────────────────
  const [color, setColor] = useState(() => localStorage.getItem('peerdraw.color') || PALETTE[0]);
  const [brushSize, setBrushSize] = useState(7);

  // ── Session ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState('entry');
  const [nameError, setNameError] = useState('');
  const [roomUrl, setRoomUrl] = useState('');
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const remoteQueue = useRef([]);
  const canvasElRef = useRef(null);

  const hashId = window.location.hash.slice(1);
  const savedHostId = localStorage.getItem('peerdraw.hostId') || '';
  const isHostReload = !!(hashId && hashId === savedHostId);
  const isGuest = !!(hashId && hashId !== savedHostId);
  const isHostRef = useRef(!isGuest);

  // ── Cursor ───────────────────────────────────────────────────────────
  const [peerCursor, setPeerCursor] = useState(null);
  const lastCursorSend = useRef(0);

  // ── Chat ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const addMessage = useCallback((msg) => setMessages(prev => [...prev, msg]), []);

  // ── Mode + game state ─────────────────────────────────────────────────
  // mode: 'draw' | 'pictionary' | 'war'
  const [mode, setMode] = useState('draw');
  const modeRef = useRef('draw');
  const [game, setGame] = useState(null);   // Pictionary
  const gameRef = useRef(null);
  const gameTimerRef = useRef(null);
  const [war, setWar] = useState(null);     // Color War
  const warRef = useRef(null);
  const warTimerRef = useRef(null);
  const warTickRef = useRef(null);
  const [overlay, setOverlay] = useState(null);

  const switchMode = (m) => { setMode(m); modeRef.current = m; };
  const updateGame = (g) => { setGame(g); gameRef.current = g; };
  const updateWar  = (w) => { setWar(w);  warRef.current = w;  };

  // ── Overlay helper ───────────────────────────────────────────────────
  const showOverlay = useCallback((text, sub = '', ms = 2500) => {
    setOverlay({ text, sub });
    setTimeout(() => setOverlay(null), ms);
  }, []);

  // ── Send ─────────────────────────────────────────────────────────────
  const sendEvent = useCallback((evt) => {
    try { connRef.current?.open && connRef.current.send(evt); } catch (_) {}
  }, []);

  const clearCanvas = useCallback(() => {
    remoteQueue.current.push({ t: 'clear' });
    sendEvent({ t: 'clear' });
  }, [sendEvent]);

  // ── Pictionary logic ─────────────────────────────────────────────────
  const clearGameTimer = useCallback(() => {
    clearInterval(gameTimerRef.current);
    gameTimerRef.current = null;
  }, []);

  const startGameTimer = useCallback(() => {
    clearGameTimer();
    gameTimerRef.current = setInterval(() => {
      setGame(g => {
        if (!g) return g;
        const t = g.timeLeft - 1;
        if (t <= 0) {
          clearInterval(gameTimerRef.current);
          gameTimerRef.current = null;
          // Drawer sends game_end when their timer expires
          if (g.role === 'drawer') {
            sendEvent({ t: 'game_end', correct: false, word: g.word,
              score: g.score, round: g.round, totalRounds: g.totalRounds });
            showOverlay("TIME'S UP!", `The word was: ${g.word}`);
          }
          return { ...g, timeLeft: 0 };
        }
        return { ...g, timeLeft: t };
      });
    }, 1000);
  }, [clearGameTimer, sendEvent, showOverlay]);

  // host starts (or advances to) a round
  const startRound = useCallback((round, score) => {
    const word = randomWord();
    const hostDraws = round % 2 === 1;
    const myRole = isHostRef.current ? (hostDraws ? 'drawer' : 'guesser')
                                     : (hostDraws ? 'guesser' : 'drawer');
    const peerRole = myRole === 'drawer' ? 'guesser' : 'drawer';

    clearCanvas();
    sendEvent({
      t: 'game_start', role: peerRole, duration: ROUND_SECS,
      word: peerRole === 'drawer' ? word : undefined,
      round, totalRounds: TOTAL_ROUNDS, score,
    });

    const g = { role: myRole, word: myRole === 'drawer' ? word : null,
      timeLeft: ROUND_SECS, duration: ROUND_SECS, score, round, totalRounds: TOTAL_ROUNDS };
    updateGame(g);
    switchMode('pictionary');

    if (myRole === 'drawer') showOverlay(`Draw: ${word}`, 'Your turn to draw!', 2000);
    else showOverlay('Guess the drawing!', 'Type in chat ↓', 2000);

    startGameTimer();
  }, [clearCanvas, sendEvent, showOverlay, startGameTimer]);

  const endPictionary = useCallback((score) => {
    clearGameTimer();
    const [hs, gs] = score;
    const myS = isHostRef.current ? hs : gs;
    const peerS = isHostRef.current ? gs : hs;
    const result = myS > peerS ? 'YOU WIN! 🏆'
                 : myS < peerS ? `${peerNameRef.current || 'Peer'} wins!`
                 : "IT'S A TIE!";
    showOverlay(result, `Score: ${myS} — ${peerS}`, 4000);
    setTimeout(() => { switchMode('draw'); updateGame(null); }, 4500);
  }, [clearGameTimer, showOverlay]);

  const startPictionary = useCallback(() => {
    if (!isHostRef.current) return;
    startRound(1, [0, 0]);
  }, [startRound]);

  const abandonGame = useCallback(() => {
    clearGameTimer();
    switchMode('draw');
    updateGame(null);
    sendEvent({ t: 'game_end', correct: false, word: '', score: [0,0], round: 0, totalRounds: 0 });
  }, [clearGameTimer, sendEvent]);

  // ── Color War logic ──────────────────────────────────────────────────
  const clearWarTimers = useCallback(() => {
    clearInterval(warTimerRef.current);
    clearInterval(warTickRef.current);
    warTimerRef.current = null;
    warTickRef.current = null;
  }, []);

  const startWarTimers = useCallback((myWarColor) => {
    clearWarTimers();
    warTimerRef.current = setInterval(() => {
      setWar(w => {
        if (!w) return w;
        const t = w.timeLeft - 1;
        if (t <= 0) {
          clearInterval(warTimerRef.current);
          clearInterval(warTickRef.current);
          // Count final pixels and decide winner locally
          const myFinal = countColor(canvasElRef.current, w.myColor);
          const peerFinal = w.peerCount;
          const result = myFinal > peerFinal ? 'YOU WIN! 🏆'
                       : myFinal < peerFinal ? `${peerNameRef.current || 'Peer'} wins!`
                       : "IT'S A TIE!";
          showOverlay(result, `Your pixels: ${myFinal} · Peer: ${peerFinal}`, 4000);
          setTimeout(() => {
            switchMode('draw');
            updateWar(null);
            setColor(myColorRef.current);
          }, 4500);
          return { ...w, timeLeft: 0 };
        }
        return { ...w, timeLeft: t };
      });
    }, 1000);

    warTickRef.current = setInterval(() => {
      const myCount = countColor(canvasElRef.current, myWarColor);
      setWar(w => w ? { ...w, myCount } : w);
      warRef.current = warRef.current ? { ...warRef.current, myCount } : warRef.current;
      sendEvent({ t: 'war_tick', count: myCount });
    }, 2000);
  }, [clearWarTimers, sendEvent, showOverlay]);

  const startColorWar = useCallback(() => {
    if (!isHostRef.current) return;
    const [hostColor, guestColor] = randomWarColors();
    clearCanvas();
    sendEvent({ t: 'war_start', yourColor: guestColor, myColor: hostColor, duration: WAR_SECS });
    const w = { myColor: hostColor, peerColor: guestColor, timeLeft: WAR_SECS, myCount: 0, peerCount: 0, bombs: WAR_BOMBS };
    updateWar(w);
    switchMode('war');
    setColor(hostColor);
    showOverlay('COLOR WAR!', `Your colour: paint everything!`, 2000);
    startWarTimers(hostColor);
  }, [clearCanvas, sendEvent, showOverlay, startWarTimers]);

  const abandonWar = useCallback(() => {
    clearWarTimers();
    switchMode('draw');
    updateWar(null);
    setColor(myColorRef.current);
  }, [clearWarTimers]);

  // ── Bombs ─────────────────────────────────────────────────────────────
  const fireBomb = useCallback((type) => {
    if (mode === 'war') {
      setWar(w => w && w.bombs > 0 ? { ...w, bombs: w.bombs - 1 } : w);
      if (warRef.current?.bombs <= 0) return;
    }
    const myWarColor = warRef.current?.myColor || color;
    const evt = type === 'ink'
      ? { t: 'bomb_ink', x: 0.5, y: 0.5, r: 0.25, c: mode === 'war' ? myWarColor : color }
      : type === 'erase'
      ? { t: 'bomb_erase', x: 0.5, y: 0.5, r: 0.22 }
      : { t: 'bomb_rainbow', x: 0.5, y: 0.5 };
    remoteQueue.current.push(evt);
    sendEvent(evt);
  }, [mode, color, sendEvent]);

  // ── Clear ─────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => clearCanvas(), [clearCanvas]);

  // ── Cursor ────────────────────────────────────────────────────────────
  const handleCursor = useCallback(({ x, y }) => {
    if (status !== 'connected') return;
    const now = Date.now();
    if (now - lastCursorSend.current < 33) return;
    lastCursorSend.current = now;
    sendEvent({ t: 'cursor', x, y });
  }, [status, sendEvent]);

  // ── Chat ──────────────────────────────────────────────────────────────
  const sendChat = useCallback((msg) => {
    addMessage({ from: 'me', text: msg, ts: Date.now() });
    // In Pictionary, chat messages also act as guesses
    if (modeRef.current === 'pictionary') sendEvent({ t: 'guess', msg });
    else sendEvent({ t: 'chat', msg });
  }, [addMessage, sendEvent]);

  // ── Data dispatch ref (always current, safe in stable setupConn) ──────
  const onDataRef = useRef(null);
  useEffect(() => {
    onDataRef.current = (evt) => {
      if (evt.t === 'cursor') { setPeerCursor({ x: evt.x, y: evt.y }); return; }
      if (evt.t === 'hello') {
        if (evt.name === myNameRef.current) connRef.current?.send({ t: 'name_conflict' });
        setPeerName(evt.name); peerNameRef.current = evt.name;
        setPeerColor(evt.color || PALETTE[3]);
        return;
      }
      if (evt.t === 'name_conflict') {
        setNameError('That name is already taken — pick another.');
        setStatus('entry');
        connRef.current?.close(); connRef.current = null;
        return;
      }
      if (evt.t === 'chat') {
        if (modeRef.current === 'pictionary' && gameRef.current?.role === 'drawer') {
          checkGuessFromPeer(evt.msg);
        }
        addMessage({ from: peerNameRef.current || 'Peer', text: evt.msg, ts: Date.now() });
        return;
      }
      if (evt.t === 'guess') {
        addMessage({ from: peerNameRef.current || 'Peer', text: evt.msg, ts: Date.now() });
        if (gameRef.current?.role === 'drawer') checkGuessFromPeer(evt.msg);
        return;
      }
      if (evt.t === 'game_start') {
        const g = evt;
        const ng = { role: g.role, word: g.word || null, timeLeft: g.duration || ROUND_SECS,
          duration: g.duration || ROUND_SECS, score: g.score || [0,0], round: g.round || 1, totalRounds: g.totalRounds || TOTAL_ROUNDS };
        remoteQueue.current.push({ t: 'clear' });
        updateGame(ng);
        switchMode('pictionary');
        if (ng.role === 'drawer') showOverlay(`Draw: ${ng.word}`, 'Your turn!', 2000);
        else showOverlay('Guess the drawing!', 'Type in chat ↓', 2000);
        startGameTimer();
        return;
      }
      if (evt.t === 'game_end') {
        clearGameTimer();
        if (evt.round === 0) { switchMode('draw'); updateGame(null); return; } // abandoned
        if (evt.correct) {
          // Peer confirmed a correct guess — I'm the guesser, I got the point
          const g = gameRef.current;
          if (g) {
            const newScore = [...g.score];
            if (g.role === 'guesser') newScore[isHostRef.current ? 0 : 1]++;
            else newScore[isHostRef.current ? 1 : 0]++;
            updateGame({ ...g, score: newScore, timeLeft: 0 });
            if (g.role === 'guesser') showOverlay('YOU GOT IT! 🎉', `Word was: ${evt.word}`);
            else showOverlay(`${peerNameRef.current} guessed it!`, `Word was: ${evt.word}`);
          }
        } else {
          showOverlay("TIME'S UP!", `Word was: ${evt.word || '?'}`);
          setGame(g => g ? { ...g, timeLeft: 0 } : g);
        }
        return;
      }
      if (evt.t === 'war_start') {
        remoteQueue.current.push({ t: 'clear' });
        const w = { myColor: evt.yourColor, peerColor: evt.myColor, timeLeft: evt.duration || WAR_SECS,
          myCount: 0, peerCount: 0, bombs: WAR_BOMBS };
        updateWar(w);
        switchMode('war');
        setColor(evt.yourColor);
        showOverlay('COLOR WAR!', 'Paint as much as you can!', 2000);
        startWarTimers(evt.yourColor);
        return;
      }
      if (evt.t === 'war_tick') {
        setWar(w => w ? { ...w, peerCount: evt.count } : w);
        return;
      }
      // Drawing events
      remoteQueue.current.push(evt);
    };
  });

  // checkGuessFromPeer needs access to current gameRef
  const checkGuessFromPeer = (msg) => {
    const g = gameRef.current;
    if (!g || g.role !== 'drawer' || !g.word) return;
    if (msg.trim().toLowerCase() !== g.word.toLowerCase()) return;
    clearGameTimer();
    const newScore = [...g.score];
    // Guesser (peer) gets the point
    newScore[isHostRef.current ? 1 : 0]++;
    const ng = { ...g, score: newScore, timeLeft: 0 };
    updateGame(ng);
    sendEvent({ t: 'game_end', correct: true, word: g.word, score: newScore, round: g.round, totalRounds: g.totalRounds });
    showOverlay(`${peerNameRef.current || 'Peer'} got it! 🎉`, `Word was: ${g.word}`);
    setTimeout(() => {
      if (g.round < g.totalRounds) startRound(g.round + 1, newScore);
      else endPictionary(newScore);
    }, 3000);
  };

  // ── Connection setup (stable — uses onDataRef) ─────────────────────
  const setupConn = useCallback((conn) => {
    conn.on('open', () => {
      setStatus('connected');
      conn.send({ t: 'hello', name: myNameRef.current, color: myColorRef.current });
    });
    conn.on('data', (evt) => onDataRef.current?.(evt));
    conn.on('close', () => { setStatus('disconnected'); setPeerCursor(null); });
    conn.on('error', () => { setStatus('disconnected'); setPeerCursor(null); });
    connRef.current = conn;
  }, []); // truly stable

  // ── Start session ──────────────────────────────────────────────────
  const startSession = useCallback(() => {
    const name = myName.trim();
    if (!name) { setNameError('Please enter a name.'); return; }
    setNameError('');
    localStorage.setItem('peerdraw.name', name);
    localStorage.setItem('peerdraw.color', myColor);
    myNameRef.current = name;
    myColorRef.current = myColor;
    setColor(myColor);

    const hostWithNewPeer = () => {
      const peer = new Peer();
      peerRef.current = peer;
      peer.on('open', (id) => {
        history.replaceState(null, '', '#' + id);
        localStorage.setItem('peerdraw.hostId', id);
        setRoomUrl(`${BASE}/#${id}`);
        setStatus('hosting');
        peer.on('connection', conn => setupConn(conn));
      });
      peer.on('error', () => setStatus('disconnected'));
    };

    if (isGuest) {
      setStatus('joining');
      const peer = new Peer();
      peerRef.current = peer;
      peer.on('open', () => setupConn(peer.connect(hashId, { reliable: true })));
      peer.on('error', () => setStatus('disconnected'));
    } else if (isHostReload) {
      setStatus('hosting');
      const peer = new Peer(savedHostId);
      peerRef.current = peer;
      peer.on('open', (id) => {
        history.replaceState(null, '', '#' + id);
        setRoomUrl(`${BASE}/#${id}`);
        peer.on('connection', conn => setupConn(conn));
      });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') hostWithNewPeer();
        else setStatus('disconnected');
      });
    } else {
      hostWithNewPeer();
    }
  }, [myName, myColor, isGuest, isHostReload, hashId, savedHostId, setupConn]);

  const isConnected = status === 'connected';
  const activeColor = mode === 'war' ? (war?.myColor || color) : color;
  const cursorTextColor = isLight(peerColor) ? '#0a0a0a' : '#ffffff';

  // Mobile tab (only affects layout on small screens via CSS)
  const [mobileTab, setMobileTab] = useState('tools');

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">peer<span className="dot">·</span>draw</span>
        <div className="topbar-right">
          {isConnected && (
            <div className="name-pills">
              <span className="name-pill" style={{ background: myColor, color: isLight(myColor) ? '#0a0a0a' : '#fff' }}>
                {myName} (you)
              </span>
              <span className="name-pill" style={{ background: peerColor, color: cursorTextColor }}>
                {peerName}
              </span>
            </div>
          )}
          <button className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z"/>
              </svg>
            )}
          </button>
          <a className="icon-btn" href="https://github.com/pws-wobbuffet/peerdraw"
            target="_blank" rel="noopener noreferrer" title="GitHub">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.5c0-1 .1-1.4-.5-2 3-.3 5.5-1.5 5.5-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.5 1.3a12 12 0 0 0-6 0C6.5 2.7 5.5 3 5.5 3a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4 9.5c0 4.5 2.5 5.7 5.5 6-.6.6-.6 1-.5 2V21"/>
            </svg>
          </a>
        </div>
      </header>

      {/* Entry form */}
      {status === 'entry' && (
        <div className="idle-screen">
          <div className="idle-card entry-card">
            <h1>peer<span className="em">·</span>draw</h1>
            <p className="entry-hint">
              {isGuest ? 'You\'re joining a session' : isHostReload ? 'Rejoin your session' : 'Start a drawing session'}
            </p>
            <label className="entry-label">Your name</label>
            <input className="entry-input" type="text" value={myName} maxLength={20}
              placeholder="e.g. Alice" autoFocus
              onChange={e => { setMyName(e.target.value); setNameError(''); }}
              onKeyDown={e => e.key === 'Enter' && startSession()} />
            <label className="entry-label" style={{ marginTop: 16 }}>Your colour</label>
            <div className="entry-swatches">
              {PALETTE.map(c => (
                <button key={c} type="button" className={'swatch' + (myColor === c ? ' active' : '')}
                  style={{ background: c }} onClick={() => setMyColor(c)} aria-label={c} />
              ))}
            </div>
            {nameError && <p className="entry-error">{nameError}</p>}
            <button type="button" className="btn btn-primary btn-full entry-submit" onClick={startSession}>
              {isGuest ? 'Join session →' : isHostReload ? 'Continue session →' : 'Create session →'}
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="main">
        <div className="canvas-col">
          <div className="canvas-wrap" style={{ position: 'relative' }}>
            <Canvas
              ref={canvasElRef}
              color={activeColor}
              brushSize={brushSize}
              remoteQueue={remoteQueue}
              onEvent={sendEvent}
              onCursor={handleCursor}
              connected={isConnected}
            />
            {peerCursor && isConnected && (
              <div className="peer-cursor" style={{ left: `${peerCursor.x * 100}%`, top: `${peerCursor.y * 100}%` }}>
                <div className="peer-cursor-dot" style={{ background: peerColor, color: cursorTextColor }}>
                  {(peerName[0] || '?').toUpperCase()}
                </div>
                <span className="peer-cursor-label" style={{ background: peerColor, color: cursorTextColor }}>
                  {peerName}
                </span>
              </div>
            )}
            <GameOverlay overlay={overlay} />
          </div>
        </div>

        <aside className="sidebar">
          {/* Mobile tab bar — hidden on desktop via CSS */}
          <div className="mobile-tabs">
            <button className={`mobile-tab-btn${mobileTab === 'tools' ? ' active' : ''}`}
              onClick={() => setMobileTab('tools')}>
              {mode === 'pictionary' ? '🎨 Game' : mode === 'war' ? '⚔️ War' : '✏️ Draw'}
            </button>
            <button className={`mobile-tab-btn${mobileTab === 'session' ? ' active' : ''}`}
              onClick={() => setMobileTab('session')}>
              🔗 Session
              {status === 'connected' && <span className="mob-dot" />}
            </button>
            <button className={`mobile-tab-btn${mobileTab === 'chat' ? ' active' : ''}`}
              onClick={() => setMobileTab('chat')}>
              💬 Chat
            </button>
          </div>

          {/* Group 1: tools / game panels */}
          <div className={`panel-group${mobileTab === 'tools' ? ' mob-active' : ''}`}>
            {mode === 'draw' && (
              <Toolbar
                color={color}
                brushSize={brushSize}
                onColor={setColor}
                onBrush={setBrushSize}
                onClear={handleClear}
                onBomb={fireBomb}
                connected={isConnected}
              />
            )}
            {mode === 'pictionary' && (
              <PictionaryPanel
                game={game}
                myName={myName}
                peerName={peerName}
                isHost={isHostRef.current}
                onAbandon={abandonGame}
              />
            )}
            {mode === 'war' && (
              <ColorWarPanel
                war={war}
                myName={myName}
                peerName={peerName}
                onBomb={fireBomb}
                isHost={isHostRef.current}
                onAbandon={abandonWar}
              />
            )}
          </div>

          {/* Group 2: session / share */}
          <div className={`panel-group${mobileTab === 'session' ? ' mob-active' : ''}`}>
            <SharePanel
              status={status}
              roomUrl={roomUrl}
              myName={myName}
              peerName={peerName}
              isHost={isHostRef.current}
              onStartPictionary={startPictionary}
              onStartColorWar={startColorWar}
            />
          </div>

          {/* Group 3: chat */}
          <div className={`panel-group${mobileTab === 'chat' ? ' mob-active' : ''}`}>
            <ChatPanel
              messages={messages}
              myName={myName}
              peerName={peerName}
              onSend={sendChat}
              connected={isConnected}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
