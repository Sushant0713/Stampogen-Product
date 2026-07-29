'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#FBBF24', '#021A54'];

/**
 * Full-screen party popper / confetti burst.
 * Call with `active` true briefly after a successful stamp or reward.
 */
export function PartyPopper({ active = false, intensity = 'normal', onDone }) {
  const canvasRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = intensity === 'big' ? 140 : 90;
    const particles = Array.from({ length: count }, () => {
      const side = Math.random();
      const fromLeft = side < 0.5;
      return {
        x: fromLeft ? width * 0.15 : width * 0.85,
        y: height * 0.55,
        vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 9) + (Math.random() - 0.5) * 4,
        vy: -(10 + Math.random() * 14),
        g: 0.28 + Math.random() * 0.12,
        w: 5 + Math.random() * 7,
        h: 7 + Math.random() * 9,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.01,
        shape: Math.random() > 0.35 ? 'rect' : 'circle',
      };
    });

    let raf = 0;
    let finished = false;
    const started = performance.now();
    const maxMs = intensity === 'big' ? 2800 : 2200;

    const draw = (now) => {
      ctx.clearRect(0, 0, width, height);
      let alive = 0;

      particles.forEach((p) => {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.992;
        p.rot += p.vr;
        p.life -= p.decay;
        if (p.life <= 0) return;
        alive += 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });

      const timedOut = now - started > maxMs;
      if (alive > 0 && !timedOut) {
        raf = requestAnimationFrame(draw);
        return;
      }

      if (!finished) {
        finished = true;
        ctx.clearRect(0, 0, width, height);
        onDoneRef.current?.();
      }
    };

    raf = requestAnimationFrame(draw);

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [active, intensity]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute inset-x-0 top-[18%] flex justify-center px-4">
        <div className="animate-bounce rounded-full bg-white/95 px-4 py-2 text-2xl shadow-lg">
          🎉
        </div>
      </div>
    </div>,
    document.body
  );
}
