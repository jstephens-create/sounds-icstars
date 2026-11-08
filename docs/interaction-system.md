# Interaction System — LEVEL UP / 060

Status: **proposal**. Describes intended behavior. Nothing here has been implemented.

---

## 1. One interface, three levels

The three systems are not separate pages. They are three **levels of zoom** inside one persistent interface:

```
A / CONSTELLATION  ──select──▶  B / HUMAN OS  ──expand──▶  C / BLUEPRINT
   (the cohort)                 (one member)               (one member's structure)
        ◀────────── back / Esc ──────────◀────────── back / Esc ──────────
```

Moving between levels is a spatial transition: selecting a node zooms into it, and the node becomes the member's environment. Going back zooms out to the node's original position. The user always knows where they are because they saw how they got there.

### The shell (always present)

```
┌──────────────────────────────────────────────────────────────────────┐
│ LEVEL UP / 060      060 / 060.07 / BLUEPRINT          14:32:07  │  ← status bar
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                              STAGE                                   │  ← current system
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ ▶ LEVEL UP 01:12 │ ◀◀ PREV  ▶▶ NEXT │ A B C │ 060.07 / 16 │ GRID THEME │  ← transport bar
└──────────────────────────────────────────────────────────────────────┘
```

- **Status bar:** project identity, current path, live clock (a system readout, aria-hidden).
- **Stage:** whichever system is active.
- **Transport bar:** media-player-style controls. Play/pause and position for the LEVEL UP soundtrack (see section 7), previous/next member, system switch (A / B / C), position readout, and utilities (grid overlay, theme).

---

## 2. System A — Constellation

**Purpose:** see the whole cohort at once and choose where to go.

### Layout
- 16 nodes arranged in a ring, ordered `060.01`–`060.16` clockwise from the top. Sixteen divides evenly (22.5° apart), which gives a strict, Swiss-ordered geometry.
- The center of the ring holds the `060` mark and a readout panel for the focused node.

### Node states
| State | Visual | Readout shows |
|---|---|---|
| Rest | Small circle, identifier label | — |
| Hover / focus | Signal-color ring, name appears | Name, ID, sections complete (e.g. `3/5`) |
| Selected | Node expands and transitions into System B | — |

### Connections (*Open question: needs approval*)
Lines between nodes are a strong visual element, but they claim a relationship between people. The proposal is to only draw connections that are **literally present in members' own text**:
- A short, human-maintained list of themes (for example "security", "music", "data", "film") is matched against profile text.
- Two members are connected only if both of their profiles contain the same theme word.
- Hovering a connection shows *why* it exists (the shared word, quoted from each profile).

Without approval, the constellation ships with **no connections**, only the ring.

### Interaction
| Input | Action |
|---|---|
| Mouse hover / keyboard focus | Highlight node, update readout |
| Click / Enter / Space | Open member in System B |
| ← → (or ↑ ↓) | Move focus around the ring |
| Type a letter | Jump to the next member whose name starts with it (like an OS file list) |
| Home / End | First / last member |

### Idle behavior
A very slow drift of the ring and a kinetic `060` mark. Paused under reduced motion and whenever the user is interacting.

---

## 3. System B — Human Operating System

**Purpose:** spend time with one member's own words.

### Layout
The member's environment is a desktop of **modular panels** with early-2000s window chrome (title bar, label, control glyphs), tiled on the Swiss grid. Panels are arranged by the system, not free-floating, so the layout stays legible.

| Panel | Content | Notes |
|---|---|---|
| `DESCRIPTION` | Member's description, verbatim | Largest panel, largest type |
| `PERSONALITY` | Verbatim | Pending state if empty |
| `INTERESTS` | Verbatim | Pending state if empty |
| `STRENGTHS` | Verbatim | Pending state if empty |
| `NOTES` | Additional Notes, verbatim | Pending state if empty |
| `SYSTEM` | ID, filename, sections complete | Factual readout only |
| `BLUEPRINT` | Thumbnail of System C | Expands to full stage |

### Timeline (optional enhancement)
Many members wrote their description using their own `Past / Present / Future` labels. When those labels are literally present, the `DESCRIPTION` panel can also show a three-segment timeline strip of the member's own text, split at their labels. When they are not present, the description is shown as written, with no forced structure.

### Pending sections
A section containing `[To be completed.]` renders as:

```
┌ PERSONALITY ─────────────────────── □ ┐
│  AWAITING INPUT_                      │
└───────────────────────────────────────┘
```

The cursor blink stops under reduced motion.

### Entry animation
Panels "boot" in a short staggered sequence (outline first, then label, then content). The whole sequence completes in under ~600ms and is skipped entirely under reduced motion. Text is never revealed letter by letter, because that slows reading and confuses screen readers.

