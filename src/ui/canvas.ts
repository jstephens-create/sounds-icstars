// Canvas 2D helpers shared by the network (System 01) and the signal display (System 03).
import { el } from './dom.ts';

/** A crisp, self-sizing canvas. size is in CSS pixels; the backing store follows devicePixelRatio. */
export function createCanvas(className: string, onResize: () => void) {
  const canvas = el('canvas', className);
  canvas.setAttribute('aria-hidden', 'true'); // visual layer only; the same information exists as text
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
  const size = { w: 0, h: 0 };
  // Layout is read only here, never inside the animation loop.
  new ResizeObserver(() => {
    const dpr = devicePixelRatio || 1;
    size.w = canvas.clientWidth;
    size.h = canvas.clientHeight;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize();
  }).observe(canvas);
  return { canvas, ctx, size };
}

/** Reads a design token from :root (canvas can't use CSS variables directly). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
