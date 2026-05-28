import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import SharePanel from './SharePanel';

const BASE = 'https://pws-wobbuffet.github.io/peerdraw';

export default function App() {
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('peerdraw.theme');
    if (s) return s;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('peerdraw.theme', theme);
  }, [theme]);

  // Drawing state
  const [color, setColor] = useState('#0a0a0a');
  const [brushSize, setBrushSize] = useState(7);

  // PeerJS state
  const [status, setStatus] = useState('idle');  // idle|hosting|joining|connected|disconnected
  const [roomUrl, setRoomUrl] = useState('');
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const remoteQueue = useRef([]);

  // Flip default colors for dark mode on first switch
  const flippedRef = useRef(false);
  useEffect(() => {
    if (theme === 'dark' && !flippedRef.current && color === '#0a0a0a') {
      setColor('#f3efe6');
      flippedRef.current = true;
    } else if (theme === 'light' && flippedRef.current && color === '#f3efe6') {
      setColor('#0a0a0a');
      flippedRef.current = false;
    }
  }, [theme]);

  const setupConn = useCallback((conn) => {
    conn.on('open', () => setStatus('connected'));
    conn.on('data', (evt) => remoteQueue.current.push(evt));
    conn.on('close', () => setStatus('disconnected'));
    conn.on('error', () => setStatus('disconnected'));
    connRef.current = conn;
  }, []);

  const sendEvent = useCallback((evt) => {
    const conn = connRef.current;
    if (conn?.open) {
      try { conn.send(evt); } catch (_) {}
    }
  }, []);

  const handleClear = useCallback(() => {
    remoteQueue.current.push({ t: 'clear' });
    sendEvent({ t: 'clear' });
  }, [sendEvent]);

  // On mount: check if we're joining (hash) or waiting for user to create
  useEffect(() => {
    const hostId = window.location.hash.slice(1);
    if (!hostId) return; // no hash → stay idle, user clicks Create

    // Guest: join mode
    setStatus('joining');
    const peer = new Peer();
    peerRef.current = peer;
    peer.on('open', () => {
      const conn = peer.connect(hostId, { reliable: true });
      setupConn(conn);
    });
    peer.on('error', () => setStatus('disconnected'));
  }, [setupConn]);

  const createSession = () => {
    if (peerRef.current) return;
    const peer = new Peer();
    peerRef.current = peer;
    peer.on('open', (id) => {
      setRoomUrl(`${BASE}/#${id}`);
      setStatus('hosting');
    });
    peer.on('connection', (conn) => setupConn(conn));
    peer.on('error', () => setStatus('disconnected'));
  };

  const isConnected = status === 'connected';

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <span className="brand">
          peer<span className="dot">·</span>draw
        </span>
        <div className="topbar-right">
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z"/>
              </svg>
            )}
          </button>
          <a
            className="icon-btn"
            href="https://github.com/pws-wobbuffet/peerdraw"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.5c0-1 .1-1.4-.5-2 3-.3 5.5-1.5 5.5-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.5 1.3a12 12 0 0 0-6 0C6.5 2.7 5.5 3 5.5 3a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4 9.5c0 4.5 2.5 5.7 5.5 6-.6.6-.6 1-.5 2V21"/>
            </svg>
          </a>
        </div>
      </header>

      {/* Idle splash — shown until user creates or joins */}
      {status === 'idle' && (
        <div className="idle-screen">
          <div className="idle-card">
            <h1>
              Draw<br />
              <span className="em">together.</span>
            </h1>
            <p>
              No server. No account.<br />
              Peer-to-peer. End-to-end.
            </p>
            <button type="button" className="btn btn-primary" onClick={createSession}>
              Create session →
            </button>
          </div>
        </div>
      )}

      {/* Main area — canvas + sidebar */}
      <div className="main">
        <div className="canvas-col">
          <Canvas
            color={color}
            brushSize={brushSize}
            remoteQueue={remoteQueue}
            onEvent={sendEvent}
            connected={isConnected}
          />
        </div>

        <aside className="sidebar">
          <Toolbar
            color={color}
            brushSize={brushSize}
            onColor={setColor}
            onBrush={setBrushSize}
            onClear={handleClear}
          />
          <SharePanel
            status={status}
            roomUrl={roomUrl}
          />
        </aside>
      </div>
    </div>
  );
}
