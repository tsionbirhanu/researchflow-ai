# CLAUDE.md: AI Research Pipeline v2 (n8n)

## 1. Project overview

I am building **AI Research Pipeline v2**, an n8n automation that takes a research request from a web form, researches it on the web, scores and analyzes sources, writes a cited report, fact-checks it, and emails the result (HTML body + PDF attachment).

This is my own original project. It is inspired by a simple "form → search → analyze → email" pipeline, but mine adds source scoring, citations, a fact-check pass, depth/style options, PDF delivery, a research log, and proper error handling.

**Your role (Claude):** act as a senior automation engineer and prompt engineer. Help me design, build, debug, and polish this workflow step by step. Be practical and concrete. Give me exact n8n node settings, expressions, code, and prompts I can paste in.

## 2. Tech stack

- **Automation:** n8n, self-hosted with Docker (free); n8n Cloud also works
- **AI model:** must stay free. Default: Google Gemini free tier via its OpenAI-compatible endpoint. Claude API is an optional paid alternative. Use a fast model for scoring/analysis and a stronger model for writing/verification.
- **Search:** SearXNG self-hosted in Docker (free, no key); Tavily optional
- **Logging:** Google Sheets
- **Email:** Gmail node
- **PDF:** Gotenberg, self-hosted in the same Docker setup

## 3. Form inputs

| Field | Type | Required | Values |
|---|---|---|---|
| topic | text | yes | free text |
| question | text | no | free text |
| num_sources | dropdown | yes | 3 / 5 / 8 / 10 |
| depth | dropdown | yes | Quick / Standard / Deep |
| style | dropdown | yes | Student / Business / Technical |
| language | dropdown | no | English (default) / others |
| max_age_years | number | no | e.g. 1, 3, 5 |
| email | email | yes | valid email |

## 4. Workflow stages

1. **Intake:** Form Trigger → validate → send confirmation email → log "started" row in Google Sheets.
2. **Plan:** AI creates sub-questions and search queries (JSON).
3. **Search:** SearXNG (or Tavily) for each query → merge → dedupe by URL → fetch content.
4. **Score:** AI rates each source for relevance and credibility → keep top N.
5. **Analyze:** loop over sources → extract facts, stats, quotes, metadata (JSON).
6. **Synthesize:** AI writes the report using only extracted facts, with `[n]` citations.
7. **Verify:** second AI call checks the draft against sources, flags issues, assigns confidence.
8. **Deliver:** build HTML → PDF → email → update Google Sheet to "completed".
9. **Error branch:** Error Trigger → failure email to user + log error row.

## 5. Rules you must follow when helping me

1. **JSON first.** Every AI stage that feeds another node must return valid JSON only (no markdown fences, no commentary). Give me the n8n expression to parse it safely.
2. **No hallucinated sources.** The writer may only use facts present in the analyzed sources. Never invent URLs, quotes, statistics, or authors.
3. **Cite everything.** Every factual claim in the report ends with a citation like `[1]` or `[2][4]`.
4. **Be honest about uncertainty.** If sources are thin, conflicting, or old, say so in the report.
5. **Fail gracefully.** A broken or paywalled URL must be skipped, not crash the run. Always suggest a fallback.
6. **Cost control.** Everything must run on free tiers. Cap sources at 10, batch where possible (scoring is 5 sources per call), and space out calls to respect free-tier rate limits. Keep prompts tight.
7. **Low randomness.** For OpenAI-compatible providers (Gemini, Groq): temperature 0 to 0.3 for planning, scoring, analysis and verification, up to 0.5 for writing. For the Claude API, version `2026-10-21` rejects `temperature`, `top_p` and `top_k`, so use `output_config.effort` instead: `low` for the fast model, `medium` for writing and revising, `high` for verification.
8. **Explain briefly, then show.** Short reasoning, then the exact node config, expression, or code.
9. When I paste an error or execution output, diagnose the root cause first, then give the fix.
10. Do not copy anyone else's workflow. Help me build and improve my own.

