import React, { useRef, useEffect, useCallback, forwardRef } from 'react';

const Canvas = forwardRef(function Canvas({ color, brushSize, remoteQueue, onEvent, onCursor, connected }, outerRef) {
  const canvasRef = useRef(null);

  // Merge internal and forwarded refs so App can read the canvas element
  const setCanvasRef = useCallback((el) => {
    canvasRef.current = el;
    if (typeof outerRef === 'function') outerRef(el);
    else if (outerRef) outerRef.current = el;
  }, [outerRef]);
  const ctxRef = useRef(null);
  const prevRef = useRef(null);
  const rafRef = useRef(null);
  const animQueue = useRef([]);
  const isDrawing = useRef(false);

  // Set up canvas + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext('2d');

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      offscreen.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width = width;
      canvas.height = height;
      ctxRef.current.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => ro.disconnect();
  }, []);

  const drawSegment = useCallback((ctx, px, py, x, y, c, w) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px, py, mx, my);
    ctx.stroke();
  }, []);

  const applyEvent = useCallback((evt) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    switch (evt.t) {
      case 'clear':
        ctx.clearRect(0, 0, W, H);
        break;
      case 'd': {
        const x = evt.x * W, y = evt.y * H;
        const px = (evt.px ?? evt.x) * W, py = (evt.py ?? evt.y) * H;
        drawSegment(ctx, px, py, x, y, evt.c, evt.w);
        break;
      }
      case 'bomb_ink': {
        const cx = evt.x * W, cy = evt.y * H;
        const radius = evt.r * Math.min(W, H);
        ctx.fillStyle = evt.c || '#0a0a0a';
        for (let i = 0; i < 50; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.pow(Math.random(), 0.5) * radius;
          const size = Math.random() * 9 + 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, size, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'bomb_erase': {
        const cx = evt.x * W, cy = evt.y * H;
        const radius = evt.r * Math.min(W, H);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'bomb_rainbow':
        animQueue.current.push({ type: 'rainbow', x: evt.x, y: evt.y, start: performance.now() });
        break;
      default:
        break;
    }
  }, [drawSegment]);

  // RAF loop: drain remoteQueue + advance animations
  useEffect(() => {
    const RAINBOW_COLORS = ['#e85d1f', '#d97706', '#1aa05a', '#0891b2', '#7c3aed', '#d4264c'];

    const tick = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      // Drain drawing queue
      const queue = remoteQueue.current;
      while (queue.length > 0) applyEvent(queue.shift());

      // Advance animations
      if (canvas && ctx && animQueue.current.length > 0) {
        const W = canvas.width, H = canvas.height;
        const now = performance.now();
        animQueue.current = animQueue.current.filter(anim => {
          const elapsed = now - anim.start;
          if (anim.type === 'rainbow') {
            const cx = anim.x * W, cy = anim.y * H;
            const maxR = Math.min(W, H) * 0.4;
            const progress = Math.min(elapsed / 700, 1);
            const r = progress * maxR;
            RAINBOW_COLORS.forEach((c, i) => {
              const ri = r - i * 14;
              if (ri <= 0) return;
              ctx.strokeStyle = c;
              ctx.lineWidth = 10;
              ctx.globalAlpha = 1 - progress * 0.6;
              ctx.beginPath();
              ctx.arc(cx, cy, ri, 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 1;
            });
            return elapsed < 700;
          }
          return false;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyEvent, remoteQueue]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / canvas.width,
      y: (e.clientY - rect.top) / canvas.height,
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const { x, y } = getPos(e);
    prevRef.current = { x, y };
    const evt = { t: 'd', x, y, px: x, py: y, p: 's', c: color, w: brushSize };
    applyEvent(evt);
    if (connected) onEvent(evt);
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    onCursor?.({ x, y });

    if (!isDrawing.current) return;
    const { x: px, y: py } = prevRef.current;
    const evt = { t: 'd', x, y, px, py, p: 'm', c: color, w: brushSize };
    applyEvent(evt);
    if (connected) onEvent(evt);
    prevRef.current = { x, y };
  };

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const { x, y } = getPos(e);
    const { x: px, y: py } = prevRef.current ?? { x, y };
    const evt = { t: 'd', x, y, px, py, p: 'e', c: color, w: brushSize };
    applyEvent(evt);
    if (connected) onEvent(evt);
    prevRef.current = null;
  };

  return (
    <canvas
      ref={setCanvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
});

export default Canvas;
