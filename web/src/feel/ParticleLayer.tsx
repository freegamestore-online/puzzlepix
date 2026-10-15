// TODO: switch to @freegamestore/games/feel once published
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useGameLoop } from "../hooks/useGameLoop";
import { createBurst, MAX_PARTICLES, particleAlpha, stepParticles, type BurstOptions, type Particle } from "./particles";
import { prefersReducedMotion } from "../motion/reducedMotion";

export interface ParticleLayerHandle {
  /** Launch a burst from (x, y), in the layer's own pixel space. Does nothing under reduced motion. */
  burst(x: number, y: number, colours: readonly string[], options: BurstOptions): void;
}

/** Highest device pixel ratio used for the canvas. Higher ratios cost fill time for no visible gain. */
const MAX_DPR = 2;

/**
 * A full-size canvas that draws particle bursts. The frame loop runs only while
 * particles are alive, so an idle board costs nothing. The live count is kept
 * on `data-particles`, which tests read without a re-render per frame.
 */
export const ParticleLayer = forwardRef<ParticleLayerHandle>(function ParticleLayer(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [running, setRunning] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      burst(x, y, colours, options) {
        const canvas = canvasRef.current;
        if (!canvas || prefersReducedMotion()) return;
        sizeCanvas(canvas, ctxRef);
        const particles = particlesRef.current;
        particles.push(...createBurst(x, y, colours, options));
        if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
        setRunning(true);
      },
    }),
    [],
  );

  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    const particles = stepParticles(particlesRef.current, dt);
    if (canvas) {
      drawParticles(canvas, ctxRef, particles);
      canvas.dataset.particles = String(particles.length);
    }
    if (particles.length === 0) setRunning(false);
  }, !running);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-particles="0"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 700 }}
    />
  );
});

/** Match the canvas backing store to its CSS size, scaled for the screen, and reset the transform. */
function sizeCanvas(canvas: HTMLCanvasElement, ctxRef: { current: CanvasRenderingContext2D | null }) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctxRef.current ??= canvas.getContext("2d");
  ctxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawParticles(
  canvas: HTMLCanvasElement,
  ctxRef: { current: CanvasRenderingContext2D | null },
  particles: readonly Particle[],
) {
  const ctx = ctxRef.current ?? (ctxRef.current = canvas.getContext("2d"));
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  for (const particle of particles) {
    ctx.globalAlpha = particleAlpha(particle);
    ctx.fillStyle = particle.colour;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}
