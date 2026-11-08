import test from 'node:test';
import assert from 'node:assert/strict';
import { bandAverage, follow, logBands, rms, createNormalizer } from './analyser.ts';

test('follow: rises instantly, releases on a time constant independent of frame rate', () => {
  assert.equal(follow(0.2, 0.9, 16.7, 110), 0.9); // attack: no lag
  const at60 = Array.from({ length: 6 }).reduce<number>((v) => follow(v, 0, 1000 / 60, 110), 1);
  const at30 = Array.from({ length: 3 }).reduce<number>((v) => follow(v, 0, 1000 / 30, 110), 1);
  assert.ok(Math.abs(at60 - at30) < 1e-9); // same 100 ms of decay at 60 fps and 30 fps
  assert.ok(Math.abs(at60 - Math.exp(-100 / 110)) < 1e-9);
});

test('logBands reuses the output array it is given', () => {
  const out = new Float32Array(4);
  assert.equal(logBands(new Array(64).fill(0.25), 100, 4, 30, 6000, out), out);
  assert.ok(out.every((b) => b === 0.25));
});

test('bandAverage averages only the bins inside the frequency range', () => {
  const spectrum = [0, 1, 1, 0, 0, 0]; // 10 Hz per bin → energy at 10–20 Hz
  assert.equal(bandAverage(spectrum, 10, 10, 20), 1);
  assert.equal(bandAverage(spectrum, 10, 30, 50), 0);
});

test('bandAverage clamps to the spectrum and returns 0 for ranges entirely above it', () => {
  assert.equal(bandAverage([1, 1], 10, 0, 100000), 1);
  assert.equal(bandAverage([1, 1], 10, 500, 900), 0);
});

test('logBands returns n values in 0..1', () => {
  const spectrum = new Array(1024).fill(0.5);
  const bands = logBands(spectrum, 23.4, 32);
  assert.equal(bands.length, 32);
  assert.ok(bands.every((b) => b === 0.5));
});

test('rms of a full-scale square wave is 1, of silence 0', () => {
  assert.equal(rms([1, -1, 1, -1]), 1);
  assert.equal(rms([0, 0, 0]), 0);
  assert.equal(rms([]), 0);
});

test('normalizer maps the loudest recent level to 1 and stays within 0..1', () => {
  const norm = createNormalizer(0.5, 0.01);
  assert.equal(norm(0.4), 1);
  assert.equal(norm(0.2), 1); // peak decayed 0.4 → 0.2
  assert.equal(norm(0.05), 0.5); // peak decayed 0.2 → 0.1
  assert.equal(norm(0), 0);
});
