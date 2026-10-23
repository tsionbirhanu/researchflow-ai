#!/usr/bin/env node
// Builds the importable n8n workflows from the sources in this repo:
//   prompts/*.md        -> prompt text injected as __PROMPT_NN__
//   templates/*.html    -> injected as __TEMPLATE_<NAME>__
//   code/lib/helpers.js -> prepended to every Code node
//   code/nodes/*.js     -> Code node bodies
// Output: workflows/research-pipeline.json and workflows/error-handler.json
// Usage: node scripts/build-workflow.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const SHEET_COLUMNS = [
  'run_id', 'timestamp', 'email', 'topic', 'depth', 'style', 'num_sources_requested',
  'sources_used', 'confidence', 'verdict', 'status', 'duration_sec', 'error_message',
];

// ---------- sources ----------

function loadPrompts() {
  const prompts = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'prompts'))) {
    const m = f.match(/^(\d\d[a-z]?)-.*\.md$/);
    if (!m) continue;
    const md = read(`prompts/${f}`);
    const block = heading => {
      const b = md.match(new RegExp(`## ${heading}\\s*\\n+\`\`\`\\n([\\s\\S]*?)\\n\`\`\``));
      return b ? b[1] : null;
    };
    const user = block('User');
    if (!user) throw new Error(`prompts/${f}: no "## User" code block`);
    prompts[m[1]] = { system: block('System'), user };
  }
  return prompts;
}

const PROMPTS = loadPrompts();
const HELPERS = read('code/lib/helpers.js');
const TEMPLATES = { REPORT: read('templates/report.html') };

function codeFor(file) {
  let body = read(`code/nodes/${file}`);
  body = body.replace(/__PROMPT_(\d\d[a-z]?)__/g, (m, n) => {
    if (!PROMPTS[n]) throw new Error(`${file}: unknown prompt ${n}`);
    return JSON.stringify(PROMPTS[n]);
  });
  body = body.replace(/__TEMPLATE_([A-Z]+)__/g, (m, n) => {
    if (!TEMPLATES[n]) throw new Error(`${file}: unknown template ${n}`);
    return JSON.stringify(TEMPLATES[n]);
  });
  if (/__(PROMPT|TEMPLATE)_/.test(body)) throw new Error(`${file}: unresolved placeholder`);
  return `${HELPERS}\n${body}`;
}

// ---------- node factories ----------

// Stable ids so rebuilding produces a clean diff.
const uuid = seed => {
  const h = crypto.createHash('md5').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { parameters, id: uuid(name), name, type, typeVersion, position, ...extra };
}

const RETRY = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const CONTINUE = { onError: 'continueRegularOutput' };

const code = (name, pos, file, extra = {}) =>
  node(name, 'n8n-nodes-base.code', 2, pos, { jsCode: codeFor(file) }, extra);

// LLM call. URL, headers and body come from the item built by aiCall() in code/lib/helpers.js,
// so switching provider (Gemini, Groq, Claude) is a CONFIG change, not a workflow change.
// Per-item calls run one at a time, 12 s apart, to stay under free-tier per-minute limits.
function ai(name, pos, { strong = false, perItem = false } = {}) {
  const options = { timeout: strong ? 300000 : 120000 };
  if (perItem) options.batching = { batch: { batchSize: 1, batchInterval: 12000 } };
  return node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'POST',
    url: '={{ $json.request_url }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendHeaders: true,
    specifyHeaders: 'json',
    jsonHeaders: '={{ JSON.stringify($json.request_headers || {}) }}',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.request) }}',
    options,
  }, {
    ...RETRY,
    ...(perItem ? CONTINUE : {}),
    notes: 'Credential: Header Auth "LLM API". Gemini/Groq: Authorization = Bearer <key>. Claude: x-api-key = <key>.',
  });
}

function tavily(name, pos, endpoint, jsonBody, extra = {}) {
  return node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'POST',
    url: `https://api.tavily.com/${endpoint}`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody,
    options: { timeout: 90000, ...(extra.options || {}) },
  }, { ...RETRY, ...CONTINUE, notes: 'Credential: Header Auth "Tavily API" (Authorization: Bearer tvly-...)' });
}

function ifTrue(name, pos, expression) {
  return node(name, 'n8n-nodes-base.if', 2.2, pos, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{
        id: uuid(`${name}-cond`),
        leftValue: expression,
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });
}

