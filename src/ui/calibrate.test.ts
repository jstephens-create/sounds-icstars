import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GROUP, validateTimeline } from '../timeline/timeline.ts';
import { asSaved, toExport } from './calibrate.ts';

const rows = [
  { section: 'INTRO', line: 'Everybody up', who: GROUP, start: null },
  { section: 'VERSE', line: 'Alex One leads', who: 'alex-one', start: 12.34 },
  { section: 'VERSE', line: 'Somebody else', who: null, start: 15.5 },
];

test('partial export keeps tapped times exactly and untapped lines as null', () => {
  const out = toExport(rows, 'song.mp3', 209.876, 0.1);
  assert.equal(out.partial, true);
  assert.equal(out.tapped, 2);
  assert.equal(out.total, 3);
  assert.equal(out.duration, 209.88);
  assert.deepEqual(
    out.cues.map((c) => [c.start, c.who, c.line, c.section]),
    rows.map((r) => [r.start, r.who, r.line, r.section]),
  );
  // A backup can never pass as a playable timeline.
  assert.equal(validateTimeline(out, new Set(['alex-one'])).timeline, null);
});

test('complete export has no partial marker and is a valid timeline', () => {
  const out = toExport(rows.map((r, i) => ({ ...r, start: r.start ?? i })), 'song.mp3', 209.88, 0);
  assert.equal('partial' in out, false);
  assert.notEqual(validateTimeline(out, new Set(['alex-one'])).timeline, null);
});

test('a partial export round-trips through asSaved for restoring', () => {
  const saved = asSaved(JSON.parse(JSON.stringify(toExport(rows, 's', 1, 0))));
  assert.deepEqual(saved?.cues.map((c) => c.start), [null, 12.34, 15.5]);
  assert.equal(asSaved({ cues: [null] }), null);
  assert.equal(asSaved('nope'), null);
});
