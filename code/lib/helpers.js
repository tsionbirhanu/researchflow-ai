// ---- Shared helpers: injected into every Code node by scripts/build-workflow.js ----

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Replace {{name}} with vars.name; unknown placeholders are left as-is.
function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
}

// Messages API request body. API version 2026-10-21 rejects temperature/top_p/top_k,
// so depth and cost are controlled with output_config.effort.
function claudeRequest(cfg, tier, prompt, vars, { maxTokens, effort }) {
  const body = {
    model: cfg.models[tier],
    max_tokens: maxTokens,
    output_config: { effort },
    messages: [{ role: 'user', content: fill(prompt.user, vars) }],
  };
  if (prompt.system) body.system = prompt.system;
  if (tier === 'fast') body.thinking = { type: 'disabled' };
  else body.fallbacks = 'default'; // server-side refusal fallback (beta header set on the HTTP node)
  return body;
}

// Text of a Messages API response; '' for failed calls (Continue On Fail) and refusals.
function responseText(res) {
  if (!res || res.error || res.stop_reason === 'refusal') return '';
  return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

function parseJson(raw, label) {
  const clean = String(raw || '').replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  try {
    return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
  } catch (e) {
    throw new Error(`${label}: AI returned invalid JSON: ${clean.slice(0, 300)}`);
  }
}

// Canonical form for deduping: no protocol, www, hash, tracking params or trailing slash.
function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|ref_src)/i.test(k)) url.searchParams.delete(k);
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return (host + url.pathname.replace(/\/+$/, '') + (url.search || '')).toLowerCase();
  } catch (e) {
    return String(u || '').trim().toLowerCase();
  }
}

function numberedList(arr) {
  return (arr || []).map((q, i) => `${i + 1}. ${q}`).join('\n');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
// ---- end helpers ----
