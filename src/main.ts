import { createAnalyser } from './audio/analyser.ts';
import { driveFrames } from './audio/player.ts';
import { loadProfiles } from './members/load.ts';
import { validateRoster } from './members/validate.ts';
import { song, lyricsRaw, timelineData, backupData, TIMELINE_PATH } from './timeline/load.ts';
import { parseLyrics } from './timeline/lyrics.ts';
import { cueAt, GROUP, memberCoverage, validateTimeline, type Cue } from './timeline/timeline.ts';
import { mountCalibrator } from './ui/calibrate.ts';
import { createDiagnostics } from './ui/diagnostics.ts';
import { el } from './ui/dom.ts';
import { createControls, type Prefs } from './ui/controls.ts';
import { createIndex } from './ui/index-list.ts';
import { motion, reducedMotion, type Scene } from './ui/motion.ts';
import { createNetwork, type Focus } from './ui/network.ts';
import { createNow } from './ui/now.ts';
import { createSpotlight } from './ui/spotlight.ts';
import { createTicker } from './ui/ticker.ts';
import { createTimelineStrip } from './ui/timeline-strip.ts';
import { createTransport } from './ui/transport.ts';
import { createVisualizer } from './ui/visualizer.ts';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('#app element missing from index.html');

// shortcut: moving between the prototype (#/) and #/calibrate reloads the page. Fine for a
// developer tool; replace with the real router when the final interface is built.
// The reload is also the cleanup: the audio context and the animation loop end with the page.
addEventListener('hashchange', () => location.reload());

const roster = validateRoster(loadProfiles());
const slugs = new Set(roster.members.map((m) => m.slug));
const checked = timelineData ? validateTimeline(timelineData, slugs) : { timeline: null, issues: [] };
const timeline = checked.timeline;

if (location.hash === '#/calibrate') mountCalibration(app);
else mountPrototype(app);

function notice(title: string, text: string): HTMLElement {
  const box = el('section', 'panel');
  box.append(el('h2', 'label', title), el('p', '', text));
  return box;
}

function mountCalibration(root: HTMLElement): void {
  if (!roster.valid) {
    root.append(notice('CALIBRATION / UNAVAILABLE', 'Fix the profile errors first (see developer diagnostics on the main page).'));
    return;
  }
  if (!song || !lyricsRaw) {
    root.append(notice('CALIBRATION / UNAVAILABLE', 'Needs soundtrack/original/Level Up.mp3 and level-up-original-lyrics.md.'));
    return;
  }
  const audio = new Audio(song.url);
  audio.preload = 'auto'; // calibration seeks constantly
  mountCalibrator(root, {
    audio,
    songName: song.name,
    lines: parseLyrics(lyricsRaw),
    members: roster.members,
    existing: timeline,
    timelinePath: TIMELINE_PATH,
    backup: backupData,
  });
}

