// 10a Build Fallback Request: Prompt 10 (Insufficient Sources), fast model.
const PROMPT = __PROMPT_10__;
const r = $('02 Validate').first().json;
const plan = $('03c Parse Plan').first().json;
const kept_count = Number($input.first().json.kept_count) || 0;

const request = claudeRequest(r.config, 'fast', PROMPT, {
  topic: r.topic,
  kept_count,
  search_queries: plan.search_queries.map(q => q.query).join('; '),
}, { maxTokens: 1000, effort: 'low' });

return [{ json: { request, kept_count } }];
