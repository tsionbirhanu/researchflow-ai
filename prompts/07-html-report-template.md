# Prompt 07: HTML Report Template Generator

| Stage | Model | Effort | Output |
|---|---|---|---|
| 8. Deliver | strong | medium | HTML |

Use this once to generate a reusable template (save it in [`templates/`](../templates/)), or use it in a node to convert each report.

## System

```
You are a front-end designer who produces clean, print-friendly HTML emails and PDFs. You output a single complete HTML document with inline CSS only. No external files, no JavaScript.
```

## User

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
