# Open items

## Before the demo (Thu 19 Nov)
- [x] Account: TD3137966 (user's TestDrive); Projects enabled, periods created
- [x] Account checks: OneWorld (default subsidiary used), last year's periods open, bills/JEs/invoices post without approval; jobs are auto-numbered under the customer (report uses the GI-JOB external ID)
- [x] Client column shows the GC
- [x] project.nl and projects.nl (Jobs list) confirmed
- [x] Deploy 4: WIP rows sorted by job no.
- [x] Deploy 1
- [x] Load, totals checked, runofshow/ids.json written, run-of-show rebuilt with live links
- [x] Screenshots (8) in runofshow/shots with captions in shots.json
- [x] Rehearsed segments 1-3 end to end, then Reset (see CONTEXT.md)
- [x] Deploy 5: verified full-width report layout and JE reversal 1 Dec (test JE posted, then Reset); screenshots 3_1 and 3_8 retaken
- [ ] Before the demo: open GI Demo Setup, Reset preview should be empty; present the report full-screen
- [ ] Email Dillon (draft in docs/PLAN.md section 7); confirm handoff point and slot length (60 vs 90 min)
- [x] GitHub: asbed-keskinian/Genesys

## Decisions / notes
- Prior-years revenue is computed from cost at prior year-end x current estimate (template carries last year's figures); say so if asked
- Loss jobs are flagged, no loss provision posted
- No pricing in our segment
- Only one NetSuite session per user: stay signed in to TD3137966 in one browser during the demo (signing in elsewhere logs the other session out)

## After the demo (Fri 20 Nov) - WIP scope only
Demo held 20 Nov 10:00 ET (Granola: https://notes.granola.ai/d/3295a8e0-3ead-4a15-b83e-9170d7af1f77). Dillon was out sick; we covered the WIP piece. Project management, budgets / quoting and estimating, change orders, procurement, inventory, T&M and MSP billing are Oracle's (Dillon, interactive session Tue 24 Nov, 4-5 PM, backup 12-1).
- [ ] Retainage (committed on the call, "a couple of hours"): retention % column on each line of bills and invoices (10% default, often steps down to 8% / 5%); on save each line splits into a retainage receivable / retainage payable GL account; AR revenue stays at the full amount; release of retainage near the end of the job. Need from client: the retainage accounts and whether every line always splits.
- [ ] WIP and retainage: decide whether JTD billings include retainage held, so over/under billing stays correct
- [ ] Estimate source: once Oracle shows the native project budget, have the WIP read estimated cost from it instead of the custom Estimated Total Cost field
- [ ] Configurable WIP formulas: client may send a second template with more formulas; offered to make formulas editable (with guards against divide-by-zero etc.)
- [ ] Lock contract value and estimate once a job is In Progress, with an override checkbox for a named person (offered on the call)
- [ ] Job cost to GL reconciliation: client asked how; showed the drill-down, offered additional GL reports
- [ ] For Faizan's estimate: on the call we said retainage is a couple of hours, customisations are included with no upcharge, timeline 4-5 months
- Note: the WIP JE posted on the call was as of 12/31/2026, so it reversed 1/1/2027 (1st of the next month); behaviour is correct
