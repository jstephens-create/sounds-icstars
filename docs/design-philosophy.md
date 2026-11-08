# Design Philosophy — LEVEL UP / 060

Status: **proposal**. Nothing in this document has been implemented. Items marked *Open question* need a decision before they are built.

---

## 1. Concept

LEVEL UP / 060 treats each member of i.c.stars Cycle 60 as a *system*: a set of inputs (past experience), current state (present), and intended outputs (future direction). The cohort is treated as a *network* of these systems.

The interface is built on one central idea:

> **A cold frame around warm content.**

The frame (the grid, labels, readouts and diagrams) is precise, technical and impersonal. The content (each member's own words) is personal and is shown exactly as written. The frame exists to give those words structure and weight. It never replaces them.

"060" refers to Cycle 60 and is used as a system prefix throughout (for example, member identifiers `060.01` to `060.16`).

The cohort is also *heard* together. The site has one soundtrack, the original LEVEL UP song. As it plays, the interface follows the lyrics: individuals light up when they are named, and the whole system comes alive in the chorus. Individual identity within a collective narrative, expressed through sound and motion.

---

## 2. Influences, and what we take from each

| Influence | What we take | What we leave behind |
|---|---|---|
| **Swiss International Typographic Style** | Strict grid, flush-left ragged-right text, sans-serif type, hierarchy through scale and position rather than decoration | Print-specific conventions that fight the screen |
| **Digital brutalism / industrial minimalism** | Visible structure: hairline borders, raw labels, coordinates, identifiers, honest default controls | Deliberate illegibility, hostility toward the user |
| **Y2K experimental interfaces** | Instrument-like controls, chrome and bevel accents, LCD readouts, "skinned" panels | Glossy excess, novelty for its own sake |
| **Early-2000s media players and operating systems** | Transport controls (previous / next), windowed panels with title bars, status bars, visualizer regions | Literal copies of any real product's UI, logos or skins |
| **Generative art / information visualization** | Form derived from data; diagrams that explain | Random decoration that *looks* meaningful but encodes nothing |
| **Kinetic typography / spatial navigation** | Motion that shows where you are and where you came from | Motion that delays reading |
| **Systems thinking / human-centered interaction** | People as interconnected systems; the user as an explorer, not a consumer | Reducing people to metrics or scores |

---

## 3. Principles

1. **Structure is the aesthetic.** The grid, alignment and hierarchy do the visual work. If something needs a shadow or gradient to stand out, the layout is wrong.

2. **Show the machinery.** Labels, identifiers, section names and states are visible, not hidden. A section is called `PERSONALITY`, not decorated into anonymity.

3. **The interface is an instrument.** Controls behave like hardware: previous/next, mode switches, readouts. They are navigation tools, not costume.

4. **Data drives form, and only real data.** Visual variation must come from what is actually in a member's profile: which sections are filled, how the member structured their own text, and the literal words they used. Visuals must never imply a trait, ranking or relationship that the member did not write.
   - Allowed: "3 of 5 sections complete", a timeline drawn from a member's own `Past / Present / Future` labels.
   - Not allowed: mapping text length to "intensity", inventing connections, scoring people.
   - A stable per-member seed (derived from the filename) may vary purely ornamental details, so each member's view looks distinct. Where this happens, it is documented as ornament, not meaning.

5. **Motion explains.** Every animation answers a question: *Where did this come from? Where am I now? What changed?* Motion that does not answer one of these is removed. All motion respects the user's reduced-motion setting.

6. **Their words, verbatim.** Member text is displayed exactly as written, including the member's own phrasing, capitalization and structure. The system does not summarize, rewrite or "improve" anyone's description. Member text is the largest, most readable type on any screen it appears on.

7. **Empty is honest.** An unfinished section (`[To be completed.]`) is shown as a visible pending slot, labeled `AWAITING INPUT`. It is not hidden and not filled with placeholder prose.

8. **Function and experiment coexist.** Every experimental element must still be usable: readable, keyboard-accessible and understandable on first contact. Experimentation happens in form and motion, never at the cost of access.

---

## 4. Visual language (initial direction)

These are starting points to be tested in prototypes, not final decisions.

### Grid
- 12-column grid, 8px base unit.
- Optional visible grid overlay (toggle) that exposes the underlying structure, in keeping with Principle 2.

### Typography
- **Primary:** a neo-grotesk sans-serif in the Swiss tradition. Start with a system font stack (`"Helvetica Neue", Helvetica, Arial, sans-serif`) so no font files are needed.
- **System / data:** a monospace face for labels, identifiers and readouts (`ui-monospace, "Cascadia Mono", Consolas, monospace`).
- Hierarchy through size, weight and position. Uppercase monospace for system labels, sentence-case sans for member text.
- *Open question:* self-host an open-licensed typeface later. That would add font files to the repository and needs approval.

### Color
- Near-black and off-white neutral base, defined as design tokens with light and dark themes.
- **One signal color** for focus, selection and active state (direction: international orange).
- **One Y2K accent** used sparingly for chrome, bevels and LCD readouts (direction: cool silver plus a phosphor-style readout tint).
- Color is never the only carrier of meaning (see accessibility requirements in `interaction-system.md`).

### Form
- Geometric primitives only: circles (nodes), lines (connections, leader lines), rectangles (panels).
- Hairline (1px) rules as the default structural element.
- Panel chrome (title bars, window controls) references early-2000s operating systems in spirit, built from the same primitives. It is not a copy of any real product.

### Nomenclature
- Members: `060.01`–`060.16`, numbered in alphabetical order of profile filename.
- Systems: `A / CONSTELLATION`, `B / HUMAN OS`, `C / BLUEPRINT`.
- Location shown as a path, for example `060 / 060.07 / BLUEPRINT`.

---

## 5. What this project is not

- Not a grid of profile cards.
- Not a dashboard of metrics about people.
- Not a parody or recreation of a specific historical operating system or media player.
- Not a showcase of effects. A heavy 3D or WebGL layer is out of scope unless a prototype proves it serves the content.
- **No photographs, likenesses or voices** until each member has given permission (project rule).

---

## 6. Visual references

A `references/` folder of experimental interface images is planned. **No reference images have been reviewed yet.** When they are added:

1. Each image is noted in this document with what to take from it (for example "panel title-bar proportions", "readout typography") and what to avoid.
2. References inform principles and details. They are not reproduced directly.
3. *Open question:* whether `references/` should be committed. Screenshots of third-party work may not be ours to republish publicly, so keeping the folder local may be the safer default.
