// 04e Attach Content: merge extracted page text into candidates and drop unreadable pages.
// A failed /extract call (Continue On Fail) just means we fall back to search snippets.
const MIN_CHARS = 200;
const { candidates } = $('04c Merge & Dedupe').first().json;

const extracted = new Map();
for (const x of ($input.first().json.results || [])) {
  if (x && x.url && x.raw_content) extracted.set(normalizeUrl(x.url), x.raw_content);
}

const readable = candidates
  .map(c => {
    const content = (c.raw_content || extracted.get(normalizeUrl(c.url)) || c.snippet || '').trim();
    const { raw_content, ...rest } = c;
    return { ...rest, content };
  })
  .filter(c => c.content.length >= MIN_CHARS); // paywalls, broken pages, empty extracts

return [{
  json: {
    candidates: readable,
    candidate_count: readable.length,
    skipped_count: candidates.length - readable.length,
    has_candidates: readable.length > 0,
    kept_count: 0,
  },
}];
