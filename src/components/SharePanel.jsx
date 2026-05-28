import React, { useState } from 'react';

const PRIVQR = 'https://pws-wobbuffet.github.io/privqr/';

export default function SharePanel({ status, roomUrl }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(roomUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const privqrUrl = roomUrl
    ? `${PRIVQR}?url=${encodeURIComponent(roomUrl)}`
    : null;

  const statusInfo = {
    idle:         { dot: '',      label: 'No session' },
    hosting:      { dot: 'amber', label: 'Waiting for peer…' },
    joining:      { dot: 'amber', label: 'Connecting…' },
    connected:    { dot: 'green', label: '▣ Connected' },
    disconnected: { dot: 'red',   label: 'Peer disconnected' },
  }[status] ?? { dot: '', label: status };

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-title">Session</div>

      <div className="status-badge">
        <span className={`status-dot ${statusInfo.dot}`} />
        {statusInfo.label}
        {status === 'joining' && <span className="spinner" style={{ width: 12, height: 12, marginLeft: 4 }} />}
      </div>

      {roomUrl && status !== 'idle' && (
        <>
          <div className="url-box">
            <b>Room link:</b><br />
            {roomUrl}
          </div>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={copy}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <a
              href={privqrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Make QR →
            </a>
          </div>
        </>
      )}

      {status === 'disconnected' && (
        <button
          type="button"
          className="btn btn-secondary btn-full"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      )}
    </div>
  );
}
