// 05c Select Top Sources: pair each score with its candidate, filter, sort, keep the top N.
// Each input item is one scored batch, in the same order as 05a built them.
const r = $('02 Validate').first().json;
const { candidates } = $('04e Attach Content').first().json;
const size = r.config.score_batch_size;

const scored = [];
$input.all().forEach((item, b) => {
  const batch = candidates.slice(b * size, b * size + size);
  let parsed;
  try { parsed = parseJson(responseText(item.json), 'Score'); } catch (e) { return; } // failed batch: skip its sources
  const list = Array.isArray(parsed.scores) ? parsed.scores : [];
  batch.forEach((c, i) => {
    const s = list.find(x => Number(x && x.source_index) === i + 1) || list[i];
    if (!s) return;
    scored.push({
      ...c,
      url: c.url, // never trust a URL echoed back by the model
      relevance_score: Number(s.relevance_score) || 0,
      credibility_score: Number(s.credibility_score) || 0,
      overall_score: Number(s.overall_score) || 0,
      source_type: s.source_type || 'other',
      is_recent_enough: s.is_recent_enough !== false,
      keep: s.keep === true,
      reason: s.reason || '',
    });
  });
});

const kept = scored
  .filter(s => s.keep && s.overall_score >= 5 && (!r.max_age_years || s.is_recent_enough))
  .sort((a, b) => b.overall_score - a.overall_score || b.credibility_score - a.credibility_score)
  .slice(0, r.num_sources);

return [{
  json: {
    kept,
    kept_count: kept.length,
    scored_count: scored.length,
    enough: kept.length >= r.config.min_sources,
  },
}];
