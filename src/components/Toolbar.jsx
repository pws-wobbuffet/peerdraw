import React, { useRef } from 'react';

const COLORS = ['#0a0a0a', '#1aa05a', '#7c3aed', '#e85d1f', '#0891b2', '#d4264c'];
const BRUSHES = [
  { size: 3,  label: 'S' },
  { size: 7,  label: 'M' },
  { size: 16, label: 'L' },
];

export default function Toolbar({ color, brushSize, onColor, onBrush, onClear }) {
  const customRef = useRef(null);

  return (
    <div className="panel">
      <div className="panel-title">Brush</div>

      <div className="swatch-row">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (color === c ? ' active' : '')}
            style={{ background: c }}
            onClick={() => onColor(c)}
            aria-label={c}
          />
        ))}
        <button
          type="button"
          className={'swatch custom' + (!COLORS.includes(color) ? ' active' : '')}
          onClick={() => customRef.current?.click()}
          title="Custom colour"
        >
          <input
            ref={customRef}
            type="color"
            value={color}
            onChange={(e) => onColor(e.target.value)}
          />
        </button>
      </div>

      <div className="brush-row">
        {BRUSHES.map(({ size, label }) => {
          const dim = size + 16;
          return (
            <button
              key={size}
              type="button"
              className={'brush-btn' + (brushSize === size ? ' active' : '')}
              style={{ width: dim, height: dim }}
              onClick={() => onBrush(size)}
              aria-label={`Brush ${label}`}
            >
              <span className="brush-dot" style={{ width: size, height: size }} />
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-danger btn-full" onClick={onClear}>
          Clear canvas
        </button>
      </div>
    </div>
  );
}
