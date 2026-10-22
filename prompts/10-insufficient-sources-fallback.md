# Prompt 10: Insufficient Sources Fallback

| Stage | Model | Temperature | Output |
|---|---|---|---|
| 4. Score (when fewer than 2 sources survive scoring) | fast | 0.3 | JSON |

## User

```
The research pipeline found too few reliable sources for this topic.

Topic: {{topic}}
Sources found that passed scoring: {{kept_count}}
Search queries used: {{search_queries}}

Write a short email to the user that:
1. Explains honestly that reliable sources were limited.
2. Suggests 3 alternative, broader or reworded topics they could try.
3. Invites them to resubmit the form.

Under 100 words. Output JSON: {"subject": "string", "body_html": "string"}
```

After sending, log the run with status `insufficient_sources`.
