# Testing Checklist

Results from the first live runs (2026-10-25, self-hosted n8n 2.44.6, Gemini free tier, SearXNG).

| Check | Result | Notes |
|---|---|---|
| Normal topic runs end to end | ✅ Passed | "Benefits of drinking water" and "How sleep affects memory" (Quick, 3 sources): report email with PDF, about 6 minutes |
| Google Sheet row updates from `started` to `completed` | ✅ Passed | Confidence, verdict, sources used and duration logged |
| PDF is attached and opens | ✅ Passed | Gotenberg; citations link to the Sources list |
| Fact-checker revises flagged claims | ✅ Passed | Both runs returned `pass_with_fixes`; the reviser ran before delivery |
| Model overload doesn't lose the run | ✅ Fixed | A Gemini 503 on `07b` led to automatic fallback to the lite model (added after run #8) |
| Paywalled or broken URL is skipped without crashing | ✅ Passed | Unreadable pages dropped; 2 of 3 sources kept in the second run |
| Invalid or empty email is rejected | ✅ Covered | Form field is type email + `02 Validate` check (unit tested) |
| Failure email sends when a stage breaks | ⬜ To verify | Run from the form's **Production URL**: n8n does not run the Error Workflow for manual "Test step" runs |
| Very niche topic triggers the fallback email | ⬜ To verify | Submit a deliberately obscure topic |
| Fact-checker catches a planted false claim | ⬜ To verify | Edit a draft in `07c` output during a test run |
| PDF opens cleanly on mobile | ⬜ To verify | Open the attachment on a phone |
| Quick, Standard and Deep stay within the timeout | ⬜ Partly | Quick verified; Standard/Deep use more requests and take longer on the free tier |

## How to run the checks

- **Unit tests (no keys):** `npm test` runs every Code node against mocked n8n data.
- **Live run:** open the form from `01 Form` (Test step for debugging, Production URL for real runs).
- **Error branch:** use the Production URL and temporarily break something (for example, stop SearXNG with `docker compose stop searxng` and submit a topic). You should get the failure email and a `failed` row. Restart it with `docker compose start searxng`.
