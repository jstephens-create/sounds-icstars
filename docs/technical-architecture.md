# Technical Architecture — LEVEL UP / 060

Status: **proposal**. No application code exists and no dependencies are installed.

---

## 1. Recommendation

**Vite + TypeScript + HTML + CSS + SVG + native browser APIs. No UI framework.**

### Why no framework (React, Vue, Svelte, etc.)
- **Small, stable data:** 16 records with five text sections each. There is no complex shared state for a framework to manage.
- **Three views, one shell:** routing between three states takes about 30 lines with the browser's own `hashchange` event.
- **Creative freedom:** the hard parts of this project are SVG drawing, spatial transitions and motion. Those work most directly with the DOM, SVG and the Web Animations API. A framework's rendering model often has to be worked *around* for this kind of work.
- **Maintainability:** fewer dependencies means fewer upgrades and fewer breaking changes. Plain TypeScript modules are readable by anyone who knows the web platform.
- **Performance:** no framework runtime to download. The whole application should stay well under 100 KB of JavaScript (gzipped).

### When to reconsider
A framework becomes worth it if the project grows features such as in-browser editing of profiles, user accounts, or many interdependent views. None are planned.

### What each tool does

| Tool | Role | Installed? |
|---|---|---|
| **TypeScript** | Type-checked JavaScript; catches mistakes in data handling before they reach the browser | Not yet (proposed dev dependency) |
| **Vite** | Development server with instant reload, and a build step that produces static files | Not yet (proposed dev dependency) |
| **HTML** | Document structure, real links and headings for accessibility | Built into the browser |
| **CSS** | Layout (grid), design tokens, themes, reduced-motion rules | Built into the browser |
| **SVG** | Constellation ring, connections, blueprint diagrams | Built into the browser |
| **Native APIs** | Routing, animation, observers (see section 5) | Built into the browser |

**Proposed dependencies in total:** `vite` and `typescript`, both development-only. **Runtime dependencies: none.**

---

## 2. Reading the member profiles (single source of truth)

The 16 files in `member/` remain the **only** place member information lives. The application reads them directly and never copies their content into code or JSON.

### How
Vite can import files as raw text at build time:

```ts
// src/data/members.ts  (illustrative — not yet created)
const files = import.meta.glob('/member/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
```

- **During development:** editing a profile in `member/` updates the browser immediately.
- **At build time:** Vite reads the current files and includes their text in the output.
- The member's slug (`first-last`) comes from the filename, and their ID (`060.01`) from alphabetical position.

### Parsing
The profiles follow one fixed template, so a small purpose-built parser (about 40 lines) is enough. No Markdown library is needed:

1. `# Name` becomes the member's name.
2. Each `## Heading` starts a section (Description, Personality, Interests, Strengths, Additional Notes).
3. The outer `[ … ]` brackets around section text are removed. Line breaks inside are kept.
4. `[To be completed.]` becomes `null`, which the interface shows as `AWAITING INPUT`.
5. A missing or unexpected section produces a development-time warning, never a crash.
6. If the member's text contains their own `Past:` / `Present:` / `Future:` labels, the parser also exposes those segments for the optional timeline. The original text is always kept unchanged alongside them.

### Data model

```ts
type SectionKey = 'description' | 'personality' | 'interests' | 'strengths' | 'notes';

interface Member {
  slug: string;                                  // "first-last"
  id: string;                                    // "060.01"
  name: string;                                  // "First Last"
  sections: Record<SectionKey, string | null>;   // verbatim text, or null if pending
  timeline?: { past?: string; present?: string; future?: string }; // only if member used the labels
}
```

### Safety
Member text is always inserted with `textContent`, never `innerHTML`. Whatever is typed into a profile is displayed as text and can never run as code.

---

## 3. Privacy and deployment (*decided 2026-11-08*)

