// ---- Shared helpers: injected into every Code node by scripts/build-workflow.js ----

const ANTHROPIC_VERSION = '2026-10-21';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Replace {{name}} with vars.name; unknown placeholders are left as-is.
function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
}

// One LLM call for the configured provider: { request, request_url, request_headers }.
//   provider 'openai': any OpenAI-compatible chat endpoint (Gemini, Groq, OpenRouter, Ollama).
//   provider 'claude': Claude Messages API. Version 2026-10-21 rejects temperature/top_p/top_k,
//                      so depth and cost are controlled with output_config.effort instead.
function aiCall(cfg, tier, prompt, vars, { maxTokens, effort, temperature }) {
  const llm = cfg.llm;
  const content = fill(prompt.user, vars);

  if (llm.provider === 'claude') {
    const request = {
      model: llm.models[tier],
      max_tokens: maxTokens,
      output_config: { effort },
      messages: [{ role: 'user', content }],
    };
    const request_headers = { 'anthropic-version': ANTHROPIC_VERSION };
    if (prompt.system) request.system = prompt.system;
    if (tier === 'fast') {
      request.thinking = { type: 'disabled' };
    } else {
      request.fallbacks = 'default'; // server-side refusal fallback
      request_headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }
    return { request, request_url: 'https://api.anthropic.com/v1/messages', request_headers };
  }

  const messages = [];
  if (prompt.system) messages.push({ role: 'system', content: prompt.system });
  messages.push({ role: 'user', content });
  return {
    request: { model: llm.models[tier], messages, max_tokens: maxTokens, temperature },
    request_url: llm.url,
    request_headers: {},
  };
}

// Text of an LLM response (Claude or OpenAI-compatible); '' for failed calls
// (Continue On Fail) and refusals.
function responseText(res) {
  if (!res || res.error) return '';
  if (Array.isArray(res.choices)) {
    const msg = res.choices[0] && res.choices[0].message;
    return msg && typeof msg.content === 'string' ? msg.content.trim() : '';
  }
  if (res.stop_reason === 'refusal') return '';
  return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

// True when the model stopped because it hit max_tokens.
function isTruncated(res) {
  if (!res) return false;
  if (Array.isArray(res.choices)) return !!res.choices[0] && res.choices[0].finish_reason === 'length';
  return res.stop_reason === 'max_tokens';
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

// Readable text from a web page: prefers <article>/<main>, drops scripts, menus and markup.
function htmlToText(html) {
  let s = String(html || '');
  const main = s.match(/<article[\s\S]*?<\/article>/i) || s.match(/<main[\s\S]*?<\/main>/i);
  if (main && main[0].length > 500) s = main[0];
  const entities = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
  return s
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|aside|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m, k) => entities[k])
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function numberedList(arr) {
  return (arr || []).map((q, i) => `${i + 1}. ${q}`).join('\n');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
// ---- end helpers ----
