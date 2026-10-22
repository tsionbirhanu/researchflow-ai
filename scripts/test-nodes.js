#!/usr/bin/env node
// Runs the built Code nodes with mocked n8n inputs.
// Usage: node scripts/test-nodes.js   (no credentials or network needed)

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMain, buildErrorHandler } = require('./build-workflow');

const MAIN = buildMain();
const ERR = buildErrorHandler();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Run one Code node. `input` is the list of incoming item JSONs; `refs` mocks $('Node Name').
async function run(wf, name, input, refs = {}) {
  const node = wf.nodes.find(n => n.name === name);
  assert.ok(node, `no node named ${name}`);
  const items = input.map(json => ({ json }));
  const $input = { first: () => items[0], all: () => items };
  const $ = ref => {
    if (!(ref in refs)) throw new Error(`test is missing a mock for $('${ref}')`);
    const list = Array.isArray(refs[ref]) ? refs[ref] : [refs[ref]];
    return { first: () => ({ json: list[0] }), all: () => list.map(json => ({ json })) };
  };
  const ctx = {
    helpers: { prepareBinaryData: async (buf, fileName, mimeType) => ({ data: buf.toString('base64'), fileName, mimeType }) },
  };
  const fn = new AsyncFunction('$input', '$', node.parameters.jsCode);
  return fn.call(ctx, $input, $);
}

const claudeText = text => ({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], stop_reason: 'end_turn' });

const FORM = {
  Topic: 'Remote work productivity',
  'Specific question': '',
  'Number of sources': '5',
  Depth: 'Standard',
  Style: 'Business',
  Language: 'English',
  'Max source age (years)': '',
  Email: 'Someone@Example.com',
};

let RUN;
const PLAN = {
  refined_topic: 'Remote work and productivity',
  main_question: 'Does remote work change productivity?',
  sub_questions: ['What do studies find?', 'What explains differences?'],
  search_queries: [{ query: 'remote work productivity study', purpose: 'evidence' }],
  key_terms: [],
};

test('02 Validate normalizes input and builds the confirmation', async () => {
  const [out] = await run(MAIN, '02 Validate', [{ ...FORM, Topic: 'AI <script>' , 'Number of sources': '50' }]);
  RUN = (await run(MAIN, '02 Validate', [FORM]))[0].json;
  assert.equal(out.json.num_sources, 10, 'capped at 10');
  assert.equal(RUN.email, 'someone@example.com');
  assert.equal(RUN.max_age_years, '');
  assert.match(RUN.run_id, /^run_/);
  assert.ok(out.json.confirmation.body_html.includes('AI &lt;script&gt;'), 'topic is escaped');
});

test('02 Validate rejects a bad email and an empty topic', async () => {
  await assert.rejects(run(MAIN, '02 Validate', [{ ...FORM, Email: 'not-an-email' }]), /valid email/);
  await assert.rejects(run(MAIN, '02 Validate', [{ ...FORM, Topic: ' ' }]), /topic is required/);
});

test('03a builds a fast request with no sampling parameters', async () => {
  const [out] = await run(MAIN, '03a Build Plan Request', [{}], { '02 Validate': RUN });
  const req = out.json.request;
  assert.equal(req.model, 'claude-haiku-5-5');
  assert.deepEqual(req.thinking, { type: 'disabled' });
  assert.equal(req.output_config.effort, 'low');
  for (const k of ['temperature', 'top_p', 'top_k']) assert.ok(!(k in req), `${k} must not be sent`);
  assert.ok(req.messages[0].content.includes('Topic: Remote work productivity'));
  assert.ok(!/\{\{(topic|depth|style)\}\}/.test(req.messages[0].content), 'placeholders filled');
});

test('03c parses fenced JSON after a thinking block', async () => {
  const [out] = await run(MAIN, '03c Parse Plan', [claudeText('```json\n' + JSON.stringify(PLAN) + '\n```')], { '02 Validate': RUN });
  assert.equal(out.json.search_queries.length, 1);
  assert.equal(out.json.main_question, PLAN.main_question);
});

