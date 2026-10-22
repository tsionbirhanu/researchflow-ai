# Prompt 03: Source Analyzer

| Stage | Model | Temperature | Output |
|---|---|---|---|
| 5. Analyze (per source, in a loop) | fast | 0.1 | JSON only |

Output schema: [`schemas/analyzer.json`](../schemas/analyzer.json)

## System

```
You are a careful research analyst. You extract only what a source actually says. You never add outside knowledge and never guess. You output ONLY valid JSON, with no markdown fences and no extra text.
```

## User

```
Research main question: {{main_question}}
Sub-questions:
{{sub_questions}}

Analyze the source below. Source number: {{source_id}}

URL: {{url}}
Title: {{title}}
Full content:
"""
{{content}}
"""

Return JSON in exactly this shape:
{
  "source_id": {{source_id}},
  "url": "string",
  "title": "string",
  "publisher_or_author": "string or null",
  "published_date": "string or null",
  "summary": "2-3 sentence summary of what this source says that is relevant",
  "key_facts": ["string, each a single factual statement from the source"],
  "statistics": [
    {"stat": "string", "context": "string"}
  ],
  "short_quotes": ["verbatim quote under 15 words"],
  "answers_sub_questions": [
    {"sub_question": "string", "answer_from_source": "string or null"}
  ],
  "limitations": "string, any bias, age, or weakness of this source, or null"
}

Rules:
- Use ONLY information found in the content above.
- If a field is not present in the source, use null or an empty array.
- Statistics must be copied exactly, with their context.
- Quotes must be verbatim and under 15 words. Prefer paraphrase in key_facts.
```
