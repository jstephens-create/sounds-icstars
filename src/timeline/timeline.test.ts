import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUP, cueAt, cueIndexAt, memberCoverage, toIdentityEvents, validateTimeline, type Timeline } from './timeline.ts';
import { parseLyrics, suggestWho } from './lyrics.ts';

// Invented lyrics and people, in the same format as the real lyrics file.
const LYRICS = `# Song — Original Lyrics

<!-- Song Title
[INTRO — Spoken]
Hello city!

[VERSE 1 — Fast Rap]
Alex got moves, all over the floor,

Still wants more!
Zed on the drums, keeping the time,
Future plans in every line!
[PRE-CHORUS — Beat Drops Out]
Three... Two... One...
[CHORUS — Big]
GO GO!
 . -->`;
const MEMBERS = [{ slug: 'alex-one', name: 'Alex One' }, { slug: 'bo-two', name: 'Bo Two' }];

test('parseLyrics keeps sung lines with their section, skipping titles and comment markers', () => {
  const lines = parseLyrics(LYRICS);
  assert.deepEqual(lines.map((l) => l.section), ['INTRO', 'VERSE 1', 'VERSE 1', 'VERSE 1', 'VERSE 1', 'PRE-CHORUS', 'CHORUS']);
  assert.equal(lines[0]?.line, 'Hello city!');
  assert.equal(lines.at(-1)?.line, 'GO GO!');
});

test('suggestWho: collective sections → group; verse couplets → named member; unknown names → none + note', () => {
  const s = suggestWho(parseLyrics(LYRICS), MEMBERS);
  assert.deepEqual(s.map((x) => x.who), [GROUP, 'alex-one', 'alex-one', null, null, GROUP, GROUP]);
  assert.match(s[3]?.note ?? '', /Zed/);
  assert.equal(s[4]?.note, undefined);
});

const cues = [1, 5, 9].map((start, i) => ({ start, section: 'S', line: `L${i}`, who: GROUP }));

test('cueIndexAt finds the active cue at any time, in any query order (seeking)', () => {
  for (const [t, expected] of [[100, 2], [0, -1], [5, 1], [1, 0], [4.99, 0], [9, 2], [6, 1]] as const) {
    assert.equal(cueIndexAt(cues, t), expected, `t=${t}`);
  }
  assert.equal(cueIndexAt([], 3), -1);
});

test('cueAt applies the global offset', () => {
  const tl: Timeline = { song: 's', duration: 20, offset: 0.5, cues };
  assert.equal(cueAt(tl, 5.4)?.line, 'L0');
  assert.equal(cueAt(tl, 5.5)?.line, 'L1');
  assert.equal(cueAt(tl, 0.2), null);
});

test('memberCoverage reports first highlight per member (with offset) and members never highlighted', () => {
  const tl: Timeline = {
    song: 's',
    duration: 30,
    offset: -0.5,
    cues: [
      { start: 2, section: 'INTRO', line: 'a', who: GROUP },
      { start: 4, section: 'VERSE 1', line: 'b', who: 'alex-one' },
      { start: 6, section: 'VERSE 1', line: 'c', who: 'alex-one' },
      { start: 8, section: 'VERSE 1', line: 'd', who: null },
    ],
  };
  const c = memberCoverage(tl, ['alex-one', 'bo-two']);
  assert.equal(c.first.get('alex-one'), 3.5);
  assert.deepEqual(c.missing, ['bo-two']);
});

test('validateTimeline accepts a correct timeline', () => {
  const r = validateTimeline({ song: 's', duration: 20, offset: 0, cues }, new Set());
  assert.deepEqual(r.issues, []);
  assert.equal(r.timeline?.cues.length, 3);
});

test('validateTimeline rejects bad order, unknown members, times past the end, and bad shapes', () => {
  const slugs = new Set(['alex-one']);
  const bad = (cs: object[]) => validateTimeline({ song: 's', duration: 10, cues: cs }, slugs).issues.join(' ');
  assert.match(bad([{ start: 2, section: 'S', line: 'a', who: null }, { start: 2, section: 'S', line: 'b', who: null }]), /before the previous/);
  assert.match(bad([{ start: 1, section: 'S', line: 'a', who: 'nobody' }]), /unknown member/);
  assert.match(bad([{ start: 12, section: 'S', line: 'a', who: 'alex-one' }]), /after the song ends/);
  assert.match(bad([{ start: -1, section: 'S', line: 'a', who: null }]), /invalid start/);
  assert.equal(validateTimeline(null, slugs).timeline, null);
  assert.equal(validateTimeline({ cues: 'x' }, slugs).timeline, null);
});

test('validateTimeline merges untimed lines into the previous event (same section and who only)', () => {
  const intro = (who: string | null, section = 'INTRO') => ({ start: null, section, line: 'b', who });
  const ok = validateTimeline(
    { song: 's', duration: 20, cues: [{ start: 0, section: 'INTRO', line: 'a', who: GROUP }, intro(GROUP), { start: 5, section: 'V', line: 'c', who: 'alex-one' }] },
    new Set(['alex-one']),
  );
  assert.deepEqual(ok.issues, []);
  assert.deepEqual(ok.timeline?.cues.map((c) => [c.start, c.line]), [[0, 'a / b'], [5, 'c']]);
  assert.equal(cueAt(ok.timeline as Timeline, 3)?.who, GROUP); // the event lasts until the next timed line

  const bad = (cs: object[], extra = {}) => validateTimeline({ song: 's', duration: 20, cues: cs, ...extra }, new Set()).issues.join(' ');
  const first = { start: 0, section: 'INTRO', line: 'a', who: GROUP };
  assert.match(bad([intro(GROUP)]), /first line needs a start/);
  assert.match(bad([first, intro(null)]), /same section and who/);
  assert.match(bad([first, intro(GROUP, 'VERSE')]), /same section and who/);
  assert.match(bad([first], { partial: true }), /partial calibration backup/);
});

test('toIdentityEvents: one event per run of section+who, earliest tap wins, untapped intro starts at 0', () => {
  const l = (start: number | null, section: string, who: string | null) => ({ start, section, line: `${section}@${start}`, who });
  const out = toIdentityEvents([
    l(null, 'INTRO', GROUP), l(null, 'INTRO', GROUP),
    l(10, 'V1', 'alex-one'), l(12, 'V1', 'alex-one'),
    l(16, 'PRE', GROUP), l(14, 'PRE', GROUP), l(15, 'PRE', GROUP), // stray first tap
    l(20, 'V1', null),
  ]);
  assert.deepEqual(out.map((c) => c.start), [0, null, 10, null, 14, null, null, 20]);
  assert.deepEqual(out.map((c) => c.line), ['INTRO@null', 'INTRO@null', 'V1@10', 'V1@12', 'PRE@16', 'PRE@14', 'PRE@15', 'V1@20']);
  const v = validateTimeline({ song: 's', duration: 30, cues: out }, new Set(['alex-one']));
  assert.deepEqual(v.timeline?.cues.map((c) => [c.start, c.who]), [[0, GROUP], [10, 'alex-one'], [14, GROUP], [20, null]]);
  assert.throws(() => toIdentityEvents([l(1, 'A', GROUP), l(null, 'B', GROUP)]), /no tapped time/);
});