## 6. n8n conventions

- Name nodes clearly: `01 Form`, `02 Validate`, `03 Plan`, `04 Search`, etc.
- Group nodes with sticky notes per stage.
- Reference earlier data with `{{ $('Node Name').item.json.field }}`.
- Parse AI JSON in a Code node:

```javascript
// Code node: safe JSON parse of AI output
const raw = $input.first().json.text || $input.first().json.output || "";
const clean = raw.replace(/```json|```/g, "").trim();
let parsed;
try {
  parsed = JSON.parse(clean);
} catch (e) {
  throw new Error("AI returned invalid JSON: " + clean.slice(0, 300));
}
return [{ json: parsed }];
```

- Enable **Retry On Fail** (2 to 3 tries) on all HTTP/AI nodes.
- Enable **Continue On Fail** on the per-source fetch nodes.

---

# PROMPTS

Variables in `{{double braces}}` are filled in by n8n expressions.

---

## PROMPT 1: Research Planner

**Model:** fast | **Effort:** low | **Output:** JSON only

**System:**
```
You are a research planning assistant. You turn a research request into a clear plan. You output ONLY valid JSON, with no markdown fences and no extra text.
```

**User:**
```
Create a research plan for this request.

Topic: {{topic}}
Specific question (may be empty): {{question}}
Depth: {{depth}}   (Quick = 3 sub-questions, Standard = 4, Deep = 5)
Audience style: {{style}}
Only use sources from the last {{max_age_years}} years (ignore if empty).

Return JSON in exactly this shape:
{
  "refined_topic": "string, a clear one-line version of the topic",
  "main_question": "string, the central question the report must answer",
  "sub_questions": ["string", "..."],
  "search_queries": [
    {"query": "string", "purpose": "string"}
  ],
  "key_terms": ["string", "..."]
}

Rules:
- Create 3 to 5 sub-questions based on the Depth value.
- Create 3 to 5 search queries. Each must be short (under 10 words), specific, and different from the others.
- If a specific question was given, make it the main_question.
- Do not answer the questions. Only plan.
```

---

## PROMPT 2: Source Scorer

**Model:** fast | **Effort:** low | **Output:** JSON only

Run once per source (or batch up to 5 sources per call).

**System:**
```
You are a strict source evaluator. You judge how relevant and credible a web source is for a research task. You output ONLY valid JSON, with no markdown fences and no extra text.
```

**User:**
```
Research main question: {{main_question}}
Topic: {{refined_topic}}

Evaluate this source.

URL: {{url}}
Title: {{title}}
Published date (may be unknown): {{published_date}}
Today's date: {{today}}
Recency limit: sources must be from the last {{max_age_years}} years (if empty, every source counts as recent enough).
Content excerpt (first 1500 characters):
"""
{{content_excerpt}}
"""

Return JSON in exactly this shape:
{
  "url": "string",
  "relevance_score": 1-10,
  "credibility_score": 1-10,
  "overall_score": 1-10,
  "source_type": "academic | government | news | company | blog | forum | other",
  "is_recent_enough": true or false,
  "keep": true or false,
  "reason": "one short sentence"
}

Scoring guide:
- Credibility 9-10: peer-reviewed, government, major institutions, established news with named authors.
- Credibility 6-8: reputable industry sites, well-known publications.
- Credibility 1-5: anonymous blogs, forums, content farms, heavily promotional pages, unclear authorship.
- Relevance reflects how directly the content answers the main question.
- Set keep=false if overall_score is below 5, the page is mostly ads or paywall text, or it is clearly off-topic.
- Judge only from the information provided. Do not invent details.
```

**After scoring (n8n):** Sort by `overall_score` descending, filter `keep == true`, take the top `num_sources`.

---

## PROMPT 3: Source Analyzer (per source, in a loop)

**Model:** fast | **Effort:** low | **Output:** JSON only

