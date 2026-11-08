// SYSTEM 02 — member spotlight. Shows the profile the visitor opened; when none is open (AUTO
// composition) it follows the member the soundtrack mentions. Profile text is verbatim
// (textContent), pending sections read AWAITING INPUT. Nothing is invented.
//
// The geometric mark is drawn only from real data: the member's position on the 16-node ring
// (060.01 at the top, clockwise) and which of their four profile sections are complete
// (solid spoke = complete, short dashed spoke = pending).
//
// Identity transition (≈0.6 s, each part moves differently): an orange wipe crosses the panel;
// the ID counts from the previous number to the new one behind a clip; the mark turns from the
// previous member's ring position to the new one; the name rises letter by letter behind a mask;
// the sections reveal top-down. Motion STILL: a short crossfade instead.
import { SECTIONS } from '../members/parse.ts';
import { completedSections, type Member } from '../members/validate.ts';
import { el } from './dom.ts';
import { motion } from './motion.ts';

const SVG = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(0.2, 0.8, 0, 1)';
const COUNT_MS = 380;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Ring position (0-based) and section completeness → mark. 100×100 viewBox. */
function mark(position: number, total: number, m: Member): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 100 100', class: 'mark', 'aria-hidden': 'true' });
  const turn = (i: number, n: number, offset = 0) => -Math.PI / 2 + offset + (i * 2 * Math.PI) / n;
  for (let i = 0; i < total; i++) {
    const a = turn(i, total);
    const me = i === position;
    root.append(svg('circle', { cx: 50 + 44 * Math.cos(a), cy: 50 + 44 * Math.sin(a), r: me ? 4 : 1.5, class: me ? 'me' : 'other' }));
  }
  // Section spokes, rotated so the first points at the member's ring position.
  const offset = (position * 2 * Math.PI) / total;
  const tips: string[] = [];
  SECTIONS.forEach((s, i) => {
    const a = turn(i, SECTIONS.length, offset);
    const done = m.sections[s.key] !== null;
    const len = done ? 34 : 14;
    const x = 50 + len * Math.cos(a);
    const y = 50 + len * Math.sin(a);
    root.append(svg('line', { x1: 50, y1: 50, x2: x, y2: y, class: done ? 'done' : 'pending' }));
    if (done) tips.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (tips.length > 2) root.prepend(svg('polygon', { points: tips.join(' '), class: 'shape' }));
  return root;
}

/** The ID shown while counting from one member number to another (prefix kept, two digits interpolated). */
export function countedId(prefix: string, from: number, to: number, f: number): string {
  const e = 1 - (1 - Math.min(1, Math.max(0, f))) ** 3;
  return `${prefix}.${String(Math.round(from + (to - from) * e)).padStart(2, '0')}`;
}

interface View {
  nodes: HTMLElement[];
  mark: SVGSVGElement;
  id: HTMLElement;
  chars: HTMLElement[];
  dts: HTMLElement[];
  dds: HTMLElement[];
}

export function createSpotlight(
  members: Member[],
  on: { close: () => void; pin: (slug: string) => void },
) {
  const root = el('section', 'panel spotlight');
  root.setAttribute('aria-labelledby', 'spot-title');
  const title = el('h2', 'label', 'SYSTEM 02 / MEMBER SPOTLIGHT');
  title.id = 'spot-title';
  const close = el('button', 'ghost close', 'CLOSE ✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close profile');
  close.hidden = true;
  close.addEventListener('click', on.close);
  const head = el('div', 'spot-head');
  head.append(title, close);

  const body = el('div', 'spot-body');
  body.tabIndex = 0; // scrollable region must be reachable by keyboard
  body.setAttribute('aria-label', 'Member profile');
  const wipe = el('div', 'spot-wipe');
  wipe.setAttribute('aria-hidden', 'true');
  const announce = el('p', 'visually-hidden');
  announce.setAttribute('aria-live', 'polite');
  root.append(head, wipe, body, announce);

  const empty = () => {
    body.replaceChildren(el('p', 'spot-empty', 'No member highlighted. Choose a member in the index or the network to open their profile.'));
  };
  empty();

  /** One member's profile view, built once and reused (a member change only swaps nodes). */
  const views = new Map<string, View>();
  const view = (m: Member, position: number): View => {
    const cached = views.get(m.slug);
    if (cached) return cached;
    const symbol = mark(position, members.length, m);
    const id = el('p', 'spot-id', m.id);
    const ident = el('div', 'spot-ident');
    ident.append(symbol, id);
    // Name: full text for assistive tech, per-letter spans (hidden from it) for the masked stagger.
    const name = el('p', 'spot-name');
    const letters = el('span', 'letters');
    letters.setAttribute('aria-hidden', 'true');
    const chars = [...m.name].map((c) => el('span', 'ch', c === ' ' ? ' ' : c));
    letters.append(...chars);
    name.append(el('span', 'visually-hidden', m.name), letters);
    const list = el('dl', 'spot-sections');
    const dts: HTMLElement[] = [];
    const dds: HTMLElement[] = [];
    for (const s of SECTIONS) {
      const text = m.sections[s.key];
      const dt = el('dt', 'label', s.heading.toUpperCase());
      const dd = el('dd', text === null ? 'pending' : '', text ?? 'AWAITING INPUT');
      dts.push(dt);
      dds.push(dd);
      list.append(dt, dd);
    }
    const meta = el('p', 'label', `${completedSections(m)}/${SECTIONS.length} SECTIONS COMPLETE · ${m.slug}.md`);
    const v = { nodes: [ident, name, meta, list], mark: symbol, id, chars, dts, dds };
    views.set(m.slug, v);
    return v;
  };

  // Warm-up while the page is idle: build and lay out all profiles once, off-screen. Measured: without
  // this, the first profile to appear (start of Verse 1) cost a ~100 ms frame for first-time text layout.
  const idle = window.requestIdleCallback?.bind(window) ?? ((fn: () => void) => setTimeout(fn, 300));
  idle(() => {
    const scratch = el('div', 'spot-body spot-warmup');
    scratch.setAttribute('aria-hidden', 'true');
    scratch.style.width = `${body.clientWidth || 360}px`;
    members.forEach((m, i) => scratch.append(...view(m, i).nodes));
    document.body.append(scratch);
    void scratch.offsetHeight; // force the one-time layout now, not mid-song
    scratch.remove();
  });

  let shown = '';
  let current: { slug: string; position: number; mode: 'selected' | 'audio' } | null = null;
  let count: { el: HTMLElement; prefix: string; from: number; to: number; start: number } | null = null;

  // Reading a profile that is following the audio pins it, so the next lyric event can't swap it away.
  const pinIfFollowing = () => {
    if (current?.mode === 'audio') on.pin(current.slug);
  };
  body.addEventListener('wheel', pinIfFollowing, { passive: true });
  body.addEventListener('pointerdown', pinIfFollowing);
  body.addEventListener('keydown', pinIfFollowing);

  function transition(v: View, fromPos: number, toPos: number): void {
    const still = motion.still();
    if (still) {
      for (const n of v.nodes) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
      return;
    }
    const step = 360 / members.length;
    wipe.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(290%)' }], { duration: 420, easing: 'cubic-bezier(0.6, 0, 0.2, 1)' });
    // Mark turns from the previous member's ring position to this one.
    const delta = fromPos < 0 ? -90 : (toPos - fromPos) * step;
    v.mark.animate([{ transform: `rotate(${-delta}deg) scale(0.8)` }, { transform: 'none' }], { duration: 560, easing: EASE });
    v.id.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 360, easing: EASE });
    if (fromPos >= 0 && fromPos !== toPos) {
      const prefix = v.id.textContent?.split('.')[0] ?? '060';
      count = { el: v.id, prefix, from: fromPos + 1, to: toPos + 1, start: performance.now() };
      v.id.textContent = countedId(prefix, count.from, count.to, 0);
    }
    v.chars.forEach((c, i) => c.animate([{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 460, delay: 80 + i * 18, easing: EASE, fill: 'backwards' }));
    v.nodes[2]?.animate([{ transform: 'translateX(-3em)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 400, delay: 160, easing: EASE, fill: 'backwards' });
    v.dts.forEach((d, i) => d.animate([{ transform: 'translateX(-1.5em)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, delay: 200 + i * 60, easing: EASE, fill: 'backwards' }));
    v.dds.forEach((d, i) => d.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, delay: 240 + i * 60, easing: EASE, fill: 'backwards' }));
  }

  return {
    el: root,
    /** mode: 'selected' = opened by the visitor; 'audio' = following the soundtrack. */
    show(slug: string | null, mode: 'selected' | 'audio'): void {
      const key = `${slug}|${mode}`;
      if (key === shown) return;
      shown = key;
      close.hidden = mode !== 'selected' || !slug;
      title.textContent = `SYSTEM 02 / MEMBER SPOTLIGHT${slug ? (mode === 'selected' ? ' · OPENED' : ' · FOLLOWING AUDIO') : ''}`;
      const position = members.findIndex((m) => m.slug === slug);
      const m = members[position];
      if (!m) {
        current = null;
        empty();
        return;
      }
      if (mode === 'selected') announce.textContent = `Opened ${m.name}, member ${position + 1} of ${members.length}.`;
      const prev = current;
      current = { slug: m.slug, position, mode };
      if (prev?.slug === m.slug) return; // same member, only the mode changed

      const v = view(m, position);
      if (count) count.el.textContent = members[count.to - 1]?.id ?? count.el.textContent; // finish any count in flight
      count = null;
      // Reset scroll BEFORE inserting: writing scrollTop after would force the new text to lay out mid-frame.
      if (body.scrollTop) body.scrollTop = 0;
      body.replaceChildren(...v.nodes);
      transition(v, prev?.position ?? -1, position);
    },
    /** Called from the animation loop: advances the ID count (only while one is running). */
    tick(now: number): void {
      if (!count) return;
      const f = (now - count.start) / COUNT_MS;
      const text = f >= 1 ? (members[count.to - 1]?.id ?? '') : countedId(count.prefix, count.from, count.to, f);
      if (count.el.textContent !== text) count.el.textContent = text;
      if (f >= 1) count = null;
    },
  };
}
