/**
 * Liquid Aura Background Engine
 * Simulates the Apple macOS Sonoma/Sequoia fluid moving ribbon wallpaper
 * Creates ambient chromatic light that refracts through Glisse liquid glass panels
 */
(function () {
  'use strict';

  class LiquidAura {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.width = 0;
      this.height = 0;
      this.time = 0;
      this.animId = null;
      this.mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
      this.isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });

      // Subtle mouse drift for interactive refraction (as in Glisse playground)
      window.addEventListener('pointermove', (e) => {
        this.mouse.targetX = e.clientX / window.innerWidth;
        this.mouse.targetY = e.clientY / window.innerHeight;
      }, { passive: true });

      // Theme observer
      const observer = new MutationObserver(() => {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (dark !== this.isDark) {
          this.isDark = dark;
          if (this.prefersReducedMotion) this.renderStatic();
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      // Visibility change to conserve battery/GPU when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.animId) cancelAnimationFrame(this.animId);
        } else if (!this.prefersReducedMotion) {
          this.loop();
        }
      });

      if (this.prefersReducedMotion) {
        this.renderStatic();
      } else {
        this.loop();
      }
    }

    resize() {
      // Use low internal resolution for smooth 60fps performance with heavy CSS blur filter
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.width = Math.max(320, Math.floor(window.innerWidth * 0.5 * dpr));
      this.height = Math.max(240, Math.floor(window.innerHeight * 0.5 * dpr));
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      if (this.prefersReducedMotion) this.renderStatic();
    }

    getPalettes() {
      if (this.isDark) {
        // Deep Obsidian Canvas with Luminous Electric Ribbons (Glisse Dark Aesthetic)
        return [
          { r: 37,  g: 99,  b: 235, a: 0.38, radius: 0.55 }, // Sapphire Blue
          { r: 147, g: 51,  b: 234, a: 0.35, radius: 0.50 }, // Electric Violet
          { r: 6,   g: 182, b: 212, a: 0.32, radius: 0.48 }, // Radiant Cyan
          { r: 236, g: 72,  b: 153, a: 0.28, radius: 0.42 }, // Vibrant Rose
          { r: 16,  g: 185, b: 129, a: 0.25, radius: 0.40 }, // Neon Emerald
        ];
      } else {
        // Silky Pearlescent Canvas with Watercolor Pastel Ribbons (Glisse Light Aesthetic)
        return [
          { r: 59,  g: 130, b: 246, a: 0.28, radius: 0.55 }, // Sky Blue
          { r: 168, g: 85,  b: 247, a: 0.25, radius: 0.50 }, // Soft Lavender
          { r: 16,  g: 185, b: 129, a: 0.24, radius: 0.46 }, // Fresh Mint
          { r: 244, g: 114, b: 182, a: 0.22, radius: 0.42 }, // Blush Rose
          { r: 14,  g: 165, b: 233, a: 0.26, radius: 0.45 }, // Aqua
        ];
      }
    }

    drawFrame(t) {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      // Smooth mouse interpolation
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

      ctx.clearRect(0, 0, w, h);

      const palettes = this.getPalettes();
      const mx = (this.mouse.x - 0.5) * w * 0.15;
      const my = (this.mouse.y - 0.5) * h * 0.15;

      // Draw sweeping fluid orbs
      palettes.forEach((p, idx) => {
        const speed = 0.0006 + idx * 0.0002;
        const phase = idx * (Math.PI / 2.5);

        // Organic Lissajous curve motion
        const cx = w * (0.5 + 0.32 * Math.sin(t * speed + phase)) + mx * (idx % 2 === 0 ? 1 : -1);
        const cy = h * (0.5 + 0.28 * Math.cos(t * speed * 0.8 + phase)) + my * (idx % 2 === 0 ? -1 : 1);
        const radius = Math.min(w, h) * p.radius * (1 + 0.1 * Math.sin(t * speed * 1.5 + phase));

        const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
        grad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a})`);
        grad.addColorStop(0.55, `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a * 0.5})`);
        grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    renderStatic() {
      this.drawFrame(1000);
    }

    loop() {
      this.time = performance.now();
      const step = (now) => {
        this.drawFrame(now);
        this.animId = requestAnimationFrame(step);
      };
      this.animId = requestAnimationFrame(step);
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new LiquidAura('liquidAuraCanvas'));
  } else {
    new LiquidAura('liquidAuraCanvas');
  }
})();
