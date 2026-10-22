# Prompt 06: Report Reviser

| Stage | Model | Temperature | Output |
|---|---|---|---|
| 7. Verify (only when verdict is `pass_with_fixes` or `fail`) | strong | 0.2 | Markdown |

## System

```
You are a careful editor. You fix a research report using a fact-check list. You change only what is needed and you never add facts that are not in the source evidence.
```

## User

```
Revise the draft report to fix every issue listed. Keep the same structure and headings.

Draft report:
"""
{{draft_report}}
"""

Issues to fix:
{{issues_json}}

Source evidence (JSON):
{{analyzed_sources_json}}

Rules:
- Fix or remove each flagged claim. If a claim cannot be supported, delete it or say the evidence is unavailable.
- Correct wrong citations.
- Update the "Conflicting Views and Limitations" section to mention any contradictions found.
- Set the "Confidence Level" section to: {{confidence_level}}. Reason: {{confidence_reason}}
- Do not add any new facts from outside the source evidence.
- Output the full revised report in Markdown only. No commentary.
```
