// SYSTEM 01 — collective network. 16 nodes on a ring (060.01 at the top, clockwise), Canvas 2D,
// drawn once per animation frame. DOM is touched only when the displayed identity changes.
//
// Connections are structural, not relational: every member is linked to every other member
// equally (the complete graph). They never claim a relationship between two people (see
// docs/design-philosophy.md, principle 4).
//
// Motion has two sources, blended by scene.perf (0 = ambient, 1 = performance):
//   ambient (scene.tau, wall clock): orbits, breathing, slow rotation, the GROUP wave, background geometry,
//     drifting large-format type. Deterministic: every offset is a sine of tau with a per-node phase.
//   audio (performance only): ring scale = bass, GROUP node size/link brightness = frequency band i of 16,
//     links to the centered member = energy, ripples around the centered member.
//   pointer: nodes near the cursor are drawn toward it (a local attraction field).
// Motion level STILL (and the system reduced-motion setting by default): none of the above; states jump.
import { logBands, type AudioFrame } from '../audio/analyser.ts';
import type { Member } from '../members/validate.ts';
import { GROUP, type Cue, type Who } from '../timeline/timeline.ts';
import { createCanvas, MONO, SANS, token } from './canvas.ts';
import { el } from './dom.ts';
import { easeStep, motion, type Scene } from './motion.ts';

export type Mode = 'member' | 'group' | 'neutral';
export const modeOf = (who: Who): Mode => (who === null ? 'neutral' : who === GROUP ? 'group' : 'member');

