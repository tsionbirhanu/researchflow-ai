# Setup Guide

This guide takes you from an empty n8n instance to a working pipeline, in about 30 minutes.

## 1. Accounts and keys

| Service | What you need | Where |
|---|---|---|
| Claude API | API key (`sk-ant-...`) | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| Tavily | API key (`tvly-...`) | [app.tavily.com](https://app.tavily.com) |
| Google | An account for Sheets and Gmail | n8n's OAuth flow |
| PDF service | A Gotenberg URL | Self-host with Docker (`docker run -p 3000:3000 gotenberg/gotenberg:8`) on a server n8n can reach, or use a hosted Gotenberg |
| n8n API | API key (for the error handler only) | n8n → Settings → n8n API |

## 2. Create the log sheet

1. Create a Google Sheet and rename the first tab to `runs`.
2. Paste this header row into row 1, one name per column:

   ```
   run_id	timestamp	email	topic	depth	style	num_sources_requested	sources_used	confidence	verdict	status	duration_sec	error_message
   ```

3. Copy the sheet ID from its URL: `https://docs.google.com/spreadsheets/d/<THIS PART>/edit`.

## 3. Create credentials in n8n

Go to **Credentials → Add credential** and create these:

| Name (suggested) | Type | Fields |
|---|---|---|
| Anthropic API | Header Auth | Name: `x-api-key`, Value: your Claude key |
| Tavily API | Header Auth | Name: `Authorization`, Value: `Bearer tvly-...` |
| n8n API | Header Auth | Name: `X-N8N-API-KEY`, Value: your n8n API key |
| Google Sheets | Google Sheets OAuth2 API | Sign in with Google |
| Gmail | Gmail OAuth2 | Sign in with Google |

## 4. Import the workflows

1. **Workflows → Add workflow → ⋯ → Import from File**, then pick `workflows/research-pipeline.json`.
2. Do the same for `workflows/error-handler.json`.

## 5. Connect credentials

Open each node with a warning icon and select its credential:

| Nodes | Credential |
|---|---|
| `03b`, `05b`, `06b`, `07b`, `08b`, `08f`, `10b`, `E05` (Claude) | Anthropic API |
| `04b`, `04d` (Tavily) | Tavily API |
| `02b`, `09h`, `10e`, `E08` (Sheets) | Google Sheets |
| `02a`, `09f`, `09g`, `10d`, `E07` (Gmail) | Gmail |
| `E02 Fetch Failed Execution` | n8n API |

The HTTP Request nodes include a note naming the credential they expect.

## 6. Edit the configuration

Open **`02 Validate`** in the main workflow and edit the `CONFIG` block at the top:

```javascript
const CONFIG = {
  models: { fast: 'claude-haiku-5-5', strong: 'claude-sonnet-5-5' },
  sheet_id: 'PASTE_YOUR_GOOGLE_SHEET_ID',
  sheet_tab: 'runs',
  pdf_url: 'https://YOUR-GOTENBERG-HOST/forms/chromium/convert/html',
  ...
};
```

Then open **`E03 Build Failure Context`** in the error workflow and set the same `models`, `sheet_id` and `sheet_tab`.

> Editing a Code node in n8n changes only your instance. To keep the repo in sync, edit the file in `code/nodes/`, run `npm run build`, and re-import the workflow.

## 7. Connect the error workflow

1. Save the error workflow.
2. In the main workflow, go to **⋯ → Settings → Error Workflow**, select **AI Research Pipeline v2: Error Handler**, and save.

## 8. Test, then activate

1. Open `01 Form`, click **Test step**, and submit a simple topic with **Quick** depth and **3** sources.
2. Watch the execution. You should receive a confirmation email, then the report with a PDF, and the sheet row should go from `started` to `completed`.
3. Work through [`testing-checklist.md`](testing-checklist.md).
4. **Activate** the workflow and share the form's **Production URL**.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Claude node returns 400 `temperature` | An old request body that still sends sampling parameters | Re-import the workflow; API version `2026-10-21` rejects `temperature` |
| Claude node returns 401 | Wrong header name or key | The header must be exactly `x-api-key` |
| Claude node returns 400 about `fallbacks` | Your account doesn't have the server-side fallback beta | Remove `fallbacks` in `code/lib/helpers.js` and the `anthropic-beta` header in `scripts/build-workflow.js`, then rebuild |
| `04b Tavily Search` returns 401 | Missing `Bearer ` prefix | Value must be `Bearer tvly-...` |
| Report email arrives without a PDF | `09d HTML to PDF` failed (by design the email still goes out) | Check that `pdf_url` is reachable from n8n and ends in `/forms/chromium/convert/html` |
| Sheets nodes error "sheet not found" | Tab name mismatch | The tab must be named `runs`, or change `sheet_tab` |
| Failure email never arrives | `E02` cannot read executions | Check the n8n API credential; n8n API access may require a paid n8n Cloud plan. The run is still logged as `failed`. |
| Deep runs time out | n8n Cloud execution limit | Use fewer sources, or raise the workflow timeout in Settings if your plan allows |
