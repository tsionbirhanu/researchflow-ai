# Prompts

One file per AI call in the pipeline. These files are the source of truth: `npm run build` injects the **System** and **User** blocks into the workflow's Code nodes, and `{{variable}}` placeholders are filled at run time. After editing a prompt, rebuild and re-import.

Prompts 07 and 08 are kept as specs: the workflow uses [`templates/report.html`](../templates/report.html) (built from Prompt 07's requirements) and a fixed confirmation email, which is cheaper and more predictable.

| # | Prompt | Stage | Model | Effort | Output |
|---|---|---|---|---|---|
| 01 | [Research Planner](01-research-planner.md) | Plan | fast | low | JSON |
| 02 | [Source Scorer](02-source-scorer.md) | Score (single-source spec) | fast | low | JSON |
| 02b | [Source Scorer, batch](02b-source-scorer-batch.md) | Score (used by the workflow) | fast | low | JSON |
| 03 | [Source Analyzer](03-source-analyzer.md) | Analyze | fast | low | JSON |
| 04 | [Report Writer](04-report-writer.md) | Synthesize | strong | medium | Markdown |
| 05 | [Fact-Checker / Verifier](05-fact-checker.md) | Verify | strong | high | JSON |
| 06 | [Report Reviser](06-report-reviser.md) | Verify | strong | medium | Markdown |
| 07 | [HTML Report Template](07-html-report-template.md) | Deliver | strong | medium | HTML |
| 08 | [Confirmation Email](08-confirmation-email.md) | Intake | fast | low | JSON |
| 09 | [Failure Email](09-failure-email.md) | Error | fast | low | JSON |
| 10 | [Insufficient Sources Fallback](10-insufficient-sources-fallback.md) | Score | fast | low | JSON |

JSON outputs are parsed with `parseJson()` in [`code/lib/helpers.js`](../code/lib/helpers.js).
