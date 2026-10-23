// 04c Merge & Dedupe: combine all search results (Tavily or SearXNG), dedupe by normalized URL.
// Failed searches (Continue On Fail) have no results array and are skipped.
const cfg = $('02 Validate').first().json.config;
const byUrl = new Map();
let failed_queries = 0;

for (const item of $input.all()) {
  const results = item.json.results;
  if (!Array.isArray(results)) { failed_queries++; continue; }
  // Tavily returns max_results already; SearXNG returns ~20-30, so keep the top ones.
  results.slice(0, cfg.results_per_query).forEach((x, rank) => {
    if (!x || !x.url || !/^https?:\/\//i.test(x.url)) return;
    const key = normalizeUrl(x.url);
    const prev = byUrl.get(key);
    const score = Number(x.score) || 1 / (rank + 1);
    if (!prev || score > prev.search_score) {
      byUrl.set(key, {
        url: x.url,
        title: x.title || '',
        published_date: x.published_date || x.publishedDate || null,
        snippet: x.content || '',
        raw_content: x.raw_content || (prev && prev.raw_content) || '',
        search_score: score,
      });
    }
  });
}

const candidates = [...byUrl.values()]
  .sort((a, b) => b.search_score - a.search_score)
  .slice(0, cfg.candidates_to_score);

return [{
  json: {
    candidates,
    // URLs that came back without page text; fetched next (Tavily /extract or direct download)
    urls_to_extract: candidates.filter(c => !c.raw_content).map(c => c.url),
    failed_queries,
  },
}];
