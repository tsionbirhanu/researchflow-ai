// 04e Attach Content: merge fetched page text into candidates and drop unreadable pages.
// Tavily path: one /extract response. SearXNG path: one downloaded page per item, in 04d2 order.
// Failed fetches (Continue On Fail) just mean we fall back to search snippets.
const MIN_CHARS = 200;
const cfg = $('02 Validate').first().json.config;
const { candidates } = $('04c Merge & Dedupe').first().json;

const extracted = new Map();
if (cfg.search.provider === 'tavily') {
  for (const x of ($input.first().json.results || [])) {
    if (x && x.url && x.raw_content) extracted.set(normalizeUrl(x.url), x.raw_content);
  }
} else {
  const urls = $('04d2 Split URLs').all();
  $input.all().forEach((item, i) => {
    const url = urls[i] && urls[i].json.url;
    const res = item.json;
    if (!url || res.error) return;
    const headers = res.headers || {};
    const type = String(headers['content-type'] || headers['Content-Type'] || '');
    if (type && !/html|text\/plain/i.test(type)) return; // PDFs, images, etc.
    const text = htmlToText(typeof res.body === 'string' ? res.body : res.data);
    if (text) extracted.set(normalizeUrl(url), text);
  });
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
