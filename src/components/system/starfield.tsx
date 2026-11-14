"use client";

import * as React from "react";

/**
 * Fondo estelar animado estilo sala de control de misiones.
 * Canvas fijo detrás del contenido: estrellas con parpadeo, deriva lenta
 * y destellos ocasionales. Respeta prefers-reduced-motion.
 */
export function Starfield() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let raf = 0;

    interface Star {
      x: number;
      y: number;
      r: number;
      baseAlpha: number;
      phase: number;
      twinkleSpeed: number;
      drift: number;
      hue: number; // 0 = blanco, 1 = cian, 2 = ámbar
    }

    let stars: Star[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(220, Math.floor((width * height) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.3 + 0.2,
        baseAlpha: Math.random() * 0.55 + 0.25,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 1.4 + 0.3,
        drift: Math.random() * 0.05 + 0.01,
        hue: Math.random() < 0.82 ? 0 : Math.random() < 0.6 ? 1 : 2,
      }));
    };

    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const tw = reduced ? 1 : 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.phase);
        const alpha = s.baseAlpha * tw;
        const color =
          s.hue === 1 ? `rgba(103, 232, 249, ${alpha})` : s.hue === 2 ? `rgba(251, 191, 36, ${alpha * 0.85})` : `rgba(226, 232, 240, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (!reduced) {
          s.x -= s.drift;
          if (s.x < -2) s.x = width + 2;
        }
      }
      raf = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-70 dark:opacity-100"
    />
  );
}
