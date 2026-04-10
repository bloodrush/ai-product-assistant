# Discovery Tool

A browser-based AI assistant that guides Product Owners and Business Analysts through a structured product discovery process — from a rough idea to a validated, well-defined problem statement.

The AI drives the conversation. The user responds. No forms, no templates, no hand-holding.

---

## What it does

Discovery Tool runs a structured, multi-phase discovery process powered by Claude. In each session, the AI guides the user through a set of rigorous questions, pushes back on vague or solution-shaped thinking, and produces a clean, copyable output at the end of each phase.

**Phase 1 — Understand the Problem** (current)
Six steps: reflect on the context, find the real problem, map affected parties, define must-haves, identify no-goes, describe what good looks like. Ends with a structured output card.

**Phases 2–5** (roadmap — see below)

---

## Architecture

```
src/
├── components/
│   ├── ChatWindow.jsx       # Message list, scroll management, loading state
│   ├── ChatInput.jsx        # Textarea input with auto-resize and keyboard handling
│   ├── MessageBubble.jsx    # Renders user and assistant messages
│   ├── OutputCard.jsx       # Parses and renders the structured Phase output
│   └── PhaseIndicator.jsx   # Visual progress tracker across all phases
├── hooks/
│   └── useConversation.js   # All conversation state and API orchestration
├── lib/
│   ├── api.js               # Claude API client (fetch wrapper)
│   └── systemPrompt.js      # Hardcoded system prompt encoding all phase logic
├── styles/
│   └── main.css             # Design tokens, layout, component styles
├── App.jsx                  # Root layout component
└── main.jsx                 # React entry point
```

**Key design decisions:**

- **No framework beyond React.** No Redux, no React Query, no router. The app is a single-session, single-page tool. Complexity is intentionally deferred.
- **All logic lives in the system prompt.** `systemPrompt.js` is the product brain. Changing the discovery flow means changing this file — no scattered logic across components.
- **Conversation history in JS state.** The full message history is passed to the API on every request. Claude has complete context throughout the session. This is the simplest correct approach for v1 — persistence comes later.
- **Output card is parsed from AI output.** The AI is instructed to wrap its Phase output in `<output-card>` tags. The `OutputCard` component strips these, renders the content, and provides one-click copy. This keeps the AI in control of content while giving the UI a reliable parsing target.

---

## Setup

**Prerequisites:** Node.js 18+, a Claude API key from [console.anthropic.com](https://console.anthropic.com)

```bash
git clone https://github.com/your-username/discovery-tool
cd discovery-tool
npm install
cp .env.example .env
# Add your API key to .env
npm run dev
```

Open `http://localhost:5173`.

**Environment variables:**

| Variable | Description |
|---|---|
| `VITE_ANTHROPIC_API_KEY` | Your Anthropic API key. Required. |

---

## Deployment

The project is configured for [Vercel](https://vercel.com). Connect the GitHub repository in Vercel, add `VITE_ANTHROPIC_API_KEY` as an environment variable, and deploy. The `vercel.json` handles routing.

```bash
npm run build   # Build for production
npm run preview # Preview production build locally
```

---

## Roadmap

This is v1. The architecture is deliberately minimal — the goal is a working, well-structured foundation that can grow cleanly.

**Short term**
- [ ] Phase 2 — Validate the Problem (is this the right thing to build?)
- [ ] Phase 3 — Define the Solution (shape and scope)
- [ ] Phase 4 — Write the Stories (dev-ready output)
- [ ] Phase 5 — Launch Prep

**Medium term**
- [ ] User accounts and session persistence (Supabase or similar)
- [ ] Per-user system prompt customisation (role, domain, team context)
- [ ] Export to PDF, Confluence, Jira
- [ ] Session history and the ability to resume or branch

**Longer term**
- [ ] Backend proxy for API calls (removes key exposure, enables rate limiting and logging)
- [ ] Users connect their own Claude accounts
- [ ] Team workspaces and shared sessions

---

## Notes on v1 constraints

**The API key is client-side.** In v1, the Anthropic API key is stored as a Vite environment variable and included in the browser bundle. This is acceptable for a controlled early deployment but is not production-safe at scale. The roadmap item to add a backend proxy resolves this.

**No session persistence.** Refreshing the page starts a new session. Conversation history lives in React state only.

**One user configuration.** The system prompt is hardcoded. All users run the same flow.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | Standard, Vercel-native, component model ready for growth |
| Styling | Vanilla CSS with custom properties | No Tailwind — full design control, no build-time dependencies |
| AI | Claude (claude-sonnet-4-20250514) | Via direct fetch to Anthropic API |
| Deployment | Vercel | GitHub integration, env var management, zero config |
| Language | JavaScript (ES modules) | TypeScript migration straightforward when team grows |
