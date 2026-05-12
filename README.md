# FORG

A browser-based AI assistant that guides Product Owners and Business Analysts through a structured product discovery process — from a rough idea to a ready-to-ship story set and launch artifacts.

The AI drives the conversation. The user responds. No forms, no templates, no hand-holding.

---

## What it does

FORG runs a structured, five-phase discovery process powered by Claude. In each phase the AI guides the user through a focused set of questions, pushes back on vague or solution-shaped thinking, and produces a clean, copyable output card at the end.

**Phase 1 — Understand the Problem**
Six steps: reflect on the context, find the real problem, map affected parties, define must-haves, identify no-goes, describe what good looks like. Ends with a structured output card.

**Phase 2 — Validate the Problem**
Carries the problem statement forward and pressure-tests it. Scopes the solution: what's in, what's out, what the constraints are, and what open questions need owners before build begins.

**Phase 3 — Forge the Solution**
Two halves: design the prototype concept, then capture validation findings. Produces a concrete, validated solution spec.

**Phase 4 — Write the Stories**
Breaks the solution into a dev-ready story set — sequenced, structured, and specific enough to hand straight to a developer.

**Phase 5 — Launch Prep**
Generates communication artifacts: release notes, a Slack announcement, and/or user documentation. The user picks what they need.

---

## Architecture

```
src/
├── components/
│   ├── ChatWindow.jsx       # Message list, scroll management, loading state
│   ├── ChatInput.jsx        # Auto-resizing textarea, keyboard handling
│   ├── MessageBubble.jsx    # Renders user and assistant messages
│   ├── OutputCard.jsx       # Parses and renders structured phase output
│   ├── PhaseSidebar.jsx     # Phase navigation, theme selector, collapse toggle
│   └── DocPanel.jsx         # Outcome tracker, copy, PDF export
├── hooks/
│   └── useConversation.js   # Conversation state and API orchestration
├── lib/
│   ├── api.js               # Claude API client with prompt caching
│   └── prompts/
│       ├── phase1.js        # System prompt: Understand the Problem
│       ├── phase2.js        # System prompt: Validate the Problem
│       ├── phase3.js        # System prompt: Forge the Solution
│       ├── phase4.js        # System prompt: Write the Stories
│       └── phase5.js        # System prompt: Launch Prep
├── styles/
│   └── main.css             # Design tokens, three colour themes, layout
├── App.jsx                  # Root layout, preferences management
└── main.jsx                 # React entry point
```

**Key design decisions:**

- **No framework beyond React.** No Redux, no React Query, no router. Single-session, single-page tool. Complexity is intentionally deferred.
- **Logic lives in the phase prompts.** Each phase is a self-contained system prompt. Changing the discovery flow means changing that file — no logic scattered across components.
- **Phase prompts are cached.** System prompts are sent with `cache_control: ephemeral` to reduce token cost on repeated turns within a session.
- **Dev/prod model split.** Development uses `claude-haiku-4-5-20251001` (fast, cheap). Production uses `claude-sonnet-4-20250514` (higher quality). Controlled via `VITE_APP_ENV`.
- **Conversation history in JS state.** Full message history is passed to the API on every request. Claude has complete context. No persistence in v1 — refreshing starts a new session.
- **Output cards parsed from AI output.** The AI wraps phase output in `<output-card>` tags. `OutputCard` strips the tags, renders the content, and provides one-click copy. The AI controls content; the UI has a reliable parsing target.

---

## Setup

**Prerequisites:** Node.js 18+, a Claude API key from [console.anthropic.com](https://console.anthropic.com)

```bash
git clone <repo-url>
cd <repo>
npm install
cp .env.example .env
# Add your API key to .env
npm run dev
```

Open `http://localhost:5173`.

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (server-side only) |
| `SHARED_PASSWORD` | Yes | Password shown to users on first load |
| `APP_ENV` | No | Set to `production` to use Sonnet. Omit for Haiku (dev). |

---

## Deployment

The project is configured for [Vercel](https://vercel.com). Connect the GitHub repository, add `ANTHROPIC_API_KEY`, `SHARED_PASSWORD`, and `APP_ENV=production` as environment variables, and deploy.

```bash
npm run build   # Build for production
npm run preview # Preview production build locally
```

---

## UI features

- **Three colour themes** — Dark (default), Light, and Slate — switchable from the sidebar. Theme preference is persisted in `localStorage`.
- **Collapsible sidebar** — frees up horizontal space on smaller screens. Collapse state is persisted.
- **Outcome panel** — right-hand panel tracks phase outputs as they are produced, with one-click copy and PDF export.
- **Typing indicator** — three-dot animation while waiting for the API response.

---

## Constraints (v1)

**The API key is client-side.** The Anthropic API key lives in the browser bundle. Acceptable for a controlled early deployment; not production-safe at scale. A backend proxy is the correct fix.

**No session persistence.** Refreshing the page starts a new session. Conversation history lives in React state only.

**No authentication.** Single-user tool. No accounts, no access control.

---

## Roadmap

**Short term**
- [ ] Refine and test Phases 2–5 through real sessions
- [ ] Session persistence (localStorage or lightweight backend)
- [ ] Backend proxy for API calls (removes key from browser bundle)

**Medium term**
- [ ] User accounts and session history
- [ ] Per-user system prompt customisation (role, domain, team context)
- [ ] Export to Confluence, Jira, PDF

**Longer term**
- [ ] Team workspaces and shared sessions
- [ ] Users connect their own Claude accounts

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | Standard, Vercel-native |
| Styling | Vanilla CSS with custom properties | Three themed palettes, no build-time dependencies |
| AI | Claude via Anthropic API | Prompt caching, dev/prod model split |
| Deployment | Vercel | GitHub integration, env var management |
| Language | JavaScript (ES modules) | TypeScript migration straightforward when team grows |
