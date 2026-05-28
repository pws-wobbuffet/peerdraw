import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import SharePanel from './SharePanel';
import ChatPanel from './ChatPanel';
import { PALETTE, isLight } from '../lib/colors';

const BASE = 'https://pws-wobbuffet.github.io/peerdraw';

export default function App() {
  // ── Theme ──────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('peerdraw.theme');
    return s || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('peerdraw.theme', theme);
  }, [theme]);

  // ── Identity (set at entry) ────────────────────────────────────────
  const [myName, setMyName] = useState(() => localStorage.getItem('peerdraw.name') || '');
  const [myColor, setMyColor] = useState(() => localStorage.getItem('peerdraw.color') || PALETTE[0]);
  const myNameRef = useRef(myName);
  const myColorRef = useRef(myColor);
  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  // ── Peer identity ──────────────────────────────────────────────────
  const [peerName, setPeerName] = useState('');
  const [peerColor, setPeerColor] = useState('');
  const peerNameRef = useRef('');

  // ── Drawing ────────────────────────────────────────────────────────
  const [color, setColor] = useState(() => localStorage.getItem('peerdraw.color') || PALETTE[0]);
  const [brushSize, setBrushSize] = useState(7);

  // ── Session ────────────────────────────────────────────────────────
  // status: 'entry' | 'hosting' | 'joining' | 'connected' | 'disconnected'
  const [status, setStatus] = useState('entry');
  const [nameError, setNameError] = useState('');
  const [roomUrl, setRoomUrl] = useState('');
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const remoteQueue = useRef([]);

  // Detect hash once on mount
  const hashId = window.location.hash.slice(1);
  const savedHostId = localStorage.getItem('peerdraw.hostId') || '';
  const isHostReload = !!(hashId && hashId === savedHostId);
  const isGuest = !!(hashId && hashId !== savedHostId);

  // ── Cursor ─────────────────────────────────────────────────────────
  const [peerCursor, setPeerCursor] = useState(null);
  const lastCursorSend = useRef(0);

  // ── Chat ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const addMessage = useCallback((msg) => setMessages(prev => [...prev, msg]), []);

  // ── Connection setup ───────────────────────────────────────────────
  const setupConn = useCallback((conn) => {
    conn.on('open', () => {
      setStatus('connected');
      conn.send({ t: 'hello', name: myNameRef.current, color: myColorRef.current });
    });
    conn.on('data', (evt) => {
      // Fast-path non-drawing events
      if (evt.t === 'cursor') {
        setPeerCursor({ x: evt.x, y: evt.y });
        return;
      }
      if (evt.t === 'hello') {
        if (evt.name === myNameRef.current) {
          conn.send({ t: 'name_conflict' });
        }
        setPeerName(evt.name); peerNameRef.current = evt.name;
        setPeerColor(evt.color || PALETTE[3]);
        return;
      }
      if (evt.t === 'name_conflict') {
        setNameError('That name is already taken — pick another.');
        setStatus('entry');
        conn.close();
        connRef.current = null;
        return;
      }
      if (evt.t === 'chat') {
        addMessage({ from: peerNameRef.current || 'Peer', text: evt.msg, ts: Date.now() });
        return;
      }
      remoteQueue.current.push(evt);
    });
    conn.on('close', () => { setStatus('disconnected'); setPeerCursor(null); });
    conn.on('error', () => { setStatus('disconnected'); setPeerCursor(null); });
    connRef.current = conn;
  }, [addMessage]);

  const sendEvent = useCallback((evt) => {
    try { connRef.current?.open && connRef.current.send(evt); } catch (_) {}
  }, []);

  // ── Start session (called from entry form) ─────────────────────────
  const startSession = useCallback(() => {
    const name = myName.trim();
    if (!name) { setNameError('Please enter a name.'); return; }
    setNameError('');
    localStorage.setItem('peerdraw.name', name);
    localStorage.setItem('peerdraw.color', myColor);
    myNameRef.current = name;
    myColorRef.current = myColor;
    setColor(myColor); // sync drawing color to identity color at start

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

  // ── Bombs ──────────────────────────────────────────────────────────
  const fireBomb = useCallback((type) => {
    const evt = type === 'ink'
      ? { t: 'bomb_ink', x: 0.5, y: 0.5, r: 0.25, c: color }
      : type === 'erase'
      ? { t: 'bomb_erase', x: 0.5, y: 0.5, r: 0.22 }
      : { t: 'bomb_rainbow', x: 0.5, y: 0.5 };
    remoteQueue.current.push(evt);
    sendEvent(evt);
  }, [color, sendEvent]);

  // ── Clear ──────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    remoteQueue.current.push({ t: 'clear' });
    sendEvent({ t: 'clear' });
  }, [sendEvent]);

  // ── Cursor send ────────────────────────────────────────────────────
  const handleCursor = useCallback(({ x, y }) => {
    if (status !== 'connected') return;
    const now = Date.now();
    if (now - lastCursorSend.current < 33) return;
    lastCursorSend.current = now;
    sendEvent({ t: 'cursor', x, y });
  }, [status, sendEvent]);

  // ── Chat send ──────────────────────────────────────────────────────
  const sendChat = useCallback((msg) => {
    addMessage({ from: 'me', text: msg, ts: Date.now() });
    sendEvent({ t: 'chat', msg });
  }, [addMessage, sendEvent]);

  const isConnected = status === 'connected';

  const cursorTextColor = isLight(peerColor) ? '#0a0a0a' : '#ffffff';

  return (
    <div className="app">
      {/* Topbar */}
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

      {/* Entry splash */}
      {status === 'entry' && (
        <div className="idle-screen">
          <div className="idle-card entry-card">
            <h1>peer<span className="em">·</span>draw</h1>
            {isGuest && <p className="entry-hint">You're joining a session</p>}
            {isHostReload && <p className="entry-hint">Rejoin your session</p>}
            {!hashId && <p className="entry-hint">Start a drawing session</p>}

            <label className="entry-label">Your name</label>
            <input
              className="entry-input"
              type="text"
              value={myName}
              maxLength={20}
              placeholder="e.g. Alice"
              autoFocus
              onChange={e => { setMyName(e.target.value); setNameError(''); }}
              onKeyDown={e => e.key === 'Enter' && startSession()}
            />

            <label className="entry-label" style={{ marginTop: 16 }}>Your colour</label>
            <div className="entry-swatches">
              {PALETTE.map(c => (
                <button key={c} type="button"
                  className={'swatch' + (myColor === c ? ' active' : '')}
                  style={{ background: c }}
                  onClick={() => setMyColor(c)}
                  aria-label={c}
                />
              ))}
            </div>

            {nameError && <p className="entry-error">{nameError}</p>}

            <button type="button" className="btn btn-primary btn-full entry-submit"
              onClick={startSession}>
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
              color={color}
              brushSize={brushSize}
              remoteQueue={remoteQueue}
              onEvent={sendEvent}
              onCursor={handleCursor}
              connected={isConnected}
            />
            {/* Peer cursor overlay */}
            {peerCursor && isConnected && (
              <div className="peer-cursor" style={{
                left: `${peerCursor.x * 100}%`,
                top: `${peerCursor.y * 100}%`,
              }}>
                <div className="peer-cursor-dot" style={{
                  background: peerColor,
                  color: cursorTextColor,
                }}>
                  {(peerName[0] || '?').toUpperCase()}
                </div>
                <span className="peer-cursor-label" style={{
                  background: peerColor,
                  color: cursorTextColor,
                }}>
                  {peerName}
                </span>
              </div>
            )}
          </div>
        </div>

        <aside className="sidebar">
          <Toolbar
            color={color}
            brushSize={brushSize}
            onColor={setColor}
            onBrush={setBrushSize}
            onClear={handleClear}
            onBomb={fireBomb}
            connected={isConnected}
          />
          <SharePanel status={status} roomUrl={roomUrl} myName={myName} peerName={peerName} />
          <ChatPanel
            messages={messages}
            myName={myName}
            peerName={peerName}
            onSend={sendChat}
            connected={isConnected}
          />
        </aside>
      </div>
    </div>
  );
}
