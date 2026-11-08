// Soundtrack sources, bundled at build time. Any may be missing (the app shows a clear state instead).
const songs = import.meta.glob<string>('/soundtrack/original/*.mp3', { query: '?url', import: 'default', eager: true });
const lyrics = import.meta.glob<string>('/soundtrack/original/level-up-original-lyrics.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const timelines = import.meta.glob<unknown>('/soundtrack/level-up-timeline.json', { import: 'default', eager: true });

const songEntry = Object.entries(songs)[0];
export const song = songEntry ? { url: songEntry[1], name: songEntry[0].slice(songEntry[0].lastIndexOf('/') + 1) } : null;
export const lyricsRaw: string | null = Object.values(lyrics)[0] ?? null;
export const timelineData: unknown = Object.values(timelines)[0] ?? null;
export const TIMELINE_PATH = 'soundtrack/level-up-timeline.json';

// Partial calibration backup exported before every line is tapped. Only the calibrator reads it.
const backups = import.meta.glob<unknown>('/soundtrack/level-up-timeline.partial.json', { import: 'default', eager: true });
export const backupData: unknown = Object.values(backups)[0] ?? null;