/** Where node i of n should be: the centered member moves to the middle, everyone else stays on the ring. */
export function nodeTarget(i: number, n: number, centered: boolean, cx: number, cy: number, r: number, rot: number) {
  if (centered) return { x: cx, y: cy };
  const a = -Math.PI / 2 + rot + (i * 2 * Math.PI) / n;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export interface Focus {
  audioActiveMember: Who;
  hoveredMember: string | null;
  selectedMember: string | null;
}

export interface NetworkOptions {
  links: boolean; // show connections
  type: boolean; // show large-format kinetic typography
}

const EASE_MS = 260;
const FIELD_R = 140; // pointer attraction radius (px)
const WORD_PERIOD = 7.5; // seconds of ambient clock per large-type composition
const AMBIENT_WORDS = ['060', 'HUMAN', 'SYSTEMS', 'LEVEL UP', 'COLLECTIVE', '16 IDENTITIES'];
const GROUP_WORDS = ['COLLECTIVE', '16 IDENTITIES', 'LEVEL UP', '060'];
const frac = (x: number) => x - Math.floor(x);

export function createNetwork(members: Member[], on: { hover: (slug: string | null) => void; select: (slug: string) => void }) {
  const N = members.length;
  const root = el('section', 'panel stage');
  root.setAttribute('aria-labelledby', 'stage-title');
  const title = el('h2', 'label', 'SYSTEM 01 / COLLECTIVE NETWORK');
  title.id = 'stage-title';

  // Kinetic typography band: who the stage is about right now.
  const overlay = el('div', 'stage-type');
  const kicker = el('p', 'label stage-kicker');
  const big = el('p', 'stage-big');
  overlay.append(kicker, big);
  overlay.setAttribute('aria-hidden', 'true'); // the NOW panel and index carry this as text

  let colors = { fg: '', dim: '', line: '', signal: '' };
  const { canvas, ctx, size } = createCanvas('net-canvas', () => {
    colors = { fg: token('--fg'), dim: token('--dim'), line: token('--line'), signal: token('--signal') };
    for (const n of nodes) n.placed = false; // snap to the new geometry
    redraw();
  });
  root.append(title, canvas, overlay);

  // Per-node deterministic motion parameters (golden-ratio spacing, so no two nodes move in step).
  const nodes = members.map((m, i) => ({
    m, i, x: 0, y: 0, focus: 0, hover: 0, sel: 0, placed: false,
    w1: 0.5 + 0.35 * frac(i * 0.618), w2: 0.45 + 0.3 * frac(i * 0.382), ph: i * 2.39996,
  }));
  const bands = new Float32Array(N);
  let focus: Focus = { audioActiveMember: null, hoveredMember: null, selectedMember: null };
  let center: string | null = null;
  let cue: Cue | null = null;
  let groupW = 0;
  let neutralW = 1;
  const pointer = { x: 0, y: 0, inside: false, field: 0 };
  let last: { frame: AudioFrame; scene: Scene; opts: NetworkOptions } | null = null;
  const redraw = () => last && draw(last.frame, 0, last.scene, last.opts);

  // Pointer: nearest node within reach previews; click opens the profile; position feeds the field.
  const hit = (e: PointerEvent) => {
    let best: (typeof nodes)[number] | null = null;
    let bestD = 22 * 22;
    for (const n of nodes) {
      const d = (n.x - e.offsetX) ** 2 + (n.y - e.offsetY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };
  let hovered: string | null = null;
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.offsetX;
    pointer.y = e.offsetY;
    pointer.inside = e.pointerType === 'mouse'; // touch has no hover; a tap selects instead
    const slug = hit(e)?.m.slug ?? null;
    canvas.style.cursor = slug ? 'pointer' : '';
    if (slug !== hovered) on.hover((hovered = slug));
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    if (hovered) on.hover((hovered = null));
  });
  canvas.addEventListener('click', (e) => {
    const n = hit(e);
    if (n) on.select(n.m.slug);
  });

  // --- Typography band (DOM, only on change) --------------------------------------------------
  const bySlug = new Map(members.map((m) => [m.slug, m]));
  let shownKey = '';
  function refreshType(): void {
    const preview = focus.hoveredMember && focus.hoveredMember !== center ? bySlug.get(focus.hoveredMember) : undefined;
    const mode = modeOf(focus.audioActiveMember);
    const centered = center ? bySlug.get(center) : undefined;
    const audioMember = mode === 'member' ? bySlug.get(focus.audioActiveMember ?? '') : undefined;
    const section = cue ? `NOW · ${cue.section} · ` : '';
    const fromAudio = center !== null && center === focus.audioActiveMember;
    let kind: string;
    let k: string;
    let b: string;
    if (preview) [kind, k, b] = ['member', `PREVIEW · ${preview.id}`, preview.name];
    else if (centered) [kind, k, b] = ['member', fromAudio ? `${section}${centered.id}` : `OPENED · ${centered.id}`, centered.name];
    else if (audioMember) [kind, k, b] = ['member', `${section}${audioMember.id}`, audioMember.name]; // MANUAL, nothing opened
    // An event's untimed lines are joined with " / " on load; only the first line is timed, so only it is set large.
    else if (mode === 'group') [kind, k, b] = ['lyric', `${section}ALL ${N} MEMBERS`, cue?.line.split(' / ')[0] ?? ''];
    else [kind, k, b] = ['none', `${section}NO MEMBER HIGHLIGHTED`, ''];
    const key = `${kind}|${k}|${b}`;
    if (key === shownKey) return;
    const identityChanged = shownKey.split('|')[2] !== b;
    shownKey = key;
    overlay.dataset.kind = kind;
    kicker.textContent = k;
    big.textContent = b;
    // Masked rise (the band clips it) + kicker slide. transform/opacity only: no layout per frame.
    if (identityChanged && b) {
      const still = motion.still();
      big.animate(
        still ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateY(105%)' }, { transform: 'none' }],
        { duration: still ? 150 : 560, easing: 'cubic-bezier(0.2, 0.8, 0, 1)' },
      );
      if (!still) kicker.animate([{ transform: 'translateX(-2em)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(0.2, 0.8, 0, 1)' });
    }
  }

  // --- Large-format type layer (canvas, behind the network) ---------------------------------
  // Words drift through the negative space at two velocities, crossing in opposite directions.
  // Each composition fades in and out on a sine envelope, so the loop never jumps.
  let idWord = { text: '', prev: '', mix: 1 };
  function drawWords(w: number, h: number, dt: number, scene: Scene, mode: Mode, centered: Member | undefined): void {
    const k = Math.floor(scene.tau / WORD_PERIOD);
    const f = frac(scene.tau / WORD_PERIOD);
    const env = Math.sin(Math.PI * f) ** 0.8; // 0 at both ends of a composition: seamless changes
    const list = mode === 'group' ? GROUP_WORDS : AMBIENT_WORDS;
    const word = list[k % list.length] ?? '060';
    const dir = k % 2 ? 1 : -1;
    const sizeA = h * (k % 3 === 0 ? 0.34 : 0.22); // occasional changes of scale
    ctx.font = `700 ${sizeA}px ${SANS}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const tw = ctx.measureText(word).width;
    const xA = (w - tw) / 2 + dir * (f - 0.5) * w * 0.35;
    const yA = k % 2 ? h * 0.32 : h * 0.9;
    ctx.globalAlpha = env * (0.07 + 0.05 * scene.perf);
    ctx.fillStyle = colors.fg;
    ctx.fillText(word, xA, yA);

    // Second layer: the centered member's ID (performance) or the cohort mark, faster and opposite.
    const target = centered ? centered.id : '060 / 16';
    if (target !== idWord.text) idWord = { text: target, prev: idWord.text, mix: 0 };
    idWord.mix = motion.still() ? 1 : Math.min(1, idWord.mix + dt / 450);
    const f2 = frac(scene.tau / (WORD_PERIOD * 0.6) + 0.37);
    const sizeB = h * 0.11;
    ctx.font = `700 ${sizeB}px ${MONO}`;
    const xB = w * (1.05 - f2 * 1.3);
    const yB = h * (k % 2 ? 0.8 : 0.2);
    const envB = Math.sin(Math.PI * f2) ** 0.6;
    ctx.fillStyle = colors.signal;
    if (idWord.prev && idWord.mix < 1) {
      ctx.globalAlpha = envB * 0.16 * (1 - idWord.mix);
      ctx.fillText(idWord.prev, xB, yB - sizeB * 0.3 * idWord.mix);
    }
    ctx.globalAlpha = envB * (0.05 + 0.07 * scene.perf + 0.06 * scene.pulse) * idWord.mix; // faint: never competes with labels
    ctx.fillText(idWord.text, xB, yB + sizeB * 0.3 * (1 - idWord.mix));
  }

  // --- Canvas (every frame) ----------------------------------------------------------------
  /** Returns true while nodes are still easing toward their targets. */
  function draw(frame: AudioFrame, dt: number, scene: Scene, opts: NetworkOptions): boolean {
    last = { frame, scene, opts };
    const { w, h } = size;
    if (!w) return false;
    const amb = Math.min(1.6, motion.scale()); // ambient amplitude: 0 when still
    const live = motion.still() ? 0 : scene.perf; // audio-driven terms
    const k = easeStep(dt, EASE_MS);
    const mode = modeOf(focus.audioActiveMember);
    if (frame.spectrum.length) logBands(frame.spectrum, frame.binHz, N, 40, 12000, bands);
    else bands.fill(0);

    let busy = false;
    const approach = (from: number, to: number, kk = k) => {
      const v = from + (to - from) * kk;
      if (Math.abs(to - v) > 0.002) busy = true;
      return v;
    };
    groupW = approach(groupW, mode === 'group' ? 1 : 0);
    neutralW = approach(neutralW, mode === 'neutral' ? 1 : 0);
    pointer.field = approach(pointer.field, pointer.inside && amb > 0 ? 1 : 0, easeStep(dt, 180));

    const cx = w / 2;
    const cy = h / 2;
    const t = scene.tau;
    const breathe = 1 + 0.03 * amb * Math.sin(t * 0.55); // expands and contracts
    const R = Math.min(w, h) * 0.36 * (1 - 0.14 * neutralW) * breathe * (1 + 0.035 * frame.low * live);
    const rot = (t * 2 * Math.PI) / 240; // one revolution per 4 minutes of ambient time (wall clock)

    for (const n of nodes) {
      const isCenter = n.m.slug === center;
      const base = nodeTarget(n.i, N, isCenter, cx, cy, R, rot);
      let tx = base.x;
      let ty = base.y;
      if (!isCenter) {
        // Orbit around the base position, plus the GROUP wave travelling around the ring.
        const orbit = amb * (5 + 3 * (1 - scene.perf));
        tx += orbit * Math.sin(t * n.w1 + n.ph);
        ty += orbit * Math.cos(t * n.w2 + n.ph);
        const a = Math.atan2(base.y - cy, base.x - cx);
        const wave = groupW * amb * (8 + 10 * (bands[n.i] ?? 0) * live) * Math.sin(t * 1.6 - (n.i * 4 * Math.PI) / N);
        tx += wave * Math.cos(a);
        ty += wave * Math.sin(a);
      } else {
        const wobble = amb * (2 + 8 * frame.low * live);
        tx += wobble * Math.sin(t * 2.1);
        ty += wobble * Math.cos(t * 1.7);
      }
      // Pointer attraction field.
      if (pointer.field > 0.001) {
        const dx = pointer.x - tx;
        const dy = pointer.y - ty;
        const d = Math.hypot(dx, dy);
        if (d < FIELD_R && d > 0.1) {
          const pull = Math.min(d * 0.5, pointer.field * amb * 22 * (1 - d / FIELD_R) ** 2);
          tx += (dx / d) * pull;
          ty += (dy / d) * pull;
        }
      }
      if (!n.placed) Object.assign(n, { x: tx, y: ty, placed: true });
      const nx = n.x + (tx - n.x) * k;
      const ny = n.y + (ty - n.y) * k;
      if (Math.abs(tx - nx) + Math.abs(ty - ny) > 0.5) busy = true;
      n.x = nx;
      n.y = ny;
      n.focus = approach(n.focus, isCenter ? 1 : 0);
      n.hover = approach(n.hover, n.m.slug === focus.hoveredMember ? 1 : 0);
      n.sel = approach(n.sel, n.m.slug === focus.selectedMember ? 1 : 0);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    const centered = center ? bySlug.get(center) : undefined;
    if (opts.type) drawWords(w, h, dt, scene, mode, centered);

    // Background geometry: crosshair, a slowly turning tick ring (64 ticks) and a counter-rotating dashed ring.
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.line;
    ctx.fillRect(0, Math.round(cy), w, 1);
    ctx.fillRect(Math.round(cx), 0, 1, h);
    ctx.strokeStyle = colors.line;
    ctx.beginPath();
    const tr = R + 30;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + t * 0.03;
      const len = i % 4 === 0 ? 8 : 3;
      ctx.moveTo(cx + tr * Math.cos(a), cy + tr * Math.sin(a));
      ctx.lineTo(cx + (tr + len) * Math.cos(a), cy + (tr + len) * Math.sin(a));
    }
    ctx.stroke();
    ctx.setLineDash([2, 6]);
    ctx.lineDashOffset = -t * 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Links. GROUP → shared frequency bands (performance) or the wave (ambient); centered member → energy;
    // selected member → white; hover → fixed.
    if (opts.links) {
      const centerLive = 0.35 + 0.5 * frame.energy * live;
      for (let i = 0; i < N; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j]!;
          const f = Math.max(a.focus, b.focus);
          const hv = Math.max(a.hover, b.hover);
          const sl = Math.max(a.sel, b.sel);
          const shared = Math.sqrt((bands[i] ?? 0) * (bands[j] ?? 0));
          const ambientGlow = 0.04 * amb * (1 + Math.sin(t * 1.6 - ((i + j) * 2 * Math.PI) / N));
          const g = groupW * (0.05 + 0.6 * shared * live + ambientGlow + (amb ? 0 : 0.1));
          const alpha = Math.min(1, g + f * centerLive + hv * 0.3 + sl * 0.4 + neutralW * 0.025);
          if (alpha < 0.01) continue;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = f > 0.5 || hv > 0.5 ? colors.signal : colors.fg;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Nodes, ripples and labels.
    ctx.font = `10px ${MONO}`;
    ctx.textBaseline = 'middle';
    const roomForNames = cx - R > 110; // narrow screens: IDs only (the index lists every name)
    for (const n of nodes) {
      const band = bands[n.i] ?? 0;
      const r = 3 + groupW * (2 + 8 * band * live) + n.focus * 9 + n.hover * 2 + n.sel * 1.5;

      // Ripples: stronger localized motion around the centered member (energy in performance).
      if (n.focus > 0.05 && amb > 0) {
        for (let j = 0; j < 3; j++) {
          const p = frac(t * 0.5 + j / 3);
          ctx.globalAlpha = n.focus * (1 - p) * (0.25 + 0.5 * frame.energy * live);
          ctx.strokeStyle = colors.signal;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6 + p * 52, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = Math.min(1, 0.45 + 0.55 * Math.max(groupW, n.focus, n.hover, n.sel));
      ctx.fillStyle = n.focus > 0.5 ? colors.signal : colors.fg;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (n.hover > 0.05) {
        ctx.strokeStyle = colors.signal;
        ctx.globalAlpha = n.hover;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (n.sel > 0.05) {
        ctx.globalAlpha = n.sel;
        ctx.strokeStyle = colors.fg; // square = opened profile (shape, not only color)
        const s = r + 7;
        ctx.strokeRect(n.x - s, n.y - s, s * 2, s * 2);
      }

      // Labels sit outside the ring on the node's own side; the centered node gets none (the type band names it).
      const dx = n.x - cx;
      const dy = n.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 20) continue;
      const ux = dx / dist;
      const uy = dy / dist;
      ctx.textAlign = ux > 0.25 ? 'left' : ux < -0.25 ? 'right' : 'center';
      const lx = n.x + ux * (r + 10);
      const ly = n.y + uy * (r + 10);
      ctx.globalAlpha = 0.6 + 0.4 * Math.max(groupW, n.hover, n.sel);
      ctx.fillStyle = n.hover > 0.5 ? colors.signal : colors.dim;
      ctx.fillText(n.m.id.slice(-2), lx, ly);
      const nameAlpha = Math.max(roomForNames ? groupW : 0, n.hover, roomForNames ? n.sel : 0);
      if (nameAlpha > 0.05) {
        ctx.globalAlpha = nameAlpha;
        ctx.fillStyle = colors.fg;
        ctx.fillText(n.m.name.toUpperCase(), lx, ly + (uy < -0.25 ? -12 : 12)); // always on the far side of the ID
      }
    }
    ctx.globalAlpha = 1;
    return busy;
  }

  return {
    el: root,
    draw,
    /** center: the member placed in the middle (audio-active in AUTO, selected in MANUAL), or null. */
    setFocus(next: Focus, nextCenter: string | null): void {
      focus = next;
      center = nextCenter;
      refreshType();
    },
    setCue(next: Cue | null): void {
      cue = next;
      refreshType();
    },
  };
}
