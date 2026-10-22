// 06c Collect Analyses: parse each analysis, skip failures, renumber sources 1..N.
// URL, title and scores always come from the real search data, not the model.
const r = $('02 Validate').first().json;
const { kept } = $('05c Select Top Sources').first().json;
const words = s => String(s).trim().split(/\s+/).length;

const analyses = [];
$input.all().forEach((item, i) => {
  const src = kept[i];
  if (!src) return;
  let a;
  try { a = parseJson(responseText(item.json), 'Analyze'); } catch (e) { return; }
  analyses.push({
    source_id: 0,
    url: src.url,
    title: a.title || src.title,
    publisher_or_author: a.publisher_or_author || null,
    published_date: a.published_date || src.published_date || null,
    source_type: src.source_type,
    credibility_score: src.credibility_score,
    summary: a.summary || '',
    key_facts: a.key_facts || [],
    statistics: a.statistics || [],
    short_quotes: (a.short_quotes || []).filter(q => words(q) < 15),
    answers_sub_questions: a.answers_sub_questions || [],
    limitations: a.limitations || null,
  });
});
analyses.forEach((a, i) => { a.source_id = i + 1; });

if (analyses.length < r.config.min_sources) {
  throw new Error(`Analyze: only ${analyses.length} source(s) could be analyzed.`);
}
return [{ json: { analyses, source_count: analyses.length } }];
