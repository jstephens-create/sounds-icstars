import test from 'node:test';
import assert from 'node:assert/strict';

// The UI modules read the reduced-motion setting at load; give Node a stand-in before importing them.
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false, addEventListener() {} });
const { countedId } = await import('./spotlight.ts');
const { ambientBar } = await import('./visualizer.ts');
const { motion, easeStep } = await import('./motion.ts');

test('countedId interpolates the member number and lands exactly on the target', () => {
  assert.equal(countedId('060', 1, 5, 0), '060.01');
  assert.equal(countedId('060', 1, 5, 1), '060.05');
  assert.equal(countedId('060', 16, 2, 1), '060.02');
  assert.equal(countedId('060', 3, 9, 2), '060.09'); // clamped past the end
});

test('ambient signal is deterministic and always within 0..1', () => {
  assert.equal(ambientBar(7, 48, 12.5), ambientBar(7, 48, 12.5));
  for (let t = 0; t < 200; t += 3.7) for (let i = 0; i < 48; i++) {
    const v = ambientBar(i, 48, t);
    assert.ok(v >= 0 && v <= 1, `bar ${i} at ${t}: ${v}`);
  }
});

test('motion STILL makes every ease a jump; a chosen level overrides the system setting', () => {
  motion.set('still');
  assert.equal(motion.scale(), 0);
  assert.equal(easeStep(16, 260), 1);
  motion.set('high');
  assert.ok(motion.scale() > 1 && easeStep(16, 260) < 1);
  motion.set(null);
  assert.equal(motion.level(), 'normal'); // stand-in reports no reduced-motion preference
});

test('stored preferences: valid values kept, anything malformed falls back to defaults', async () => {
  const { parsePrefs, DEFAULT_PREFS } = await import('./controls.ts');
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('not json'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('{"composition":"manual","motion":"high","type":false,"links":false,"clean":true}'),
    { composition: 'manual', motion: 'high', type: false, links: false, clean: true });
  assert.deepEqual(parsePrefs('{"composition":"x","motion":"warp","type":"yes"}'), DEFAULT_PREFS);
});
