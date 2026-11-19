# Genesys Impact - NetSuite WIP demo (Meadowport)

Generic WIP demo for Genesys Impact (Oracle NetSuite deal, Connor O'Grady / Dillon Barclay), Fri 20 Nov 2026.
Plan and running order: `docs/PLAN.md`. Handover (record IDs, URLs, status): `docs/CONTEXT.md` once built.

- `sdf/` SuiteCloud project (auth ID `genesys-demo`): 4 project fields, `GI WIP Schedule` Suitelet, `GI Demo Setup` Suitelet (load / reset)
- `sdf/src/FileCabinet/SuiteScripts/GenesysDemo/data/jobs.json` the 12 dummy jobs
- `tools/wip_check.py` recomputes the template columns from jobs.json (expected numbers after Load)

Deploy: `cd sdf && suitecloud account:setup` (once, auth ID genesys-demo) then `suitecloud project:deploy`.
Then open GI Demo Setup -> Load demo data -> Open the WIP schedule. After the demo: Reset after demo -> Confirm.
