# Reddit-Engage-CLI

A lightweight CLI to discover relevant Reddit threads, rank lead opportunities, and prepare helpful draft replies for manual review.

## Why this exists

Manual Reddit prospecting is slow. This tool gives you a repeatable pipeline:

1. Find thread opportunities (`scan`)
2. Rank opportunities (`rank`)
3. Draft helpful replies (`draft`)
4. Export a review queue (`export`)

## Quick start

```bash
cd ~/Desktop/Projects/reddit-engage-cli
node src/index.js init
node src/index.js all
```

Generated files:

- `data/threads.raw.json`
- `data/threads.ranked.json`
- `data/drafts.json`
- `data/review-queue.md`

## Commands

```bash
node src/index.js init
node src/index.js scan
node src/index.js rank
node src/index.js draft
node src/index.js export
node src/index.js all
```

## Web UI Dashboard

Run the local dashboard:

```bash
cd ~/Desktop/Projects/reddit-engage-cli
npm run ui
```

Open [http://localhost:3080](http://localhost:3080)

Features:

- One-click `Scan`, `Rank`, `Draft`, `Export`, or `Run All`
- Live counts for raw/ranked/drafts
- Editable config form (`engage.config.json`)
- Leads table with search, subreddit filter, and pagination
- Draft queue with search, status filter, and pagination
- Approve/reject/pending review workflow with persisted status
- Top draft preview with compliance status
- Inline draft edit + save
- One-click regenerate for single draft with style variants
- Auto keyword suggestions from ranked threads

## Config

Edit `engage.config.json`:

- `subreddits`: target communities
- `subredditQuery`: optional natural-language topic used to auto-discover related subreddits
- `autoDiscoverSubreddits`: set `true` to expand topic queries into subreddit names
- `maxDiscoveredSubreddits`: max subreddit suggestions per query
- `keywords`: problem/intent phrases
- `daysBack`: search recency window
- `minUpvotes`, `minComments`: signal filters
- `maxThreads`: cap result size
- `brandName`, `brandSummary`, `voice`: draft context
- `llm`: free-model provider settings
- `llm.timeoutMs`: max wait per LLM request before fallback template (default `4000`)
- `compliance`: guardrails for reply safety

## Reddit OAuth setup (required for reliable scan)

Reddit frequently blocks unauthenticated public JSON fetches (`403`). This project now supports official Reddit OAuth.

1) Create a Reddit app at [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
- choose **script** app type
- copy `client_id` and `client_secret`

2) Create `.env` from template:

```bash
cp .env.example .env
```

3) Fill `.env`:

```bash
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=reddit-engage-cli/0.3.0 by u/<your_username>
REDDIT_USERNAME=<your_username>
REDDIT_PASSWORD=<your_password>
```

4) Run scan again:

```bash
node src/index.js scan
node src/index.js rank
```

If scan still fails, verify credentials and that your Reddit app type is `script`.

## Free LLM setup (recommended)

This project defaults to a free local model via Ollama.

1) Install Ollama: [https://ollama.com](https://ollama.com)
2) Pull a free model:

```bash
ollama pull llama3.2:3b
```

3) Keep Ollama running, then execute:

```bash
node src/index.js all
```

If the model is unavailable, the CLI automatically falls back to template drafting so your pipeline still completes.

## Optional free cloud model

You can use OpenRouter free-tier models by changing `engage.config.json`:

- `llm.provider = "openrouter"`
- `llm.openRouterApiKey = "<your key>"`
- keep model as `meta-llama/llama-3.3-8b-instruct:free` (or another `:free` model)

## Current behavior notes

- `scan` uses Reddit OAuth automatically when env credentials are present; otherwise falls back to public endpoint.
- `scan` accepts natural-language subreddit inputs and can auto-discover related subreddit names.
- `draft` generates replies with LLM first, then template fallback if LLM call fails.
- `draft` creates top 5 drafts by default for faster runs; regenerate styles on demand in UI.
- `export` includes compliance verdict and flags for each draft.
- Review states are stored in `data/review-status.json`.
- Threads with id `error-*` are excluded from ranking/drafting.

## Screenshots
<img width="1214" height="644" alt="image" src="https://github.com/user-attachments/assets/ed15b3be-24b3-4f47-8c39-7d615ec80c25" />
<img width="1214" height="753" alt="image" src="https://github.com/user-attachments/assets/898607ca-69a1-4e51-9b14-b87649d6abd8" />
<img width="1214" height="747" alt="image" src="https://github.com/user-attachments/assets/4ccde82e-9e08-47de-a700-3b22c78fd69a" />




