// Collapsible developer diagnostics: roster validation, analyser status, timeline status.
// Closed by default; opens itself only when the roster has errors.
import type { Issue } from '../members/parse.ts';
import type { Roster } from '../members/validate.ts';
import { formatPrecise } from './calibrate.ts';
import { el } from './dom.ts';

export interface AudioStatus {
  state: string;
  sampleRate: number;
  frames: number;
  peakBin: number;
}

export function createDiagnostics(roster: Roster) {
  const root = el('details', 'panel diagnostics');
  const summary = el('summary', 'label');
  root.append(summary);

  const errors = roster.issues.filter((i) => i.level === 'error');
  const warnings = roster.issues.filter((i) => i.level === 'warning');
  if (!roster.valid) {
    root.open = true;
    root.setAttribute('role', 'alert');
  }

  const block = (heading: string) => {
    const wrap = el('div', 'diag-block');
    wrap.append(el('h3', 'label', heading));
    root.append(wrap);
    return wrap;
  };

  const rosterBlock = block(roster.valid ? `ROSTER · VALID · ${warnings.length} WARNINGS` : `ROSTER · INVALID · ${errors.length} ERRORS`);
  rosterBlock.append(issueList([...errors, ...warnings]));

  const audioLine = el('p', 'label', 'AUDIO · not started');
  block('AUDIO ANALYSER').append(audioLine);

  const timelineBlock = block('TIMELINE');
  const timelineLine = el('p', 'label');
  const timelineIssues = el('ul', 'issues');
  const calibrate = el('a', 'label', 'Open calibration →');
  calibrate.href = '#/calibrate';
  timelineBlock.append(timelineLine, timelineIssues, calibrate);

  const coverageList = el('ul', 'coverage');
  timelineBlock.append(coverageList);

  const framesLine = el('p', 'label', 'FRAMES · measured while playing');
  block('ANIMATION LOOP').append(framesLine);

  const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  block('MOTION').append(
    el('p', 'label', motion
      ? 'Reduced (system setting): signal stays live but falls slower; no rotation, pulsing, waveform or eased transitions.'
      : 'Full.'),
  );

  let audioState = 'not started';
  let timelineState = '';
  const refreshSummary = () => {
    summary.textContent = `DEVELOPER DIAGNOSTICS · ROSTER ${roster.valid ? 'OK' : 'ERRORS'} · ${warnings.length} WARNINGS · AUDIO ${audioState.toUpperCase()} · TIMELINE ${timelineState}`;
  };
  refreshSummary();

  return {
    el: root,
    setAudio(s: AudioStatus): void {
      const line = `AUDIO · context ${s.state} · ${s.sampleRate} Hz · ${s.frames} frames analysed · peak bin ${s.peakBin}/255`;
      if (line === audioLine.textContent) return; // unchanged (e.g. paused): no DOM write
      audioLine.textContent = line;
      if (s.state !== audioState) {
        audioState = s.state;
        refreshSummary();
      }
    },
    /** Recent frame intervals (ms) → fps and percentiles, so frame timing can be checked on real hardware. */
    setFrames(gaps: Float32Array): void {
      const s = Float32Array.from(gaps).sort();
      const at = (p: number) => (s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0).toFixed(1);
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      framesLine.textContent = `FRAMES · ${(1000 / mean).toFixed(0)} FPS · p50 ${at(0.5)} ms · p95 ${at(0.95)} ms · max ${at(1)} ms (last ${s.length})`;
    },
    setTimeline(state: string, issues: string[]): void {
      timelineState = state;
      timelineLine.textContent = `TIMELINE · ${state}`;
      timelineIssues.replaceChildren(...issues.map((m) => el('li', 'warning', m)));
      refreshSummary();
    },
    /** Per-member check list: first highlight time with a jump button, or "never highlighted". */
    setCoverage(rows: { id: string; name: string; time: number | null }[], jump: (t: number) => void): void {
      coverageList.replaceChildren(
        ...rows.map((r) => {
          const item = el('li', r.time === null ? 'warning' : '');
          item.append(el('span', 'id', r.id), el('span', 'name', r.name));
          if (r.time === null) {
            item.append(el('span', 'label', 'NEVER HIGHLIGHTED'));
          } else {
            const go = el('button', 'ghost', `▶ ${formatPrecise(r.time)}`);
            go.type = 'button';
            go.setAttribute('aria-label', `Jump to ${r.name}'s first lyric`);
            go.addEventListener('click', () => jump(r.time ?? 0));
            item.append(go);
          }
          return item;
        }),
      );
    },
  };
}

function issueList(issues: Issue[]): HTMLUListElement {
  const list = el('ul', 'issues');
  for (const i of issues) {
    const item = el('li', i.level);
    item.append(el('span', 'level', i.level.toUpperCase()), el('span', 'slug', i.slug ?? 'ROSTER'), el('span', 'msg', i.message));
    list.append(item);
  }
  return list;
}
