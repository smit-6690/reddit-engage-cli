<div align="center">

# 🤖 Reddit Engage CLI

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Reddit OAuth](https://img.shields.io/badge/Reddit-OAuth2-orange?style=for-the-badge&logo=reddit&logoColor=white)](https://www.reddit.com/prefs/apps)
[![LLM](https://img.shields.io/badge/LLM-Ollama%20%2F%20OpenRouter-blue?style=for-the-badge)](https://ollama.com/)
[![Dashboard](https://img.shields.io/badge/Web%20UI-Dashboard-purple?style=for-the-badge)](http://localhost:3080)

**A lightweight CLI to discover relevant Reddit threads, rank lead opportunities, and prepare helpful draft replies for manual review.**

[Overview](#-overview) • [Pipeline](#-pipeline) • [Quick Start](#-quick-start) • [Commands](#-commands) • [Web UI](#-web-ui-dashboard) • [Config](#-config) • [Reddit OAuth](#-reddit-oauth-setup) • [LLM Setup](#-free-llm-setup) • [Screenshots](#-screenshots)

</div>

---

## 📌 Overview

Manual Reddit prospecting is slow. **Reddit Engage CLI** gives you a repeatable, automated pipeline to surface relevant threads, score lead quality, and generate helpful draft replies — all from your terminal.

The system integrates:
- **Reddit OAuth2** for reliable, authenticated thread fetching
- **Free LLM drafting** via Ollama (local) or OpenRouter (cloud)
- **Compliance guardrails** for reply safety and brand voice
- **Web UI dashboard** for review, editing, and approval workflows

> **Key Capability:** Go from zero to a curated, draft-ready lead queue in minutes — with no paid APIs required.

---

## 🔄 Pipeline

The tool routes each Reddit prospecting job through a structured 4-stage pipeline:

<img width="476" height="636" alt="Screenshot 2026-04-28 at 5 34 11 PM" src="https://github.com/user-attachments/assets/46e2760e-cc60-424b-8046-f84d2b451dc5" />

### Stage Responsibilities

| Stage | Role | Key Feature |
|---|---|---|
| **Scan** | Fetches threads from target subreddits via Reddit OAuth | Auto-discovers related subreddits from natural-language topics |
| **Rank** | Scores threads by upvotes, comments, recency, and keyword match | Configurable signal filters (`minUpvotes`, `minComments`, `daysBack`) |
| **Draft** | Generates helpful replies using LLM with brand voice context | Falls back to template if LLM is unavailable |
| **Export** | Produces a `review-queue.md` with compliance flags | Persists review states (`approve` / `reject` / `pending`) |

---

## ⚡ Quick Start

```bash
cd ~/Desktop/Projects/reddit-engage-cli
node src/index.js init
node src/index.js all
```

Generated output files:

| File | Contents |
|---|---|
| `data/threads.raw.json` | Raw fetched threads |
| `data/threads.ranked.json` | Scored and ranked leads |
| `data/drafts.json` | LLM-generated reply drafts |
| `data/review-queue.md` | Human-readable review queue |

---

## 🖥 Commands

```bash
node src/index.js init      # Initialize config and data directory
node src/index.js scan      # Fetch threads from Reddit
node src/index.js rank      # Score and rank thread opportunities
node src/index.js draft     # Generate reply drafts with LLM
node src/index.js export    # Export review queue with compliance report
node src/index.js all       # Run full pipeline end-to-end
```

---

## 🌐 Web UI Dashboard

Run the local dashboard:

```bash
cd ~/Desktop/Projects/reddit-engage-cli
npm run ui
```

Open [http://localhost:3080](http://localhost:3080)

### Dashboard Features

| Feature | Description |
|---|---|
| **Pipeline Controls** | One-click `Scan`, `Rank`, `Draft`, `Export`, or `Run All` |
| **Live Counts** | Real-time counts for raw threads / ranked leads / drafts |
| **Config Editor** | Editable `engage.config.json` form in the UI |
| **Leads Table** | Search, subreddit filter, and pagination |
| **Draft Queue** | Search, status filter, approve / reject / pending workflow |
| **Draft Preview** | Top draft preview with compliance status indicator |
| **Inline Editing** | Edit and save drafts directly in the UI |
| **Regenerate** | One-click regeneration for single drafts with style variants |
| **Keyword Suggestions** | Auto-suggested keywords from ranked threads |

---

## ⚙️ Config

Edit `engage.config.json` to customize the pipeline:

### Subreddit Discovery

| Key | Description |
|---|---|
| `subreddits` | Explicit list of target communities |
| `subredditQuery` | Natural-language topic for auto-discovery |
| `autoDiscoverSubreddits` | Set `true` to expand topics into subreddit names |
| `maxDiscoveredSubreddits` | Max subreddit suggestions per query |

### Signal Filters

| Key | Description |
|---|---|
| `keywords` | Problem/intent phrases to match |
| `daysBack` | Search recency window |
| `minUpvotes` | Minimum upvote threshold |
| `minComments` | Minimum comment threshold |
| `maxThreads` | Cap result size |

### Draft & Brand

| Key | Description |
|---|---|
| `brandName` | Your brand name injected into drafts |
| `brandSummary` | One-line brand description for LLM context |
| `voice` | Tone/style instructions for draft generation |

### LLM Settings

| Key | Description |
|---|---|
| `llm` | Free-model provider settings |
| `llm.timeoutMs` | Max wait per LLM request before fallback template (default: `4000`) |

### Compliance

| Key | Description |
|---|---|
| `compliance` | Guardrails object for reply safety rules |

---

## 🔐 Reddit OAuth Setup

Reddit frequently blocks unauthenticated public JSON fetches (`403`). This project supports official Reddit OAuth for reliable scanning.

**1. Create a Reddit app**

Go to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps):
- Choose **script** app type
- Copy `client_id` and `client_secret`

**2. Create `.env` from template**

```bash
cp .env.example .env
```

**3. Fill `.env`**

```env
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=reddit-engage-cli/0.3.0 by u/<your_username>
REDDIT_USERNAME=<your_username>
REDDIT_PASSWORD=<your_password>
```

**4. Run scan**

```bash
node src/index.js scan
node src/index.js rank
```

> If scan still fails, verify credentials and confirm your Reddit app type is set to `script`.

---

## 🆓 Free LLM Setup

This project defaults to a free local model via **Ollama**.

**1. Install Ollama:** [https://ollama.com](https://ollama.com)

**2. Pull a free model:**

```bash
ollama pull llama3.2:3b
```

**3. Keep Ollama running, then execute:**

```bash
node src/index.js all
```

> If the model is unavailable, the CLI automatically falls back to template drafting — your pipeline still completes.

### Optional: Free Cloud Model via OpenRouter

Change `engage.config.json`:

| Key | Value |
|---|---|
| `llm.provider` | `"openrouter"` |
| `llm.openRouterApiKey` | `"<your key>"` |
| `llm.model` | `meta-llama/llama-3.3-8b-instruct:free` (or another `:free` model) |

---

## 📝 Current Behavior Notes

- `scan` uses Reddit OAuth automatically when env credentials are present; otherwise falls back to public endpoint.
- `scan` accepts natural-language subreddit inputs and can auto-discover related subreddit names.
- `draft` generates replies with LLM first, then template fallback if LLM call fails.
- `draft` creates top 5 drafts by default for faster runs; regenerate styles on demand in UI.
- `export` includes compliance verdict and flags for each draft.
- Review states are stored in `data/review-status.json`.
- Threads with id `error-*` are excluded from ranking/drafting.

---

## 📸 Screenshots

<img width="1214" height="644" alt="image" src="https://github.com/user-attachments/assets/ed15b3be-24b3-4f47-8c39-7d615ec80c25" />
<img width="1214" height="753" alt="image" src="https://github.com/user-attachments/assets/898607ca-69a1-4e51-9b14-b87649d6abd8" />
<img width="1214" height="747" alt="image" src="https://github.com/user-attachments/assets/4ccde82e-9e08-47de-a700-3b22c78fd69a" />

---

<div align="center">

**Built by [Smit Ardeshana](https://www.linkedin.com/in/smit-ardeshana-956512220/) · [GitHub](https://github.com/smit-6690)**

*If this project helped you, please consider giving it a ⭐*

</div>
