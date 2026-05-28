import React, { useRef, useEffect, useCallback } from 'react';

export default function Canvas({ color, brushSize, remoteQueue, onEvent, connected }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const prevRef = useRef(null);
  const rafRef = useRef(null);
  const isDrawing = useRef(false);

  // Set up canvas and ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext('2d');

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      // Preserve existing drawing on resize via offscreen copy
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

  // Draw a smooth segment
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

  // Apply a normalized event to the canvas
  const applyEvent = useCallback((evt) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    if (evt.t === 'clear') {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    if (evt.t !== 'd') return;

    const x = evt.x * W;
    const y = evt.y * H;
    const px = (evt.px ?? evt.x) * W;
    const py = (evt.py ?? evt.y) * H;

    drawSegment(ctx, px, py, x, y, evt.c, evt.w);
  }, [drawSegment]);

  // RAF loop — drain remote queue
  useEffect(() => {
    const tick = () => {
      const queue = remoteQueue.current;
      while (queue.length > 0) {
        applyEvent(queue.shift());
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyEvent, remoteQueue]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY);
    return {
      x: (clientX - rect.left) / canvas.width,
      y: (clientY - rect.top) / canvas.height,
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
    if (!isDrawing.current) return;
    const { x, y } = getPos(e);
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
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
