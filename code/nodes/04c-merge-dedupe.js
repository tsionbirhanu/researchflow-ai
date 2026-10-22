// 04c Merge & Dedupe: combine all search results, dedupe by normalized URL.
// Failed searches (Continue On Fail) have no results array and are skipped.
const cfg = $('02 Validate').first().json.config;
const byUrl = new Map();
let failed_queries = 0;

for (const item of $input.all()) {
  const results = item.json.results;
  if (!Array.isArray(results)) { failed_queries++; continue; }
  for (const x of results) {
    if (!x || !x.url) continue;
    const key = normalizeUrl(x.url);
    const prev = byUrl.get(key);
    const score = Number(x.score) || 0;
    if (!prev || score > prev.search_score) {
      byUrl.set(key, {
        url: x.url,
        title: x.title || '',
        published_date: x.published_date || null,
        snippet: x.content || '',
        raw_content: x.raw_content || (prev && prev.raw_content) || '',
        search_score: score,
      });
    }
  }
}

const candidates = [...byUrl.values()]
  .sort((a, b) => b.search_score - a.search_score)
  .slice(0, cfg.candidates_to_score);

return [{
  json: {
    candidates,
    // URLs Tavily returned without page text; 04d fetches them with /extract
    urls_to_extract: candidates.filter(c => !c.raw_content).map(c => c.url),
    failed_queries,
  },
}];
