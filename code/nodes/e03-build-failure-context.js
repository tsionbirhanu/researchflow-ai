// E03 Build Failure Context: recover the run's form data from the failed execution
// and prepare Prompt 09 (Failure Email).
const PROMPT = __PROMPT_09__;

// ---- Keep in sync with CONFIG in 02 Validate ----
const CONFIG = {
  models: { fast: 'claude-haiku-5-5', strong: 'claude-sonnet-5-5' },
  sheet_id: 'PASTE_YOUR_GOOGLE_SHEET_ID',
  sheet_tab: 'runs',
};

const err = $('E01 Error Trigger').first().json;
const exec = $input.first().json; // n8n API execution (empty or error if the lookup failed)
const runData = (exec && exec.data && exec.data.resultData && exec.data.resultData.runData) || {};
const firstJson = name => {
  try { return runData[name][0].data.main[0][0].json || {}; } catch (e) { return {}; }
};
const run = firstJson('02 Validate');
const form = firstJson('01 Form');

const failedNode = (err.execution && err.execution.lastNodeExecuted) || (err.trigger && err.trigger.node && err.trigger.node.name) || 'unknown';
const message = (err.execution && err.execution.error && err.execution.error.message) || (err.trigger && err.trigger.error && err.trigger.error.message) || 'Unknown error';

const STAGES = {
  '01': ['Intake', 'the request could not be read'],
  '02': ['Intake', 'some of the form details were missing or invalid'],
  '03': ['Planning', 'the research plan could not be created'],
  '04': ['Search', 'the web search did not return usable results'],
  '05': ['Source scoring', 'the sources could not be evaluated'],
  '06': ['Analysis', 'too few sources could be read and analyzed'],
  '07': ['Writing', 'the report could not be written'],
  '08': ['Fact-checking', 'the report could not be checked'],
  '09': ['Delivery', 'the finished report could not be prepared or sent'],
  '10': ['Fallback email', 'the follow-up email could not be sent'],
};
const [failed_stage, friendly_reason] = STAGES[failedNode.slice(0, 2)] || ['Processing', 'an unexpected problem occurred'];

const topic = run.topic || form.Topic || '(unknown topic)';
const email = run.email || String(form.Email || '').trim().toLowerCase();

return [{
  json: {
    run_id: run.run_id || `exec_${(err.execution && err.execution.id) || Date.now()}`,
    started_at: run.started_at || '',
    topic,
    email,
    has_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    depth: run.depth || '',
    style: run.style || '',
    num_sources: run.num_sources || '',
    failed_node: failedNode,
    failed_stage,
    error_message: `${failedNode}: ${message}`.slice(0, 500),
    config: CONFIG,
    request: claudeRequest(CONFIG, 'fast', PROMPT, { topic, failed_stage, friendly_reason }, { maxTokens: 1000, effort: 'low' }),
  },
}];
