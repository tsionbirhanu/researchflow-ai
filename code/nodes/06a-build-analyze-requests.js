// 06a Build Analyze Requests: Prompt 03 (Source Analyzer), one fast-model call per kept source.
const PROMPT = __PROMPT_03__;
const r = $('02 Validate').first().json;
const plan = $('03c Parse Plan').first().json;
const { kept } = $input.first().json;

return kept.map((s, i) => ({
  json: {
    url: s.url,
    request: claudeRequest(r.config, 'fast', PROMPT, {
      main_question: plan.main_question,
      sub_questions: numberedList(plan.sub_questions),
      source_id: i + 1,
      url: s.url,
      title: s.title,
      content: s.content.slice(0, r.config.content_chars),
    }, { maxTokens: 3000, effort: 'low' }),
  },
}));
