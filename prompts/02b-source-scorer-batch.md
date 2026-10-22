# Prompt 02b: Source Scorer (batch)

| Stage | Model | Effort | Output |
|---|---|---|---|
| 4. Score (up to 5 sources per call) | fast | low | JSON only |

Same scoring rules as [Prompt 02](02-source-scorer.md), but scores several sources in one call. The workflow uses this version to save requests on free-tier rate limits.

## System

```
You are a strict source evaluator. You judge how relevant and credible web sources are for a research task. You output ONLY valid JSON, with no markdown fences and no extra text.
```

## User

```
Research main question: {{main_question}}
Topic: {{refined_topic}}
Today's date: {{today}}
Recency limit: sources must be from the last {{max_age_years}} years (if empty, every source counts as recent enough).

Evaluate each source below. Each one starts with "=== SOURCE n ===".

{{sources_block}}

Return JSON in exactly this shape, with one entry per source, in the same order:
{
  "scores": [
    {
      "source_index": 1,
      "relevance_score": 1-10,
      "credibility_score": 1-10,
      "overall_score": 1-10,
      "source_type": "academic | government | news | company | blog | forum | other",
      "is_recent_enough": true or false,
      "keep": true or false,
      "reason": "one short sentence"
    }
  ]
}

Scoring guide:
- Credibility 9-10: peer-reviewed, government, major institutions, established news with named authors.
- Credibility 6-8: reputable industry sites, well-known publications.
- Credibility 1-5: anonymous blogs, forums, content farms, heavily promotional pages, unclear authorship.
- Relevance reflects how directly the content answers the main question.
- Set keep=false if overall_score is below 5, the page is mostly ads or paywall text, or it is clearly off-topic.
- Judge each source only from its own information. Do not invent details.
```
