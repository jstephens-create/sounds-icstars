// Builds the production identity timeline from the line-by-line calibration backup.
//   npm run build:timeline
// Reads soundtrack/level-up-timeline.partial.json (never changes it) and writes
// soundtrack/level-up-timeline.json. Refuses to overwrite an existing production file.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseProfile } from '../src/members/parse.ts';
import { validateRoster } from '../src/members/validate.ts';
import { GROUP, toIdentityEvents, validateTimeline, type RawCue } from '../src/timeline/timeline.ts';
import { formatPrecise } from '../src/ui/calibrate.ts';

const SOURCE = 'soundtrack/level-up-timeline.partial.json';
const TARGET = 'soundtrack/level-up-timeline.json';
// Lyric lines (1-based) about the former participant: no individual highlight (decision 2026-11-07).
const NO_HIGHLIGHT_LINES = [56, 57];

if (existsSync(TARGET)) {
  console.log(`STOP  ${TARGET} already exists. Move it aside first; nothing was written.`);
  process.exit(1);
}

const backup = JSON.parse(readFileSync(SOURCE, 'utf8')) as { song: string; duration: number; offset: number; cues: RawCue[] };
const lines = backup.cues.map((c, i) => (NO_HIGHLIGHT_LINES.includes(i + 1) ? { ...c, who: null } : { ...c }));

const roster = validateRoster(
  readdirSync('member').filter((f) => f.endsWith('.md')).map((f) => parseProfile(f.slice(0, -3), readFileSync(`member/${f}`, 'utf8'))),
);
const timelineFile = { song: backup.song, duration: backup.duration, offset: backup.offset, cues: toIdentityEvents(lines) };
const { timeline, issues } = validateTimeline(timelineFile, new Set(roster.members.map((m) => m.slug)));
if (!timeline) {
  issues.forEach((m) => console.log(`FAIL  ${m}`));
  process.exit(1);
}

writeFileSync(TARGET, JSON.stringify(timelineFile, null, 2) + '\n');
console.log(`WROTE ${TARGET}: ${lines.length} lines → ${timeline.cues.length} identity events\n`);

const names = new Map(roster.members.map((m) => [m.slug, `${m.id} ${m.name}`]));
let line = 1;
timeline.cues.forEach((c, i) => {
  const count = c.line.split(' / ').length;
  const who = c.who === GROUP ? 'GROUP (all 16)' : c.who ? (names.get(c.who) ?? c.who) : 'NEUTRAL (no highlight)';
  const range = count > 1 ? `${line}-${line + count - 1}` : `${line}`;
  console.log(`${String(i + 1).padStart(2)}  ${formatPrecise(c.start)}  ${c.section.padEnd(12)} ${who.padEnd(28)} lines ${range}`);
  line += count;
});
