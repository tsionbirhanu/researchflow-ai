// 08e Build Revise Request: Prompt 06 (Report Reviser), strong model.
const PROMPT = __PROMPT_06__;
const r = $('02 Validate').first().json;
const { analyses } = $('06c Collect Analyses').first().json;
const v = $input.first().json;

const request = claudeRequest(r.config, 'strong', PROMPT, {
  draft_report: v.draft_report,
  issues_json: JSON.stringify({ issues: v.issues, contradictions_between_sources: v.contradictions_between_sources }),
  analyzed_sources_json: JSON.stringify(analyses),
  confidence_level: v.confidence_level,
  confidence_reason: v.confidence_reason,
}, { maxTokens: 16000, effort: 'medium' });

return [{ json: { request } }];
