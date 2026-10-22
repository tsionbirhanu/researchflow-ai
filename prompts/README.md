# Prompts

One file per AI call in the pipeline. Paste the **System** and **User** blocks into the matching n8n AI node and map each `{{variable}}` to an n8n expression.

| # | Prompt | Stage | Model | Effort | Output |
|---|---|---|---|---|---|
| 01 | [Research Planner](01-research-planner.md) | Plan | fast | low | JSON |
| 02 | [Source Scorer](02-source-scorer.md) | Score | fast | low | JSON |
| 03 | [Source Analyzer](03-source-analyzer.md) | Analyze | fast | low | JSON |
| 04 | [Report Writer](04-report-writer.md) | Synthesize | strong | medium | Markdown |
| 05 | [Fact-Checker / Verifier](05-fact-checker.md) | Verify | strong | high | JSON |
| 06 | [Report Reviser](06-report-reviser.md) | Verify | strong | medium | Markdown |
| 07 | [HTML Report Template](07-html-report-template.md) | Deliver | strong | medium | HTML |
| 08 | [Confirmation Email](08-confirmation-email.md) | Intake | fast | low | JSON |
| 09 | [Failure Email](09-failure-email.md) | Error | fast | low | JSON |
| 10 | [Insufficient Sources Fallback](10-insufficient-sources-fallback.md) | Score | fast | low | JSON |

Parse every JSON output with [`code/parse-ai-json.js`](../code/parse-ai-json.js).
