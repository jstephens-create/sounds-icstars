// Parses one member profile (member/<first-last>.md). Pure: no file or DOM access.
// The Markdown stays the single source of truth; nothing here rewrites member text.

// The profile template. "Additional Notes" was removed from every profile (Nov 2026) and is no longer part of it.
export const SECTIONS = [
  { key: 'description', heading: 'Description' },
  { key: 'personality', heading: 'Personality' },
  { key: 'interests', heading: 'Interests' },
  { key: 'strengths', heading: 'Strengths' },
] as const;

export type SectionKey = (typeof SECTIONS)[number]['key'];

/** Section text exactly as written (outer [ ] removed), or null when pending/empty. */
export type Sections = Record<SectionKey, string | null>;

export interface Issue {
  level: 'error' | 'warning';
  slug: string | null;
  message: string;
}

export interface ParsedProfile {
  slug: string;
  name: string | null;
  sections: Partial<Sections>;
  issues: Issue[];
}

export const PENDING_TEXT = 'To be completed.';

export function parseProfile(slug: string, raw: string): ParsedProfile {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', slug, message });
  const warn = (message: string) => issues.push({ level: 'warning', slug, message });

  const text = raw.replace(/\r\n?/g, '\n');
  const name = text.match(/^# (.+)$/m)?.[1]?.trim() ?? null;
  if (!name) error('Missing "# Name" heading.');

  // Split into "## Heading" blocks.
  const blocks = [...text.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)].map((m) => ({
    heading: (m[1] ?? '').trim(),
    body: (m[2] ?? '').trim(),
  }));

  const sections: Partial<Sections> = {};
  const seen: string[] = [];
  for (const { heading, body } of blocks) {
    const def = SECTIONS.find((s) => s.heading === heading);
    if (!def) {
      warn(`Unexpected section "## ${heading}" (ignored).`);
      continue;
    }
    if (seen.includes(heading)) {
      error(`Duplicate section "## ${heading}".`);
      continue;
    }
    seen.push(heading);

    let value = body;
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).trim();
    } else {
      warn(`"${heading}" is not wrapped in [ ] brackets.`);
    }
    if (value === PENDING_TEXT) {
      sections[def.key] = null;
    } else if (value === '') {
      warn(`"${heading}" is empty.`);
      sections[def.key] = null;
    } else {
      sections[def.key] = value;
    }
  }

  for (const def of SECTIONS) {
    if (!seen.includes(def.heading)) error(`Missing section "## ${def.heading}".`);
  }
  const expectedOrder = SECTIONS.map((s) => s.heading).filter((h) => seen.includes(h));
  if (seen.join('|') !== expectedOrder.join('|')) {
    error(`Sections out of order. Expected: ${SECTIONS.map((s) => s.heading).join(', ')}.`);
  }

  return { slug, name, sections, issues };
}
