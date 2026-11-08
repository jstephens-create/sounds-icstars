// Command-line check of soundtrack/level-up-timeline.json against the real profiles and lyrics.
//   npm run check:timeline
// Prints to this terminal only (it reads private local files). Exit code 1 when anything fails.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parseProfile } from '../src/members/parse.ts';
import { validateRoster } from '../src/members/validate.ts';
import { parseLyrics } from '../src/timeline/lyrics.ts';
import { GROUP, memberCoverage, validateTimeline } from '../src/timeline/timeline.ts';
import { formatPrecise } from '../src/ui/calibrate.ts';

const PATH = process.argv[2] ?? 'soundtrack/level-up-timeline.json';
const LYRICS = 'soundtrack/original/level-up-original-lyrics.md';
const RECORDING_SECONDS = 209.88; // from the MP3's Xing header (8,745 frames at 48 kHz)

let failed = false;
const fail = (msg: string) => {
  failed = true;
  console.log(`FAIL  ${msg}`);
};
const ok = (msg: string) => console.log(`OK    ${msg}`);

if (!existsSync(PATH)) {
  console.log(`FAIL  ${PATH} not found. Export it from #/calibrate (DOWNLOAD JSON) and move it here.`);
  process.exit(1);
}

const roster = validateRoster(
  readdirSync('member').filter((f) => f.endsWith('.md')).map((f) => parseProfile(f.slice(0, -3), readFileSync(`member/${f}`, 'utf8'))),
);
roster.valid ? ok(`roster: ${roster.members.length} valid profiles`) : fail('roster has errors (run the app for details)');

let data: unknown;
try {
  data = JSON.parse(readFileSync(PATH, 'utf8'));
} catch (e) {
  fail(`not valid JSON: ${(e as Error).message}`);
  process.exit(1);
}

const partial = data as { partial?: boolean; tapped?: number; total?: number } | null;
if (partial?.partial) {
  fail(`${PATH} is a partial backup (${partial.tapped}/${partial.total} lines tapped). Finish it in #/calibrate.`);
  process.exit(1);
}

const slugs = roster.members.map((m) => m.slug);
const { timeline, issues } = validateTimeline(data, new Set(slugs));
if (!timeline) {
  issues.forEach(fail);
  process.exit(1);
}
// Raw lines from the file. `timeline` has untimed lines merged into events, so count lines here.
const raw = (data as { cues: { start: number | null; section: string; line: string; who: string | null }[] }).cues;
const untimed = raw.filter((c) => c.start === null).length;
ok(`structure: ${raw.length} lines → ${timeline.cues.length} timed events (${untimed} untimed lines join the event before them), offset ${timeline.offset}s`);

Math.abs(timeline.duration - RECORDING_SECONDS) <= 0.5
  ? ok(`duration ${timeline.duration}s matches the recording (${RECORDING_SECONDS}s)`)
  : fail(`duration ${timeline.duration}s does not match the recording (${RECORDING_SECONDS}s)`);

const lyricLines = parseLyrics(readFileSync(LYRICS, 'utf8')).map((l) => l.line);
const sameLines = lyricLines.length === raw.length && lyricLines.every((l, i) => l === raw[i]?.line);
sameLines ? ok(`all ${lyricLines.length} cues match the original lyrics line for line`) : fail('cues do not match the current lyrics file');

const { first, missing } = memberCoverage(timeline, slugs);
missing.length ? fail(`members never highlighted: ${missing.join(', ')}`) : ok('all 16 members are highlighted at least once');

console.log('\nFIRST HIGHLIGHT PER MEMBER (check the line names them)');
for (const m of roster.members) {
  const cue = raw.find((c) => c.who === m.slug);
  console.log(`  ${m.id}  ${formatPrecise(first.get(m.slug) ?? 0)}  ${m.name.padEnd(18)} "${cue?.line ?? '—'}"`);
}

const none = raw.filter((c) => c.who === null);
console.log(`\nLINES WITH NO HIGHLIGHT (${none.length}; expected: the 2 lines about the former participant)`);
none.forEach((c) => console.log(`  ${c.start === null ? 'untimed ' : formatPrecise(c.start)}  [${c.section}] "${c.line}"`));

const group = raw.filter((c) => c.who === GROUP).length;
console.log(`\nGROUP LINES: ${group}`);
console.log(failed ? '\nRESULT: needs fixing' : '\nRESULT: timeline ready');
process.exit(failed ? 1 : 0);
