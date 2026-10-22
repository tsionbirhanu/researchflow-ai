// 03a Build Plan Request: Prompt 01 (Research Planner), fast model.
const PROMPT = __PROMPT_01__;
const r = $('02 Validate').first().json;

const request = claudeRequest(r.config, 'fast', PROMPT, {
  topic: r.topic,
  question: r.question,
  depth: r.depth,
  style: r.style,
  max_age_years: r.max_age_years,
}, { maxTokens: 2000, effort: 'low' });

return [{ json: { request } }];
