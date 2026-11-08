// SYSTEM 04 — identity timeline as broadcast navigation. One cell per identity event, in song order,
// equal widths (easy targets, and the playhead maps cleanly onto them). Event times are never changed.
//
// States: done (progress bar filled, dimmed) · active (inverted "on air" block, live progress) · upcoming.
// Types differ by label and pattern, not color alone: member = its ID, GROUP = ALL (solid),
// NEUTRAL = — (hatched). A playhead glides across the strip on the playback clock.
// Hover / focus previews an event (and its member on the stage) without seeking; click seeks.
// Per frame: one transform on the playhead and one on the active progress bar. Everything else on change.
import type { Member } from '../members/validate.ts';
import { cueIndexAt, GROUP, type Timeline } from '../timeline/timeline.ts';
import { el } from './dom.ts';
import { easeStep, motion } from './motion.ts';
import { formatTime } from './transport.ts';

export function createTimelineStrip(
  timeline: Timeline,
  members: Member[],
  on: { seek: (t: number) => void; preview: (slug: string | null) => void },
) {
  const { cues, offset, duration } = timeline;
  const n = cues.length;
  const root = el('section', 'panel strip');
  root.setAttribute('aria-labelledby', 'strip-title');
  const title = el('h2', 'label', `SYSTEM 04 / IDENTITY TIMELINE · ${n} EVENTS`);
  title.id = 'strip-title';
  const scroller = el('div', 'strip-scroll');
  const track = el('div', 'strip-track');
  const list = el('ol', 'strip-cells');
  list.style.setProperty('--cells', String(n));
  const head = el('div', 'strip-head');
  head.setAttribute('aria-hidden', 'true');
  track.append(list, head);
  scroller.append(track);
  const readout = el('p', 'label strip-readout');

  const bySlug = new Map(members.map((m) => [m.slug, m]));
  const cells = cues.map((c, i) => {
    const kind = c.who === null ? 'neutral' : c.who === GROUP ? 'group' : 'member';
    const m = kind === 'member' ? bySlug.get(c.who ?? '') : undefined;
    const tag = kind === 'neutral' ? '—' : kind === 'group' ? 'ALL' : (m?.id.slice(-2) ?? '?');
    const who = kind === 'neutral' ? 'no member highlighted' : kind === 'group' ? `all ${members.length} members` : `${m?.id} ${m?.name}`;
    const start = c.start + offset;
    const end = (cues[i + 1]?.start ?? duration) + offset;

    const item = el('li', `cell ${kind}`);
    const button = el('button', 'cell-btn');
    button.type = 'button';
    button.setAttribute('aria-label', `Event ${i + 1} of ${n}, ${formatTime(start)}, ${c.section}, ${who}`);
    const tagEl = el('span', 'tag', tag);
    button.append(el('span', 'n', String(i + 1).padStart(2, '0')), tagEl, el('span', 't', formatTime(start)));
    const describe = `EVENT ${String(i + 1).padStart(2, '0')} · ${formatTime(start)} · ${c.section} · ${kind === 'member' ? `${m?.id} ${m?.name.toUpperCase()}` : kind === 'group' ? `ALL ${members.length}` : 'NO HIGHLIGHT'}`;
    const enter = () => {
      readout.textContent = `PREVIEW · ${describe}`;
      readout.dataset.preview = 'true';
      on.preview(m?.slug ?? null);
    };
    const leave = () => {
      readout.dataset.preview = '';
      showCurrent();
      on.preview(null);
    };
    button.addEventListener('pointerenter', enter);
    button.addEventListener('focus', enter);
    button.addEventListener('pointerleave', leave);
    button.addEventListener('blur', leave);
    button.addEventListener('click', () => on.seek(start));
    const fill = el('span', 'fill');
    item.append(button, fill);
    list.append(item);
    return { item, fill, tagEl, start, end, describe };
  });
  root.append(title, scroller, readout);
  // Whether the strip scrolls sideways (small screens), measured on resize, never during playback.
  let overflowing = false;
  new ResizeObserver(() => (overflowing = scroller.scrollWidth > scroller.clientWidth)).observe(scroller);

  let active = -2;
  let shownProgress = -1;
  let headX = -1; // eased playhead position, in cells
  const showCurrent = () => {
    if (readout.dataset.preview === 'true') return;
    const c = cells[active];
    readout.textContent = c ? `NOW · ${c.describe}` : 'BEFORE FIRST EVENT';
  };

  return {
    el: root,
    /** Called every frame with the playback clock (and frame time, for the playhead glide). */
    setTime(t: number, dt: number): void {
      const idx = cueIndexAt(cues, t - offset);
      if (idx !== active) {
        cells.forEach((c, i) => {
          c.item.classList.toggle('is-done', i < idx);
          c.item.classList.toggle('is-active', i === idx);
          if (i !== idx) c.item.removeAttribute('aria-current');
          c.fill.style.transform = i < idx ? 'scaleX(1)' : 'scaleX(0)'; // all cells: a seek can jump many events
        });
        const cur = cells[idx];
        if (cur) {
          cur.item.setAttribute('aria-current', 'step');
          if (!motion.still() && active >= -1) {
            cur.tagEl.animate([{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0, 1)' });
          }
          // Keep the active event in view when the strip scrolls sideways (small screens only).
          if (overflowing) {
            const left = cur.item.offsetLeft - scroller.clientWidth / 2 + cur.item.offsetWidth / 2;
            scroller.scrollTo({ left, behavior: motion.still() ? 'auto' : 'smooth' });
          }
        }
        active = idx;
        shownProgress = -1;
        showCurrent();
      }
      const c = cells[idx];
      const p = c ? Math.min(1, Math.max(0, (t - c.start) / (c.end - c.start))) : 0;
      if (c && Math.abs(p - shownProgress) >= 0.004) {
        shownProgress = p;
        c.fill.style.transform = `scaleX(${p.toFixed(3)})`;
      }
      // Playhead: glides on seeks instead of jumping; tracks playback exactly otherwise.
      const target = idx < 0 ? 0 : idx + p;
      const next = headX < 0 ? target : headX + (target - headX) * easeStep(dt, 90);
      if (Math.abs(next - headX) > 0.0005) {
        headX = next;
        head.style.transform = `translateX(${((headX / n) * 100).toFixed(3)}%)`;
      }
    },
  };
}
