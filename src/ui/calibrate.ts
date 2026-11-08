// Calibration tool (#/calibrate): tap along with the song to record when each lyric line starts,
// confirm who each line is about, then export soundtrack/level-up-timeline.json.
// Nothing is guessed: a line has a time only once a person has tapped it.
// Before every line is tapped, export still works as a backup (untapped lines get "start": null).
import { driveFrames } from '../audio/player.ts';
import type { Member } from '../members/validate.ts';
import { suggestWho, type LyricLine } from '../timeline/lyrics.ts';
import { GROUP, validateTimeline, type Timeline, type Who } from '../timeline/timeline.ts';
import { el } from './dom.ts';
import { createTransport } from './transport.ts';

const DRAFT_KEY = 'hs060.calibration.v1';
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Row {
  section: string;
  line: string;
  who: Who;
  start: number | null;
  note?: string;
}

interface Saved {
  offset?: number;
  cues: { start: number | null; who: Who; line: string }[];
}

/** Shape check for a draft or backup read from storage or a file; null when unusable. */
export function asSaved(data: unknown): Saved | null {
  const d = data as Saved | null;
  return d && typeof d === 'object' && Array.isArray(d.cues) && d.cues.every((c) => c && typeof c === 'object') ? d : null;
}

/** Export file contents. Untapped lines keep "start": null, and the file is then marked partial. */
export function toExport(rows: readonly Omit<Row, 'note'>[], song: string, duration: number, offset: number) {
  const tapped = rows.filter((r) => r.start !== null).length;
  const progress = tapped < rows.length ? { partial: true, tapped, total: rows.length } : {};
  return {
    song,
    duration: round2(duration),
    offset,
    ...progress,
    cues: rows.map((r) => ({ start: r.start, section: r.section, line: r.line, who: r.who })),
  };
}

