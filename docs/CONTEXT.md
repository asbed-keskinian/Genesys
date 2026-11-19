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
