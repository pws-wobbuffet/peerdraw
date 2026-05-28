export const PALETTE = ['#0a0a0a', '#1aa05a', '#7c3aed', '#e85d1f', '#0891b2', '#d4264c'];

export function isLight(hex) {
  const h = (hex || '#000').replace('#', '').padEnd(6, '0');
  const n = parseInt(h.slice(0, 6), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
