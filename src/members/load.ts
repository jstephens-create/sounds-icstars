// Reads member/*.md at build/dev time via Vite. Edits to a profile hot-reload in dev.
import { parseProfile, type ParsedProfile } from './parse.ts';

const files = import.meta.glob<string>('/member/*.md', { query: '?raw', import: 'default', eager: true });

export function loadProfiles(): ParsedProfile[] {
  return Object.entries(files).map(([path, raw]) =>
    parseProfile(path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), raw),
  );
}