function gmail(name, pos, { to, subject, message, attachPdf = false, continueOnFail = false }) {
  const options = { appendAttribution: false };
  if (attachPdf) options.attachmentsUi = { attachmentsBinary: [{ property: 'pdf' }] };
  return node(name, 'n8n-nodes-base.gmail', 2.1, pos, {
    sendTo: to, subject, emailType: 'html', message, options,
  }, { ...RETRY, ...(continueOnFail ? CONTINUE : {}), webhookId: uuid(`${name}-webhook`) });
}

function sheet(name, pos, operation, cfgExpr, values, { continueOnFail = true } = {}) {
  const columns = {
    mappingMode: 'defineBelow',
    value: values,
    schema: SHEET_COLUMNS.map(id => ({
      id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true,
    })),
  };
  if (operation === 'appendOrUpdate') columns.matchingColumns = ['run_id'];
  return node(name, 'n8n-nodes-base.googleSheets', 4.5, pos, {
    operation,
    documentId: { __rl: true, value: `={{ ${cfgExpr}.sheet_id }}`, mode: 'id' },
    sheetName: { __rl: true, value: `={{ ${cfgExpr}.sheet_tab }}`, mode: 'name' },
    columns,
    options: {},
  }, { ...RETRY, ...(continueOnFail ? CONTINUE : {}) });
}

function sticky(name, pos, width, height, content, color = 7) {
  return node(name, 'n8n-nodes-base.stickyNote', 1, pos, { content, width, height, color });
}

// ---------- main workflow ----------