The project lead authorized the full public release: `member/` profiles, the soundtrack, lyrics and timeline are committed to Git and published on GitHub Pages. Only `soundtrack/*.partial.json` (calibration backups) and `Visual/` stay local.

- Deployment: `.github/workflows/deploy.yml` runs tests, `check:timeline` and the build on every push to `main`, then publishes `dist/` to Pages. The build uses `--base=/sounds-icstars/` (the repository name).
- Still to confirm: each member's permission for their profile, and the Suno account owner's permission and plan terms for public use of the song (it was made in Suno under a cohort member's account).

---

## 3b. Soundtrack synchronization

One song, `soundtrack/original/Level Up.mp3`, plays across the site. It is never modified; the site only reads it.

- **Playback:** the browser's built-in `<audio>` element, imported by Vite as a file URL (`import songUrl from '/soundtrack/original/Level Up.mp3?url'`). No audio library is needed.
- **Timeline:** `soundtrack/level-up-timeline.json` lists every lyric line in order with its section and who it refers to: a member slug, `"group"`, or `null` for no highlight (a neutral state).
- **Identity events:** consecutive lines with the same section and who form one event. Only an event's first line has a `start`; its other lines have `"start": null`. The highlight lasts until the next event starts. On load, events are merged into single cues (captions joined).
- **How it is made:** tap along in `#/calibrate` (line by line). Its export before every line is tapped is a backup, `level-up-timeline.partial.json`, which the site never plays. `npm run build:timeline` turns the backup into events: each event starts at the earliest time tapped inside it; an untapped first event starts at 0. No times are made up. `npm run check:timeline` verifies the result.

```ts
interface Cue {
  start: number | null;             // seconds into the song; null = part of the previous line's event
  section: string;                  // e.g. "VERSE 1", "CHORUS"
  who: string | 'group' | null;     // member slug, whole group, or no highlight
  line: string;                     // lyric as sung, for captions
}
```

- **Sync loop:** while playing, `requestAnimationFrame` reads `audio.currentTime`, finds the current cue, and tells the active view who to highlight. Only a change of cue triggers a visual update.
- **Validation:** in development, every `who` slug is checked against the loaded profiles, so a typo in the cue map shows a warning instead of a silent failure.

---

## 4. Proposed file structure

```
sounds-icstars/
├── index.html                 # single page; the shell lives here
├── package.json               # scripts: dev, build, preview
├── tsconfig.json
├── docs/                      # design and architecture documentation
├── member/                    # 16 profiles (published)
├── soundtrack/                # published; *.partial.json stays local
│   ├── original/              # Level Up.mp3 + original lyrics (never modified)
│   ├── level-up-timeline.json         # identity events (production)
│   └── level-up-timeline.partial.json # line-by-line calibration backup
├── Visual/                    # visual reference images (local only, not in Git)
└── src/
    ├── main.ts                # start-up: load members, build shell, start router
    ├── router.ts              # hash URLs → which view to show
    ├── shell.ts               # status bar + transport bar
    ├── data/
    │   ├── members.ts         # reads member/*.md via import.meta.glob
    │   └── parse-profile.ts   # Markdown template → Member object
    ├── views/
    │   ├── constellation.ts   # System A
    │   ├── human-os.ts        # System B
    │   └── blueprint.ts       # System C
    ├── audio.ts               # LEVEL UP playback + cue sync → "who is mentioned now"
    ├── motion.ts              # transitions, reduced-motion handling
    └── styles/
        ├── tokens.css         # colors, type, spacing, themes
        └── main.css           # grid, shell, panels, views
```

No `vite.config.ts` is needed initially; Vite's defaults are sufficient. Files are only split further when one becomes hard to read.

### How the pieces fit

```
member/*.md ──▶ members.ts ──▶ parse-profile.ts ──▶ Member[]
                                                      │
URL (#/m/slug) ──▶ router.ts ──▶ picks a view ◀───────┘
                                    │
               constellation.ts / human-os.ts / blueprint.ts ◀── highlight(who)
                                    │                              │
                         motion.ts animates the change    audio.ts (Level Up.mp3 + cue map)
```

Each view is a module exporting two functions: `render(stage, members, current)` and `destroy()`. The router calls `destroy()` on the old view and `render()` on the new one. That one convention is the whole architecture.

---

## 5. Native browser APIs used

| API | Used for |
|---|---|
| `hashchange` / `location.hash` | Routing and shareable URLs |
| SVG DOM | Ring, connections, blueprint drawing |
| Web Animations API (`element.animate`) | Zoom transitions, panel boot sequence |
| View Transitions API | Smooth view-to-view morphing where supported; instant change elsewhere (progressive enhancement) |
| `matchMedia('(prefers-reduced-motion: reduce)')` | Disabling or reducing motion |
| `matchMedia('(prefers-color-scheme: dark)')` | Default theme |
| CSS custom properties | Design tokens and themes |
| CSS Grid, container queries, trig functions (`sin()`, `cos()`) | Swiss grid, responsive panels, placing ring nodes in CSS |
| `ResizeObserver` | Redrawing SVG when the stage changes size |
| `aria-live` regions, focus management | Screen-reader announcements on view change |
| `<audio>` / `HTMLAudioElement` | Playing LEVEL UP, play/pause, seeking |
| `requestAnimationFrame` | Reading the song position to keep highlights in time with the lyrics |

---

## 6. Quality checks

- **Type checking:** `tsc --noEmit` as part of the build.
- **Parser test:** a small test of `parse-profile.ts` against sample text (brackets, multi-line text, pending sections, `Past/Present/Future` labels). Node's built-in test runner can do this without adding a test framework, depending on the installed Node version. Otherwise a test dependency would need approval.
- **Accessibility:** manual keyboard-only pass and screen-reader pass on every view, plus a browser accessibility audit.
- **Performance budget:** under 100 KB JavaScript gzipped, transitions at 60 fps on a mid-range laptop.

---

## 7. Browser support

Current versions of Chrome, Edge, Firefox and Safari. Features that are not supported everywhere (View Transitions) are progressive enhancements: the experience works without them.

---

## 8. Milestone 4: rendering and audio analysis (implemented)

**Why the old visualizer felt slow (measured, not assumed).** Frame rate was never the problem: it measured 60 fps with no long tasks. There were three causes:
1. On this development PC, Windows "Animation effects" is off. Chrome and Edge report that as `prefers-reduced-motion: reduce`, and the old visualizer then redrew only every 200 ms (about 5 times a second).
2. `AnalyserNode.smoothingTimeConstant = 0.8` (the browser default) smooths rises and falls equally. Measured with a tone burst: 52 ms to rise, and more than 600 ms to fall.
3. The transport and member index wrote to the DOM every frame, which forced a layout pass 60 times a second.

**What replaced it**
- **One loop** (`src/audio/player.ts`). It runs while the song plays, and keeps running only while something is still easing (after pause, seek or hover). Then it stops. `wake()` restarts it, and it cannot start a second copy of itself.
- **Analyser**: `fftSize` 2048 (about 43 ms window), smoothing 0. Each frequency bin then goes through an envelope (`follow()` in `analyser.ts`): it rises instantly and falls with a time constant of 110 ms (320 ms under reduced motion). It is frame-rate independent and every array is reused.
- **Fast path, every frame**: analyser → two Canvas 2D drawings (network and signal), plus one `transform` on the active timeline cell. The transport writes only when its display changes (at most 4 times a second).
- **Slow path, only on change**: `audioActiveMember`, `hoveredMember` and `selectedMember` live in `main.ts`. A change updates the index, the stage typography and the spotlight. No member DOM is touched per frame.
- **Cleanup**: navigation reloads the page (see the shortcut note in `main.ts`), which ends the audio context and the loop.
- **Diagnostics** now show live fps and frame-time percentiles, so you can check timing on real hardware.

Measured in headless Chrome at 1440×900 with the song playing, before → after: 60 → 60 fps (p99 17.2 → 17.4 ms), layout passes 181 → 33 per 3 s, style recalculation 113 → 3 ms per 3 s, total main-thread task time 444 → 222 ms per 3 s, while drawing more.

**Modules added**: `src/ui/canvas.ts` (canvas sizing, tokens, easing), `network.ts` (System 01), `spotlight.ts` (System 02), `visualizer.ts` rewritten (System 03), `timeline-strip.ts` (System 04).

**Profile template (2026-11-08):** `SectionKey` is now `'description' | 'personality' | 'interests' | 'strengths'`. Additional Notes was removed from the template and from every profile.

**Smoothness pass (2026-11-08), measured at Verse 1 member changes:** the first profile to appear used to cost a single 83–100 ms frame (first-time text layout plus a forced layout from `scrollTop`). Profiles are now built once and laid out off-screen while the page is idle. The name transition animates only `transform` and `opacity`, and the type band and spotlight body use `contain: strict`, so new text never re-lays out the page grid. After the fix, the worst frame at a member change was 33–35 ms in 2 of 3 cold runs.

---

## 9. Milestone 5: living interface (implemented)

**Three clocks, kept apart** (`src/ui/motion.ts`):
1. **Ambient clock** (`scene.tau`): wall-clock seconds × motion level. It drives everything autonomous: node orbits, breathing, ring rotation (one turn per 4 minutes), the GROUP wave, background geometry and drifting large type. It never reads the song position. (Milestone 4's song-driven rotation was removed.)
2. **Playback clock** (`audio.currentTime`): identity events, timeline playhead, captions.
3. **Interaction state**: hovered, selected and audio-active member (`main.ts`).

**Composition engine** (`main.ts`): one `scene` object read by every system each frame.
- `perf` eases between 0 (ambient) and 1 (performance) over about 0.7 s on play and pause, so nothing hard-cuts.
- `pulse` fires at each new member and decays.
- `#app[data-scene]`, `[data-focus]` and `[data-composition]` are set on change only, and drive shared CSS emphasis.

**Loop**: still a single `requestAnimationFrame` loop (`player.ts`). It now keeps running while paused if motion is above STILL. At STILL it stops once everything settles (verified: 0 callbacks per second).

**Per system**
- Network: deterministic sine motion per node (golden-ratio phases), a pointer attraction field, ripples on the centered member, and a large-type layer behind it.
- Ticker (`ticker.ts`): runs on the compositor via the Web Animations API with no per-frame JavaScript. Speed changes through `updatePlaybackRate`, so it never jumps.
- Signal: the ambient pattern is hollow outlines labelled synthetic and never feeds the meters or numbers. The live layer is real analyser data.
- Spotlight: per-element transitions (counting ID, rotating mark, masked letters, clipped sections). Reading or scrolling a profile that follows the audio pins it.
- Timeline: done, active and upcoming states, a gliding playhead, and hover preview without seeking.

**Controls** (`controls.ts`): AUTO/MANUAL, STATUS plus PLAY, MOTION STILL/LOW/NORMAL/HIGH, TYPE, LINKS, CLEAN, FULLSCREEN. Saved in `localStorage` under `hs060.prefs`, validated on load. The system reduced-motion setting defaults MOTION to STILL; an explicit choice overrides it.

**Measured** (headless Chrome, 1440×900, software rendering with no GPU):
- Ambient idle: 60 fps, p99 17.2 ms, 0 layouts per 3 s. A diagnostics write every paused frame was found and removed; it had caused 181 layouts per 3 s.
- Playing: 60 fps, p99 about 18 ms, no long tasks. The first member transition costs one slow frame (34–68 ms; render work, not script) and later transitions at most one dropped frame. The timeline's per-event `scrollWidth` read and a blend-mode wipe were removed after profiling.