test('04c merges, dedupes URL variants and counts failed searches', async () => {
  const [out] = await run(MAIN, '04c Merge & Dedupe', [
    { results: [
      { url: 'https://www.example.com/a/?utm_source=x', title: 'A', content: 'snip', raw_content: '', score: 0.5 },
      { url: 'https://b.org/b', title: 'B', content: 'snip', raw_content: 'full text', score: 0.9 },
    ] },
    { results: [{ url: 'http://example.com/a', title: 'A2', content: 'snip', score: 0.7 }] },
    { error: { message: '500' } },
  ], { '02 Validate': RUN });
  const { candidates, urls_to_extract, failed_queries } = out.json;
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].url, 'https://b.org/b');
  assert.equal(candidates[1].title, 'A2', 'higher-scoring duplicate wins');
  assert.deepEqual(urls_to_extract, ['http://example.com/a']);
  assert.equal(failed_queries, 1);
});

test('04e attaches extracted text and drops unreadable pages', async () => {
  const long = 'x'.repeat(300);
  const [out] = await run(MAIN, '04e Attach Content', [{ results: [{ url: 'https://example.com/a', raw_content: long }] }], {
    '04c Merge & Dedupe': { candidates: [
      { url: 'https://example.com/a', title: 'A', snippet: 'short', raw_content: '' },
      { url: 'https://paywall.com/p', title: 'P', snippet: 'Subscribe to read', raw_content: '' },
    ] },
  });
  assert.equal(out.json.candidate_count, 1);
  assert.equal(out.json.candidates[0].content, long);
  assert.equal(out.json.skipped_count, 1);
  assert.equal(out.json.has_candidates, true);
});

test('05c keeps scored sources in order, skips failures, ignores model URLs', async () => {
  const cands = ['a', 'b', 'c', 'd'].map(k => ({ url: `https://${k}.com`, title: k, content: 'text' }));
  const score = (o, keep = true) => claudeText(JSON.stringify({
    url: 'https://hallucinated.example', relevance_score: o, credibility_score: o, overall_score: o, keep, is_recent_enough: true,
  }));
  const [out] = await run(MAIN, '05c Select Top Sources',
    [score(6), score(9), { error: { message: 'timeout' } }, score(8, false)],
    { '02 Validate': { ...RUN, num_sources: 5 }, '04e Attach Content': { candidates: cands } });
  assert.deepEqual(out.json.kept.map(k => k.url), ['https://b.com', 'https://a.com']);
  assert.equal(out.json.scored_count, 3);
  assert.equal(out.json.enough, true);
});

const KEPT = [
  { url: 'https://a.com', title: 'A', source_type: 'news', credibility_score: 8, content: 'x' },
  { url: 'https://b.com', title: 'B', source_type: 'academic', credibility_score: 9, content: 'x' },
  { url: 'https://c.com', title: 'C', source_type: 'blog', credibility_score: 5, content: 'x' },
];
let ANALYSES;