function buildMain() {
  const V = "$('02 Validate').first().json";
  const R = "$('09a Prepare Report').first().json";
  const X = x => x * 240;
  const Y = 300;

  const nodes = [
    sticky('Stage 1: Intake', [-120, 120], 1080, 400, '## 1. Intake\nForm → validate → confirmation email → log `started`.\nEdit **CONFIG** in `02 Validate` after importing.'),
    sticky('Stage 2: Plan', [X(4) - 120, 120], 720, 400, '## 2. Plan\nPrompt 01: sub-questions + search queries (fast model).', 5),
    sticky('Stage 3: Search', [X(7) - 120, 80], 2160, 480, '## 3. Search\nSearXNG (free, self-hosted) or Tavily per query → merge + dedupe by URL → fetch page text.\nBroken or paywalled pages are dropped, not fatal. Provider: `CONFIG.search.provider`.', 4),
    sticky('Stage 4: Score', [X(16) - 120, 120], 960, 400, '## 4. Score\nPrompt 02b, 5 sources per call (fast) → keep the top N. Fewer than 2 → fallback email.', 6),
    sticky('Stage 4b: Insufficient sources', [X(20) - 120, 520], 1200, 300, '## Insufficient sources\nPrompt 10 email → log `insufficient_sources`.', 3),
    sticky('Stage 5: Analyze', [X(20) - 120, 120], 720, 400, '## 5. Analyze\nPrompt 03 per source (fast). Failed sources are skipped.', 5),
    sticky('Stage 6: Synthesize', [X(23) - 120, 120], 720, 400, '## 6. Synthesize\nPrompt 04: cited Markdown report (strong model).', 4),
    sticky('Stage 7: Verify', [X(26) - 120, -80], 1680, 600, '## 7. Verify\nPrompt 05 fact-check (strong). Issues → Prompt 06 revision.', 6),
    sticky('Stage 8: Deliver', [X(33) - 120, 120], 2160, 520, '## 8. Deliver\nSources list rebuilt from real URLs → HTML → PDF (Gotenberg) → Gmail → log `completed`.\nIf the PDF fails, the email goes out without it.', 4),

    node('01 Form', 'n8n-nodes-base.formTrigger', 2.2, [X(0), Y], {
      formTitle: 'AI Research Pipeline',
      formDescription: 'Request a cited, fact-checked research report. It arrives by email with a PDF attached.',
      formFields: {
        values: [
          { fieldLabel: 'Topic', placeholder: 'e.g. Impact of remote work on productivity', requiredField: true },
          { fieldLabel: 'Specific question', fieldType: 'textarea', placeholder: 'Optional' },
          { fieldLabel: 'Number of sources', fieldType: 'dropdown', requiredField: true,
            fieldOptions: { values: ['3', '5', '8', '10'].map(option => ({ option })) } },
          { fieldLabel: 'Depth', fieldType: 'dropdown', requiredField: true,
            fieldOptions: { values: ['Quick', 'Standard', 'Deep'].map(option => ({ option })) } },
          { fieldLabel: 'Style', fieldType: 'dropdown', requiredField: true,
            fieldOptions: { values: ['Student', 'Business', 'Technical'].map(option => ({ option })) } },
          { fieldLabel: 'Language', fieldType: 'dropdown',
            fieldOptions: { values: ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Chinese'].map(option => ({ option })) } },
          { fieldLabel: 'Max source age (years)', fieldType: 'number', placeholder: 'Optional, e.g. 3' },
          { fieldLabel: 'Email', fieldType: 'email', placeholder: 'you@example.com', requiredField: true },
        ],
      },
      options: {},
    }, { webhookId: uuid('01 Form-webhook') }),
    code('02 Validate', [X(1), Y], '02-validate.js'),
    gmail('02a Send Confirmation', [X(2), Y], {
      to: `={{ ${V}.email }}`,
      subject: `={{ ${V}.confirmation.subject }}`,
      message: `={{ ${V}.confirmation.body_html }}`,
      continueOnFail: true,
    }),
    sheet('02b Log Started', [X(3), Y], 'append', `${V}.config`, {
      run_id: `={{ ${V}.run_id }}`,
      timestamp: `={{ ${V}.started_at }}`,
      email: `={{ ${V}.email }}`,
      topic: `={{ ${V}.topic }}`,
      depth: `={{ ${V}.depth }}`,
      style: `={{ ${V}.style }}`,
      num_sources_requested: `={{ ${V}.num_sources }}`,
      status: 'started',
    }),

    code('03a Build Plan Request', [X(4), Y], '03a-build-plan.js'),
    ai('03b AI: Plan', [X(5), Y]),
    code('03c Parse Plan', [X(6), Y], '03c-parse-plan.js'),

    code('04a Split Queries', [X(7), Y], '04a-split-queries.js'),
    ifTrue('04a2 Use Tavily?', [X(8), Y], `={{ ${V}.config.search.provider === 'tavily' }}`),
    tavily('04b Tavily Search', [X(9), Y - 120], 'search', '={{ JSON.stringify($json.body) }}',
      { options: { batching: { batch: { batchSize: 2, batchInterval: 500 } } } }),
    node('04b2 SearXNG Search', 'n8n-nodes-base.httpRequest', 4.2, [X(9), Y + 120], {
      method: 'GET',
      url: `={{ ${V}.config.search.searxng_url }}`,
      sendQuery: true,
      queryParameters: { parameters: [{ name: 'q', value: '={{ $json.query }}' }, { name: 'format', value: 'json' }] },
      options: { timeout: 30000, batching: { batch: { batchSize: 1, batchInterval: 1000 } } },
    }, { ...RETRY, ...CONTINUE, notes: 'Free self-hosted search from docker-compose.yml. No credential needed.' }),
    code('04c Merge & Dedupe', [X(10), Y], '04c-merge-dedupe.js'),
    ifTrue('04c2 Use Tavily?', [X(11), Y], `={{ ${V}.config.search.provider === 'tavily' }}`),
    tavily('04d Tavily Extract', [X(12), Y - 120], 'extract', '={{ JSON.stringify({ urls: $json.urls_to_extract }) }}'),
    code('04d2 Split URLs', [X(12), Y + 120], '04d2-split-urls.js'),
    node('04d3 Fetch Pages', 'n8n-nodes-base.httpRequest', 4.2, [X(13), Y + 120], {
      method: 'GET',
      url: '={{ $json.url }}',
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' },
        { name: 'Accept', value: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
      ] },
      options: {
        timeout: 20000,
        allowUnauthorizedCerts: true,
        batching: { batch: { batchSize: 4, batchInterval: 500 } },
        response: { response: { fullResponse: true, responseFormat: 'text' } },
      },
    }, { retryOnFail: true, maxTries: 2, waitBetweenTries: 2000, ...CONTINUE, notes: 'Downloads each page; failures (paywalls, 403s, timeouts) are skipped.' }),
    code('04e Attach Content', [X(14), Y], '04e-attach-content.js'),
    ifTrue('04f Any Sources?', [X(15), Y], '={{ $json.has_candidates }}'),

    code('05a Build Score Requests', [X(16), Y], '05a-build-score-requests.js'),
    ai('05b AI: Score', [X(17), Y], { perItem: true }),
    code('05c Select Top Sources', [X(18), Y], '05c-select-top-sources.js'),
    ifTrue('05d Enough Sources?', [X(19), Y], '={{ $json.enough }}'),

    code('10a Build Fallback Request', [X(20), Y + 340], '10a-build-fallback-request.js'),
    ai('10b AI: Fallback Email', [X(21), Y + 340], { perItem: true }),
    code('10c Parse Fallback Email', [X(22), Y + 340], '10c-parse-fallback-email.js'),
    gmail('10d Send Fallback Email', [X(23), Y + 340], {
      to: `={{ ${V}.email }}`, subject: '={{ $json.subject }}', message: '={{ $json.body_html }}',
    }),
    sheet('10e Log Insufficient', [X(24), Y + 340], 'appendOrUpdate', `${V}.config`, {
      run_id: `={{ ${V}.run_id }}`,
      timestamp: `={{ ${V}.started_at }}`,
      email: `={{ ${V}.email }}`,
      topic: `={{ ${V}.topic }}`,
      depth: `={{ ${V}.depth }}`,
      style: `={{ ${V}.style }}`,
      num_sources_requested: `={{ ${V}.num_sources }}`,
      sources_used: "={{ $('10c Parse Fallback Email').first().json.kept_count }}",
      status: 'insufficient_sources',
      duration_sec: `={{ Math.round((Date.now() - new Date(${V}.started_at).getTime()) / 1000) }}`,
    }),

    code('06a Build Analyze Requests', [X(20), Y], '06a-build-analyze-requests.js'),
    ai('06b AI: Analyze', [X(21), Y], { perItem: true }),
    code('06c Collect Analyses', [X(22), Y], '06c-collect-analyses.js'),

    code('07a Build Write Request', [X(23), Y], '07a-build-write-request.js'),
    ai('07b AI: Write Report', [X(24), Y], { strong: true }),
    code('07c Extract Draft', [X(25), Y], '07c-extract-draft.js'),

    code('08a Build Verify Request', [X(26), Y], '08a-build-verify-request.js'),
    ai('08b AI: Fact-Check', [X(27), Y], { strong: true, perItem: true }),
    code('08c Parse Verification', [X(28), Y], '08c-parse-verification.js'),
    ifTrue('08d Needs Revision?', [X(29), Y], '={{ $json.needs_revision }}'),
    code('08e Build Revise Request', [X(30), Y - 260], '08e-build-revise-request.js'),
    ai('08f AI: Revise', [X(31), Y - 260], { strong: true, perItem: true }),
    code('08g Take Revision', [X(32), Y - 260], '08g-take-revision.js'),

    code('09a Prepare Report', [X(33), Y], '09a-prepare-report.js'),
    node('09b Markdown to HTML', 'n8n-nodes-base.markdown', 1, [X(34), Y], {
      mode: 'markdownToHtml', markdown: '={{ $json.markdown }}', destinationKey: 'html_body', options: {},
    }),
    code('09c Build HTML', [X(35), Y], '09c-build-html.js'),
    node('09d HTML to PDF', 'n8n-nodes-base.httpRequest', 4.2, [X(36), Y], {
      method: 'POST',
      url: `={{ ${V}.config.pdf_url }}`,
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Gotenberg-Output-Filename', value: 'research-report' }] },
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'report' }] },
      options: { timeout: 120000, response: { response: { responseFormat: 'file', outputPropertyName: 'pdf' } } },
    }, { ...RETRY, ...CONTINUE, notes: 'Gotenberg Chromium HTML route. Add auth here if your PDF service needs it.' }),
    ifTrue('09e PDF Ready?', [X(37), Y], '={{ !!($binary && $binary.pdf) }}'),
    gmail('09f Email Report + PDF', [X(38), Y - 120], {
      to: `={{ ${V}.email }}`,
      subject: `=Research report: {{ ${R}.title }}`,
      message: "={{ $('09c Build HTML').first().json.html }}",
      attachPdf: true,
    }),
    gmail('09g Email Report (no PDF)', [X(38), Y + 120], {
      to: `={{ ${V}.email }}`,
      subject: `=Research report: {{ ${R}.title }}`,
      message: "={{ $('09c Build HTML').first().json.html }}",
    }),
    sheet('09h Log Completed', [X(39), Y], 'appendOrUpdate', `${V}.config`, {
      run_id: `={{ ${V}.run_id }}`,
      timestamp: `={{ ${V}.started_at }}`,
      email: `={{ ${V}.email }}`,
      topic: `={{ ${V}.topic }}`,
      depth: `={{ ${V}.depth }}`,
      style: `={{ ${V}.style }}`,
      num_sources_requested: `={{ ${V}.num_sources }}`,
      sources_used: `={{ ${R}.source_count }}`,
      confidence: `={{ ${R}.confidence }}`,
      verdict: `={{ ${R}.verdict }}`,
      status: 'completed',
      duration_sec: `={{ Math.round((Date.now() - new Date(${V}.started_at).getTime()) / 1000) }}`,
      error_message: `={{ ${R}.invalid_citations ? ${R}.invalid_citations + ' invalid citation(s) removed' : '' }}`,
    }),
  ];

  const links = [
    ['01 Form', '02 Validate'], ['02 Validate', '02a Send Confirmation'], ['02a Send Confirmation', '02b Log Started'],
    ['02b Log Started', '03a Build Plan Request'], ['03a Build Plan Request', '03b AI: Plan'], ['03b AI: Plan', '03c Parse Plan'],
    ['03c Parse Plan', '04a Split Queries'], ['04a Split Queries', '04a2 Use Tavily?'],
    ['04a2 Use Tavily?', '04b Tavily Search', 0], ['04a2 Use Tavily?', '04b2 SearXNG Search', 1],
    ['04b Tavily Search', '04c Merge & Dedupe'], ['04b2 SearXNG Search', '04c Merge & Dedupe'],
    ['04c Merge & Dedupe', '04c2 Use Tavily?'],
    ['04c2 Use Tavily?', '04d Tavily Extract', 0], ['04c2 Use Tavily?', '04d2 Split URLs', 1],
    ['04d Tavily Extract', '04e Attach Content'], ['04d2 Split URLs', '04d3 Fetch Pages'], ['04d3 Fetch Pages', '04e Attach Content'],
    ['04e Attach Content', '04f Any Sources?'],
    ['04f Any Sources?', '05a Build Score Requests', 0], ['04f Any Sources?', '10a Build Fallback Request', 1],
    ['05a Build Score Requests', '05b AI: Score'], ['05b AI: Score', '05c Select Top Sources'], ['05c Select Top Sources', '05d Enough Sources?'],
    ['05d Enough Sources?', '06a Build Analyze Requests', 0], ['05d Enough Sources?', '10a Build Fallback Request', 1],
    ['10a Build Fallback Request', '10b AI: Fallback Email'], ['10b AI: Fallback Email', '10c Parse Fallback Email'],
    ['10c Parse Fallback Email', '10d Send Fallback Email'], ['10d Send Fallback Email', '10e Log Insufficient'],
    ['06a Build Analyze Requests', '06b AI: Analyze'], ['06b AI: Analyze', '06c Collect Analyses'],
    ['06c Collect Analyses', '07a Build Write Request'], ['07a Build Write Request', '07b AI: Write Report'], ['07b AI: Write Report', '07c Extract Draft'],
    ['07c Extract Draft', '08a Build Verify Request'], ['08a Build Verify Request', '08b AI: Fact-Check'], ['08b AI: Fact-Check', '08c Parse Verification'],
    ['08c Parse Verification', '08d Needs Revision?'],
    ['08d Needs Revision?', '08e Build Revise Request', 0], ['08d Needs Revision?', '09a Prepare Report', 1],
    ['08e Build Revise Request', '08f AI: Revise'], ['08f AI: Revise', '08g Take Revision'], ['08g Take Revision', '09a Prepare Report'],
    ['09a Prepare Report', '09b Markdown to HTML'], ['09b Markdown to HTML', '09c Build HTML'], ['09c Build HTML', '09d HTML to PDF'],
    ['09d HTML to PDF', '09e PDF Ready?'],
    ['09e PDF Ready?', '09f Email Report + PDF', 0], ['09e PDF Ready?', '09g Email Report (no PDF)', 1],
    ['09f Email Report + PDF', '09h Log Completed'], ['09g Email Report (no PDF)', '09h Log Completed'],
  ];

  return workflow('AI Research Pipeline v2', nodes, links, { executionOrder: 'v1', saveManualExecutions: true });
}

