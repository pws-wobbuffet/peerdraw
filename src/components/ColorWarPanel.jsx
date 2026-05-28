import React from 'react';
import { isLight } from '../lib/colors';

export default function ColorWarPanel({ war, myName, peerName, onBomb, isHost, onAbandon }) {
  if (!war) return null;

  const total = war.myCount + war.peerCount;
  const myPct  = total > 0 ? Math.round((war.myCount  / total) * 100) : 50;
  const peerPct = 100 - myPct;
  const timerColor = war.timeLeft <= 15 ? 'var(--danger)' : 'var(--fg)';

  return (
    <div className="panel game-panel">
      <div className="panel-title">Color War</div>

      <div className="game-timer-num" style={{ color: timerColor, fontSize: 28, textAlign: 'center', marginBottom: 10 }}>
        {war.timeLeft}s
      </div>

      {/* Territory bar */}
      <div className="war-bar">
        <div style={{ width: `${myPct}%`, background: war.myColor, height: '100%', transition: 'width 0.5s ease' }} />
        <div style={{ flex: 1, background: war.peerColor, height: '100%', transition: 'flex 0.5s ease' }} />
      </div>
      <div className="war-bar-labels">
        <span style={{ color: war.myColor, fontWeight: 700 }}>{myName || 'You'} {myPct}%</span>
        <span style={{ color: war.peerColor, fontWeight: 700 }}>{peerName || 'Peer'} {peerPct}%</span>
      </div>

      {/* Your color swatch */}
      <div className="war-color-mine">
        <span className="panel-title" style={{ marginBottom: 4 }}>Your colour</span>
        <div style={{
          width: 36, height: 36,
          background: war.myColor,
          border: '3px solid var(--line)',
          borderRadius: 4,
          boxShadow: '2px 2px 0 var(--shadow)',
        }} />
      </div>

      {/* Bombs */}
      <div className="panel-title" style={{ marginTop: 12 }}>Bombs ({war.bombs} left)</div>
      <div className="bomb-row">
        <button type="button" className="btn btn-secondary bomb-btn"
          disabled={war.bombs <= 0} onClick={() => onBomb('ink')} title="Ink bomb">💥</button>
        <button type="button" className="btn btn-secondary bomb-btn"
          disabled={war.bombs <= 0} onClick={() => onBomb('erase')} title="Erase bomb">⊘</button>
        <button type="button" className="btn btn-secondary bomb-btn"
          disabled={war.bombs <= 0} onClick={() => onBomb('rainbow')} title="Rainbow bomb">🌈</button>
      </div>

      {isHost && (
        <button type="button" className="btn btn-secondary btn-full" style={{ marginTop: 10 }}
          onClick={onAbandon}>
          End war
        </button>
      )}
    </div>
  );
}
