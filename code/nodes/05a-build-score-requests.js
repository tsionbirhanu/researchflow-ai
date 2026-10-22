// 05a Build Score Requests: Prompt 02b (batch Source Scorer), one fast-model call
// per batch of up to score_batch_size candidates.
const PROMPT = __PROMPT_02b__;
const r = $('02 Validate').first().json;
const plan = $('03c Parse Plan').first().json;
const { candidates } = $input.first().json;
const size = r.config.score_batch_size;

const batches = [];
for (let i = 0; i < candidates.length; i += size) batches.push(candidates.slice(i, i + size));

return batches.map((batch, b) => {
  const sources_block = batch.map((c, i) => [
    `=== SOURCE ${i + 1} ===`,
    `URL: ${c.url}`,
    `Title: ${c.title}`,
    `Published date (may be unknown): ${c.published_date || 'unknown'}`,
    `Content excerpt (first ${r.config.excerpt_chars} characters):`,
    '"""',
    c.content.slice(0, r.config.excerpt_chars),
    '"""',
  ].join('\n')).join('\n\n');

  return {
    json: {
      batch_start: b * size,
      batch_count: batch.length,
      ...aiCall(r.config, 'fast', PROMPT, {
        main_question: plan.main_question,
        refined_topic: plan.refined_topic,
        today: today(),
        max_age_years: r.max_age_years,
        sources_block,
      }, { maxTokens: 4000, effort: 'low', temperature: 0 }),
    },
  };
});