**System:**
```
You are a careful research analyst. You extract only what a source actually says. You never add outside knowledge and never guess. You output ONLY valid JSON, with no markdown fences and no extra text.
```

**User:**
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

---

## PROMPT 4: Report Writer

**Model:** strong | **Effort:** medium | **Output:** Markdown

**System:**
```
You are an expert research writer. You write clear, accurate, well-structured reports using ONLY the evidence provided. Every factual claim must carry a citation like [1] or [2][3] that matches the source numbers given. If the evidence is weak, thin, or conflicting, you say so openly. You never invent facts, statistics, quotes, names, or URLs.
```

**User:**
```
Write a research report.

Topic: {{refined_topic}}
Main question: {{main_question}}
Sub-questions:
{{sub_questions}}
Audience style: {{style}}
Depth: {{depth}}
Language: {{language}}
Today's date: {{today}}

Analyzed sources (JSON):
{{analyzed_sources_json}}

Style guide:
- Student: plain language, define terms, short paragraphs, explain why things matter.
- Business: practical, decision-focused, highlight implications, risks, and opportunities.
- Technical: precise terminology, include numbers and methods, assume expert readers.

Length guide:
- Quick: about 400 to 600 words total
- Standard: about 900 to 1300 words total
- Deep: about 1600 to 2200 words total

Use exactly this structure and these headings:

# {{title of report}}
*Generated on {{today}}*

## Executive Summary
(Maximum 5 lines. The direct answer to the main question.)

## Key Findings
(5 to 8 bullets. Each bullet ends with citations.)

## Detailed Analysis
(One subsection per sub-question, with its own ### heading. Cite every claim.)

## Conflicting Views and Limitations
(Where sources disagree, where evidence is weak, and what is missing. If none, say so.)

## Confidence Level
(High / Medium / Low, plus 2 to 3 sentences explaining why.)

## Suggested Follow-up Questions
(3 to 5 questions worth researching next.)

## Sources
(Numbered list matching citation numbers: [n] Title, Publisher/Author, Date, URL.)

Hard rules:
- Use ONLY facts from the provided sources.
- Every factual sentence needs a citation.
- Do not cite a source number that does not exist.
- Do not add a fact because you "know" it. If the sources do not cover something, write that the available sources do not cover it.
- Do not quote more than 15 words from any source. Prefer paraphrase.
- Output Markdown only. No preamble and no closing remarks.
```

---

## PROMPT 5: Fact-Checker / Verifier

**Model:** strong | **Effort:** high | **Output:** JSON only

**System:**
```
You are an uncompromising fact-checker. You compare a draft report against the source evidence and flag anything unsupported, exaggerated, mis-cited, or contradictory. You output ONLY valid JSON, with no markdown fences and no extra text.
```

**User:**
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

**Routing in n8n:**
- `pass` → go to delivery
- `pass_with_fixes` or `fail` → run PROMPT 6 (Report Reviser), then deliver

---

## PROMPT 6: Report Reviser

**Model:** strong | **Effort:** medium | **Output:** Markdown

**System:**
```
You are a careful editor. You fix a research report using a fact-check list. You change only what is needed and you never add facts that are not in the source evidence.
```

**User:**
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

---

## PROMPT 7: HTML Report Template Generator

**Model:** strong | **Effort:** medium | **Output:** HTML

Use this once to generate the template, or use it in a node to convert each report.

**System:**
```
You are a front-end designer who produces clean, print-friendly HTML emails and PDFs. You output a single complete HTML document with inline CSS only. No external files, no JavaScript.
```

