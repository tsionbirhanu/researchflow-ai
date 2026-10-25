#!/usr/bin/env node
// One-command setup for a local n8n:
//   1. creates the credentials (LLM, Tavily placeholder, n8n API, Google Sheets, Gmail)
//   2. imports both workflows with credentials attached and your Sheet ID filled in
//   3. links the error workflow to the main workflow
// Reads keys from .env (see .env.example). Safe to run again: it updates the same
// workflows and reuses credentials it created before (ids kept in .n8n-setup.json).
// Usage: npm run setup            (add -- --fresh to create new credentials)

const fs = require('fs');
const path = require('path');
const { buildMain, buildErrorHandler } = require('./build-workflow');

const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.n8n-setup.json');

function loadEnv() {
  const file = path.join(ROOT, '.env');
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

// Accepts the Sheet ID or the whole Google Sheets URL.
function sheetIdFrom(value) {
  const v = String(value || '').trim();
  const m = v.match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : v;
}

const isPlaceholder = v => !v || /x{6,}|your-|PASTE_|^<|\.\.\./i.test(v);

const CREDENTIALS = [
  {
    key: 'llm', name: 'LLM API', type: 'httpHeaderAuth', needs: ['GEMINI_API_KEY'],
    data: env => ({ name: 'Authorization', value: `Bearer ${env.GEMINI_API_KEY}` }),
  },
  {
    key: 'tavily', name: 'Tavily API', type: 'httpHeaderAuth', needs: [],
    data: env => ({ name: 'Authorization', value: `Bearer ${isPlaceholder(env.TAVILY_API_KEY) ? 'none' : env.TAVILY_API_KEY}` }),
  },
  {
    key: 'n8nApi', name: 'n8n API', type: 'httpHeaderAuth', needs: ['N8N_API_KEY'],
    data: env => ({ name: 'X-N8N-API-KEY', value: env.N8N_API_KEY }),
  },
  {
    key: 'sheets', name: 'Google Sheets', type: 'googleSheetsOAuth2Api', needs: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    data: env => ({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
  },
  {
    key: 'gmail', name: 'Gmail', type: 'gmailOAuth2', needs: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    data: env => ({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
  },
];

// Which credential a node needs: [credential type, key in CREDENTIALS].
function credentialFor(node) {
  if (node.type === 'n8n-nodes-base.googleSheets') return ['googleSheetsOAuth2Api', 'sheets'];
  if (node.type === 'n8n-nodes-base.gmail') return ['gmailOAuth2', 'gmail'];
  if (node.type === 'n8n-nodes-base.httpRequest' && node.parameters.genericAuthType === 'httpHeaderAuth') {
    if (/Tavily/.test(node.name)) return ['httpHeaderAuth', 'tavily'];
    if (/^E02 /.test(node.name)) return ['httpHeaderAuth', 'n8nApi'];
    return ['httpHeaderAuth', 'llm'];
  }
  return null;
}

// Workflow body for the n8n public API: credentials attached, Sheet ID filled in.
function prepareWorkflow(wf, creds, { sheetId, errorWorkflowId } = {}) {
  const nodes = wf.nodes.map(n => {
    const node = JSON.parse(JSON.stringify(n));
    if (node.type === 'n8n-nodes-base.code' && sheetId) {
      node.parameters.jsCode = node.parameters.jsCode.replace("'PASTE_YOUR_GOOGLE_SHEET_ID'", `'${sheetId}'`);
    }
    const need = credentialFor(node);
    if (need && creds[need[1]]) node.credentials = { [need[0]]: { id: creds[need[1]].id, name: creds[need[1]].name } };
    return node;
  });
  const settings = { ...wf.settings };
  if (errorWorkflowId) settings.errorWorkflow = errorWorkflowId;
  return { name: wf.name, nodes, connections: wf.connections, settings };
}

async function main() {
  const env = loadEnv();
  const base = (env.N8N_URL || 'http://localhost:5678').replace(/\/+$/, '');
  const fresh = process.argv.includes('--fresh');
  const sheetId = sheetIdFrom(env.GOOGLE_SHEET_ID);

  const missing = ['N8N_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_SHEET_ID']
    .filter(k => isPlaceholder(env[k]));
  if (missing.length) {
    console.error(`Fill these in .env first (see .env.example):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId)) {
    console.error('GOOGLE_SHEET_ID does not look like a Sheet ID or Sheets URL.');
    process.exit(1);
  }

  const api = async (method, p, body) => {
    let res;
    try {
      res = await fetch(`${base}/api/v1${p}`, {
        method,
        headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(`Cannot reach n8n at ${base}. Is it running? (docker compose ps)`);
    }
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { message: text.slice(0, 300) }; }
    if (!res.ok) {
      const err = new Error(`${method} ${p} -> HTTP ${res.status}: ${json.message || text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return json;
  };

  // Check the connection and API key.
  try {
    await api('GET', '/workflows?limit=1');
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      console.error('n8n rejected N8N_API_KEY. Create a new key in n8n: Settings → n8n API.');
      process.exit(1);
    }
    throw e;
  }
  console.log(`Connected to n8n at ${base}\n`);

  // 1. Credentials
  const state = !fresh && fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  state.credentials = state.credentials || {};
  const creds = {};
  const manual = [];
  for (const c of CREDENTIALS) {
    if (state.credentials[c.key]) {
      creds[c.key] = state.credentials[c.key];
      console.log(`  credential  ${c.name}: reusing existing`);
      continue;
    }
    try {
      const created = await api('POST', '/credentials', { name: c.name, type: c.type, data: c.data(env) });
      creds[c.key] = state.credentials[c.key] = { id: created.id, name: created.name || c.name };
      console.log(`  credential  ${c.name}: created`);
    } catch (e) {
      manual.push(c.name);
      console.log(`  credential  ${c.name}: could not create automatically (${e.message})`);
    }
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

  // 2. Workflows: error handler first, so the main workflow can point to it.
  const upsert = async body => {
    const found = await api('GET', `/workflows?name=${encodeURIComponent(body.name)}`);
    const existing = (found.data || []).find(w => w.name === body.name);
    if (existing) {
      await api('PUT', `/workflows/${existing.id}`, body);
      console.log(`  workflow    ${body.name}: updated`);
      return existing.id;
    }
    const created = await api('POST', '/workflows', body);
    console.log(`  workflow    ${body.name}: imported`);
    return created.id;
  };
  console.log('');
  const errorId = await upsert(prepareWorkflow(buildErrorHandler(), creds, { sheetId }));
  const mainId = await upsert(prepareWorkflow(buildMain(), creds, { sheetId, errorWorkflowId: errorId }));

  console.log(`
Done. Two things left, in the n8n UI (${base}):

  1. Connect Google (one time):
     Credentials → "Google Sheets" → Sign in with Google → allow → Save
     Credentials → "Gmail"         → Sign in with Google → allow → Save
${manual.length ? `\n  Create these credentials by hand (see docs/setup.md, step 5), then run npm run setup again:\n     ${manual.join(', ')}\n` : ''}
  2. Test: open ${base}/workflow/${mainId} → double-click "01 Form" → Test step,
     submit a topic with Depth = Quick and Number of sources = 3.
`);
}

if (require.main === module) {
  main().catch(e => { console.error(`\nSetup failed: ${e.message}`); process.exit(1); });
}

module.exports = { prepareWorkflow, credentialFor, sheetIdFrom, loadEnv };