function mountPrototype(root: HTMLElement): void {
  const diagnostics = createDiagnostics(roster);
  if (!timelineData) diagnostics.setTimeline('NOT CALIBRATED', [`No ${TIMELINE_PATH} yet.`]);
  else if (!timeline) diagnostics.setTimeline('INVALID', checked.issues);
  else diagnostics.setTimeline(`OK · ${timeline.cues.length} CUES`, []);

  // Interaction state: three independent values. The audio never overwrites the visitor's choices.
  //   audioActiveMember: who the soundtrack mentions now (slug, GROUP or null). Set by the timeline only.
  //   hoveredMember:     pointer / keyboard preview. Shown on the stage; never touches playback.
  //   selectedMember:    the profile the visitor opened. The spotlight keeps it until closed.
  const state: Focus = { audioActiveMember: null, hoveredMember: null, selectedMember: null };
  const on = {
    hover: (slug: string | null) => setState({ hoveredMember: slug }),
    select: (slug: string) => setState({ selectedMember: slug }),
  };

  // Errors stop the member views: only diagnostics are shown until the profiles are fixed.
  const index = roster.valid ? createIndex(roster.members, on) : null;
  const network = roster.valid ? createNetwork(roster.members, on) : null;
  const spotlight = roster.valid
    ? createSpotlight(roster.members, { close: () => setState({ selectedMember: null }), pin: (slug) => setState({ selectedMember: slug }) })
    : null;
  if (!song) {
    root.append(
      ...[index?.el, notice('SOUNDTRACK / NOT FOUND', 'Place the LEVEL UP recording in soundtrack/original/.'), diagnostics.el].filter((x) => x !== undefined),
    );
    return;
  }

  const ticker = roster.valid ? createTicker(roster.members) : null;
  if (ticker) root.before(ticker.el);

  // Broadcast controls (header). Applying a change re-renders the slow path and wakes the loop.
  const controls = createControls((p) => applyPrefs(p), () => transport.el.querySelector<HTMLButtonElement>('button.play')?.click());
  let prefs: Prefs = controls.prefs();
  document.querySelector('.bar')?.append(controls.el);
  function applyPrefs(p: Prefs): void {
    prefs = p;
    const html = document.documentElement;
    html.classList.toggle('clean', p.clean);
    html.classList.toggle('no-type', !p.type);
    html.classList.toggle('motion-still', motion.still());
    render();
    loop.wake();
  }
  reducedMotion.addEventListener('change', () => {
    controls.refresh();
    applyPrefs(prefs);
  });

  const audio = new Audio(song.url);
  audio.preload = 'metadata';
  // How fast every audio level falls after a hit: snappy normally; calmer, but still live, under reduced motion.
  const analyser = createAnalyser(audio, () => (motion.still() ? 320 : 110));
  const transport = createTransport(audio, () => analyser.start());
  const now = roster.valid ? createNow(roster.members, timeline !== null) : null;
  const viz = createVisualizer();
  const strip = timeline && roster.valid
    ? createTimelineStrip(timeline, roster.members, { seek: (t) => (audio.currentTime = t), preview: on.hover })
    : null;

  root.classList.add('instrument');
  root.append(
    ...[index?.el, network?.el, spotlight?.el, strip?.el, transport.el, now?.el, viz.el, diagnostics.el].filter((x) => x !== undefined),
  );
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selectedMember) setState({ selectedMember: null });
  });

  function setState(patch: Partial<Focus>): void {
    const next = { ...state, ...patch };
    const same = (k: keyof Focus) => next[k] === state[k];
    if (same('audioActiveMember') && same('hoveredMember') && same('selectedMember')) return;
    if (next.audioActiveMember !== state.audioActiveMember && next.audioActiveMember && next.audioActiveMember !== GROUP) scene.pulse = 1;
    Object.assign(state, next);
    render();
  }

  // Slow path: runs only when the interaction state or a preference changes, never per frame.
  function render(): void {
    const memberActive = state.audioActiveMember !== GROUP ? state.audioActiveMember : null;
    const manual = prefs.composition === 'manual';
    // AUTO: the soundtrack directs the stage and spotlight. MANUAL: only the visitor's choice does.
    const center = manual ? state.selectedMember : memberActive;
    index?.setFocus(state.audioActiveMember);
    index?.setSelected(state.selectedMember);
    network?.setFocus({ ...state }, center);
    spotlight?.show(state.selectedMember ?? (manual ? null : memberActive), state.selectedMember ? 'selected' : 'audio');
    // Shared emphasis for CSS: which composition, and what the song is focused on.
    root.dataset.focus = state.audioActiveMember === null ? 'neutral' : state.audioActiveMember === GROUP ? 'group' : 'member';
    root.dataset.composition = prefs.composition;
    loop.wake(); // let the network ease into its new layout even while paused
  }

  // Verification aid: every member's first highlight, with a jump button (lands 1 s early).
  if (timeline) {
    const { first, missing } = memberCoverage(timeline, roster.members.map((m) => m.slug));
    diagnostics.setCoverage(
      roster.members.map((m) => ({ id: m.id, name: m.name, time: first.get(m.slug) ?? null })),
      (t) => {
        audio.currentTime = Math.max(0, t - 1);
      },
    );
    if (missing.length) {
      diagnostics.setTimeline(`OK · ${timeline.cues.length} CUES · ${missing.length} MEMBERS NEVER HIGHLIGHTED`, []);
    }
  }

  // Composition engine: one shared scene for every system (see ui/motion.ts for the three clocks).
  //   tau   — ambient clock, wall time × motion level: orbits, drift, ticker-independent canvas motion
  //   perf  — eases 0 ↔ 1 over ~0.7 s on play/pause, so ambient and performance blend, never cut
  //   pulse — 1 at each new member, decays: typography and network react to identity changes
  const scene: Scene = { tau: 0, perf: 0, pulse: 0 };
  let tickerRate = -1;

  // The single animation loop. Fast path, every frame: analyser → canvases, playback clock → timeline.
  // Member/profile DOM changes go through setState and happen only when the cue changes.
  // It keeps running while there is ambient motion; at motion STILL it stops once everything settles.
  let cue: Cue | null | undefined;
  const gaps = new Float32Array(120); // recent frame intervals, for the diagnostics readout
  let frameCount = 0;
  const loop = driveFrames(audio, (dt) => {
    const frame = analyser.sample(dt);
    const t = audio.currentTime;
    transport.update();
    if (timeline) {
      const next = audio.ended ? null : cueAt(timeline, t);
      if (next !== cue) {
        cue = next;
        now?.set(cue);
        network?.setCue(cue);
        setState({ audioActiveMember: cue?.who ?? null });
      }
      strip?.setTime(t, dt);
    }
    const scale = motion.scale();
    scene.tau += (dt / 1000) * scale;
    const target = audio.paused ? 0 : 1;
    scene.perf = scale === 0 ? target : target + (scene.perf - target) * Math.exp(-dt / 240);
    if (Math.abs(scene.perf - target) < 0.001) scene.perf = target;
    scene.pulse *= Math.exp(-dt / 250);
    const rate = prefs.type ? scale : 0; // ticker speed ignores playback; only motion level and type pref
    if (rate !== tickerRate) ticker?.setRate((tickerRate = rate));
    const scn = scene.perf >= 0.5 ? 'performance' : 'ambient';
    if (root.dataset.scene !== scn) {
      root.dataset.scene = scn;
      controls.setStatus(scn === 'performance');
    }

    const netBusy = network?.draw(frame, dt, scene, prefs) ?? false;
    const vizBusy = viz.draw(frame, dt, scene);
    spotlight?.tick(performance.now());

    gaps[frameCount % gaps.length] = dt;
    if (++frameCount % 60 === 0 && !audio.paused) diagnostics.setFrames(gaps);
    if (frameCount % 15 === 0) diagnostics.setAudio(analyser.status()); // the loop now also runs while paused
    return scale > 0 || scene.perf !== target || netBusy || vizBusy;
  });

  applyPrefs(prefs); // first render, now that the loop exists
  for (const type of ['play', 'pause', 'ended']) audio.addEventListener(type, () => controls.setPlaying(!audio.paused));

  audio.addEventListener('loadedmetadata', () => {
    if (timeline && Math.abs(timeline.duration - audio.duration) > 0.5) {
      diagnostics.setTimeline('MISMATCH', [
        `Timeline was calibrated for a ${timeline.duration}s recording; this file is ${audio.duration.toFixed(2)}s.`,
      ]);
    }
  });

  if (import.meta.env.DEV) console.table(roster.issues);
}
