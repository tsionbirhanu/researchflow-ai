# Prompt 08: Confirmation Email

| Stage | Model | Effort | Output |
|---|---|---|---|
| 1. Intake (sent immediately after form submit) | fast | low | JSON |

You can also hard-code this template without AI.

## User

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
