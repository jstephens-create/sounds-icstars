// Test fixture: a profile in the member/ template format, for invented placeholder people only.
export function profile(name: string, overrides: Record<string, string> = {}): string {
  const body = (h: string, fallback: string) => `## ${h}\n[${overrides[h] ?? fallback}]\n`;
  return [
    `# ${name}\n`,
    body('Description', 'Past: example. Present: example.\nFuture: example.'),
    body('Personality', 'To be completed.'),
    body('Interests', 'Example interest.'),
    body('Strengths', 'To be completed.'),
  ].join('\n');
}
