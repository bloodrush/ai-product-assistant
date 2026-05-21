export const SAMPLE_OUTPUTS = {
  1: `Here's your Phase 1 output.

<output-card>
**Problem**
Field sales reps have no visibility into which customer accounts are at risk of churn between quarterly business reviews. By the time attrition signals surface in CRM reports, the account has already disengaged — and recovery is costly or impossible.

**Who is affected**
- Sales reps: spend time on reactive firefighting instead of proactive outreach; miss renewal targets without warning
- Account managers: lack a shared signal to trigger early intervention conversations with customers
- Revenue operations: unable to forecast churn risk accurately because leading indicators aren't captured in the current toolset
- End customers: receive outreach that feels too late or misaligned with their actual concerns

**Must-haves**
- Surface at-risk accounts before the renewal window opens (at least 60 days prior)
- Work with data already in Salesforce — no new data entry burden on reps
- Alert the right rep, not just a manager; reps must be able to act on the signal directly

**No-goes**
- Cannot store customer usage data outside the existing data residency boundaries (EU data must stay EU)
- Must not replace or duplicate the existing QBR process — this is an early-warning layer, not a reporting replacement
- No manual scoring by managers; the signal must be algorithmic to scale

**What good looks like**
Today, a rep finds out an account is at risk when the customer stops responding to emails or misses a check-in — weeks before renewal. With this solved, the rep sees a risk flag in their Salesforce queue 90 days out, reaches out with a targeted message, and the account renews without escalation. Account managers spend their energy on high-value relationships, not damage control.
</output-card>

This is your Phase 1 output. You can use this in your documentation.`,

  2: `Here's your Phase 2 output.

PHASE 2 OUTPUT — SOLUTION BRIEF

Solution
A Salesforce-native churn risk indicator that scores open accounts weekly using existing CRM activity signals (email response rate, meeting cadence, support ticket volume, last login date) and surfaces high-risk accounts in a prioritised rep queue. No new data sources. No external tools. Reps see a risk score and a one-line reason directly in their existing account view.

In scope
- Weekly risk score calculation for all accounts with an active contract and renewal within 12 months
- Risk tier labels (High / Medium / Low) visible on the Account record in Salesforce
- A "My at-risk accounts" list view filtered to the logged-in rep's portfolio
- A plain-language reason for the score (e.g. "No meeting logged in 45 days, 3 open support tickets")
- Email alert to rep when an account moves from Medium to High risk

Out of scope
- Mobile push notifications (no mobile Salesforce app currently in use — future consideration)
- Manager dashboard / roll-up view (separate initiative owned by RevOps, not this release)
- Integration with product usage telemetry (data access not yet approved — Phase 2 of the roadmap)

Constraints
- Technical: Must be built using Salesforce Flow and standard objects; no custom Apex unless absolutely necessary — platform team constraint
- Data residency: EU accounts must be scored using EU-region Salesforce instance only
- Business: Cannot change how reps log activities — adoption of the score depends on zero additional data entry
- Design: Must conform to existing Salesforce Lightning component standards; no custom UI frameworks

Open questions
- Who owns the scoring logic long-term — RevOps or the platform team? (Owner: VP RevOps, answer needed before build starts — blocker)
- What is the threshold for "High" vs "Medium" risk? Needs calibration against historical churn data. (Owner: Revenue Analytics, can be resolved in parallel with story writing)`,

  3: `Here's your Phase 3 output.

PHASE 3 OUTPUT — SOLUTION SPEC

Prototype validated: Yes (usability test with 4 reps, 2 account managers — 12 May)

Validated solution
A Salesforce Lightning component embedded on the Account record page that displays a weekly-refreshed churn risk score, a risk tier badge (High / Medium / Low), and a human-readable reason string. A companion list view ("My At-Risk Accounts") is pinned to the rep's Salesforce nav. A Salesforce Flow sends an email alert when an account crosses from Medium to High.

Scoring model (validated)
Composite score from 4 signals, equally weighted in v1:
1. Days since last logged meeting (threshold: >30 days = risk signal)
2. Email open rate on last 3 automated sequences (threshold: <20% = risk signal)
3. Open support tickets older than 14 days (threshold: ≥2 = risk signal)
4. Days since last activity of any kind (threshold: >21 days = risk signal)

Score tiers: 0 signals = Low, 1–2 = Medium, 3–4 = High

Prototype changes incorporated
- Removed "confidence %" display — reps found it confusing and distracting
- Reason string capped at one sentence per signal (originally showed all 4; reps only acted on the top reason)
- "My At-Risk Accounts" list view sorts by renewal date ascending, not by score — reps said time-sensitivity mattered more than score magnitude

Out of scope (confirmed)
- Mobile alerts: confirmed out, no appetite from reps in testing
- Manager rollup: confirmed out, RevOps to own separately

Open questions resolved
- Scoring threshold ownership: RevOps will own and tune after 90-day pilot
- High/Medium threshold calibrated: 3+ signals = High (confirmed with Revenue Analytics against 18 months of historical data)

Remaining unknowns
- None blocking story writing`,

  4: `Here's your Phase 4 output.

PHASE 4 OUTPUT — USER STORIES

Story map summary
Epic: Churn Risk Indicator — Salesforce MVP

EPIC 1: Risk Scoring Engine
Story 1.1 — Weekly score calculation (M)
As RevOps, I want the system to calculate a churn risk score for every active account weekly, so that risk data is always current without manual intervention.
Acceptance: Score recalculates every Monday 06:00 UTC. Covers all accounts with contract end date within 12 months. Uses the 4 approved signals. Logs score history (last 12 weeks retained).

Story 1.2 — Signal data fetch (S)
As the system, I need to read meeting logs, email open rates, support ticket counts, and last-activity dates from existing Salesforce objects, so that scoring has accurate inputs.
Acceptance: Reads from Task, Event, EmailMessage, Case standard objects only. Falls back gracefully if a signal is unavailable (score calculated on remaining signals, reason string notes the gap). EU accounts use EU-region instance.

EPIC 2: Account Record Display
Story 2.1 — Risk badge on Account record (M)
As a sales rep, I want to see a risk tier badge (High / Medium / Low) and a one-line reason on the Account record, so that I can quickly assess account health without leaving my workflow.
Acceptance: Badge renders in Account page layout (Lightning component). Colour-coded: red = High, amber = Medium, green = Low. Reason string ≤ 120 characters. Visible to reps and account managers; hidden from customer-facing portal views.

Story 2.2 — Risk badge null state (S)
As a sales rep, I want accounts with insufficient data to show a neutral "Not enough data" state, so that I'm not misled by a score based on incomplete signals.
Acceptance: Accounts with fewer than 2 scoreable signals show "Not enough data" badge (grey). Tooltip explains what data is missing.

EPIC 3: At-Risk List View
Story 3.1 — My At-Risk Accounts list view (M)
As a sales rep, I want a Salesforce list view that shows only my High and Medium risk accounts sorted by renewal date, so that I can prioritise outreach efficiently.
Acceptance: List view filtered to logged-in rep's accounts. Columns: Account name, Risk tier, Renewal date, Primary reason, Days since last activity. Sorted by renewal date ascending. Excludes Low risk accounts.

EPIC 4: Alerting
Story 4.1 — Medium-to-High escalation email (S)
As a sales rep, I want an email alert when one of my accounts moves from Medium to High risk, so that I can act before the signal deteriorates further.
Acceptance: Email sent within 1 hour of score recalculation that triggers the tier change. Email contains: account name, renewal date, reason string, link to account record. Sent to the account owner only (not manager). Plain-text email; no HTML template required for v1.

Dependencies
- Story 1.2 must complete before 2.1 and 3.1
- Story 2.1 must complete before 2.2
- Story 1.1 and 1.2 can run in parallel

Sizing key: S = 1–2 days, M = 3–5 days, L = 6–10 days, XL = 10+ days`,

  5: `Here's your Phase 5 output.

PHASE 5 OUTPUT — LAUNCH ARTIFACTS

RELEASE NOTES (Internal / Stakeholder)
Churn Risk Indicator — Salesforce MVP
Release date: [TBD]
Audience: Sales, Account Management, Revenue Operations

What's new
Salesforce now shows a weekly-refreshed churn risk score on every active account record. Accounts are categorised as High, Medium, or Low risk based on four signals: meeting cadence, email engagement, open support tickets, and days since last activity.

Sales reps also have a new "My At-Risk Accounts" list view that surfaces High and Medium risk accounts sorted by upcoming renewal date. An automatic email alert fires when an account moves from Medium to High risk.

What this replaces
Nothing is removed. This is an additive layer on top of existing Salesforce workflows and does not change how reps log activities or run QBRs.

Known limitations in v1
- Mobile alerts are not included
- Manager roll-up views are not included (separate initiative)
- Accounts with fewer than 2 scoreable signals show "Not enough data" rather than a score

---

SLACK ANNOUNCEMENT (Draft — #sales-all)
Hey team — we've just shipped something that should make your renewal conversations a lot less reactive.

Starting this week, every active account in Salesforce now has a churn risk score — High, Medium, or Low — calculated weekly from signals already in the system (meetings, emails, support tickets, last activity). No new data entry required on your end.

You'll also find a new list view in Salesforce: "My At-Risk Accounts." It shows your High and Medium risk accounts sorted by renewal date so you know exactly where to focus.

If an account jumps from Medium to High, you'll get an email alert automatically.

Check your accounts and let us know if anything looks off. Questions? Drop them in #revenue-ops.

---

USER DOCUMENTATION (Help article — internal wiki)

Churn Risk Indicator — How It Works

Overview
The churn risk indicator gives you a weekly snapshot of account health based on CRM activity data. It is designed to help you prioritise proactive outreach before renewal conversations become difficult.

Where to find it
- On any Account record: look for the Risk Tier badge near the top of the page (High = red, Medium = amber, Low = green)
- In your Salesforce nav: "My At-Risk Accounts" list view

How the score is calculated
The score uses four signals from your existing activity data:
1. Days since last logged meeting
2. Email open rate on recent sequences
3. Number of open support tickets older than 14 days
4. Days since any activity was logged

Each signal is weighted equally. Accounts with 3 or 4 active risk signals are rated High; 1–2 signals are Medium; 0 signals are Low.

What "Not enough data" means
If an account has fewer than 2 scoreable signals (e.g. a very new account with little activity history), it will show "Not enough data" in grey. This is not a risk signal — it simply means the system doesn't have enough to calculate a reliable score yet.

Email alerts
You will receive an email when one of your accounts moves from Medium to High risk. The email includes the account name, renewal date, primary risk reason, and a direct link to the account record.

Limitations
- Scores refresh weekly (every Monday morning). Intraweek activity changes will be reflected in the next cycle.
- Manager rollup views are not available in this release.
- Mobile push alerts are not available in this release.`,
}
