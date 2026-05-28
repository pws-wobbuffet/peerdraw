import React, { useState } from 'react';

const PRIVQR = 'https://pws-wobbuffet.github.io/privqr/';

export default function SharePanel({ status, roomUrl, myName, peerName, isHost, onStartPictionary, onStartColorWar }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(roomUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const privqrUrl = roomUrl ? `${PRIVQR}?url=${encodeURIComponent(roomUrl)}` : null;

  const statusInfo = {
    entry:        { dot: '',      label: 'Not connected' },
    hosting:      { dot: 'amber', label: 'Waiting for peer…' },
    joining:      { dot: 'amber', label: 'Connecting…' },
    connected:    { dot: 'green', label: peerName ? `▣ ${peerName} joined` : '▣ Connected' },
    disconnected: { dot: 'red',   label: 'Peer disconnected' },
  }[status] ?? { dot: '', label: status };

  return (
    <div className="panel">
      <div className="panel-title">Session</div>

      <div className="status-badge">
        <span className={`status-dot ${statusInfo.dot}`} />
        {statusInfo.label}
        {status === 'joining' && <span className="spinner" style={{ width: 12, height: 12, marginLeft: 4 }} />}
      </div>

      {roomUrl && status !== 'entry' && (
        <>
          <div className="url-box">
            <b>Room link:</b><br />
            {roomUrl}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={copy}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <a href={privqrUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Make QR →
            </a>
          </div>
        </>
      )}

      {status === 'connected' && isHost && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onStartPictionary}>
            🎨 Pictionary
          </button>
          <button type="button" className="btn btn-secondary" onClick={onStartColorWar}>
            ⚔️ Color War
          </button>
        </div>
      )}

      {status === 'disconnected' && (
        <button type="button" className="btn btn-secondary btn-full" style={{ marginTop: 10 }}
          onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  );
}
