# Context / handover

Genesys Impact WIP demo for the Oracle NetSuite deal (AE Connor O'Grady, SC Dillon Barclay). Handed over by Faizan Khalid on 19 Nov 2026
for the Fri 20 Nov 10:00 ET workshop. Plan: docs/PLAN.md. Open items: docs/OPEN_ITEMS.md.

## Status
- 19 Nov: SDF project, loader and WIP report written and checked offline (template maths reproduced in tools/wip_check.py); run-of-show drafted
  with placeholder links.
- 19 Nov 14:11: deploy 1 to TD3137966 succeeded (fields, both Suitelets, files). 
- 19 Nov 14:29: deploy 2, loader reads existing GI external IDs in one SuiteQL query and stops cleanly at the 1,000-unit Suitelet limit ("Continue loading"). Load finished in 4 runs.
- 19 Nov 14:55: deploy 3, report shows job no. from the GI-JOB- external ID (this account auto-numbers jobs under the customer: IDs 151-183), strips the customer number/prefix, status filter matches Closed.
- WIP totals verified in the account against the offline calc: contract 19,730,000; earned 13,323,336; billed 12,645,000; under 988,336; over 310,000; loss job 01-00155.

## Account
- Account: **TD3137966** ("Blank US OW v26.2", OneWorld, user's TestDrive). Auth ID `genesys-demo` (an earlier setup pointed at TD3139237 by mistake; re-created). Projects feature enabled and accounting periods created by the user on 19 Nov. Record IDs (also runofshow/ids.json): jobs 01-00044..01-00177 = 254..265 in job order; vendors Westline 252, Keystone 253; labour JEs prior 122, YTD 123; Setup Suitelet script 484, WIP Suitelet script 485. Full config: File Cabinet `SuiteScripts/GenesysDemo/gi_config.json` (copied to runofshow/ids.json).

## Deploy log
| # | Date | What |
|---|---|---|
| 1 | 2026-11-19 | Project fields, GI WIP Schedule and GI Demo Setup Suitelets, jobs.json; manifest declares CRM/ACCOUNTING as optional |
| 2 | 2026-11-19 | Loader: one-query external-ID preload, usage budget with Continue |
| 3 | 2026-11-19 | Report: job no. from external ID, client/description clean-up, status filter |
| 4 | 2026-11-19 | Report: rows sorted by job no. |

## Status at end of 19 Nov
- Account reset to starting figures (19,730,000 / 13,323,336 / 12,645,000 / 988,336 / 310,000); ready for the demo. Run-of-show: runofshow/genesys-run-of-show.html.

## Rehearsal, 19 Nov (Claude, in the built-in browser)
- Ran every live step: Westline bill $180,000 on 01-00177, pay app $350,000 on 01-00152, estimate 905,000 -> 1,010,000 on 01-00170, refresh, drill-down, year-end view, CSV export, WIP JE. All figures matched the run-of-show.
- Account quirks found: no locations existed, so created **Genesys HQ (DEMO)** (location id 1007); the SkyHop bill form needs Location on the header and on every expense line (client-script alert); invoices need header Location. Line Customer is a dropdown (pick from list).
- Customer "Allow Override" (ticked by the user in Auto-Generated Numbers) let Reset set job IDs to 01-00044..01-00177 on the records too.
- Project Management is off in this account (record is "Job", no profitability subtab), so 3.9 is Described.
- Reset after rehearsal: deleted the bill, invoice and WIP JE (+ its auto-reversal), restored 01-00170; totals back to 19,730,000 / 13,323,336 / 12,645,000 / 988,336 / 310,000.
- Code from the rehearsal (deploy 5): WIP JE reverses on the 1st of next month (was next day); report table placed below the filters (full width); Reset reports auto-reversals as already removed.
| 5 | 2026-11-19 | WIP JE reverses 1st of next month; report table full width below filters; Reset notes auto-reversals. Verified in account, then Reset. |
| 6 | 2026-11-19 | Report note: loss recognition worded "under US GAAP" (was ASC 606). Deployed and checked in the account. |
| 7 | 2026-11-19 | WIP JE button: clicking again for the same date replaces the journal and its reversal with the latest figures. Tested (01-00170 line 191,546.96 -> 104,059.41 after estimate change), then Reset. |
