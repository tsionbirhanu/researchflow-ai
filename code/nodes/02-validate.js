// 02 Validate: normalize the form submission, create the run, build the confirmation email.

// ---- Run configuration: edit these after importing ----
const CONFIG = {
  // Free default: Google Gemini (AI Studio key, no credit card) via its OpenAI-compatible endpoint.
  llm: {
    provider: 'openai',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: { fast: 'gemini-flash-lite-latest', strong: 'gemini-flash-latest' },
  },
  // Groq (free tier):  { provider: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', models: { fast: '...', strong: '...' } }
  // Claude (paid):     { provider: 'claude', models: { fast: 'claude-haiku-5-5', strong: 'claude-sonnet-5-5' } }
  // Free default: SearXNG from docker-compose.yml (no account, no key).
  // Tavily:  { provider: 'tavily' } plus the "Tavily API" credential on 04b and 04d.
  search: { provider: 'searxng', searxng_url: 'http://searxng:8080/search' },
  sheet_id: 'PASTE_YOUR_GOOGLE_SHEET_ID',
  sheet_tab: 'runs',
  pdf_url: 'http://gotenberg:3000/forms/chromium/convert/html', // Gotenberg from docker-compose.yml
  max_sources: 10,          // hard cap (cost control)
  min_sources: 2,           // fewer kept sources -> insufficient-sources email
  results_per_query: 5,     // Tavily results per search query
  candidates_to_score: 10,  // max deduped sources sent to the scorer
  score_batch_size: 5,      // sources scored per AI call (fewer calls for free-tier limits)
  excerpt_chars: 1500,      // scorer sees this much content
  content_chars: 12000,     // analyzer sees this much content
};

const f = $input.first().json;
const pick = (...keys) => {
  for (const k of keys) {
    const v = f[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const topic = pick('Topic', 'topic');
const email = pick('Email', 'email').toLowerCase();
if (topic.length < 3) throw new Error('Validation: the topic is required (at least 3 characters).');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Validation: a valid email address is required.');

const requested = parseInt(pick('Number of sources', 'num_sources'), 10);
const num_sources = Math.min(CONFIG.max_sources, Math.max(1, Number.isFinite(requested) ? requested : 5));
const depth = oneOf(pick('Depth', 'depth'), ['Quick', 'Standard', 'Deep'], 'Standard');
const style = oneOf(pick('Style', 'style'), ['Student', 'Business', 'Technical'], 'Student');
const language = pick('Language', 'language') || 'English';
const age = parseFloat(pick('Max source age (years)', 'max_age_years'));
const max_age_years = Number.isFinite(age) && age > 0 ? age : '';
const question = pick('Specific question', 'question');

const eta = { Quick: '3 to 5 minutes', Standard: '5 to 8 minutes', Deep: '8 to 12 minutes' }[depth];
const run_id = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const confirmation = {
  subject: `Research started: ${topic}`,
  body_html:
    `<p>Hi,</p>` +
    `<p>Your research request on <strong>${esc(topic)}</strong> was received and is now running ` +
    `(${num_sources} sources, ${depth} depth).</p>` +
    `<p>It usually takes about ${eta}. The report will arrive in this inbox with a PDF attached.</p>` +
    `<p>AI Research Pipeline</p>`,
};

return [{
  json: {
    run_id,
    started_at: new Date().toISOString(),
    topic, question, num_sources, depth, style, language, max_age_years, email, eta,
    config: CONFIG,
    confirmation,
  },
}];
