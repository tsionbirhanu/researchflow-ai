// 04a Split Queries: one item per search query, each carrying its Tavily request body.
const cfg = $('02 Validate').first().json.config;
const plan = $input.first().json;

return plan.search_queries.map(q => ({
  json: {
    query: q.query,
    purpose: q.purpose || '',
    body: {
      query: q.query,
      search_depth: 'advanced',
      max_results: cfg.results_per_query,
      include_raw_content: true,
    },
  },
}));
