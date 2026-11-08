// Broadcast control panel. Every control changes real application state (main.ts applies it):
//   COMPOSITION  AUTO   — the soundtrack directs: the stage centers and the spotlight follows the audio member.
//                MANUAL — the visitor directs: the stage centers and the spotlight show only the opened member;
//                         the audio member is still marked, and GROUP / NEUTRAL still come from the song.
//   STATUS       AMBIENT / PERFORMANCE — read-only, follows playback.
//   MOTION       STILL / LOW / NORMAL / HIGH — defaults to STILL when the system asks for reduced motion.
//   TYPE, LINKS  show / hide kinetic typography and network connections.
//   CLEAN        hide developer diagnostics. FULLSCREEN — presentation mode (also suits OBS capture).
// Preferences persist in localStorage (nothing personal); storage failures are ignored.
import { el } from './dom.ts';
import { MOTION_LEVELS, motion, type MotionLevel } from './motion.ts';

export interface Prefs {
  composition: 'auto' | 'manual';
  motion: MotionLevel | null; // null = follow the system setting
  type: boolean;
  links: boolean;
  clean: boolean;
}

const KEY = 'hs060.prefs';
export const DEFAULT_PREFS: Prefs = { composition: 'auto', motion: null, type: true, links: true, clean: false };

/** Reads stored preferences, keeping only well-formed values (anything else falls back to the default). */
export function parsePrefs(raw: string | null): Prefs {
  let d: Partial<Record<keyof Prefs, unknown>> = {};
  try {
    const v: unknown = JSON.parse(raw ?? '{}');
    if (v && typeof v === 'object') d = v as typeof d;
  } catch {
    /* corrupt storage: defaults */
  }
  const bool = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
  return {
    composition: d.composition === 'manual' ? 'manual' : 'auto',
    motion: MOTION_LEVELS.includes(d.motion as MotionLevel) ? (d.motion as MotionLevel) : null,
    type: bool(d.type, DEFAULT_PREFS.type),
    links: bool(d.links, DEFAULT_PREFS.links),
    clean: bool(d.clean, DEFAULT_PREFS.clean),
  };
}

function load(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function save(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / blocked storage: preferences just don't persist */
  }
}

export function createControls(onChange: (p: Prefs) => void, togglePlay: () => void) {
  const prefs = load();
  const root = el('details', 'controls');
  const phone = matchMedia('(max-width: 720px)');
  root.open = !phone.matches; // collapsed on phones, so the stage comes first
  phone.addEventListener('change', () => (root.open = !phone.matches));
  const summary = el('summary', 'label', 'CONTROLS');
  const body = el('div', 'controls-body');
  root.append(summary, body);

  const group = (label: string) => {
    const g = el('div', 'ctl');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    g.append(el('span', 'label ctl-name', label));
    body.append(g);
    return g;
  };
  const button = (g: HTMLElement, text: string, onClick: () => void) => {
    const b = el('button', 'ctl-btn', text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    g.append(b);
    return b;
  };
  const pressed = (b: HTMLButtonElement, on: boolean) => b.setAttribute('aria-pressed', String(on));

  const statusGroup = group('STATUS');
  const play = button(statusGroup, 'PLAY', togglePlay); // same action as the transport button (always in view)
  play.classList.add('ctl-play');
  const status = el('span', 'ctl-status', 'AMBIENT');
  statusGroup.append(status);

  const comp = group('COMPOSITION');
  const auto = button(comp, 'AUTO', () => update({ composition: 'auto' }));
  const manual = button(comp, 'MANUAL', () => update({ composition: 'manual' }));

  const mot = group('MOTION');
  const levels = MOTION_LEVELS.map((l) => [l, button(mot, l.toUpperCase(), () => update({ motion: l }))] as const);
  const systemNote = el('span', 'label ctl-note');
  mot.append(systemNote);

  const view = group('SHOW');
  const type = button(view, 'TYPE', () => update({ type: !prefs.type }));
  const links = button(view, 'LINKS', () => update({ links: !prefs.links }));
  const clean = button(view, 'CLEAN', () => update({ clean: !prefs.clean }));

  const screen = group('SCREEN');
  const full = button(screen, 'FULLSCREEN', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  });
  full.hidden = !document.fullscreenEnabled;
  document.addEventListener('fullscreenchange', () => {
    pressed(full, document.fullscreenElement !== null);
    full.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
  });

  function render(): void {
    pressed(auto, prefs.composition === 'auto');
    pressed(manual, prefs.composition === 'manual');
    for (const [l, b] of levels) pressed(b, motion.level() === l);
    systemNote.textContent = prefs.motion === null && motion.still() ? 'SYSTEM: REDUCED MOTION' : '';
    pressed(type, prefs.type);
    pressed(links, prefs.links);
    pressed(clean, prefs.clean);
  }

  function update(patch: Partial<Prefs>): void {
    Object.assign(prefs, patch);
    motion.set(prefs.motion);
    save(prefs);
    render();
    onChange({ ...prefs });
  }

  motion.set(prefs.motion);
  render();
  return {
    el: root,
    prefs: (): Prefs => ({ ...prefs }),
    /** Read-only status, written only when it changes. */
    setStatus(performance: boolean): void {
      const text = performance ? 'PERFORMANCE' : 'AMBIENT';
      if (status.textContent === text) return;
      status.textContent = text;
      status.dataset.on = String(performance);
    },
    setPlaying(playing: boolean): void {
      play.textContent = playing ? 'PAUSE' : 'PLAY';
      play.setAttribute('aria-label', playing ? 'Pause LEVEL UP' : 'Play LEVEL UP');
    },
    /** Re-render after the system reduced-motion setting changes. */
    refresh: render,
  };
}
