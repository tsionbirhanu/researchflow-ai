// 07a Build Write Request: Prompt 04 (Report Writer), strong model.
const PROMPT = __PROMPT_04__;
const r = $('02 Validate').first().json;
const plan = $('03c Parse Plan').first().json;
const { analyses } = $input.first().json;

const request = claudeRequest(r.config, 'strong', PROMPT, {
  refined_topic: plan.refined_topic,
  main_question: plan.main_question,
  sub_questions: numberedList(plan.sub_questions),
  style: r.style,
  depth: r.depth,
  language: r.language,
  today: today(),
  analyzed_sources_json: JSON.stringify(analyses),
}, { maxTokens: 16000, effort: 'medium' });

return [{ json: { request } }];
