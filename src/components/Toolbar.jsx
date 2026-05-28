import React, { useRef } from 'react';
import { PALETTE } from '../lib/colors';

const BRUSHES = [
  { size: 3, label: 'S' },
  { size: 7, label: 'M' },
  { size: 16, label: 'L' },
];

const BOMBS = [
  { type: 'ink',     icon: '💥', label: 'Ink bomb' },
  { type: 'erase',   icon: '⊘',  label: 'Erase bomb' },
  { type: 'rainbow', icon: '🌈', label: 'Rainbow bomb' },
];

export default function Toolbar({ color, brushSize, onColor, onBrush, onClear, onBomb, connected }) {
  const customRef = useRef(null);

  return (
    <div className="panel">
      <div className="panel-title">Brush</div>

      <div className="swatch-row">
        {PALETTE.map((c) => (
          <button key={c} type="button"
            className={'swatch' + (color === c ? ' active' : '')}
            style={{ background: c }}
            onClick={() => onColor(c)}
            aria-label={c}
          />
        ))}
        <button type="button"
          className={'swatch custom' + (!PALETTE.includes(color) ? ' active' : '')}
          onClick={() => customRef.current?.click()}
          title="Custom colour">
          <input ref={customRef} type="color" value={color}
            onChange={(e) => onColor(e.target.value)} />
        </button>
      </div>

      <div className="brush-row" style={{ marginBottom: 14 }}>
        {BRUSHES.map(({ size, label }) => {
          const dim = size + 18;
          return (
            <button key={size} type="button"
              className={'brush-btn' + (brushSize === size ? ' active' : '')}
              style={{ width: dim, height: dim }}
              onClick={() => onBrush(size)}
              aria-label={`Brush ${label}`}>
              <span className="brush-dot" style={{ width: size, height: size }} />
            </button>
          );
        })}
      </div>

      <button type="button" className="btn btn-danger btn-full" onClick={onClear}>
        Clear canvas
      </button>

      {connected && (
        <div className="bomb-row">
          {BOMBS.map(({ type, icon, label }) => (
            <button key={type} type="button"
              className="btn btn-secondary bomb-btn"
              onClick={() => onBomb(type)}
              title={label}>
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
