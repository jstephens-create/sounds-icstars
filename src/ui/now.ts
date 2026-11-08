// "NOW" readout: the current lyric line (a caption for the audio) and who it is about.
import type { Member } from '../members/validate.ts';
import { GROUP, type Cue } from '../timeline/timeline.ts';
import { el } from './dom.ts';

export function createNow(members: Member[], calibrated: boolean) {
  const root = el('section', 'panel now');
  root.setAttribute('aria-label', 'Now playing');
  const label = el('h2', 'label', 'NOW');
  const caption = el('p', 'caption');
  const who = el('p', 'label who');
  root.append(label, caption, who);

  if (!calibrated) {
    caption.textContent = 'Timeline not calibrated.';
    const link = el('a', '', 'Open calibration →');
    link.href = '#/calibrate';
    who.append(link);
    return { el: root, set: (_cue: Cue | null) => {} };
  }

  const bySlug = new Map(members.map((m) => [m.slug, m]));
  let last: Cue | null | undefined;
  return {
    el: root,
    set(cue: Cue | null): void {
      if (cue === last) return;
      last = cue;
      label.textContent = cue ? `NOW · ${cue.section}` : 'NOW';
      caption.textContent = cue?.line ?? '—';
      const m = cue?.who && cue.who !== GROUP ? bySlug.get(cue.who) : undefined;
      who.textContent = cue?.who === GROUP ? `ALL ${members.length} MEMBERS` : m ? `${m.id} · ${m.name}` : '';
    },
  };
}
