// Lyric timeline: which member (or the whole group) is being sung about at each moment.
// Lookups are a pure function of the playback time, so pause, resume and seek can never drift.

export const GROUP = 'group';
/** A member slug, GROUP for collective lines, or null for no highlight. */
export type Who = string | null;

export interface Cue {
  start: number; // seconds into the recording
  section: string; // e.g. "VERSE 1", "CHORUS"
  line: string; // lyric as sung (from the original lyrics file)
  who: Who;
}

export interface Timeline {
  song: string;
  duration: number; // seconds, of the recording the timeline was calibrated against
  offset: number; // seconds added to every cue (positive = highlights later)
  cues: Cue[];
}

/** Index of the cue playing at time t (largest start <= t), or -1 before the first cue. Binary search. */
export function cueIndexAt(cues: readonly { start: number }[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((cues[mid]?.start ?? Infinity) <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function cueAt(timeline: Timeline, t: number): Cue | null {
  return timeline.cues[cueIndexAt(timeline.cues, t - timeline.offset)] ?? null;
}

/** When each member is first highlighted, and which members the timeline never highlights. */
export function memberCoverage(timeline: Timeline, slugs: readonly string[]) {
  const first = new Map<string, number>();
  for (const c of timeline.cues) if (c.who && c.who !== GROUP && !first.has(c.who)) first.set(c.who, c.start + timeline.offset);
  return { first, missing: slugs.filter((s) => !first.has(s)) };
}

/** Raw file shape: "start": null marks a line that is part of the previous line's event (not timed on its own). */
export type RawCue = Omit<Cue, 'start'> & { start: number | null };

/**
 * Turns line-by-line calibration into identity events: consecutive lines with the same section and who
 * become one event, timed on its first line; the event's other lines get "start": null.
 * The event starts at the earliest time tapped inside it, so one stray out-of-order tap can't delay
 * or reorder it. No time is made up: only the first event may have no taps, and it starts at 0.
 */
export function toIdentityEvents(lines: readonly RawCue[]): RawCue[] {
  const out: RawCue[] = [];
  let i = 0;
  while (i < lines.length) {
    const head = lines[i] as RawCue;
    let j = i;
    while (j + 1 < lines.length && lines[j + 1]?.section === head.section && lines[j + 1]?.who === head.who) j++;
    const taps = lines.slice(i, j + 1).flatMap((l) => (l.start === null ? [] : [l.start]));
    if (!taps.length && i > 0) throw new Error(`Lines ${i + 1}-${j + 1} (${head.section}) have no tapped time.`);
    lines.slice(i, j + 1).forEach((l, k) => out.push({ ...l, start: k ? null : taps.length ? Math.min(...taps) : 0 }));
    i = j + 1;
  }
  return out;
}

/**
 * Checks a timeline file and returns it ready for playback. A line with "start": null is merged into the
 * line before it (one event, captions joined), but only within the same section and the same who, so an
 * untimed line can never change who is highlighted. Files marked "partial" (calibration backups) are refused.
 */
export function validateTimeline(
  data: unknown,
  slugs: ReadonlySet<string>,
): { timeline: Timeline | null; issues: string[] } {
  const d = data as (Partial<Omit<Timeline, 'cues'>> & { cues?: RawCue[]; partial?: unknown }) | null;
  if (!d || typeof d !== 'object' || !Array.isArray(d.cues)) {
    return { timeline: null, issues: ['Timeline must be an object with a "cues" array.'] };
  }
  if (d.partial === true) {
    return { timeline: null, issues: ['This is a partial calibration backup, not a finished timeline.'] };
  }
  const issues: string[] = [];
  const duration = typeof d.duration === 'number' ? d.duration : NaN;
  if (!Number.isFinite(duration)) issues.push('Missing "duration" (seconds).');
  if (d.offset !== undefined && (typeof d.offset !== 'number' || !Number.isFinite(d.offset))) {
    issues.push('"offset" must be a number of seconds.');
  }
  if (d.cues.length === 0) issues.push('Timeline has no cues.');

  const merged: Cue[] = [];
  d.cues.forEach((c, i) => {
    const at = `Cue ${i + 1}`;
    const prev = d.cues?.[i - 1];
    const last = merged.at(-1);
    if (c?.start === null) {
      if (!prev) issues.push(`${at}: the first line needs a start time.`);
      else if (c.who !== prev?.who || c.section !== prev?.section) {
        issues.push(`${at}: an untimed line must have the same section and who as the line before it.`);
      } else if (last && typeof c.line === 'string') last.line += ` / ${c.line}`;
    } else if (!c || typeof c.start !== 'number' || !Number.isFinite(c.start) || c.start < 0) {
      issues.push(`${at}: invalid start time.`);
    } else {
      if (last && c.start <= last.start) issues.push(`${at}: starts at or before the previous line.`);
      if (Number.isFinite(duration) && c.start >= duration) issues.push(`${at}: starts after the song ends.`);
      merged.push({ start: c.start, section: c.section, line: c.line, who: c.who });
    }
    if (c?.who != null && c.who !== GROUP && !slugs.has(c.who)) issues.push(`${at}: unknown member "${c.who}".`);
    if (typeof c?.line !== 'string' || typeof c?.section !== 'string') issues.push(`${at}: missing line or section.`);
  });

  if (issues.length) return { timeline: null, issues };
  return { timeline: { song: String(d.song ?? ''), duration, offset: d.offset ?? 0, cues: merged }, issues };
}
