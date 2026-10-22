// 09c Build HTML: wrap the converted report in templates/report.html and attach it
// as a binary file (index.html) for the PDF service.
const TEMPLATE = __TEMPLATE_REPORT__;
const report = $('09a Prepare Report').first().json;
const r = $('02 Validate').first().json;
let html = String($input.first().json.html_body || '');

// The title and date live in the template header.
html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
html = html.replace(/<p>\s*<em>\s*Generated on[\s\S]*?<\/p>\s*/i, '');

// Executive Summary in a highlighted card.
html = html.replace(/(<h2[^>]*>\s*Executive Summary\s*<\/h2>)([\s\S]*?)(?=<h2)/i, '<div class="card summary">$1$2</div>');

// Sources: anchor each list item so citations can jump to it.
const parts = html.split(/(<h2[^>]*>\s*Sources\s*<\/h2>)/i);
if (parts.length === 3) {
  let k = 0;
  parts[2] = parts[2].replace(/<li>/g, () => `<li id="src-${++k}">`);
  parts[1] = parts[1].replace('<h2', '<h2 class="sources-heading"');
}
let main = parts.length === 3 ? parts[0] : html;
const tail = parts.length === 3 ? parts[1] + parts[2] : '';

// Citations [n] -> superscript links (only in the body, not in the Sources list).
main = main.replace(/\[(\d+)\]/g, (m, k) =>
  Number(k) <= report.source_count ? `<sup class="cite"><a href="#src-${k}">[${k}]</a></sup>` : m);

const badge = { High: 'high', Medium: 'medium', Low: 'low' }[report.confidence] || 'low';
const verdictNote = {
  pass: 'Fact-check passed.',
  pass_with_fixes: 'Fact-check found issues; they were corrected before delivery.',
  fail: 'Fact-check found significant issues; unsupported claims were corrected or removed.',
  unverified: 'Automatic fact-check could not be completed. Verify facts against the sources.',
}[report.verdict] || '';

const page = fill(TEMPLATE, {
  title: esc(report.title),
  date: today(),
  confidence: esc(report.confidence),
  badge_class: badge,
  verdict_note: esc(verdictNote),
  source_count: report.source_count,
  style: esc(r.style),
  depth: esc(r.depth),
  content: main + tail,
});

const binary = { report: await this.helpers.prepareBinaryData(Buffer.from(page, 'utf8'), 'index.html', 'text/html') };
return [{ json: { html: page }, binary }];
