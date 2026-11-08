import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile } from './parse.ts';
import { slugify, validateRoster, completedSections } from './validate.ts';
import { profile } from './fixtures.ts';

// 16 invented placeholder people: "Person A" … "Person P".
const roster = (n = 16) =>
  Array.from({ length: n }, (_, i) => {
    const name = `Person ${String.fromCharCode(65 + i)}`;
    return parseProfile(slugify(name), profile(name));
  });

test('valid 16-member roster passes with sequential unique IDs', () => {
  const r = validateRoster(roster());
  assert.equal(r.valid, true);
  assert.equal(r.members.length, 16);
  assert.equal(r.members[0]?.id, '060.01');
  assert.equal(r.members[15]?.id, '060.16');
  assert.equal(new Set(r.members.map((m) => m.id)).size, 16);
});

test('IDs follow alphabetical filename order, not load order', () => {
  const r = validateRoster(roster().reverse());
  assert.equal(r.members[0]?.slug, 'person-a');
});

test('wrong member count is an error', () => {
  assert.equal(validateRoster(roster(15)).valid, false);
  assert.equal(validateRoster(roster(17)).valid, false);
});

test('duplicate file is an error', () => {
  const list = roster(15);
  list.push(parseProfile('person-a', profile('Person A')));
  const r = validateRoster(list);
  assert.ok(r.issues.some((i) => i.level === 'error' && i.message.includes('Duplicate')));
});

test('heading that does not match filename is an error', () => {
  const list = roster(15);
  list.push(parseProfile('person-z', profile('Someone Else')));
  const r = validateRoster(list);
  assert.ok(r.issues.some((i) => i.level === 'error' && i.message.includes('does not match')));
});

test('mixed-case name heading still matches lowercase filename', () => {
  assert.equal(slugify('SaM ExamplE'), 'sam-example');
  assert.equal(slugify('José Núñez'), 'jose-nunez');
});

test('pending sections are warnings, and counted', () => {
  const r = validateRoster(roster());
  assert.ok(r.issues.some((i) => i.level === 'warning' && i.message.startsWith('Awaiting input')));
  assert.equal(completedSections(r.members[0]!), 2);
});
