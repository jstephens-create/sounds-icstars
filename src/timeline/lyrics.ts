// Reads the original lyrics file into lines, and suggests who each line is about.
// Suggestions are only a starting point: every line is confirmed by a person during calibration.
import { GROUP, type Who } from './timeline.ts';

export interface LyricLine {
  section: string;
  line: string;
}

export interface Suggestion {
  who: Who;
  note?: string;
}

const COLLECTIVE = /^(INTRO|PRE-CHORUS|CHORUS|BREAKDOWN|FINAL VERSE|FINAL CHORUS|OUTRO)\b/;

export function isCollective(section: string): boolean {
  return COLLECTIVE.test(section);
}

/** Lines under "[SECTION — notes]" headers. Text before the first header (titles) and comment markers are skipped. */
export function parseLyrics(raw: string): LyricLine[] {
  const out: LyricLine[] = [];
  let section: string | null = null;
  for (const rawLine of raw.replace(/\r\n?/g, '\n').replace(/<!--|-->/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      section = (header[1] ?? '').split(/\s+[—–-]\s+/)[0]?.trim().toUpperCase() ?? '';
    } else if (section && /\p{L}/u.test(line)) {
      out.push({ section, line });
    }
  }
  return out;
}

/**
 * Collective sections → whole group. In verses, lines come in couplets: the first line of each
 * pair names a member (matched by first name against the profiles), the second inherits it.
 * Unmatched names get no highlight plus a note asking for manual assignment.
 */
export function suggestWho(lines: LyricLine[], members: { slug: string; name: string }[]): Suggestion[] {
  // shortcut: assumes first names are unique in the roster (true today); a clash would need an alias list.
  const byFirstName = new Map(members.map((m) => [(m.name.split(/\s+/)[0] ?? '').toLowerCase(), m.slug]));
  let section = '';
  let index = 0;
  let previous: Who = null;
  return lines.map((l) => {
    if (l.section !== section) {
      section = l.section;
      index = 0;
    }
    const i = index++;
    if (isCollective(l.section)) return { who: GROUP };
    if (i % 2 === 1) return { who: previous };
    const first = (l.line.match(/^[\p{L}.]+/u)?.[0] ?? '').replace(/\.$/, '');
    previous = byFirstName.get(first.toLowerCase()) ?? null;
    return previous ? { who: previous } : { who: null, note: `"${first}" doesn't match a profile. Assign manually.` };
  });
}
