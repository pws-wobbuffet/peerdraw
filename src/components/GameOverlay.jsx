import React from 'react';

export default function GameOverlay({ overlay }) {
  if (!overlay) return null;
  return (
    <div className="game-overlay">
      <div className="game-overlay-text">{overlay.text}</div>
      {overlay.sub && <div className="game-overlay-sub">{overlay.sub}</div>}
    </div>
  );
}
