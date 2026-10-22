// 09a Prepare Report: final Markdown with citations checked and a Sources list
// rebuilt from the real source metadata (the model's own list is discarded).
const v = $('08c Parse Verification').first().json;
const { analyses } = $('06c Collect Analyses').first().json;
const md = ($input.first().json.final_markdown || v.draft_report).trim();
const n = analyses.length;

// Drop citations that point at sources that don't exist.
let invalid_citations = 0;
const body = md
  .replace(/\n#{1,3}\s*Sources\s*\n[\s\S]*$/i, '')
  .replace(/\[(\d+)\]/g, (m, k) => {
    const i = Number(k);
    if (i >= 1 && i <= n) return m;
    invalid_citations++;
    return '';
  })
  .trim();

const sources = analyses.map(a => {
  const meta = [a.publisher_or_author, a.published_date].filter(Boolean).join(', ');
  return `${a.source_id}. ${a.title}${meta ? `, ${meta}` : ''}. [${a.url}](${a.url})`;
}).join('\n');

const titleMatch = body.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].trim() : $('03c Parse Plan').first().json.refined_topic;

return [{
  json: {
    markdown: `${body}\n\n## Sources\n\n${sources}\n`,
    title,
    confidence: v.confidence_level,
    verdict: v.overall_verdict,
    source_count: n,
    invalid_citations,
  },
}];