export function formatPrecise(t: number): string {
  const cs = Math.round(t * 100);
  const m = Math.floor(cs / 6000);
  const s = Math.floor(cs / 100) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

export function mountCalibrator(
  app: HTMLElement,
  opts: {
    audio: HTMLAudioElement;
    songName: string;
    lines: LyricLine[];
    members: Member[];
    existing: Timeline | null;
    timelinePath: string;
    backup?: unknown; // contents of the partial backup file, if present
  },
): void {
  const { audio, songName, lines, members, existing, timelinePath } = opts;
  const slugs = new Set(members.map((m) => m.slug));
  const suggestions = suggestWho(lines, members);
  const rows: Row[] = lines.map((l, i) => ({ ...l, who: suggestions[i]?.who ?? null, note: suggestions[i]?.note, start: null }));
  let offset = 0;

  // Restore work: browser draft first (most recent), else the saved timeline file, else the partial
  // backup file, else suggestions only.
  const sameLines = (s: Saved) => s.cues.length === rows.length && s.cues.every((c, i) => c.line === rows[i]?.line);
  const apply = (s: Saved) => {
    s.cues.forEach((c, i) => {
      const r = rows[i];
      if (!r) return;
      r.start = typeof c.start === 'number' && c.start >= 0 ? c.start : null;
      r.who = typeof c.who === 'string' && (c.who === GROUP || slugs.has(c.who)) ? c.who : null;
    });
    offset = typeof s.offset === 'number' && Number.isFinite(s.offset) ? s.offset : 0;
  };
  const draft = readDraft();
  const backup = asSaved(opts.backup);
  const backupPath = timelinePath.replace(/.json$/, '.partial.json');
  let restored = 'Starting fresh: who-suggestions come from the lyrics and profiles. Check every line.';
  if (draft && sameLines(draft)) {
    apply(draft);
    restored = 'Draft restored from this browser.';
  } else if (existing && sameLines(existing)) {
    apply(existing);
    restored = `Loaded ${timelinePath}.`;
  } else if (backup && sameLines(backup)) {
    apply(backup);
    restored = `Loaded the partial backup ${backupPath}.`;
  }
  let cursor = rows.findIndex((r) => r.start === null);
  if (cursor < 0) cursor = rows.length;

  // --- Header ---------------------------------------------------------------
  const head = el('section', 'panel cal-head');
  const back = el('a', 'label', '← Back to prototype');
  back.href = '#/';
  const howto = el(
    'p',
    'howto',
    'Press PLAY, then tap SPACE (or TAP) exactly when each highlighted line begins. BACKSPACE undoes the last tap. ' +
      'Click a line to re-tap from there. Click a time to replay from just before it. Use ±0.1 to fine-tune.',
  );
  const transport = createTransport(audio, () => Promise.resolve());

  const tapBtn = button('TAP', 'play');
  const undoBtn = button('UNDO');
  const progress = el('span', 'label');
  const offsetLabel = el('label', 'label', 'OFFSET (S) ');
  const offsetInput = el('input', 'offset');
  offsetInput.type = 'number';
  offsetInput.step = '0.05';
  offsetInput.value = String(offset);
  offsetLabel.append(offsetInput);
  const copyBtn = button('COPY JSON');
  const downloadBtn = button('DOWNLOAD JSON');
  const discardBtn = button('DISCARD DRAFT');
  const status = el('p', 'label status', restored);
  status.setAttribute('aria-live', 'polite');
  const issuesList = el('ul', 'issues');

  const tools = el('div', 'controls');
  tools.append(tapBtn, undoBtn, progress, offsetLabel);
  const exportTools = el('div', 'controls');
  exportTools.append(copyBtn, downloadBtn, discardBtn);
  head.append(back, el('h2', 'label', 'CALIBRATION / LEVEL UP'), howto, transport.el, tools, exportTools, status, issuesList);

  // --- Rows -------------------------------------------------------------------
  const list = el('div', 'cal-rows');
  const rowEls = rows.map((r, i) => {
    if (i === 0 || rows[i - 1]?.section !== r.section) list.append(el('h3', 'label cal-section', r.section));
    const row = el('div', 'cal-row');
    const time = button('', 'time');
    const minus = button('−0.1', 'nudge');
    const plus = button('+0.1', 'nudge');
    const text = button(r.line, 'line');
    const select = el('select', 'who');
    select.setAttribute('aria-label', `Who is "${r.line}" about`);
    select.append(option('', '— none'), option(GROUP, 'ALL (group)'), ...members.map((m) => option(m.slug, `${m.id} ${m.name}`)));
    select.value = r.who ?? '';
    const note = el('span', 'note');
    row.append(time, minus, plus, text, select, note);
    list.append(row);

    time.addEventListener('click', () => {
      if (r.start === null) return;
      audio.currentTime = Math.max(0, r.start + offset - 1.5);
      void audio.play().catch(() => {});
    });
    const nudge = (d: number) => {
      if (r.start === null) return;
      r.start = Math.max(0, round2(r.start + d));
      refresh();
    };
    minus.addEventListener('click', () => nudge(-0.1));
    plus.addEventListener('click', () => nudge(0.1));
    text.addEventListener('click', () => {
      cursor = i;
      refresh();
    });
    select.addEventListener('change', () => {
      r.who = select.value || null;
      refresh();
    });
    return { row, time, note };
  });
  app.append(head, list);

  // --- Behaviour --------------------------------------------------------------
  const build = () => toExport(rows, songName, audio.duration, offset);
  // Full-completion check. Only a timeline that passes is exported under the name the prototype plays;
  // anything else is exported as a backup under a different name, so it can never replace that file.
  const check = (): string[] => {
    const missing = rows.filter((r) => r.start === null).length;
    if (missing) return [`${missing} of ${rows.length} lines not tapped yet. Export saves a partial backup.`];
    if (!Number.isFinite(audio.duration)) return ['Waiting for the song to load.'];
    return validateTimeline(build(), slugs).issues;
  };
  let ready = false;
  const fileName = () => (ready ? 'level-up-timeline.json' : 'level-up-timeline.partial.json');
  const nextStep = () =>
    ready
      ? `Move it to ${timelinePath}, then reload the prototype.`
      : `Backup only (untapped lines have "start": null). Keep it at ${backupPath}; the prototype plays only the finished ${timelinePath}.`;

  function refresh(): void {
    rows.forEach((r, i) => {
      const e = rowEls[i];
      if (!e) return;
      e.time.textContent = r.start === null ? '--:--.--' : formatPrecise(r.start);
      e.row.classList.toggle('is-next', i === cursor);
      e.row.classList.toggle('is-stamped', r.start !== null);
      e.note.textContent = r.who === null && r.note ? r.note : '';
    });
    progress.textContent = `${rows.filter((r) => r.start !== null).length}/${rows.length} LINES TAPPED`;
    const issues = check();
    issuesList.replaceChildren(...issues.map((m) => el('li', 'warning', m)));
    ready = issues.length === 0;
    copyBtn.textContent = ready ? 'COPY JSON' : 'COPY BACKUP JSON';
    downloadBtn.textContent = ready ? 'DOWNLOAD JSON' : 'DOWNLOAD BACKUP JSON';
    try {
      const saved: Saved = { offset, cues: rows.map(({ start, who, line }) => ({ start, who, line })) };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable (private mode): the draft just isn't kept */
    }
  }

  const tap = () => {
    const r = rows[cursor];
    if (!r) return;
    r.start = round2(audio.currentTime);
    cursor++;
    refresh();
    rowEls[Math.min(cursor, rows.length - 1)]?.row.scrollIntoView({ block: 'nearest' });
  };
  const undo = () => {
    if (cursor === 0) return;
    cursor--;
    const r = rows[cursor];
    if (r) r.start = null;
    refresh();
  };

  tapBtn.addEventListener('click', tap);
  undoBtn.addEventListener('click', undo);
  offsetInput.addEventListener('change', () => {
    offset = round2(Number(offsetInput.value) || 0);
    refresh();
  });
  copyBtn.addEventListener('click', () => {
    navigator.clipboard
      .writeText(JSON.stringify(build(), null, 2))
      .then(() => (status.textContent = `Copied ${fileName()} contents. ${nextStep()}`))
      .catch(() => (status.textContent = 'Copy failed. Use DOWNLOAD JSON instead.'));
  });
  downloadBtn.addEventListener('click', () => {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(build(), null, 2) + '\n'], { type: 'application/json' }));
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(a.href);
    status.textContent = `Downloaded ${fileName()}. ${nextStep()}`;
  });
  discardBtn.addEventListener('click', () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing to discard */
    }
    location.reload();
  });

  // SPACE taps and BACKSPACE undoes anywhere except text fields and dropdowns.
  const isField = (t: EventTarget | null) =>
    (t instanceof HTMLInputElement && t.type !== 'range') || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
  addEventListener(
    'keydown',
    (e) => {
      if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) tap();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        undo();
      }
    },
    true,
  );
  // Stops SPACE from also "clicking" whichever button has focus (buttons activate on keyup).
  addEventListener('keyup', (e) => {
    if (e.key === ' ' && !isField(e.target)) e.preventDefault();
  }, true);

  // Preview: mark the line playing now according to the taps so far.
  let playing = -1;
  driveFrames(audio, () => {
    transport.update();
    let idx = -1;
    rows.forEach((r, i) => {
      if (r.start !== null && r.start + offset <= audio.currentTime) idx = i;
    });
    if (idx !== playing) {
      rowEls[playing]?.row.classList.remove('is-playing');
      rowEls[idx]?.row.classList.add('is-playing');
      playing = idx;
    }
    return false; // nothing eases here; the loop only needs to run while playing
  });
  audio.addEventListener('loadedmetadata', refresh);
  refresh();
}

function readDraft(): Saved | null {
  try {
    return asSaved(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

function button(text: string, className = 'ghost'): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

function option(value: string, text: string): HTMLOptionElement {
  const o = el('option', '', text);
  o.value = value;
  return o;
}
