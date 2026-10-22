// 08c Parse Verification: normalize the fact-check. If the check itself fails,
// deliver the draft marked "unverified" with Low confidence instead of failing the run.
const { draft_report } = $('07c Extract Draft').first().json;
const VERDICTS = ['pass', 'pass_with_fixes', 'fail'];
const LEVELS = ['High', 'Medium', 'Low'];

let v;
try {
  v = parseJson(responseText($input.first().json), 'Verify');
} catch (e) {
  v = {
    overall_verdict: 'unverified',
    confidence_level: 'Low',
    confidence_reason: 'The automatic fact-check could not be completed, so this report has not been verified.',
    issues: [],
  };
}

const issues = Array.isArray(v.issues) ? v.issues : [];
const verdict = VERDICTS.includes(v.overall_verdict) ? v.overall_verdict : 'unverified';

return [{
  json: {
    overall_verdict: verdict,
    confidence_level: LEVELS.includes(v.confidence_level) ? v.confidence_level : 'Low',
    confidence_reason: v.confidence_reason || '',
    issues,
    contradictions_between_sources: v.contradictions_between_sources || [],
    unsupported_claim_count: Number(v.unsupported_claim_count) || 0,
    citation_coverage_percent: Number(v.citation_coverage_percent) || 0,
    needs_revision: (verdict === 'pass_with_fixes' || verdict === 'fail') && issues.length > 0,
    draft_report,
  },
}];
