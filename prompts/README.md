# Prompts

One file per AI call in the pipeline. Paste the **System** and **User** blocks into the matching n8n AI node and map each `{{variable}}` to an n8n expression.

| # | Prompt | Stage | Model | Temp | Output |
|---|---|---|---|---|---|
| 01 | [Research Planner](01-research-planner.md) | Plan | fast | 0.2 | JSON |
| 02 | [Source Scorer](02-source-scorer.md) | Score | fast | 0 | JSON |
| 03 | [Source Analyzer](03-source-analyzer.md) | Analyze | fast | 0.1 | JSON |
| 04 | [Report Writer](04-report-writer.md) | Synthesize | strong | 0.4 | Markdown |
| 05 | [Fact-Checker / Verifier](05-fact-checker.md) | Verify | strong | 0 | JSON |
| 06 | [Report Reviser](06-report-reviser.md) | Verify | strong | 0.2 | Markdown |
| 07 | [HTML Report Template](07-html-report-template.md) | Deliver | strong | 0.3 | HTML |
| 08 | [Confirmation Email](08-confirmation-email.md) | Intake | fast | 0.5 | JSON |
| 09 | [Failure Email](09-failure-email.md) | Error | fast | 0.4 | JSON |
| 10 | [Insufficient Sources Fallback](10-insufficient-sources-fallback.md) | Score | fast | 0.3 | JSON |

Parse every JSON output with [`code/parse-ai-json.js`](../code/parse-ai-json.js).