test('06c renumbers analyses, skips failures and filters long quotes', async () => {
  const a = q => claudeText(JSON.stringify({ title: 'T', summary: 's', key_facts: ['f'], short_quotes: q, url: 'https://fake' }));
  const [out] = await run(MAIN, '06c Collect Analyses',
    [a(['short quote here', 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen']),
     claudeText('not json'), a([])],
    { '02 Validate': RUN, '05c Select Top Sources': { kept: KEPT } });
  ANALYSES = out.json.analyses;
  assert.deepEqual(ANALYSES.map(x => [x.source_id, x.url]), [[1, 'https://a.com'], [2, 'https://c.com']]);
  assert.deepEqual(ANALYSES[0].short_quotes, ['short quote here']);
});

test('06c fails the run when fewer than 2 sources survive', async () => {
  await assert.rejects(run(MAIN, '06c Collect Analyses', [claudeText('{}'), claudeText('bad')],
    { '02 Validate': RUN, '05c Select Top Sources': { kept: KEPT } }), /only 1 source/);
});

test('07a builds a strong request with server-side fallback', async () => {
  const [out] = await run(MAIN, '07a Build Write Request', [{ analyses: ANALYSES }], { '02 Validate': RUN, '03c Parse Plan': PLAN });
  const req = out.json.request;
  assert.equal(req.model, 'claude-sonnet-5-5');
  assert.equal(req.fallbacks, 'default');
  assert.ok(!('thinking' in req) && !('temperature' in req));
});

test('07c refuses a truncated report', async () => {
  await assert.rejects(run(MAIN, '07c Extract Draft', [{ ...claudeText('# T\n' + 'x'.repeat(300)), stop_reason: 'max_tokens' }]), /cut off/);
});

const DRAFT = '# Remote Work Report\n*Generated on 2026-10-23*\n\n## Executive Summary\nIt helps [1].\n\n## Key Findings\n- Finding [2][9]\n\n## Sources\n1. Made up source http://fake.example\n' + ' '.repeat(200);

test('08c degrades to "unverified" when the fact-check fails', async () => {
  const [bad] = await run(MAIN, '08c Parse Verification', [{ error: { message: '529' } }], { '07c Extract Draft': { draft_report: DRAFT } });
  assert.equal(bad.json.overall_verdict, 'unverified');
  assert.equal(bad.json.confidence_level, 'Low');
  assert.equal(bad.json.needs_revision, false);
  const [fix] = await run(MAIN, '08c Parse Verification',
    [claudeText(JSON.stringify({ overall_verdict: 'pass_with_fixes', confidence_level: 'Medium', issues: [{ type: 'unsupported_claim' }] }))],
    { '07c Extract Draft': { draft_report: DRAFT } });
  assert.equal(fix.json.needs_revision, true);
});

let REPORT;
test('09a rebuilds Sources from real URLs and drops invalid citations', async () => {
  const verification = { draft_report: DRAFT, confidence_level: 'Medium', overall_verdict: 'pass' };
  const [out] = await run(MAIN, '09a Prepare Report', [verification],
    { '08c Parse Verification': verification, '06c Collect Analyses': { analyses: ANALYSES }, '03c Parse Plan': PLAN });
  REPORT = out.json;
  assert.equal(REPORT.title, 'Remote Work Report');
  assert.equal(REPORT.invalid_citations, 1);
  assert.ok(!REPORT.markdown.includes('[9]'));
  assert.ok(!REPORT.markdown.includes('fake.example'), 'model-written source list removed');
  assert.ok(REPORT.markdown.includes('[https://c.com](https://c.com)'));
});

test('09c builds the HTML page and the PDF input file', async () => {
  const html_body = '<h1 id="t">Remote Work Report</h1><p><em>Generated on 2026-10-23</em></p>' +
    '<h2 id="executivesummary">Executive Summary</h2><p>It helps [1].</p><h2 id="keyfindings">Key Findings</h2><ul><li>Finding [2]</li></ul>' +
    '<h2 id="sources">Sources</h2><ol><li>A</li><li>C</li></ol>';
  const [out] = await run(MAIN, '09c Build HTML', [{ html_body }], { '09a Prepare Report': REPORT, '02 Validate': RUN });
  const page = out.json.html;
  assert.ok(page.includes('<div class="card summary"><h2 id="executivesummary">'));
  assert.ok(page.includes('<a href="#src-1">[1]</a>'));
  assert.ok(page.includes('<li id="src-2">C</li>'));
  assert.ok(page.includes('badge medium'));
  assert.ok(!/\{\{\w+\}\}/.test(page), 'all template tokens filled');
  assert.equal(out.binary.report.fileName, 'index.html');
});

test('E03 recovers the run from execution data and maps the stage', async () => {
  const [out] = await run(ERR, 'E03 Build Failure Context',
    [{ data: { resultData: { runData: { '02 Validate': [{ data: { main: [[{ json: RUN }]] } }] } } } }],
    { 'E01 Error Trigger': { execution: { id: '42', lastNodeExecuted: '07b Claude: Write Report', error: { message: 'Overloaded' } } } });
  assert.equal(out.json.email, RUN.email);
  assert.equal(out.json.failed_stage, 'Writing');
  assert.equal(out.json.has_email, true);
  assert.ok(!out.json.request.messages[0].content.includes('Overloaded'), 'no internal error text sent to the email writer');
});

test('E03 still logs when the execution lookup failed', async () => {
  const [out] = await run(ERR, 'E03 Build Failure Context', [{ error: { message: '401' } }],
    { 'E01 Error Trigger': { execution: { id: '7', lastNodeExecuted: '04b Tavily Search', error: { message: 'x' } } } });
  assert.equal(out.json.has_email, false);
  assert.equal(out.json.run_id, 'exec_7');
});

test('no request anywhere sends sampling parameters', () => {
  for (const wf of [MAIN, ERR]) {
    for (const n of wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')) {
      assert.ok(!/temperature|top_p|top_k/.test(JSON.stringify(n.parameters)), `${n.name}`);
    }
  }
});
