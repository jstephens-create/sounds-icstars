// Roster-level rules across all parsed profiles. Pure; no member names live in code.
import { SECTIONS, type Issue, type ParsedProfile, type Sections } from './parse.ts';

export const EXPECTED_MEMBERS = 16;
export const ID_PREFIX = '060';

export interface Member {
  id: string; // "060.01" … "060.16", by alphabetical filename
  slug: string; // filename without .md, e.g. "first-last"
  name: string; // exactly as written in the "# Name" heading
  sections: Sections;
}

export interface Roster {
  members: Member[];
  issues: Issue[];
  valid: boolean; // false when any error exists
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateRoster(profiles: ParsedProfile[], expected = EXPECTED_MEMBERS): Roster {
  const issues: Issue[] = profiles.flatMap((p) => p.issues);
  const error = (slug: string | null, message: string) => issues.push({ level: 'error', slug, message });

  if (profiles.length !== expected) {
    error(null, `Expected exactly ${expected} member profiles, found ${profiles.length}.`);
  }

  const sorted = [...profiles].sort((a, b) => a.slug.localeCompare(b.slug));
  const seenSlugs = new Set<string>();
  const members: Member[] = sorted.map((p, i) => {
    if (seenSlugs.has(p.slug.toLowerCase())) error(p.slug, `Duplicate member file "${p.slug}".`);
    seenSlugs.add(p.slug.toLowerCase());
    if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(p.slug)) {
      error(p.slug, `Filename "${p.slug}.md" is not lowercase kebab-case (first-last).`);
    }
    if (p.name && slugify(p.name) !== p.slug) {
      error(p.slug, `Heading "${p.name}" does not match filename "${p.slug}.md".`);
    }

    const sections = Object.fromEntries(
      SECTIONS.map((s) => [s.key, p.sections[s.key] ?? null]),
    ) as Sections;
    const pending = SECTIONS.filter((s) => sections[s.key] === null).map((s) => s.heading);
    if (pending.length) {
      issues.push({ level: 'warning', slug: p.slug, message: `Awaiting input: ${pending.join(', ')}.` });
    }

    return {
      id: `${ID_PREFIX}.${String(i + 1).padStart(2, '0')}`,
      slug: p.slug,
      name: p.name ?? p.slug,
      sections,
    };
  });

  const ids = new Set(members.map((m) => m.id));
  if (ids.size !== members.length) error(null, 'Member IDs are not unique.');

  return { members, issues, valid: !issues.some((i) => i.level === 'error') };
}

export function completedSections(m: Member): number {
  return SECTIONS.filter((s) => m.sections[s.key] !== null).length;
}
