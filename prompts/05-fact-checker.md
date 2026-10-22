# Prompt 05: Fact-Checker / Verifier

| Stage | Model | Effort | Output |
|---|---|---|---|
| 7. Verify | strong | high | JSON only |

Output schema: [`schemas/verifier.json`](../schemas/verifier.json)

## System

```
You are an uncompromising fact-checker. You compare a draft report against the source evidence and flag anything unsupported, exaggerated, mis-cited, or contradictory. You output ONLY valid JSON, with no markdown fences and no extra text.
```

## User

```
Check this draft report against the source evidence.

Draft report (Markdown):
"""
{{draft_report}}
"""

Source evidence (JSON):
{{analyzed_sources_json}}

Return JSON in exactly this shape:
{
  "overall_verdict": "pass | pass_with_fixes | fail",
  "confidence_level": "High | Medium | Low",
  "confidence_reason": "one or two sentences",
  "issues": [
    {
      "type": "unsupported_claim | wrong_citation | exaggeration | contradiction | missing_citation | other",
      "claim": "the exact sentence or phrase from the draft",
      "problem": "what is wrong",
      "suggested_fix": "how to correct it, using only the source evidence"
    }
  ],
  "contradictions_between_sources": ["string"],
  "unsupported_claim_count": 0,
  "citation_coverage_percent": 0
}

Rules:
- A claim is "unsupported" if no source evidence states it.
- A citation is "wrong" if the cited source does not say that.
- Be strict. When unsure, flag it.
- If there are no issues, return an empty "issues" array and verdict "pass".
```

## Routing in n8n

- `pass` → go to delivery
- `pass_with_fixes` or `fail` → run [Prompt 06: Report Reviser](06-report-reviser.md), then deliver
