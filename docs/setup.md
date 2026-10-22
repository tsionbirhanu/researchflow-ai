# Setup Guide (100% free)

Everything below is free and needs no credit card. Plan on about 45 minutes the first time.

| Piece | Free option | Limits to know |
|---|---|---|
| AI model | Google Gemini via AI Studio | Low free rate limits (a few requests per minute, limited requests per day). The pipeline is tuned for this. |
| Web search | Tavily free plan | 1,000 credits per month, roughly 50 to 70 reports |
| n8n | Self-hosted with Docker on your computer | Runs while your computer is on |
| PDF | Gotenberg in the same Docker setup | None |
| Sheets + Gmail | Your Google account | None for this use |

## 1. Start n8n and Gotenberg

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), which is free for personal use, and start it.
2. In the project folder, run:

   ```bash
   docker compose up -d
   ```

3. Open <http://localhost:5678> and create your n8n owner account. It is local to your machine.

To stop it, run `docker compose down`. Your workflows and credentials are kept.

## 2. Get the free API keys

**Gemini (AI model)**
1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with Google.
2. Click **Get API key → Create API key**. No billing is needed.
3. Check which models your key can use for free in AI Studio. The workflow uses the aliases `gemini-flash-lite-latest` (fast steps) and `gemini-flash-latest` (writing and fact-checking). If either one is not available to you, change it in `CONFIG` (step 6).

**Tavily (web search)**
1. Sign up at [app.tavily.com](https://app.tavily.com) and copy your API key (`tvly-...`).

**n8n API (for failure emails)**
1. In n8n, go to **Settings → n8n API → Create an API key**.

## 3. Set up Google access (Sheets and Gmail)

A self-hosted n8n needs its own Google OAuth app. It is free:

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project, for example `researchflow`.
2. Go to **APIs & Services → Library** and enable **Gmail API**, **Google Sheets API** and **Google Drive API**.
3. Go to **APIs & Services → OAuth consent screen**, choose **External**, fill in the app name and your email, and add your own Gmail address under **Test users**.
4. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**, choose **Web application**, and add this redirect URI:

   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```

5. Copy the **Client ID** and **Client secret**.

## 4. Create the log sheet

1. Create a Google Sheet and rename the first tab to `runs`.
2. Paste this header row into row 1:

   ```
   run_id	timestamp	email	topic	depth	style	num_sources_requested	sources_used	confidence	verdict	status	duration_sec	error_message
   ```

3. Copy the sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<THIS PART>/edit`.

## 5. Create credentials in n8n

Go to **Credentials → Add credential**:

| Name | Type | Fields |
|---|---|---|
| LLM API | Header Auth | Name: `Authorization`, Value: `Bearer <your Gemini key>` |
| Tavily API | Header Auth | Name: `Authorization`, Value: `Bearer tvly-...` |
| n8n API | Header Auth | Name: `X-N8N-API-KEY`, Value: your n8n API key |
| Google Sheets | Google Sheets OAuth2 API | Client ID + secret from step 3, then **Sign in with Google** |
| Gmail | Gmail OAuth2 | Same Client ID + secret, then **Sign in with Google** |

## 6. Import and configure the workflows

1. **Workflows → Add workflow → ⋯ → Import from File**, then pick `workflows/research-pipeline.json`. Repeat for `workflows/error-handler.json`.
2. Open each node that shows a warning and select its credential:

   | Nodes | Credential |
   |---|---|
   | `03b`, `05b`, `06b`, `07b`, `08b`, `08f`, `10b`, `E05` (AI) | LLM API |
   | `04b`, `04d` (Tavily) | Tavily API |
   | `02b`, `09h`, `10e`, `E08` | Google Sheets |
   | `02a`, `09f`, `09g`, `10d`, `E07` | Gmail |
   | `E02 Fetch Failed Execution` | n8n API |

3. Open **`02 Validate`** and set `sheet_id` in the `CONFIG` block. The Gemini URL, models and the Gotenberg URL (`http://gotenberg:3000/...`) are already set for the free setup.
4. Open **`E03 Build Failure Context`** in the error workflow and set the same `sheet_id`.
5. In the main workflow, go to **⋯ → Settings → Error Workflow**, choose **AI Research Pipeline v2: Error Handler**, and save.

## 7. First test (keep it small)

1. Open `01 Form` and click **Test step**. Submit a simple topic with **Quick** depth and **3** sources.
2. A Quick run makes about 8 to 10 AI requests and takes a few minutes, because calls are spaced 12 seconds apart to respect the free limits.
3. You should get a confirmation email, then the report with a PDF, and the sheet row should change from `started` to `completed`.
4. When it works, click **Activate**. The form's **Production URL** works on your computer at `http://localhost:5678/form/...`.

## Staying inside the free limits

- Test with **Quick** depth and **3 to 5** sources. Deep runs with 10 sources use more requests.
- If you see **HTTP 429** (too many requests), wait a minute (per-minute limit) or until the next day (daily limit), then run again.
- To spread the load, use different models for fast and strong steps; each model has its own quota.
- Other free OpenAI-compatible providers (such as Groq) also work. Change `CONFIG.llm.url` and `models`, and update the LLM API credential.

## Switching to Claude later

If you get Claude API credit later, set this in `02 Validate` and `E03`:

```javascript
llm: { provider: 'claude', models: { fast: 'claude-haiku-5-5', strong: 'claude-sonnet-5-5' } },
```

Then change the **LLM API** credential to Name `x-api-key`, Value `<your Claude key>`. Nothing else changes.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| AI node returns 429 | Free-tier rate limit | Wait and retry; use Quick depth and fewer sources |
| AI node returns 404 / model not found | The model alias isn't available to your key | Pick a free model listed in AI Studio and set it in `CONFIG.llm.models` |
| AI node returns 400/401 | Wrong credential format | Gemini needs `Authorization: Bearer <key>` |
| `04b Tavily Search` returns 401 or 432 | Wrong key, or monthly credits used up | Check the key and your usage at app.tavily.com |
| Email arrives without a PDF | Gotenberg not reachable | Run `docker compose ps`; `pdf_url` must be `http://gotenberg:3000/forms/chromium/convert/html` |
| Google sign-in says "access blocked" | You're not a test user | Add your Gmail under OAuth consent screen → Test users |
| Sheets error "sheet not found" | Tab name mismatch | Name the tab `runs`, or change `sheet_tab` |
| Failure email never arrives | `E02` can't read executions | Check the n8n API credential; the run is still logged as `failed` |
