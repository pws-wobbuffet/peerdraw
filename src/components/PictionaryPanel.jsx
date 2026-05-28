import React from 'react';

export default function PictionaryPanel({ game, myName, peerName, isHost, onAbandon }) {
  if (!game) return null;

  const myScore = game.score[isHost ? 0 : 1];
  const peerScore = game.score[isHost ? 1 : 0];
  const pct = Math.round((game.timeLeft / game.duration) * 100);
  const timerColor = game.timeLeft <= 10 ? 'var(--danger)' : 'var(--accent)';

  return (
    <div className="panel game-panel">
      <div className="panel-title">
        Pictionary · Round {game.round}/{game.totalRounds}
      </div>

      {/* Timer */}
      <div className="game-timer-bar" style={{ background: 'var(--bg)', border: 'var(--border-w) solid var(--line)' }}>
        <div className="game-timer-fill" style={{ width: `${pct}%`, background: timerColor }} />
      </div>
      <div className="game-timer-num" style={{ color: timerColor }}>{game.timeLeft}s</div>

      {/* Role + word */}
      <div className="game-role">
        {game.role === 'drawer' ? '✏️ YOU ARE DRAWING' : '🔍 YOU ARE GUESSING'}
      </div>
      {game.role === 'drawer' && (
        <div className="game-word">{game.word}</div>
      )}
      {game.role === 'guesser' && (
        <div className="game-word-hint">Type your guess in chat ↓</div>
      )}

      {/* Score */}
      <div className="game-score">
        <span>{myName || 'You'} {myScore}</span>
        <span className="game-score-sep">·</span>
        <span>{peerName || 'Peer'} {peerScore}</span>
      </div>

      {isHost && (
        <button type="button" className="btn btn-secondary btn-full" style={{ marginTop: 10 }}
          onClick={onAbandon}>
          End game
        </button>
      )}
    </div>
  );
}