### Interaction
| Input | Action |
|---|---|
| ← → or transport PREV / NEXT | Previous / next member (wraps around) |
| Tab / Shift+Tab | Move between panels |
| 1–5 | Jump to Description, Personality, Interests, Strengths, Notes |
| B | Open Blueprint (System C) |
| Esc / back button | Return to Constellation, focus returns to this member's node |

---

## 4. System C — Identity Blueprint

**Purpose:** see the *shape* of a member's profile as a structured diagram, like a technical drawing.

### Composition
A drafting-style SVG schematic:
- **Center:** the member's name and ID.
- **Four labeled regions:** Description, Personality, Interests, Strengths.
- **Callouts:** the member's own phrases attached to their region with leader lines, like engineering annotations. Short list sections (for example "Word, word and word.") are split at commas and "and" into separate callouts. The words are never changed.
- **Description region:** shows the member's `Past / Present / Future` segments when they used those labels. Otherwise it shows the full text. The text is never summarized.
- **Title block** (bottom-right, like a drawing sheet): `LEVEL UP / 060`, member name, ID, sections complete.
- **Pending regions:** drawn as dashed outlines labeled `PENDING`.

### Interaction
| Input | Action |
|---|---|
| Hover / focus a callout | Highlight it and its source text in the matching panel |
| Esc | Return to System B |
| ← → | Previous / next member's blueprint (compare structures) |

### Accessibility note
The blueprint is a visual summary of text that is also available in System B panels. It is never the only place information appears. It gets a text alternative describing its structure (for example "Blueprint for 060.01: 4 of 5 sections complete").

---

## 5. Navigation and URLs

Every state has a shareable URL, and the browser back button works:

| URL | State |
|---|---|
| `#/` | Constellation |
| `#/m/first-last` | Human OS for that member |
| `#/m/first-last/blueprint` | Blueprint for that member |

Unknown member slugs return to the constellation with a status-bar notice (`NODE NOT FOUND`).

---

## 6. Accessibility requirements

Target: **WCAG 2.2 Level AA.** These are requirements, not aspirations.

**Keyboard**
- Every action is possible with the keyboard alone. No keyboard traps.
- Focus indicator: thick, high-contrast signal-color outline, always visible with `:focus-visible`. This also suits the brutalist style.

**Screen readers**
- Constellation nodes are real links in an ordered list (`16 members`). The SVG ring is a visual layer marked `aria-hidden`.
- On each view change, focus moves to the new view's heading and a polite live region announces the location (for example "[Member name], member 1 of 16").
- Panels use real headings (`h2`) matching section names.

**Motion**
- `prefers-reduced-motion: reduce` replaces zoom transitions with an instant or short crossfade, stops idle drift and cursor blink, and skips boot sequences.
- Nothing flashes more than three times per second.

**Visual**
- Text contrast at least 4.5:1, and UI component contrast at least 3:1, in both themes.
- Color is never the only indicator. States also change shape, outline or label.
- Layout holds at 200% text zoom and at 320px viewport width.

**Touch**
- Targets at least 44 × 44px. Hover-only information is also available on focus and tap.

---

## 7. Soundtrack — one song, synchronized

The whole site has **one soundtrack: the original LEVEL UP recording** (`soundtrack/original/Level Up.mp3`). There are no per-member songs. The song is a collective experience that moves through the members as they are mentioned.

### Behavior
- **The visitor starts it.** Play/pause lives in the transport bar. Audio never starts by itself: browsers block autoplay with sound, and WCAG requires the user to control audio.
- **Member mentions:** when a lyric line names a member, that member is highlighted. In the constellation, their node lights up and the readout shows their name and ID. When the next member is named, the highlight moves on.
- **Collective lines:** during the intro, pre-chorus, choruses, breakdown, final verse and outro, the interface shows the **whole group**, for example all 16 nodes lit and the ring pulsing on the beat of the chant.
- **Navigation stays with the visitor.** Highlights never change the view on their own. An optional **FOLLOW** toggle lets the visitor have the interface open each member as they are mentioned.
- **Inside a member's view (System B):** the status bar shows who is being mentioned now (for example `NOW: 060.05`), without leaving the current member.
- **Captions:** the current lyric line can be shown as a caption, taken from `level-up-original-lyrics.md`. This also gives deaf and hard-of-hearing visitors a text alternative to the audio.
- **Reduced motion:** highlights change color and outline only. No pulsing or movement.

### Cue map
A small, hand-made list matches moments in the song to who is mentioned:

| Start (s) | Line (from original lyrics) | Highlights |
|---|---|---|
| *to be timed* | *(a verse line naming a member)* | `first-last` |
| *to be timed* | *(a chorus line)* | group |

Timings are set by listening to the recording. No audio analysis or extra tools are needed. The cue map contains member names, so it stays local with the profiles (see `technical-architecture.md`).

