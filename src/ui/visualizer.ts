// SYSTEM 03 — signal. Canvas 2D, drawn once per animation frame with no DOM writes (the readout
// refreshes 4×/s, the title only when the mode changes). Knows nothing about members.
//
// Two layers, crossfaded by scene.perf:
//   AMBIENT SIGNAL (paused): a procedural pattern of sines on the ambient clock. Drawn as hollow
//     outlines and labelled synthetic. It never feeds the meters or the numeric readout.
//   LIVE AUDIO (playing): real analyser data, filled bars, peak caps and the raw waveform.
// Motion STILL: the ambient pattern holds still; live bars keep updating but fall more slowly
// (release set in main.ts); the waveform and peak caps are hidden.
import { logBands, type AudioFrame } from '../audio/analyser.ts';
import { createCanvas, MONO, token } from './canvas.ts';
import { el } from './dom.ts';
import { motion, type Scene } from './motion.ts';

const BARS = 48;
const F_MIN = 30;
const F_MAX = 16000;
const SPLITS = [250, 2000]; // LOW | MID | HIGH boundaries, same as AudioFrame.low/mid/high
const CAP_FALL = 0.5; // peak caps fall half the display height per second
const READOUT_MS = 250;

/** The synthetic pattern for bar i at ambient time t (0..1). Pure, so it is testable and deterministic. */
export function ambientBar(i: number, n: number, t: number): number {
  const v = 0.16 + 0.1 * Math.sin(t * 0.8 + i * 0.31) + 0.06 * Math.sin(t * 1.9 - i * 0.73) + 0.04 * Math.sin(t * 0.23 + i * 2.1);
  return Math.max(0, Math.min(1, v * (1.15 - (0.55 * i) / n)));
}

export function createVisualizer() {
  const root = el('section', 'panel viz');
  root.setAttribute('aria-label', 'Audio signal');
  const title = el('h2', 'label');
  let titleMode = '';

  let colors = { fg: '', dim: '', line: '', signal: '' };
  const { canvas, ctx, size } = createCanvas('viz-canvas', () => {
    colors = { fg: token('--fg'), dim: token('--dim'), line: token('--line'), signal: token('--signal') };
    if (last) draw(last.frame, 0, last.scene);
  });
  const readout = el('p', 'label readout');

  const bands = new Float32Array(BARS);
  const caps = new Float32Array(BARS);
  const xAt = (hz: number, w: number) => (Math.log(hz / F_MIN) / Math.log(F_MAX / F_MIN)) * w;
  let last: { frame: AudioFrame; scene: Scene } | null = null;
  let sinceReadout = READOUT_MS;

  /** Returns true while live bars are still visibly falling. */
  function draw(frame: AudioFrame, dt: number, scene: Scene): boolean {
    last = { frame, scene };
    const live = scene.perf >= 0.5;
    const modeName = live ? 'live' : 'ambient';
    if (modeName !== titleMode) {
      titleMode = modeName;
      title.textContent = live ? 'SYSTEM 03 / SIGNAL · LIVE AUDIO' : 'SYSTEM 03 / AMBIENT SIGNAL · SYNTHETIC';
      root.dataset.mode = modeName;
    }
    const { w, h } = size;
    if (!w) return false;
    const still = motion.still();
    const silent = frame.spectrum.length === 0;
    if (silent) bands.fill(0);
    else logBands(frame.spectrum, frame.binHz, BARS, F_MIN, F_MAX, bands);

    ctx.clearRect(0, 0, w, h);
    const meterH = 18;
    const base = h - 14;
    const span = base - meterH - 8;
    const bw = w / BARS;

    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.line;
    ctx.fillRect(0, base, w, 1);
    for (const hz of SPLITS) ctx.fillRect(Math.round(xAt(hz, w)), meterH + 4, 1, base - meterH - 4);

    // Ambient layer: hollow bars + a slow synthetic wave, fading out as performance takes over.
    const ambientAlpha = 1 - scene.perf;
    if (ambientAlpha > 0.01) {
      ctx.globalAlpha = ambientAlpha;
      ctx.strokeStyle = colors.dim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < BARS; i++) {
        const v = ambientBar(i, BARS, scene.tau) * span;
        ctx.rect(i * bw + 1.5, base - v + 0.5, Math.max(1, bw - 3), v);
      }
      ctx.stroke();
      const mid = meterH + span * 0.45;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const u = x / w;
        const y = mid - span * 0.12 * (Math.sin(u * 9 + scene.tau * 1.3) + 0.5 * Math.sin(u * 23 - scene.tau * 0.7));
        if (x) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Live layer: real analyser data (all zero before the first play, decays to zero after a pause).
    let busy = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.fg;
    for (let i = 0; i < BARS; i++) {
      const v = bands[i] ?? 0;
      if (v > 0.002) ctx.fillRect(i * bw + 1, base - v * span, Math.max(1, bw - 2), v * span);
      caps[i] = still ? v : Math.max(v, (caps[i] ?? 0) - (CAP_FALL * dt) / 1000);
      if (v > 0.004 || (caps[i] ?? 0) > 0.004) busy = true;
    }
    if (!still) {
      ctx.fillStyle = colors.signal;
      for (let i = 0; i < BARS; i++) if ((caps[i] ?? 0) > 0.004) ctx.fillRect(i * bw + 1, base - (caps[i] ?? 0) * span - 2, Math.max(1, bw - 2), 2);
      const wave = frame.wave;
      if (wave.length && !silent && scene.perf > 0.01) {
        const mid = meterH + span * 0.45;
        const step = Math.max(1, Math.floor(wave.length / w));
        ctx.globalAlpha = scene.perf;
        ctx.strokeStyle = colors.signal;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, mid - (wave[0] ?? 0) * span * 0.4);
        for (let i = step; i < wave.length; i += step) ctx.lineTo((i / wave.length) * w, mid - (wave[i] ?? 0) * span * 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // LOW / MID / HIGH meters: real measurements only (empty in ambient mode).
    const zones: [number, number, number][] = [
      [0, xAt(SPLITS[0] ?? 250, w), frame.low],
      [xAt(SPLITS[0] ?? 250, w), xAt(SPLITS[1] ?? 2000, w), frame.mid],
      [xAt(SPLITS[1] ?? 2000, w), w, frame.high],
    ];
    ctx.font = `10px ${MONO}`;
    ctx.textBaseline = 'middle';
    ['LOW', 'MID', 'HIGH'].forEach((name, i) => {
      const [x0, x1, v] = zones[i] ?? [0, 0, 0];
      ctx.fillStyle = colors.line;
      ctx.fillRect(x0 + 1, 2, x1 - x0 - 2, meterH - 4);
      ctx.fillStyle = colors.fg;
      ctx.fillRect(x0 + 1, 2, (x1 - x0 - 2) * v, meterH - 4);
      ctx.fillStyle = colors.dim;
      ctx.fillText(name, x0 + 4, base + 8);
    });

    sinceReadout += dt;
    if (sinceReadout >= READOUT_MS || !live) {
      sinceReadout = 0;
      const f = (n: number) => n.toFixed(2);
      const text = live
        ? `ENERGY ${f(frame.energy)} · LOW ${f(frame.low)} · MID ${f(frame.mid)} · HIGH ${f(frame.high)}`
        : 'NO AUDIO PLAYING · PROCEDURAL PATTERN, NOT A MEASUREMENT';
      if (readout.textContent !== text) readout.textContent = text;
    }
    return busy;
  }

  root.append(title, canvas, readout);
  return { el: root, draw };
}
