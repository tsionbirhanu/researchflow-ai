# Prompt 09: Failure Email

| Stage | Model | Effort | Output |
|---|---|---|---|
| 9. Error branch | fast | low | JSON |

## User

```
Write a short, apologetic failure email for an automated research request that failed.

Details:
- Topic: {{topic}}
- Failed stage: {{failed_stage}}
- Plain-language reason (no technical jargon): {{friendly_reason}}

Requirements:
- Apologize briefly and say the research could not be completed.
- Suggest what the user can try (for example: a more specific topic, fewer sources, or trying again in a few minutes).
- Do not include stack traces, API names, or internal error details.
- Under 80 words, kind and calm.
- Output JSON: {"subject": "string", "body_html": "string"}
```