**User:**
```
Convert this Markdown research report into a polished HTML document.

Markdown report:
"""
{{final_report_markdown}}
"""

Design requirements:
- Single self-contained HTML file with all CSS in a <style> tag (also inline critical styles for email clients).
- Max width 720px, centered, generous spacing, readable font (system sans-serif stack), 16px base size.
- Header: report title, date, and a small "AI Research Pipeline" label.
- Colored confidence badge near the top (green = High, amber = Medium, red = Low).
- Executive Summary in a highlighted card.
- Key Findings as a clean bulleted list.
- Citations like [1] rendered as small superscript-style links that jump to the matching item in the Sources list.
- Sources section as a numbered list with clickable URLs.
- Print/PDF friendly: avoid page breaks inside cards, use @media print rules, white background.
- Mobile friendly (responsive).
- Footer: "Generated automatically by AI Research Pipeline. Verify important facts with the original sources."

Output only the HTML document. No explanation.
```

---

## PROMPT 8: Confirmation Email (sent immediately after form submit)

**Model:** fast | **Effort:** low | **Output:** HTML or plain text

*(You can also hard-code this template without AI.)*

```
Write a short, friendly confirmation email.

Details:
- Topic: {{topic}}
- Number of sources: {{num_sources}}
- Depth: {{depth}}
- Estimated time: {{eta}}

Requirements:
- Subject line plus body.
- Confirm that the research request was received and is running.
- Mention the topic and the expected wait time.
- Say the report will arrive in this same inbox with a PDF attached.
- Keep it under 90 words, warm and professional, no hype.
- Output JSON: {"subject": "string", "body_html": "string"}
```

---

## PROMPT 9: Failure Email (Error branch)

**Model:** fast | **Effort:** low | **Output:** JSON

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

---

## PROMPT 10: Insufficient Sources Fallback

Use when fewer than 2 sources survive scoring.

**Model:** fast | **Effort:** low

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

---

# DATA SCHEMAS

## Planner output
```json
{
  "refined_topic": "",
  "main_question": "",
  "sub_questions": [],
  "search_queries": [{"query": "", "purpose": ""}],
  "key_terms": []
}
```

## Scorer output
```json
{
  "url": "",
  "relevance_score": 0,
  "credibility_score": 0,
  "overall_score": 0,
  "source_type": "",
  "is_recent_enough": true,
  "keep": true,
  "reason": ""
}
```

## Analyzer output
```json
{
  "source_id": 1,
  "url": "",
  "title": "",
  "publisher_or_author": null,
  "published_date": null,
  "summary": "",
  "key_facts": [],
  "statistics": [{"stat": "", "context": ""}],
  "short_quotes": [],
  "answers_sub_questions": [{"sub_question": "", "answer_from_source": null}],
  "limitations": null
}
```

## Verifier output
```json
{
  "overall_verdict": "pass",
  "confidence_level": "High",
  "confidence_reason": "",
  "issues": [],
  "contradictions_between_sources": [],
  "unsupported_claim_count": 0,
  "citation_coverage_percent": 100
}
```

---

# GOOGLE SHEETS LOG COLUMNS

`run_id | timestamp | email | topic | depth | style | num_sources_requested | sources_used | confidence | verdict | status | duration_sec | error_message`

Status values: `started`, `completed`, `failed`, `insufficient_sources`

---

# TESTING CHECKLIST

- [ ] Normal topic runs end to end
- [ ] Very niche topic (few sources) triggers the fallback email
- [ ] Invalid or empty email is rejected with a clear message
- [ ] Paywalled or broken URL is skipped without crashing
- [ ] Fact-checker catches a deliberately planted false claim
- [ ] PDF opens cleanly on desktop and mobile
- [ ] Google Sheet row updates from `started` to `completed`
- [ ] Failure email sends when a stage breaks
- [ ] Quick, Standard, and Deep modes each stay within the timeout

---

# HOW TO WORK WITH ME ON THIS PROJECT

When I say:
- **"next step"**: move to the next stage in section 4 and give me exact node settings and prompts.
- **"debug"**: I will paste an error or execution output. Find the root cause first, then the fix.
- **"improve prompt X"**: rewrite that prompt for better accuracy, shorter length, or lower cost, and explain what changed.
- **"make it shareable"**: help me write the demo post, screenshot plan, and sample report.

Always keep answers practical, step by step, and ready to paste into n8n.