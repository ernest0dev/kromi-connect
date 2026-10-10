export function parseHashtags(raw: string): string[] {
  const seen = new Map<string, string>();
  for (const candidate of raw.split(/[\s,]+/)) {
    const value = candidate.trim().replace(/^#+/, '');
    if (!value) continue;
    const hashtag = `#${value}`;
    const key = hashtag.toLocaleLowerCase('es');
    if (!seen.has(key)) seen.set(key, hashtag);
  }
  return [...seen.values()];
}

export function normalizeHashtagArray(values: string[] | null | undefined): string[] {
  return parseHashtags((values || []).join(' '));
}
