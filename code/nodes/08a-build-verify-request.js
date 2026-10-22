// 08a Build Verify Request: Prompt 05 (Fact-Checker), strong model.
const PROMPT = __PROMPT_05__;
const r = $('02 Validate').first().json;
const { analyses } = $('06c Collect Analyses').first().json;
const { draft_report } = $input.first().json;

const call = aiCall(r.config, 'strong', PROMPT, {
  draft_report,
  analyzed_sources_json: JSON.stringify(analyses),
}, { maxTokens: 16000, effort: 'high', temperature: 0 });

return [{ json: call }];