// ---------- error workflow ----------

function buildErrorHandler() {
  const C = "$('E03 Build Failure Context').first().json";
  const nodes = [
    sticky('Error branch', [-120, 120], 2200, 520,
      '## 9. Error branch\nRuns when the main workflow fails (set it as the main workflow\'s **Error Workflow**).\n' +
      'Looks up the failed run through the n8n API to find the user\'s email, sends a plain-language failure email (Prompt 09), logs `failed`.\n' +
      'Edit **CONFIG** in `E03` to match `02 Validate`.'),
    node('E01 Error Trigger', 'n8n-nodes-base.errorTrigger', 1, [0, 300], {}),
    node('E02 Fetch Failed Execution', 'n8n-nodes-base.httpRequest', 4.2, [240, 300], {
      method: 'GET',
      url: '={{ new URL($json.execution.url).origin }}/api/v1/executions/{{ $json.execution.id }}?includeData=true',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 30000 },
    }, { ...RETRY, ...CONTINUE, alwaysOutputData: true, notes: 'Credential: Header Auth "n8n API" (X-N8N-API-KEY)' }),
    code('E03 Build Failure Context', [480, 300], 'e03-build-failure-context.js'),
    ifTrue('E04 Has Email?', [720, 300], '={{ $json.has_email }}'),
    ai('E05 AI: Failure Email', [960, 200], { perItem: true }),
    code('E06 Parse Failure Email', [1200, 200], 'e06-parse-failure-email.js'),
    gmail('E07 Send Failure Email', [1440, 200], {
      to: `={{ ${C}.email }}`, subject: '={{ $json.subject }}', message: '={{ $json.body_html }}', continueOnFail: true,
    }),
    sheet('E08 Log Failed', [1680, 300], 'appendOrUpdate', `${C}.config`, {
      run_id: `={{ ${C}.run_id }}`,
      timestamp: `={{ ${C}.started_at || $now.toISO() }}`,
      email: `={{ ${C}.email }}`,
      topic: `={{ ${C}.topic }}`,
      depth: `={{ ${C}.depth }}`,
      style: `={{ ${C}.style }}`,
      num_sources_requested: `={{ ${C}.num_sources }}`,
      status: 'failed',
      duration_sec: `={{ ${C}.started_at ? Math.round((Date.now() - new Date(${C}.started_at).getTime()) / 1000) : '' }}`,
      error_message: `={{ ${C}.error_message }}`,
    }, { continueOnFail: false }),
  ];
  const links = [
    ['E01 Error Trigger', 'E02 Fetch Failed Execution'], ['E02 Fetch Failed Execution', 'E03 Build Failure Context'],
    ['E03 Build Failure Context', 'E04 Has Email?'],
    ['E04 Has Email?', 'E05 AI: Failure Email', 0], ['E04 Has Email?', 'E08 Log Failed', 1],
    ['E05 AI: Failure Email', 'E06 Parse Failure Email'], ['E06 Parse Failure Email', 'E07 Send Failure Email'],
    ['E07 Send Failure Email', 'E08 Log Failed'],
  ];
  return workflow('AI Research Pipeline v2: Error Handler', nodes, links, { executionOrder: 'v1' });
}

