// 05a Build Score Requests: Prompt 02 (Source Scorer), one fast-model call per candidate.
const PROMPT = __PROMPT_02__;
const r = $('02 Validate').first().json;
const plan = $('03c Parse Plan').first().json;
const { candidates } = $input.first().json;

return candidates.map(c => ({
  json: {
    url: c.url,
    request: claudeRequest(r.config, 'fast', PROMPT, {
      main_question: plan.main_question,
      refined_topic: plan.refined_topic,
      url: c.url,
      title: c.title,
      published_date: c.published_date || 'unknown',
      today: today(),
      max_age_years: r.max_age_years,
      content_excerpt: c.content.slice(0, r.config.excerpt_chars),
    }, { maxTokens: 800, effort: 'low' }),
  },
}));
