# GigSaathi

A GenAI companion for gig and informal workers in India: delivery partners, drivers and daily-wage workers. It helps them track what they really earn, stay safe, find welfare schemes, understand confusing documents and write complaints, in the language they are comfortable with.

Built for the PromptWars warm-up challenge, *Gig Worker Companion*. The product name is configurable (`APP_NAME`).

## What it does

| Feature | How it works |
|---|---|
| **Earnings tracker** | Add income, hours and expenses per day. The dashboard shows today, the last 7 days, hours, expenses, net pay per hour, a daily chart and a weekly summary. `Net = Gross − Expenses`. Stored in SQLite. |
| **AI assistant** | Chat in any Indian language, reply in the language you choose (default English). Asking about earnings makes the model call a backend function, so the numbers come from your saved data and the model never invents them. Voice input where the browser supports it. |
| **Safety** | Short, practical guidance for night work, road safety, emergencies and difficult situations. A call card with 112, 100, 108 and 1091 opens your phone's dialer. The app says clearly that it cannot call anyone itself. |
| **Welfare schemes** | Pick your work and state. Results come from a reviewed reference file, not from the model, and each one shows its source, last-checked date and a verified / partly verified / not verified label. |
| **Document help** | Paste a notice or message. You get a simple explanation, key dates, amounts and next steps. One click turns it into a complaint draft. |
| **Grievance drafts** | A guided form produces a subject and letter in your language and tone. Missing facts appear as `[ADD: ...]` placeholders. Edit, copy, regenerate and save drafts on your device. |

### Where Generative AI is used

| Feature | AI does | AI does not |
|---|---|---|
| Assistant | Understands the question, calls tools, writes the answer | Make up earnings or schemes |
| Document help | Explains pasted text, extracts dates and amounts | Store the text |
| Grievance | Writes the letter from the facts supplied | Add facts, dates or evidence |
| Weekly summary, safety, schemes | Re-words stored data in the chosen language | Change the data |

Earnings tracking, the scheme lookup and the safety content work without AI.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4
- **Backend:** Python, FastAPI, Pydantic, SQLite
- **AI:** Google Gemini through its REST API (one module: `backend/app/services/ai_service.py`)

## Project structure

```
backend/
  app/
    routes/        HTTP endpoints (earnings, assistant, documents, reference)
    services/      earnings maths, database queries, AI service, prompts, rate limiter
    data/          schemes.json and safety.json (reviewed reference content)
    schemas.py     request/response models and validation limits
    deps.py        device id, database, rate limit dependencies
  tests/           pytest suite
frontend/src/
  pages/           one file per screen
  components/      shared UI and voice button
  lib/             API client, validation, translations, helpers (unit tested)
Dockerfile         one container serves the API and the built frontend
```

## Run it locally

You need Python 3.11+ and Node 20+.

```bash
cp .env.example .env          # then add your GEMINI_API_KEY

# backend
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173
```

For a single-server run, build the frontend (`npm run build` in `frontend/`) and open `http://localhost:8000`, since FastAPI serves `frontend/dist`.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | empty | Needed for AI features. Without it they return a clear "not set up" message. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Change if Google retires the model. |
| `APP_NAME` | `GigSaathi` | Name shown in the app. |
| `DATABASE_PATH` | `backend/gigsaathi.db` | SQLite file location. |
| `APP_TIMEZONE` | `Asia/Kolkata` | Decides what "today" means. |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | AI calls per device per minute. |

## Tests

```bash
cd backend  && pip install -r requirements-dev.txt && pytest     # 59 tests
cd frontend && npm test                                          # 24 tests
cd frontend && npm run typecheck
```

Last run: backend **59 passed**, frontend **24 passed**, TypeScript clean, `npm audit` (production) found 0 vulnerabilities.

The backend tests never call the real Gemini API. They replace the HTTP transport, so they check what this app sends and how it handles replies, outages, rate limits, blocked answers and malformed JSON. They do not prove how Gemini itself answers, so test the AI features with your own key before you demo.

What is covered: earnings maths and the weekly window, low-pay detection, input validation, per-device data isolation, SQL-injection text, the tool-calling loop (the model receives the real stored numbers), AI failure handling, rate limiting, scheme data rules (every scheme needs a source, date and status), security headers, and request-size limits.

## Security and privacy

- API key lives in environment variables and is sent in a request header, never in a URL. `.env` is git-ignored.
- All input is validated with Pydantic (types, ranges, lengths). Documents are capped at 6,000 characters and request bodies at 64 KB.
- Database access is parameterised, and every query is scoped to the caller's device id.
- No accounts. A random id in the browser separates one user's data from another's. Anyone who has that id can read that data, so it is not strong authentication. Add real login before storing anything more sensitive.
- AI endpoints are rate limited per device and across the server.
- Errors shown to users never include stack traces, keys or provider messages.
- Pasted documents and complaint details are sent to Google Gemini and are not stored by this app. Saved complaint drafts stay in the browser.
- Security headers include a content security policy, `nosniff` and frame blocking.
- Document text is wrapped and treated as data in the prompt to resist prompt injection. This reduces the risk but cannot remove it.

## Accessibility

Semantic landmarks and headings, a skip link, labelled form fields with linked hints and errors, focus moved to the first invalid field, visible focus rings, 44 px touch targets, live regions for results, correct `lang` on AI-written text, a table for history, a text version of the daily chart, reduced-motion support, and a navigation that collapses on phones. Colours were chosen for AA text contrast.

## Deployment

The Dockerfile builds the frontend and serves everything from one FastAPI process.

Example for Google Cloud Run:

```bash
echo -n "YOUR_KEY" | gcloud secrets create gemini-api-key --data-file=-
gcloud run deploy gigsaathi --source . --region asia-south1 --allow-unauthenticated \
  --max-instances 1 --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

**Important:** Cloud Run's disk is temporary, so the SQLite database resets when the container restarts, and `--max-instances 1` keeps users on one database. That is fine for a demo, but not for real use. For durable data, host on a service with a persistent disk (for example Render or Fly.io with a volume mounted at `/data`), or move to a managed database.

## Known limitations

- Interface text is translated into English and Hindi only. In other languages the interface stays in English while every AI answer is written in the chosen language. AI translations can contain mistakes.
- Voice input depends on the browser. It works best in Chrome-based browsers and is hidden where unsupported. Support for some Indian languages is limited.
- The scheme file holds six entries. Only the facts listed as verified were checked against a source; everything else is labelled as unverified. It is not a complete directory of schemes, and the rules change.
- Only one device id per browser: clearing browser data means losing access to saved earnings.

## AI usage disclosure

The app uses **Google Gemini** (model set by `GEMINI_MODEL`, default `gemini-3.8-flash`) through the Gemini API for the assistant, document explanations, complaint drafting and "explain in my language" features. No other generative AI service is used inside the app.