// ---------- assembly + checks ----------

function workflow(name, nodes, links, settings) {
  const names = new Set(nodes.map(n => n.name));
  if (names.size !== nodes.length) throw new Error(`${name}: duplicate node names`);
  const connections = {};
  for (const [from, to, output = 0] of links) {
    if (!names.has(from) || !names.has(to)) throw new Error(`${name}: bad link ${from} -> ${to}`);
    const outs = (connections[from] = connections[from] || { main: [] }).main;
    while (outs.length <= output) outs.push([]);
    outs[output].push({ node: to, type: 'main', index: 0 });
  }
  return { name, nodes, connections, active: false, settings, pinData: {}, meta: { templateCredsSetupCompleted: false } };
}

function checkCodeNodes(wf) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const n of wf.nodes.filter(n => n.type === 'n8n-nodes-base.code')) {
    try { new AsyncFunction(n.parameters.jsCode); } catch (e) {
      throw new Error(`${wf.name} / ${n.name}: syntax error: ${e.message}`);
    }
  }
}

if (require.main === module) {
  for (const [file, wf] of [['research-pipeline.json', buildMain()], ['error-handler.json', buildErrorHandler()]]) {
    checkCodeNodes(wf);
    fs.writeFileSync(path.join(ROOT, 'workflows', file), JSON.stringify(wf, null, 2) + '\n');
    console.log(`workflows/${file}: ${wf.nodes.filter(n => n.type !== 'n8n-nodes-base.stickyNote').length} nodes`);
  }
}

module.exports = { buildMain, buildErrorHandler, codeFor };
