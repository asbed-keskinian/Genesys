# Context / handover

Genesys Impact WIP demo for the Oracle NetSuite deal (AE Connor O'Grady, SC Dillon Barclay). Handed over by Faizan Khalid on 19 Nov 2026
for the Fri 20 Nov 10:00 ET workshop. Plan: docs/PLAN.md. Open items: docs/OPEN_ITEMS.md.

## Status
- 19 Nov: SDF project, loader and WIP report written and checked offline (template maths reproduced in tools/wip_check.py); run-of-show drafted
  with placeholder links.
- 19 Nov 14:11: deploy 1 to TD3137966 succeeded (fields, both Suitelets, files). Next: load data from GI Demo Setup.

## Account
- Account: **TD3137966** ("Blank US OW v26.2", OneWorld, user's TestDrive). Auth ID `genesys-demo` (an earlier setup pointed at TD3139237 by mistake; re-created). Projects feature enabled and accounting periods created by the user on 19 Nov. Record IDs: see the File Cabinet `SuiteScripts/GenesysDemo/gi_config.json` (copied to runofshow/ids.json).

## Deploy log
| # | Date | What |
|---|---|---|
| 1 | 2026-11-19 | Project fields, GI WIP Schedule and GI Demo Setup Suitelets, jobs.json; manifest declares CRM/ACCOUNTING as optional |