### Known differences between the recording and the roster
- **A former participant:** the recording includes two lines about someone who is not part of this project. *Open question:* what the interface shows during those lines. Options include no highlight (neutral state) or the group view.
- **"Seventeen":** the recording counts seventeen members. The interface always shows 16. *Open question:* whether a caption should show the lyric as sung.
- **Names as sung:** some members are named by nickname or with a different spelling. The cue map links each mention to the correct profile.

---

## 8. Future hooks (not in scope now)

- **Comparison mode:** overlay two blueprints.
- **Free-floating panels:** draggable windows in System B, if prototypes show they add value rather than confusion.

---

## 9. Milestone 4: what was built (prototype page `#/`)

| System | What it does |
|---|---|
| **01 Collective network** | The 16-node ring, drawn on canvas. When a member is mentioned, their node moves to the center and their 15 links light up. The others stay on the ring, smaller. In GROUP the full network shows with every name, and node *i* and its links respond to frequency band *i* of 16. In NEUTRAL the ring contracts and nothing is highlighted. The ring turns once over the length of the song. Under it, a typography band shows the active name, or the first line of a GROUP event as large type. |
| **02 Member spotlight** | Shows the profile the visitor opened. When none is open, it follows the member the soundtrack mentions. Text is verbatim and pending sections read `AWAITING INPUT`. Its mark is drawn only from the member's ring position and which sections are complete. |
| **03 Signal** | 48 log-spaced bars, LOW / MID / HIGH meters, falling peak caps and the raw waveform. |
| **04 Identity timeline** | One cell per event (25). Clicking a cell seeks to its calibrated start. Member = ID, GROUP = `ALL` (solid), NEUTRAL = `—` (hatched). |

**Interaction states** stay independent:
- `audioActiveMember` is set only by the timeline.
- `hoveredMember` (pointer, or keyboard focus in the index) previews a member on the stage without touching playback.
- `selectedMember` (click, Enter or Space) opens the spotlight until Close or Esc.

The member index is the accessible version of the network: real buttons with `aria-pressed` and `aria-current`. The canvases are `aria-hidden`.

**Reduced motion**: the signal stays live every frame but falls more slowly. Rotation, bass scaling, node pulsing, the waveform, peak caps and eased transitions are switched off, and type changes crossfade.

### Decision needed: network connections
Section 2 says the constellation has **no connections** without approval. Milestone 4 asked for an interconnected network, so the prototype draws **structural links only**: every member is linked to every other member equally (the complete graph, 120 lines). It claims no specific relationship between two people. *Open question:* approve this, switch to the theme-matching proposal in section 2, or remove the links.

### Decision: profiles have four sections (2026-11-08)
Additional Notes was removed from all 16 profiles because it served no purpose. The template is now **Description, Personality, Interests, Strengths**. The `NOTES` panel and the `5` key in section 3 no longer apply. A leftover `## Additional Notes` heading in a profile produces a warning and is ignored; it is never an error.

---

## 10. Milestone 5: living interface

- **Alive before interaction**: two-row ticker (phrases moving right, member names moving left, at a steady speed whether or not the song plays), orbiting network, drifting large type and an ambient signal. All run on the ambient clock, not the song.
- **AUTO / MANUAL**: in AUTO the soundtrack directs the stage centre and the spotlight. In MANUAL only the member the visitor opens is centred and shown; the audio member is still named in the type band, and GROUP and NEUTRAL still follow the song.
- **Profiles never change under the reader**: an opened profile stays until Close or Esc. A profile that is following the audio becomes pinned as soon as the visitor scrolls, clicks or types inside it.
- **Motion levels**: STILL, LOW, NORMAL, HIGH. STILL is the default when the system asks for reduced motion. In STILL, nothing moves on its own; the live audio bars still update (they are information) but fall slowly, and state changes are instant or crossfaded. TYPE off hides the ticker and large type. Together these satisfy WCAG 2.2.2 (pause, stop, hide).

### Open question: "Seventeen" in the recording
The source lyrics and the recording say "Seventeen" in five lines, because the song was written when the cohort counted 17. The interface presents 16. Where it appears:

| Event | Line | Shown as |
|---|---|---|
| 1 INTRO | "Seventeen stories." / "Seventeen dreams." | NOW caption |
| 9 CHORUS | "Seventeen dreams and we're going so far," | NOW caption |
| 24 FINAL CHORUS | "Seventeen stories, ONE BIG STAR!" | NOW caption |
| 25 OUTRO | "Seventeen stories." | NOW caption **and large stage type** |

Nothing has been changed. **Recommendation (needs approval):**
1. **Captions stay verbatim.** They are the text alternative to the audio, so they must match what is sung.
2. **Add a small factual note to those five captions:** `AS SUNG · RECORDED WITH 17 · THIS SITE PRESENTS 16`. It is honest about the gap without naming anyone.
3. **The large stage type is a design layer, not a caption.** For the OUTRO it can set the event's next line instead, so the closing image doesn't contradict the 16-node network. The full line remains in the caption.

This is tied to the existing open question about the former participant's two lines; both should be decided together.
