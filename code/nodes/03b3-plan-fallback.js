// 03b3 Plan Fallback Request: the planner call failed (often HTTP 503 "model overloaded" on
// free tiers), so resend the same request on the fallback model, which has its own capacity.
const llm = $('02 Validate').first().json.config.llm;
const { request, request_url, request_headers } = $('03a Build Plan Request').first().json;
return [{ json: { request: { ...request, model: llm.models.fallback || llm.models.fast }, request_url, request_headers } }];
