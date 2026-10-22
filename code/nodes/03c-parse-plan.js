// 03c Parse Plan: validate the planner JSON before searching.
const r = $('02 Validate').first().json;
const plan = parseJson(responseText($input.first().json), 'Plan');

const queries = (plan.search_queries || [])
  .map(q => (typeof q === 'string' ? { query: q, purpose: '' } : q))
  .filter(q => q && q.query && String(q.query).trim())
  .slice(0, 5);
if (!queries.length) throw new Error('Plan: the planner returned no search queries.');

return [{
  json: {
    refined_topic: plan.refined_topic || r.topic,
    main_question: r.question || plan.main_question || r.topic,
    sub_questions: (plan.sub_questions || []).filter(Boolean).slice(0, 5),
    search_queries: queries,
    key_terms: plan.key_terms || [],
  },
}];
