import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile } from './parse.ts';
import { profile } from './fixtures.ts';

test('parses name and keeps section text verbatim, multi-line included', () => {
  const p = parseProfile('sam-example', profile('Sam Example'));
  assert.equal(p.name, 'Sam Example');
  assert.equal(p.sections.description, 'Past: example. Present: example.\nFuture: example.');
  assert.equal(p.sections.interests, 'Example interest.');
  assert.deepEqual(p.issues, []);
});

test('"[To be completed.]" becomes null (pending), not text', () => {
  const p = parseProfile('sam-example', profile('Sam Example'));
  assert.equal(p.sections.personality, null);
});

test('handles Windows line endings', () => {
  const p = parseProfile('sam-example', profile('Sam Example').replace(/\n/g, '\r\n'));
  assert.equal(p.sections.description, 'Past: example. Present: example.\nFuture: example.');
  assert.deepEqual(p.issues, []);
});

test('missing section is an error', () => {
  const raw = profile('Sam Example').replace(/## Strengths\n\[To be completed\.\]\n/, '');
  const p = parseProfile('sam-example', raw);
  assert.ok(p.issues.some((i) => i.level === 'error' && i.message.includes('Strengths')));
});

test('out-of-order sections are an error', () => {
  const raw = `# Sam Example\n## Personality\n[x]\n## Description\n[y]\n## Interests\n[z]\n## Strengths\n[s]\n`;
  const p = parseProfile('sam-example', raw);
  assert.ok(p.issues.some((i) => i.level === 'error' && i.message.includes('out of order')));
});

test('missing name heading is an error', () => {
  const p = parseProfile('sam-example', profile('Sam Example').replace(/^# .*\n/, ''));
  assert.equal(p.name, null);
  assert.ok(p.issues.some((i) => i.level === 'error' && i.message.includes('Name')));
});

test('empty brackets and missing brackets are warnings', () => {
  const p = parseProfile('sam-example', profile('Sam Example', { Interests: '' }).replace('[Example', 'Example'));
  assert.equal(p.sections.interests, null);
  assert.ok(p.issues.some((i) => i.level === 'warning' && i.message.includes('empty')));
});

test('unknown section is a warning and ignored', () => {
  const p = parseProfile('sam-example', profile('Sam Example') + '\n## Music\n[x]\n');
  assert.ok(p.issues.some((i) => i.level === 'warning' && i.message.includes('Music')));
  assert.equal(p.issues.filter((i) => i.level === 'error').length, 0);
});

test('the four-section template (no Additional Notes) parses with no issues', () => {
  const raw = '# Sam Example\n## Description\n[d]\n## Personality\n[p]\n## Interests\n[i]\n## Strengths\n[s]\n';
  const p = parseProfile('sam-example', raw);
  assert.deepEqual(p.issues, []);
  assert.deepEqual(Object.keys(p.sections), ['description', 'personality', 'interests', 'strengths']);
});

test('a leftover "## Additional Notes" heading is only a warning', () => {
  const p = parseProfile('sam-example', profile('Sam Example') + '\n## Additional Notes\n[n]\n');
  assert.ok(p.issues.some((i) => i.level === 'warning' && i.message.includes('Additional Notes')));
  assert.equal(p.issues.filter((i) => i.level === 'error').length, 0);
});
