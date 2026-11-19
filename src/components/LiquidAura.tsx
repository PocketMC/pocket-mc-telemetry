import React, { useEffect, useRef } from 'react';

interface LiquidAuraProps {
  theme?: 'light' | 'dark';
}

export const LiquidAura: React.FC<LiquidAuraProps> = ({ theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    const mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(320, Math.floor(window.innerWidth * 0.5 * dpr));
      height = Math.max(240, Math.floor(window.innerHeight * 0.5 * dpr));
      canvas.width = width;
      canvas.height = height;
      if (prefersReducedMotion) renderFrame(1000);
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouse.targetX = e.clientX / window.innerWidth;
      mouse.targetY = e.clientY / window.innerHeight;
    };

    const getPalettes = () => {
      const isDark = theme === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        return [
          { r: 37,  g: 99,  b: 235, a: 0.40, radius: 0.55 }, // Sapphire
          { r: 147, g: 51,  b: 234, a: 0.36, radius: 0.50 }, // Electric Violet
          { r: 6,   g: 182, b: 212, a: 0.34, radius: 0.48 }, // Radiant Cyan
          { r: 236, g: 72,  b: 153, a: 0.30, radius: 0.42 }, // Rose
          { r: 16,  g: 185, b: 129, a: 0.28, radius: 0.40 }, // Neon Emerald
        ];
      } else {
        return [
          { r: 59,  g: 130, b: 246, a: 0.28, radius: 0.55 }, // Sky Blue
          { r: 168, g: 85,  b: 247, a: 0.25, radius: 0.50 }, // Lavender
          { r: 16,  g: 185, b: 129, a: 0.24, radius: 0.46 }, // Mint
          { r: 244, g: 114, b: 182, a: 0.22, radius: 0.42 }, // Pastel Blush
          { r: 14,  g: 165, b: 233, a: 0.26, radius: 0.45 }, // Aqua
        ];
      }
    };

    const renderFrame = (t: number) => {
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const palettes = getPalettes();
      const mx = (mouse.x - 0.5) * width * 0.15;
      const my = (mouse.y - 0.5) * height * 0.15;

      palettes.forEach((p, idx) => {
        const speed = 0.0006 + idx * 0.0002;
        const phase = idx * (Math.PI / 2.5);

        const cx = width * (0.5 + 0.32 * Math.sin(t * speed + phase)) + mx * (idx % 2 === 0 ? 1 : -1);
        const cy = height * (0.5 + 0.28 * Math.cos(t * speed * 0.8 + phase)) + my * (idx % 2 === 0 ? -1 : 1);
        const radius = Math.min(width, height) * p.radius * (1 + 0.1 * Math.sin(t * speed * 1.5 + phase));

        const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
        grad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a})`);
        grad.addColorStop(0.55, `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a * 0.5})`);
        grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    if (!prefersReducedMotion) {
      const loop = (now: number) => {
        renderFrame(now);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    } else {
      renderFrame(1000);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [theme]);

  return (
    <div
      className="liquid-aura-bg"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="liquid-aura-canvas" />
    </div>
  );
};
