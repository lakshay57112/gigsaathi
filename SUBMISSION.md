# PromptWars Warm-up: Submission Pack

Fill in the three links once they exist. Nothing below has been invented.

## Checklist: the six submission requirements

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | GitHub repository link submitted | Done | https://github.com/lakshay57112/gigsaathi |
| 2 | Repository is public | Done | Opens without logging in. |
| 3 | Deployed project link submitted | Done | https://gigsaathi-dkku.onrender.com/ |
| 4 | Project description | Done | Text below |
| 5 | GenAI services and where they are used | Done | Text below |
| 6 | Demo video link | **TODO** | Record using the script below, paste URL: `____` |

Before submitting, add your `GEMINI_API_KEY` on the host and test all five AI flows with the real key. The automated tests fake the AI provider, so a live run is the only proof it works end to end.

## Checklist: the six scoring parameters

| Parameter | Where to look |
|---|---|
| Code quality | Small modules by responsibility: `routes/`, `services/`, `schemas.py`, `deps.py`; pure functions for the maths; typed on both sides |
| Problem statement alignment | All five topics in the brief each have a screen: earnings, safety, welfare, documents, grievances, plus multilingual AI |
| Security | README, Security and privacy; tests in `test_ai.py`, `test_reference.py`, `test_earnings_api.py` |
| Efficiency | Scheme lookup uses no AI call; repeat explanations are cached; the summary uses two aggregate SQL queries; one dependency-light container |
| Testing | 59 backend and 24 frontend tests, listed in the README |
| Accessibility | README, Accessibility |

## Project description (paste into the form)

GigSaathi is a mobile-friendly web app for gig and informal workers in India, such as delivery partners, drivers and daily-wage workers. These workers often cannot see what they really earn after costs, struggle to understand platform notices, do not know which welfare schemes exist, and have no easy way to write a complaint. GigSaathi tracks daily earnings and expenses and shows real net pay. Its AI assistant answers questions in the user's chosen Indian language, using their saved numbers instead of guesses. It explains pasted documents in simple words, shows reviewed welfare-scheme information with sources and verification dates, gives practical safety guidance with emergency numbers, and drafts editable complaints that mark any missing facts instead of inventing them.

## GenAI disclosure (paste into the form)

**Service used:** Google Gemini, through the Gemini API. The model is set by the `GEMINI_MODEL` setting; the default is `gemini-3.8-flash`.

**Where it is used in the app:**
1. AI Assistant: answers questions, and calls backend functions to read the user's real earnings and the reviewed scheme list.
2. Document Help: explains pasted text and extracts dates, amounts and next steps.
3. Grievance Drafts: writes the complaint from the facts the user supplies.
4. "Explain simply in my language" buttons on the dashboard, safety and welfare pages.

**Where it is not used:** earnings calculations, the scheme lookup, and the safety content are produced by ordinary code and reviewed data files, not by the model.

## Demo video script (about 2 minutes)

1. **Open on the Dashboard** (empty state): state the problem in one sentence.
2. **Earnings:** add two or three days of entries; show the live net preview and the dashboard updating.
3. **Assistant:** switch the language to Hindi, ask "How much did I earn this week?" and point out that the answer matches the dashboard. Try the mic button.
4. **Document Help:** paste a sample deduction notice, show the dates, amounts and actions, then click *Draft a complaint from this*.
5. **Grievance:** show the prefilled form, generate, edit the text, copy it.
6. **Safety & Welfare:** show the emergency card, choose "Delivery partner" and a state, and open the source and verification labels.
7. Close on Settings: show the AI provider, the privacy notice and the delete-my-data button.

Use made-up sample data in the video. Do not show your API key or real personal documents.
